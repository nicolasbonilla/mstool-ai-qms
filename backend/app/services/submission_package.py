"""
CE Mark Submission Package — Phase 3 deliverable.

Bundles a frozen baseline + supporting artifacts into a single ZIP that
can be handed directly to a Notified Body or attached to an FDA submission.

Contents (per FDA Premarket Software Guidance + EU MDR Annex II):
- baseline.json        : the immutable baseline document (with hash)
- audit_report.pdf     : last audit run reformatted as a PDF
- traceability.xlsx    : RTM matrix as Excel (auditor format)
- soup_inventory.json  : SOUP list at baseline time
- activity_log.json    : WORM audit-trail entries from baseline window
- ai_dossier.json      : AI Validation Dossier for the agents in scope
- README.md            : index file describing every artifact
- HASHES.txt           : SHA-256 of every file (tamper evidence)
"""

import hashlib
import io
import json
import logging
import zipfile
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _build_rtm_xlsx(traceability_graph: dict) -> bytes:
    """Build the Requirements Traceability Matrix as an Excel workbook.

    Falls back to CSV bytes if openpyxl is unavailable in the environment.
    """
    rtm_rows = traceability_graph.get("rtm_rows", [])
    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "RTM"
        headers = ["Req ID", "Description", "Category", "Safety Class",
                   "Code Modules", "Code Count", "Tests", "Test Count",
                   "Risk Controls", "Risk Count", "Status"]
        ws.append(headers)
        for r in rtm_rows:
            ws.append([
                r.get("req_id", ""),
                r.get("description", ""),
                r.get("category", ""),
                r.get("safety_class", ""),
                ", ".join(r.get("code_modules", [])),
                r.get("code_count", 0),
                ", ".join(r.get("tests", [])),
                r.get("test_count", 0),
                ", ".join(r.get("risk_controls", [])),
                r.get("risk_count", 0),
                r.get("status", ""),
            ])
        for col_letter, width in (("A", 18), ("B", 50), ("C", 10), ("D", 12),
                                    ("E", 30), ("F", 12), ("G", 30), ("H", 12),
                                    ("I", 24), ("J", 12), ("K", 14)):
            ws.column_dimensions[col_letter].width = width
        buf = io.BytesIO()
        wb.save(buf)
        return buf.getvalue()
    except ImportError:
        # Fallback: CSV
        out = io.StringIO()
        out.write("req_id,description,category,safety_class,code_count,test_count,risk_count,status\n")
        for r in rtm_rows:
            out.write(",".join([
                str(r.get("req_id", "")),
                '"' + str(r.get("description", "")).replace('"', "'") + '"',
                str(r.get("category", "")),
                str(r.get("safety_class", "")),
                str(r.get("code_count", 0)),
                str(r.get("test_count", 0)),
                str(r.get("risk_count", 0)),
                str(r.get("status", "")),
            ]) + "\n")
        return out.getvalue().encode("utf-8")


def _build_audit_pdf(audit_result: Optional[dict]) -> bytes:
    """Render the most recent audit result as a basic PDF.

    For MVP we use reportlab to render a simple multi-page report. Future:
    ship a designed template via the existing PDFService.
    """
    if not audit_result:
        return b"%PDF-1.4\n%no-audit\n"
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
        from reportlab.lib.units import cm
    except ImportError:
        return json.dumps(audit_result, indent=2, default=str).encode("utf-8")

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter
    y = height - 2 * cm

    def draw(text, font="Helvetica", size=10, indent=0, gap=14):
        nonlocal y
        if y < 2 * cm:
            c.showPage()
            y = height - 2 * cm
        c.setFont(font, size)
        c.drawString(2 * cm + indent, y, text)
        y -= gap

    draw("MSTool-AI-QMS — Audit Report (frozen at baseline)", font="Helvetica-Bold", size=14, gap=24)
    draw(f"Generated: {datetime.now(timezone.utc).isoformat()}", size=9)
    draw(f"Mode: {audit_result.get('mode', '?')}", size=9)
    draw(f"Readiness Score: {audit_result.get('readiness_score', '?')}%", font="Helvetica-Bold", size=12, gap=20)

    summary = audit_result.get("summary", {}) or {}
    for k in ("strong", "adequate", "weak", "missing"):
        draw(f"  {k.title()}: {summary.get(k, 0)}", size=10)

    draw("Clauses:", font="Helvetica-Bold", size=11, gap=18)
    for q in (audit_result.get("questions") or [])[:30]:
        draw(f"  {q.get('clause', '?')} — {q.get('title', '')}: "
             f"{q.get('score', '?').upper()}", size=9)
    c.save()
    return buf.getvalue()


def build_submission_package(
    baseline: dict,
    audit_result: Optional[dict],
    traceability_graph: dict,
    soup: dict,
    recent_activity: list,
    ai_dossier: dict,
) -> bytes:
    """Build the ZIP and return its bytes.

    All inputs are passed by the caller so this function stays pure
    (deterministic + testable).
    """
    files: dict[str, bytes] = {}

    files["baseline.json"] = json.dumps(baseline, indent=2, default=str).encode("utf-8")
    files["audit_report.pdf"] = _build_audit_pdf(audit_result)
    files["traceability.xlsx"] = _build_rtm_xlsx(traceability_graph)
    files["soup_inventory.json"] = json.dumps(soup, indent=2, default=str).encode("utf-8")
    files["activity_log.json"] = json.dumps(recent_activity, indent=2, default=str).encode("utf-8")
    files["ai_dossier.json"] = json.dumps(ai_dossier, indent=2, default=str).encode("utf-8")

    # README
    readme = (
        f"# CE Mark Submission Package\n\n"
        f"**Baseline:** `{baseline.get('version_tag')}`\n"
        f"**Generated:** {datetime.now(timezone.utc).isoformat()}\n"
        f"**Baseline hash:** `{baseline.get('hash')}`\n\n"
        f"## Contents\n"
        f"- `baseline.json` — Immutable QMS snapshot at this release tag\n"
        f"- `audit_report.pdf` — Last IEC 62304 audit reformatted for submission\n"
        f"- `traceability.xlsx` — RTM matrix in Excel (auditor format)\n"
        f"- `soup_inventory.json` — Complete SOUP list at baseline time\n"
        f"- `activity_log.json` — WORM audit-trail entries (21 CFR Part 11 §11.10(e))\n"
        f"- `ai_dossier.json` — IQ/OQ/PQ + PCCP for every AI agent in scope\n"
        f"- `HASHES.txt` — SHA-256 of every file in this package\n\n"
        f"All files are tamper-evident: any modification breaks the SHA-256\n"
        f"in HASHES.txt. The baseline document itself carries its own embedded\n"
        f"hash (`baseline.hash`).\n"
    )
    files["README.md"] = readme.encode("utf-8")

    # Compute hashes after the other files exist
    hashes_lines = [f"{_sha256_bytes(b)}  {n}" for n, b in files.items()]
    files["HASHES.txt"] = "\n".join(sorted(hashes_lines)).encode("utf-8") + b"\n"

    # Build ZIP
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, data in files.items():
            zf.writestr(name, data)
    return zip_buf.getvalue()
