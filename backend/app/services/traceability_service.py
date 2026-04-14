"""
Traceability Service — MSTool-AI-QMS.

Parses the MSTool-AI repository via GitHub API to build a real
requirements-to-evidence traceability graph.

REQ → ARCH → CODE → TEST
REQ → RISK_CONTROL
"""

import re
import logging
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from app.services.github_service import GitHubService

logger = logging.getLogger(__name__)


class TraceabilityService:
    """Build traceability graph from MSTool-AI repository."""

    def __init__(self):
        self.github = GitHubService()

    def build_graph(self) -> Dict[str, Any]:
        """Build the complete traceability graph."""
        nodes = []
        edges = []
        node_ids = set()

        # 1. Parse requirements
        reqs = self._parse_requirements()
        for req in reqs:
            nodes.append({"id": req["id"], "type": "requirement", "label": req["label"], "metadata": req})
            node_ids.add(req["id"])

        # 2. Parse architecture modules
        arch_modules = self._parse_architecture()
        for mod in arch_modules:
            nodes.append({"id": mod["id"], "type": "architecture", "label": mod["label"], "metadata": mod})
            node_ids.add(mod["id"])

        # 3. Parse code modules
        code_modules = self._parse_code_modules()
        for cm in code_modules:
            nodes.append({"id": cm["id"], "type": "code", "label": cm["label"], "metadata": cm})
            node_ids.add(cm["id"])

        # 4. Parse test files
        test_files = self._parse_tests()
        for tf in test_files:
            nodes.append({"id": tf["id"], "type": "test", "label": tf["label"], "metadata": tf})
            node_ids.add(tf["id"])

        # 5. Parse risk controls
        risks = self._parse_risk_controls()
        for rc in risks:
            nodes.append({"id": rc["id"], "type": "risk_control", "label": rc["label"], "metadata": rc})
            node_ids.add(rc["id"])

        # 6. Build edges
        # REQ → CODE (by scanning code for REQ-XXX references)
        for cm in code_modules:
            for req_id in cm.get("referenced_reqs", []):
                if req_id in node_ids:
                    edges.append({"source": req_id, "target": cm["id"], "type": "implemented_by"})

        # CODE → TEST (by matching module names)
        for tf in test_files:
            for cm in code_modules:
                if cm["module_name"] in tf["id"] or cm["module_name"] in tf.get("tests_module", ""):
                    edges.append({"source": cm["id"], "target": tf["id"], "type": "tested_by"})

        # REQ → RISK (by scanning risk file for REQ references)
        for rc in risks:
            for req_id in rc.get("mitigates_reqs", []):
                if req_id in node_ids:
                    edges.append({"source": req_id, "target": rc["id"], "type": "mitigated_by"})

        # REQ → ARCH (by keyword matching)
        for mod in arch_modules:
            for req in reqs:
                if any(kw in mod.get("description", "").lower() for kw in req.get("keywords", [])):
                    edges.append({"source": req["id"], "target": mod["id"], "type": "traces_to"})

        # ARCH → CODE (by module name matching)
        for mod in arch_modules:
            for cm in code_modules:
                if mod["module_name"].lower() in cm["id"].lower() or mod["module_name"].lower() in cm.get("path", "").lower():
                    edges.append({"source": mod["id"], "target": cm["id"], "type": "implemented_by"})

        # 7. Detect orphans
        req_ids = {n["id"] for n in nodes if n["type"] == "requirement"}
        test_ids = {n["id"] for n in nodes if n["type"] == "test"}
        risk_ids = {n["id"] for n in nodes if n["type"] == "risk_control"}
        code_ids = {n["id"] for n in nodes if n["type"] == "code"}

        tested_reqs = {e["source"] for e in edges if e["type"] == "tested_by"}
        # Requirements that have code implementing them
        implemented_reqs = {e["source"] for e in edges if e["type"] == "implemented_by" and e["source"] in req_ids}
        # Code that implements requirements
        code_with_reqs = {e["target"] for e in edges if e["type"] == "implemented_by" and e["source"] in req_ids}
        # Risks with verification edges
        verified_risks = {e["target"] for e in edges if e["type"] == "mitigated_by"}

        # Reqs without tests: any req that has no path to a test
        reqs_with_tests = set()
        for e in edges:
            if e["type"] == "tested_by":
                # Find reqs that connect to this code
                for e2 in edges:
                    if e2["target"] == e["source"] and e2["source"] in req_ids:
                        reqs_with_tests.add(e2["source"])

        orphans = {
            "requirements_without_tests": sorted(req_ids - reqs_with_tests),
            "risk_controls_without_verification": sorted(risk_ids - verified_risks),
            "code_without_requirements": sorted(code_ids - code_with_reqs),
        }

        stats = {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "requirements": len(req_ids),
            "architecture": len([n for n in nodes if n["type"] == "architecture"]),
            "code_modules": len(code_ids),
            "tests": len(test_ids),
            "risk_controls": len(risk_ids),
            "orphan_requirements": len(orphans["requirements_without_tests"]),
            "orphan_risks": len(orphans["risk_controls_without_verification"]),
            "orphan_code": len(orphans["code_without_requirements"]),
        }

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "nodes": nodes,
            "edges": edges,
            "orphans": orphans,
            "stats": stats,
        }

    def _parse_requirements(self) -> List[Dict]:
        """Parse requirement IDs from SRS document."""
        content = self.github.get_file_content("docs/iec62304/02_Software_Requirements_Specification.md")
        if not content:
            return []

        reqs = []
        # Match REQ-FUNC-XXX, REQ-SAFE-XXX, REQ-PERF-XXX, REQ-SEC-XXX etc
        pattern = r'(REQ-[A-Z]+-\d+)\s*[:\|]\s*(.+?)(?:\n|$)'
        for match in re.finditer(pattern, content):
            req_id = match.group(1)
            desc = match.group(2).strip().rstrip('|').strip()
            category = req_id.split('-')[1].lower()
            keywords = [w.lower() for w in desc.split() if len(w) > 4][:5]
            reqs.append({
                "id": req_id,
                "label": f"{req_id}: {desc[:60]}",
                "description": desc,
                "category": category,
                "keywords": keywords,
            })

        # Also try simpler patterns: **REQ-XXX** or `REQ-XXX`
        for match in re.finditer(r'[*`]*(REQ-[A-Z]+-\d+)[*`]*', content):
            req_id = match.group(1)
            if not any(r["id"] == req_id for r in reqs):
                reqs.append({
                    "id": req_id,
                    "label": req_id,
                    "description": "",
                    "category": req_id.split('-')[1].lower() if '-' in req_id else "func",
                    "keywords": [],
                })

        return reqs

    def _parse_architecture(self) -> List[Dict]:
        """Parse architecture modules from SAD."""
        content = self.github.get_file_content("docs/iec62304/03_Software_Architecture_Document.md")
        if not content:
            # Fallback: use known module structure
            return self._default_architecture()

        modules = []
        # Look for module/component headings
        for match in re.finditer(r'#+\s+(?:Module|Component|Service)[\s:]+(.+)', content, re.IGNORECASE):
            name = match.group(1).strip()
            mod_id = f"ARCH-{name.replace(' ', '_').upper()[:20]}"
            modules.append({
                "id": mod_id,
                "label": name,
                "module_name": name.lower().replace(' ', '_'),
                "description": name,
            })

        if not modules:
            return self._default_architecture()
        return modules

    def _default_architecture(self) -> List[Dict]:
        """Default architecture modules based on known MSTool-AI structure."""
        modules = [
            ("ARCH-SEGMENTATION", "AI Segmentation Module", "segmentation"),
            ("ARCH-VOLUMETRY", "Brain Volumetry Module", "volumetry"),
            ("ARCH-REPORTS", "Report Generation Module", "report"),
            ("ARCH-LESION", "Lesion Analysis Module", "lesion"),
            ("ARCH-CLASSIFIER", "Region Classifier Module", "classifier"),
            ("ARCH-DICOM", "DICOM Processing Module", "dicom"),
            ("ARCH-NIFTI", "NIfTI Processing Module", "nifti"),
            ("ARCH-AUTH", "Authentication Module", "auth"),
            ("ARCH-VIEWER", "Image Viewer Module", "viewer"),
            ("ARCH-EDGE-AI", "Edge AI Module", "edge"),
        ]
        return [{"id": m[0], "label": m[1], "module_name": m[2], "description": m[1]} for m in modules]

    def _parse_code_modules(self) -> List[Dict]:
        """Parse code modules and their requirement references."""
        modules = []

        # Backend services
        service_files = self.github.list_directory("backend/app/services")
        for f in service_files:
            if not f["name"].endswith(".py") or f["name"].startswith("__"):
                continue
            content = self.github.get_file_content(f["path"]) or ""
            req_refs = list(set(re.findall(r'REQ-[A-Z]+-\d+', content)))
            mod_name = f["name"].replace(".py", "")
            modules.append({
                "id": f"CODE-{mod_name}",
                "label": mod_name.replace("_", " ").title(),
                "path": f["path"],
                "module_name": mod_name,
                "referenced_reqs": req_refs,
            })

        # Backend utils
        util_files = self.github.list_directory("backend/app/utils")
        for f in (util_files or []):
            if not f["name"].endswith(".py") or f["name"].startswith("__"):
                continue
            content = self.github.get_file_content(f["path"]) or ""
            req_refs = list(set(re.findall(r'REQ-[A-Z]+-\d+', content)))
            mod_name = f["name"].replace(".py", "")
            modules.append({
                "id": f"CODE-{mod_name}",
                "label": mod_name.replace("_", " ").title(),
                "path": f["path"],
                "module_name": mod_name,
                "referenced_reqs": req_refs,
            })

        # Key frontend components
        for comp in ["ImageViewer2D", "SegmentationCanvasLocal", "SegmentationPanel"]:
            modules.append({
                "id": f"CODE-{comp}",
                "label": comp,
                "path": f"frontend/src/components/{comp}.tsx",
                "module_name": comp.lower(),
                "referenced_reqs": [],
            })

        return modules

    def _parse_tests(self) -> List[Dict]:
        """Parse test files."""
        test_files = self.github.list_directory("backend/tests/unit")
        tests = []
        for f in (test_files or []):
            if not f["name"].startswith("test_") or not f["name"].endswith(".py"):
                continue
            mod_name = f["name"].replace("test_", "").replace(".py", "")
            content = self.github.get_file_content(f["path"]) or ""
            test_count = len(re.findall(r'def test_\w+', content))
            tests.append({
                "id": f"TEST-{mod_name}",
                "label": f"test_{mod_name} ({test_count} tests)",
                "path": f["path"],
                "tests_module": mod_name,
                "test_count": test_count,
            })
        return tests

    def _parse_risk_controls(self) -> List[Dict]:
        """Parse hazards and risk controls from Risk Management File."""
        content = self.github.get_file_content("docs/iec62304/03_Risk_Management_File.md")
        if not content:
            return []

        risks = []
        # Match HAZ-XXX
        for match in re.finditer(r'(HAZ-\d+)\s*[:\|]\s*(.+?)(?:\n|$)', content):
            haz_id = match.group(1)
            desc = match.group(2).strip().rstrip('|').strip()
            # Find REQ references near this hazard
            context_start = max(0, match.start() - 200)
            context_end = min(len(content), match.end() + 500)
            context = content[context_start:context_end]
            mitigated_reqs = list(set(re.findall(r'REQ-[A-Z]+-\d+', context)))

            risks.append({
                "id": haz_id,
                "label": f"{haz_id}: {desc[:60]}",
                "description": desc,
                "mitigates_reqs": mitigated_reqs,
            })

        # Also match RC-XXX (risk controls)
        for match in re.finditer(r'(RC-\d+)\s*[:\|]\s*(.+?)(?:\n|$)', content):
            rc_id = match.group(1)
            desc = match.group(2).strip().rstrip('|').strip()
            context_start = max(0, match.start() - 200)
            context_end = min(len(content), match.end() + 500)
            context = content[context_start:context_end]
            mitigated_reqs = list(set(re.findall(r'REQ-[A-Z]+-\d+', context)))

            risks.append({
                "id": rc_id,
                "label": f"{rc_id}: {desc[:60]}",
                "description": desc,
                "mitigates_reqs": mitigated_reqs,
            })

        return risks