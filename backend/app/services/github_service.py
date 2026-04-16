"""
GitHub API Service — MSTool-AI-QMS.

Reads the MSTool-AI repository via GitHub API instead of local filesystem.
This allows the QMS backend to run in Cloud Run without local repo access.
"""

import logging
import base64
import time
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, timezone

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Module-level cache: {cache_key: (data, expire_timestamp)}
_cache: Dict[str, Tuple[Any, float]] = {}
CACHE_TTL = 300  # 5 minutes


class GitHubService:
    """Read MSTool-AI repo via GitHub REST API with in-memory cache."""

    BASE_URL = "https://api.github.com"

    def __init__(self):
        self.repo = settings.GITHUB_REPO
        self.token = settings.GITHUB_TOKEN
        self.headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        if self.token:
            self.headers["Authorization"] = f"Bearer {self.token}"

    def _url(self, path: str) -> str:
        return f"{self.BASE_URL}/repos/{self.repo}/{path}"

    def _get(self, path: str, params: dict = None) -> Any:
        """Make authenticated GET request with cache."""
        cache_key = f"{path}:{params}"
        now = time.time()

        # Check cache
        if cache_key in _cache:
            data, expires = _cache[cache_key]
            if now < expires:
                return data

        # Fetch from GitHub
        with httpx.Client(timeout=30) as client:
            resp = client.get(self._url(path), headers=self.headers, params=params)
            if resp.status_code == 404:
                _cache[cache_key] = (None, now + CACHE_TTL)
                return None
            resp.raise_for_status()
            result = resp.json()

        _cache[cache_key] = (result, now + CACHE_TTL)
        return result

    # ─── File operations ───

    def get_file_content(self, file_path: str) -> Optional[str]:
        """Read a file's content from the repo."""
        data = self._get(f"contents/{file_path}")
        if not data or data.get("type") != "file":
            return None
        content_b64 = data.get("content", "")
        return base64.b64decode(content_b64).decode("utf-8")

    def list_directory(self, dir_path: str) -> List[Dict[str, Any]]:
        """List files in a directory."""
        data = self._get(f"contents/{dir_path}")
        if not data or not isinstance(data, list):
            return []
        return [
            {
                "name": item["name"],
                "path": item["path"],
                "type": item["type"],  # "file" or "dir"
                "size": item.get("size", 0),
            }
            for item in data
        ]

    def file_exists(self, file_path: str) -> bool:
        """Check if a file exists in the repo."""
        data = self._get(f"contents/{file_path}")
        return data is not None

    def get_file_lines(self, file_path: str) -> Optional[List[str]]:
        """Get file content split into indexed lines."""
        content = self.get_file_content(file_path)
        if content is None:
            return None
        return content.split('\n')

    def search_in_file(self, file_path: str, pattern: str, context: int = 3) -> List[Dict[str, Any]]:
        """Search for a regex pattern in a file and return matching lines with context and GitHub URLs."""
        import re
        lines = self.get_file_lines(file_path)
        if not lines:
            return []

        github_base = f"https://github.com/{self.repo}/blob/main"
        matches = []

        for i, line in enumerate(lines):
            if re.search(pattern, line):
                # Get context lines
                start = max(0, i - context)
                end = min(len(lines), i + context + 1)
                snippet_lines = [
                    {"number": j + 1, "text": lines[j], "highlighted": j == i}
                    for j in range(start, end)
                ]
                matches.append({
                    "line_number": i + 1,
                    "text": line.strip(),
                    "github_url": f"{github_base}/{file_path}#L{i + 1}",
                    "snippet": snippet_lines,
                })

        return matches

    def get_code_snippet(self, file_path: str, line_start: int, line_end: int) -> Dict[str, Any]:
        """Get a specific range of lines from a file."""
        lines = self.get_file_lines(file_path)
        if not lines:
            return {"lines": [], "github_url": ""}

        github_base = f"https://github.com/{self.repo}/blob/main"
        start = max(0, line_start - 1)
        end = min(len(lines), line_end)

        return {
            "lines": [{"number": i + 1, "text": lines[i], "highlighted": False} for i in range(start, end)],
            "github_url": f"{github_base}/{file_path}#L{line_start}-L{line_end}",
            "file": file_path,
        }

    def list_files_recursive(self, dir_path: str, extension: str = ".md") -> List[Dict[str, Any]]:
        """List all files with given extension in a directory (non-recursive via tree API)."""
        # Use Git Trees API for efficient recursive listing
        data = self._get("git/trees/main", params={"recursive": "1"})
        if not data or "tree" not in data:
            return []

        results = []
        for item in data["tree"]:
            if item["type"] == "blob" and item["path"].startswith(dir_path) and item["path"].endswith(extension):
                results.append({
                    "name": item["path"].split("/")[-1],
                    "path": item["path"],
                    "size": item.get("size", 0),
                })
        return results

    # ─── Commit & PR data ───

    def get_recent_commits(self, count: int = 30) -> List[Dict[str, Any]]:
        """Get recent commits."""
        data = self._get("commits", params={"per_page": count})
        if not data:
            return []
        return [
            {
                "sha": c["sha"][:7],
                "message": c["commit"]["message"].split("\n")[0],
                "author": c["commit"]["author"]["name"],
                "date": c["commit"]["author"]["date"],
            }
            for c in data
        ]

    def get_file_last_commit(self, file_path: str) -> Optional[Dict[str, Any]]:
        """Get the most recent commit that touched a specific file (ISO 13485 §4.2.4 traceability)."""
        data = self._get("commits", params={"path": file_path, "per_page": 1})
        if not data or not isinstance(data, list) or len(data) == 0:
            return None
        c = data[0]
        return {
            "sha": c["sha"][:7],
            "message": c["commit"]["message"].split("\n")[0],
            "author": c["commit"]["author"]["name"],
            "date": c["commit"]["author"]["date"],
            "github_url": f"https://github.com/{self.repo}/commit/{c['sha']}",
        }

    def get_pull_requests(self, state: str = "all", count: int = 30) -> List[Dict[str, Any]]:
        """Get pull requests."""
        data = self._get("pulls", params={"state": state, "per_page": count})
        if not data:
            return []
        return [
            {
                "number": pr["number"],
                "title": pr["title"],
                "state": pr["state"],
                "author": pr["user"]["login"],
                "created_at": pr["created_at"],
                "merged_at": pr.get("merged_at"),
            }
            for pr in data
        ]

    def get_ci_runs(self, count: int = 10) -> List[Dict[str, Any]]:
        """Get recent CI workflow runs."""
        data = self._get("actions/runs", params={"per_page": count})
        if not data or "workflow_runs" not in data:
            return []
        return [
            {
                "id": run["id"],
                "name": run["name"],
                "status": run["status"],
                "conclusion": run.get("conclusion"),
                "created_at": run["created_at"],
                "head_sha": run["head_sha"][:7],
            }
            for run in data["workflow_runs"]
        ]

    def get_repo_info(self) -> Dict[str, Any]:
        """Get basic repo info."""
        data = self._get("")
        if not data:
            return {}
        return {
            "full_name": data["full_name"],
            "default_branch": data["default_branch"],
            "visibility": data["visibility"],
            "updated_at": data["updated_at"],
            "language": data["language"],
            "size": data["size"],
        }
