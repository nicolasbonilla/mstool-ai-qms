"""
Agent Skills loader — Anthropic Agent Skills pattern.

Each Skill is a folder with a SKILL.md describing its purpose and one or
more reference files. Agents lazy-load the relevant Skill(s) into their
system prompt by calling `load_skill('iec62304')`.

Reference: Anthropic Engineering blog "Equipping agents for the real
world with Agent Skills" (2025).
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, List

SKILLS_DIR = Path(__file__).parent


@lru_cache(maxsize=64)
def load_skill(skill_name: str, max_chars: int = 8000) -> str:
    """Concatenate every .md file in the named Skill folder into one string.

    Cached because Skill content is immutable per deployment. The cache key
    is (skill_name, max_chars) so different agents asking for different
    truncation budgets each get their own slice.
    """
    folder = SKILLS_DIR / skill_name
    if not folder.exists() or not folder.is_dir():
        return f"[Skill '{skill_name}' not available]"

    chunks: List[str] = []
    for md_file in sorted(folder.glob("*.md")):
        try:
            text = md_file.read_text(encoding="utf-8")
            chunks.append(f"--- BEGIN {md_file.name} ---\n{text}\n--- END {md_file.name} ---\n")
        except Exception:
            continue

    full = "\n".join(chunks)
    if len(full) <= max_chars:
        return full
    return full[:max_chars] + "\n[Skill content truncated]"


def list_available_skills() -> List[Dict]:
    """For a future /agents/skills endpoint or UI listing."""
    out = []
    for entry in SKILLS_DIR.iterdir():
        if entry.is_dir() and not entry.name.startswith("_"):
            files = [p.name for p in entry.glob("*.md")]
            skill_md = entry / "SKILL.md"
            description = ""
            if skill_md.exists():
                # First markdown paragraph after the heading
                text = skill_md.read_text(encoding="utf-8")
                lines = [l for l in text.split("\n") if l.strip() and not l.startswith("#")]
                description = lines[0] if lines else ""
            out.append({
                "name": entry.name,
                "description": description,
                "files": files,
            })
    return out
