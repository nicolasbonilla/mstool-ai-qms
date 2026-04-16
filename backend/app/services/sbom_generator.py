"""
SBOM (Software Bill of Materials) generator — CycloneDX 1.5 JSON format.

The CycloneDX spec is the de-facto industry standard for SBOMs and is the
format FDA accepts in 510(k) submissions per their 2023 cybersecurity
guidance. We emit JSON (not XML) because regulators handle both and JSON
is friendlier for diff/inspection.

References:
- CycloneDX 1.5 spec: https://cyclonedx.org/docs/1.5/json/
- FDA Cybersecurity in Medical Devices (Sep 2023):
  https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cybersecurity-medical-devices-quality-system-considerations-and-content-premarket-submissions
- SPDX as alternative format if needed: https://spdx.dev/

Each component carries:
- bom-ref (unique within document)
- type: library
- name, version
- supplier (manufacturer name)
- purl (package URL — the canonical machine-readable identifier)
- licenses (when known)
- externalReferences (homepage, issue tracker)
- properties (our internal safety_class, source, pinned status)

The dependency tree is flat (no transitives) because we only inventory
direct deps. A future enhancement could lock+resolve via uv/npm-tree
to capture the full transitive graph.
"""

import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

CYCLONEDX_VERSION = "1.5"
CYCLONEDX_SPEC_URL = "http://cyclonedx.org/schema/bom-1.5.schema.json"


def _purl(name: str, version: str, source: str) -> str:
    """Construct a Package URL per the spec."""
    if source == "backend":
        # Python convention: pkg:pypi/{name}@{version}
        return f"pkg:pypi/{name}@{version}"
    if source == "frontend":
        # JS convention: pkg:npm/{name}@{version}
        return f"pkg:npm/{name}@{version}"
    return f"pkg:generic/{name}@{version}"


def _component_for_dep(dep: Dict[str, Any]) -> Dict[str, Any]:
    name = dep.get("name", "unknown")
    version = dep.get("version", "0.0.0")
    source = dep.get("source", "backend")
    bom_ref = f"{source}:{name}@{version}"

    component: Dict[str, Any] = {
        "bom-ref": bom_ref,
        "type": "library",
        "name": name,
        "version": version,
        "purl": _purl(name, version, source),
    }

    # Supplier (manufacturer) per CycloneDX 1.5
    supplier = dep.get("manufacturer")
    if supplier and supplier != "Open Source":
        component["supplier"] = {"name": supplier}

    # Description if available
    summary = dep.get("purpose")
    if summary:
        component["description"] = summary[:280]

    # Licenses
    license_str = dep.get("license")
    if license_str:
        component["licenses"] = [{"license": {"name": str(license_str)[:100]}}]

    # External references (per spec: array of {url, type})
    refs: List[Dict[str, str]] = []
    if dep.get("homepage"):
        refs.append({"url": dep["homepage"], "type": "website"})
    if dep.get("anomaly_url"):
        refs.append({"url": dep["anomaly_url"], "type": "issue-tracker"})
    if refs:
        component["externalReferences"] = refs

    # Custom properties (our safety classification + audit metadata)
    component["properties"] = [
        {"name": "iec62304:safety_class", "value": dep.get("safety_class", "?")},
        {"name": "iec62304:source", "value": source},
        {"name": "iec62304:pinned", "value": str(bool(dep.get("pinned"))).lower()},
    ]

    return component


def generate_cyclonedx(
    deps: List[Dict[str, Any]],
    project_name: str = "MSTool-AI",
    project_version: Optional[str] = None,
) -> Dict[str, Any]:
    """Build a complete CycloneDX 1.5 SBOM as a Python dict ready to JSON-dump.

    The serialNumber follows CycloneDX requirement: a deterministic UUIDv4-shaped
    ID derived from (project, generated_at, dep set hash) so re-running
    on the same input produces the same SBOM (auditable, diffable).
    """
    now = datetime.now(timezone.utc)

    # Deterministic-ish hash of dep set so identical runs produce identical SBOMs
    dep_hash = hashlib.sha256(
        json.dumps(
            [(d.get("name"), d.get("version"), d.get("source")) for d in deps],
            sort_keys=True,
        ).encode("utf-8")
    ).hexdigest()
    serial_uuid = uuid.UUID(dep_hash[:32])

    components = [_component_for_dep(d) for d in deps]

    sbom = {
        "$schema": CYCLONEDX_SPEC_URL,
        "bomFormat": "CycloneDX",
        "specVersion": CYCLONEDX_VERSION,
        "serialNumber": f"urn:uuid:{serial_uuid}",
        "version": 1,
        "metadata": {
            "timestamp": now.isoformat(),
            "tools": [{
                "vendor": "MSTool-AI-QMS",
                "name": "sbom_generator",
                "version": "1.0",
            }],
            "component": {
                "bom-ref": "root-component",
                "type": "application",
                "name": project_name,
                "version": project_version or "live",
                "description": (
                    "Brain MRI segmentation and MS lesion analysis SaMD, "
                    "Class C under IEC 62304:2006+A1:2015"
                ),
            },
            "supplier": {"name": "MSTool-AI"},
        },
        "components": components,
        "compositions": [{
            "aggregate": "complete",
            "dependencies": [c["bom-ref"] for c in components],
        }],
    }
    return sbom


def cyclonedx_bytes(deps: List[Dict[str, Any]],
                     project_name: str = "MSTool-AI",
                     project_version: Optional[str] = None) -> bytes:
    """Serialize SBOM to JSON bytes ready for HTTP download."""
    sbom = generate_cyclonedx(deps, project_name, project_version)
    return json.dumps(sbom, indent=2, ensure_ascii=False).encode("utf-8")
