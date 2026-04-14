"""
PDF Generation Service — MSTool-AI-QMS.

Professional PDF generation for audit forms, compliance reports, and audit results.
Uses ReportLab for PDF creation.
"""

import io
import logging
from datetime import datetime, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, black, gray, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable,
)

logger = logging.getLogger(__name__)

# Colors
NAVY = HexColor("#0F172A")
TEAL = HexColor("#0D9488")
LIGHT_GRAY = HexColor("#F8FAFC")
BORDER_GRAY = HexColor("#E2E8F0")


class PDFService:
    """Generate professional PDFs for QMS records."""

    @staticmethod
    def generate_form_pdf(form_data: dict, template_config: dict) -> bytes:
        """Generate a PDF for a completed form."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                topMargin=2*cm, bottomMargin=2*cm,
                                leftMargin=2*cm, rightMargin=2*cm)
        styles = getSampleStyleSheet()
        story = []

        # Custom styles
        title_style = ParagraphStyle('FormTitle', parent=styles['Heading1'],
                                      fontSize=18, textColor=NAVY, spaceAfter=6)
        subtitle_style = ParagraphStyle('FormSubtitle', parent=styles['Normal'],
                                         fontSize=10, textColor=gray, spaceAfter=12)
        section_style = ParagraphStyle('Section', parent=styles['Heading2'],
                                        fontSize=13, textColor=TEAL, spaceBefore=18, spaceAfter=8)
        field_label = ParagraphStyle('FieldLabel', parent=styles['Normal'],
                                      fontSize=9, textColor=gray)
        field_value = ParagraphStyle('FieldValue', parent=styles['Normal'],
                                      fontSize=11, textColor=black)

        # Header
        header_data = [
            ['MSTool-AI-QMS', f"Document: {form_data.get('template_id', 'N/A')}"],
            ['Regulatory Compliance Platform', f"Form ID: {form_data.get('id', 'N/A')}"],
            ['IEC 62304 Class C', f"Status: {form_data.get('status', 'draft').upper()}"],
        ]
        header_table = Table(header_data, colWidths=[doc.width * 0.6, doc.width * 0.4])
        header_table.setStyle(TableStyle([
            ('TEXTCOLOR', (0, 0), (0, 0), TEAL),
            ('FONTSIZE', (0, 0), (0, 0), 14),
            ('FONTNAME', (0, 0), (0, 0), 'Helvetica-Bold'),
            ('TEXTCOLOR', (0, 1), (0, -1), gray),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        story.append(header_table)
        story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceAfter=12))

        # Title
        story.append(Paragraph(form_data.get('title', 'Untitled Form'), title_style))
        story.append(Paragraph(
            f"Standard: {template_config.get('standard', 'N/A')} | "
            f"Version: {form_data.get('version', 1)} | "
            f"Created: {form_data.get('created_at', 'N/A')[:10]} | "
            f"By: {form_data.get('created_by', 'N/A')}",
            subtitle_style))

        # Draft watermark notice
        if form_data.get('status') == 'draft':
            story.append(Paragraph(
                '<font color="red"><b>DRAFT — NOT APPROVED</b></font>',
                ParagraphStyle('Draft', parent=styles['Normal'], fontSize=12, alignment=TA_CENTER,
                               textColor=HexColor("#EF4444"), spaceBefore=6, spaceAfter=12)))

        # Form fields
        fields = form_data.get('fields', {})
        if fields:
            story.append(Paragraph("Form Data", section_style))
            for key, value in fields.items():
                label = key.replace('_', ' ').title()
                story.append(Paragraph(label, field_label))
                story.append(Paragraph(str(value) if value else "—", field_value))
                story.append(Spacer(1, 4))

        # Signatures
        signatures = form_data.get('signatures', [])
        if signatures:
            story.append(Paragraph("Electronic Signatures", section_style))
            sig_data = [['Name', 'Role', 'Date/Time', 'Type']]
            for sig in signatures:
                sig_data.append([
                    sig.get('user', ''),
                    sig.get('role', ''),
                    sig.get('signed_at', '')[:19],
                    sig.get('signature_type', ''),
                ])
            sig_table = Table(sig_data, colWidths=[doc.width * 0.3, doc.width * 0.2, doc.width * 0.3, doc.width * 0.2])
            sig_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), NAVY),
                ('TEXTCOLOR', (0, 0), (-1, 0), white),
                ('FONTSIZE', (0, 0), (-1, 0), 9),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_GRAY]),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
            ]))
            story.append(sig_table)

        # Footer
        story.append(Spacer(1, 30))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
        story.append(Paragraph(
            f"Generated by MSTool-AI-QMS | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} | "
            "IEC 62304 Class C Medical Device Software — CONFIDENTIAL",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7, textColor=gray, alignment=TA_CENTER)))

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def generate_audit_report_pdf(audit_result: dict) -> bytes:
        """Generate audit report PDF."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                topMargin=2*cm, bottomMargin=2*cm,
                                leftMargin=2*cm, rightMargin=2*cm)
        styles = getSampleStyleSheet()
        story = []

        title_style = ParagraphStyle('Title', parent=styles['Heading1'],
                                      fontSize=20, textColor=NAVY, spaceAfter=6)
        section_style = ParagraphStyle('Section', parent=styles['Heading2'],
                                        fontSize=13, textColor=TEAL, spaceBefore=18, spaceAfter=8)

        # Header
        story.append(Paragraph("IEC 62304 Audit Report", title_style))
        story.append(Paragraph(
            f"Audit ID: {audit_result.get('id', 'N/A')} | "
            f"Mode: {audit_result.get('mode', 'full')} | "
            f"Date: {audit_result.get('started_at', 'N/A')[:10]}",
            ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, textColor=gray, spaceAfter=12)))
        story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceAfter=12))

        # Readiness Score
        score = audit_result.get('readiness_score', 0)
        score_color = "#10B981" if score >= 80 else "#F59E0B" if score >= 60 else "#EF4444"
        story.append(Paragraph(
            f'<font size="36" color="{score_color}"><b>{score}%</b></font>',
            ParagraphStyle('Score', parent=styles['Normal'], alignment=TA_CENTER, spaceBefore=12, spaceAfter=6)))
        story.append(Paragraph("Overall Readiness Score",
            ParagraphStyle('ScoreLabel', parent=styles['Normal'], alignment=TA_CENTER, fontSize=12, textColor=gray, spaceAfter=18)))

        # Summary
        summary = audit_result.get('summary', {})
        summary_data = [
            ['Total Checks', 'Strong', 'Adequate', 'Weak', 'Missing'],
            [str(summary.get('total_checks', 0)), str(summary.get('strong', 0)),
             str(summary.get('adequate', 0)), str(summary.get('weak', 0)), str(summary.get('missing', 0))],
        ]
        st = Table(summary_data, colWidths=[doc.width / 5] * 5)
        st.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(st)

        # Per-clause results
        story.append(Paragraph("Clause-by-Clause Results", section_style))
        questions = audit_result.get('questions', [])
        clause_data = [['Clause', 'Title', 'Score']]
        score_colors = {"strong": "#10B981", "adequate": "#F59E0B", "weak": "#F97316", "missing": "#EF4444"}
        for q in questions:
            color = score_colors.get(q.get('score', 'missing'), '#666')
            clause_data.append([
                q.get('clause', ''),
                q.get('question', ''),
                f'<font color="{color}"><b>{q.get("score", "N/A").upper()}</b></font>',
            ])
        ct = Table(clause_data, colWidths=[doc.width * 0.1, doc.width * 0.65, doc.width * 0.25])
        ct.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_GRAY]),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(ct)

        # Gaps
        gaps = audit_result.get('gaps', [])
        if gaps:
            story.append(Paragraph("Identified Gaps", section_style))
            for gap in gaps:
                sev = gap.get('severity', 'warning')
                color = "#EF4444" if sev == "critical" else "#F59E0B"
                story.append(Paragraph(
                    f'<font color="{color}"><b>[{sev.upper()}]</b></font> '
                    f'Clause {gap.get("clause", "")} — {gap.get("recommendation", "")}',
                    ParagraphStyle('Gap', parent=styles['Normal'], fontSize=9, spaceAfter=4)))

        # Footer
        story.append(Spacer(1, 30))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
        story.append(Paragraph(
            f"MSTool-AI-QMS Audit Report | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} | CONFIDENTIAL",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7, textColor=gray, alignment=TA_CENTER)))

        doc.build(story)
        return buffer.getvalue()

    @staticmethod
    def generate_compliance_pdf(scores: dict) -> bytes:
        """Generate compliance score PDF report."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
                                topMargin=2*cm, bottomMargin=2*cm,
                                leftMargin=2*cm, rightMargin=2*cm)
        styles = getSampleStyleSheet()
        story = []

        story.append(Paragraph("Compliance Score Report", ParagraphStyle(
            'Title', parent=styles['Heading1'], fontSize=20, textColor=NAVY)))
        story.append(Paragraph(
            f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            ParagraphStyle('Sub', parent=styles['Normal'], fontSize=10, textColor=gray, spaceAfter=18)))
        story.append(HRFlowable(width="100%", thickness=1, color=TEAL, spaceAfter=12))

        # Scores table
        s = scores.get('scores', {})
        score_data = [
            ['Standard', 'Score', 'Status'],
            ['IEC 62304', f"{s.get('iec62304', 0)}%", 'PASS' if s.get('iec62304', 0) >= 80 else 'NEEDS WORK'],
            ['ISO 13485', f"{s.get('iso13485', 0)}%", 'PASS' if s.get('iso13485', 0) >= 80 else 'NEEDS WORK'],
            ['Cybersecurity', f"{s.get('cybersecurity', 0)}%", 'PASS' if s.get('cybersecurity', 0) >= 80 else 'NEEDS WORK'],
            ['CE Mark Overall', f"{s.get('ce_mark_overall', 0)}%", 'PASS' if s.get('ce_mark_overall', 0) >= 80 else 'NEEDS WORK'],
        ]
        st = Table(score_data, colWidths=[doc.width * 0.4, doc.width * 0.3, doc.width * 0.3])
        st.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 11),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_GRAY]),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))
        story.append(st)

        # Breakdown
        story.append(Spacer(1, 18))
        story.append(Paragraph("Breakdown", ParagraphStyle(
            'Section', parent=styles['Heading2'], fontSize=13, textColor=TEAL)))
        breakdown = scores.get('breakdown', {})
        bd_data = [['Metric', 'Score']]
        for key, val in breakdown.items():
            bd_data.append([key.replace('_', ' ').title(), f"{val}%"])
        bt = Table(bd_data, colWidths=[doc.width * 0.6, doc.width * 0.4])
        bt.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), NAVY),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (1, 0), (1, -1), 'CENTER'),
            ('GRID', (0, 0), (-1, -1), 0.5, BORDER_GRAY),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [white, LIGHT_GRAY]),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
        ]))
        story.append(bt)

        story.append(Spacer(1, 30))
        story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_GRAY))
        story.append(Paragraph(
            f"MSTool-AI-QMS | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} | CONFIDENTIAL",
            ParagraphStyle('Footer', parent=styles['Normal'], fontSize=7, textColor=gray, alignment=TA_CENTER)))

        doc.build(story)
        return buffer.getvalue()