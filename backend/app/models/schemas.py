"""
QMS Pydantic schemas — MSTool-AI-QMS.

Data models for regulatory compliance automation:
- Compliance scoring (IEC 62304, ISO 13485, EU MDR)
- Form management (TPL-01 to TPL-11)
- Traceability graph
- Audit simulation
- SOUP monitoring
- Document sync
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ─── Enums ───

class ComplianceStandard(str, Enum):
    IEC_62304 = "iec62304"
    ISO_13485 = "iso13485"
    CYBERSECURITY = "cybersecurity"
    CE_MARK = "ce_mark"

class FormStatus(str, Enum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    SUPERSEDED = "superseded"

class SignatureType(str, Enum):
    AUTHOR = "author"
    REVIEWER = "reviewer"
    APPROVER = "approver"

class NodeType(str, Enum):
    REQUIREMENT = "requirement"
    ARCHITECTURE = "architecture"
    DESIGN = "design"
    CODE = "code"
    TEST = "test"
    RISK_CONTROL = "risk_control"

class EdgeType(str, Enum):
    TRACES_TO = "traces_to"
    IMPLEMENTED_BY = "implemented_by"
    TESTED_BY = "tested_by"
    MITIGATED_BY = "mitigated_by"

class EvidenceStrength(str, Enum):
    STRONG = "strong"
    ADEQUATE = "adequate"
    WEAK = "weak"
    MISSING = "missing"

class AlertSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


# ─── Compliance Dashboard ───

class ComplianceBreakdown(BaseModel):
    auth_coverage: float = 0
    input_validation: float = 0
    test_coverage: float = 0
    risk_verification: float = 0
    doc_completeness: float = 0
    doc_freshness: float = 0
    soup_vulnerability: float = 0
    codeowners_coverage: float = 0

class ComplianceScores(BaseModel):
    iec62304: float = 0
    iso13485: float = 0
    cybersecurity: float = 0
    ce_mark_overall: float = 0

class ComplianceResult(BaseModel):
    computed_at: str
    scores: ComplianceScores
    breakdown: ComplianceBreakdown


# ─── Form Manager ───

class FormField(BaseModel):
    name: str
    label: str
    field_type: str = "text"
    required: bool = False
    options: Optional[List[str]] = None
    default_value: Optional[str] = None
    section: Optional[str] = None

class FormSignature(BaseModel):
    user: str
    role: str
    signed_at: str
    signature_type: SignatureType

class FormRecord(BaseModel):
    id: str
    template_id: str
    title: str
    status: FormStatus = FormStatus.DRAFT
    version: int = 1
    created_by: str = ""
    created_at: str = ""
    updated_at: str = ""
    fields: Dict[str, Any] = {}
    ai_filled_fields: List[str] = []
    signatures: List[FormSignature] = []

class CreateFormRequest(BaseModel):
    template_id: str = Field(pattern=r"^TPL-(0[1-9]|1[01])$")
    title: Optional[str] = None

class UpdateFormRequest(BaseModel):
    fields: Dict[str, Any]

class AIFillResponse(BaseModel):
    fields: Dict[str, Any]
    confidence: Dict[str, float]
    sources: Dict[str, str]


# ─── Traceability ───

class TraceabilityNode(BaseModel):
    id: str
    type: NodeType
    label: str
    metadata: Dict[str, Any] = {}

class TraceabilityEdge(BaseModel):
    source: str
    target: str
    type: EdgeType

class TraceabilityOrphans(BaseModel):
    requirements_without_tests: List[str] = []
    risk_controls_without_verification: List[str] = []
    code_without_requirements: List[str] = []

class TraceabilityGraph(BaseModel):
    generated_at: str
    nodes: List[TraceabilityNode]
    edges: List[TraceabilityEdge]
    orphans: TraceabilityOrphans
    stats: Dict[str, int] = {}


# ─── Audit Simulator ───

class AuditEvidence(BaseModel):
    type: str
    reference: str
    content: str

class AuditQuestion(BaseModel):
    clause: str
    question: str
    evidence: List[AuditEvidence] = []
    score: EvidenceStrength = EvidenceStrength.MISSING

class AuditSimulateRequest(BaseModel):
    mode: str = Field(default="full", pattern=r"^(full|random_commit|random_requirement)$")
    target: Optional[str] = None

class AuditRunResult(BaseModel):
    id: str
    started_at: str
    completed_at: Optional[str] = None
    mode: str
    questions: List[AuditQuestion] = []
    readiness_score: float = 0
    gaps: List[Dict[str, str]] = []


# ─── SOUP Monitor ───

class SOUPDependency(BaseModel):
    name: str
    version: str
    safety_class: str = "A"
    source: str = "backend"
    license: Optional[str] = None
    soup_id: Optional[str] = None

class CVEVulnerability(BaseModel):
    cve_id: str
    package: str
    version: str
    severity: str
    description: str
    fix_version: Optional[str] = None

class SOUPScanResult(BaseModel):
    scanned_at: str
    total_dependencies: int
    vulnerabilities: List[CVEVulnerability]
    summary: Dict[str, int]


# ─── Document Sync ───

class DocumentDrift(BaseModel):
    document_path: str
    document_id: str
    reason: str
    changed_files: List[str]
    severity: str
    suggested_action: str

class DocumentInfo(BaseModel):
    path: str
    doc_id: str
    title: str
    standard: str
    last_modified: str
    lines: int
    freshness: str  # green, yellow, red


# ─── Alerts ───

class QMSAlert(BaseModel):
    id: str
    created_at: str
    type: str
    severity: AlertSeverity
    title: str
    description: str
    acknowledged: bool = False
