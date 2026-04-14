<p align="center">
  <img src="https://img.shields.io/badge/IEC_62304-Class_C-red?style=for-the-badge" alt="IEC 62304 Class C" />
  <img src="https://img.shields.io/badge/ISO_13485-QMS-blue?style=for-the-badge" alt="ISO 13485" />
  <img src="https://img.shields.io/badge/EU_MDR-2017%2F745-purple?style=for-the-badge" alt="EU MDR" />
  <img src="https://img.shields.io/badge/AI_Powered-Claude_API-orange?style=for-the-badge" alt="AI Powered" />
  <img src="https://img.shields.io/badge/Status-Production-green?style=for-the-badge" alt="Production" />
</p>

# MSTool-AI-QMS

**AI-Powered Quality Management System for IEC 62304 Class C Medical Device Software**

An intelligent regulatory compliance automation platform that continuously monitors, audits, and enforces quality standards for [MSTool-AI](https://github.com/nicolasbonilla/medical-imaging-viewer) — a brain MRI analysis tool classified as Class C medical device software under IEC 62304:2006+A1:2015.

> **Live Application**: [mstool-ai-qms.web.app](https://mstool-ai-qms.web.app)
> **API Documentation**: [Cloud Run /api/docs](https://mstool-ai-qms-354942400159.us-central1.run.app/api/docs)

---

## Table of Contents

- [Motivation](#motivation)
- [Key Capabilities](#key-capabilities)
- [System Architecture](#system-architecture)
- [AI Intelligence Layer](#ai-intelligence-layer)
- [Regulatory Coverage](#regulatory-coverage)
- [Compliance Scoring Algorithm](#compliance-scoring-algorithm)
- [Form Templates (TPL-01 to TPL-11)](#form-templates-tpl-01-to-tpl-11)
- [Traceability Model](#traceability-model)
- [Audit Engine](#audit-engine)
- [SOUP Monitoring](#soup-monitoring)
- [Security & Authentication](#security--authentication)
- [Deployment Architecture](#deployment-architecture)
- [API Reference](#api-reference)
- [Local Development](#local-development)
- [Operational Guide](#operational-guide)
- [Technology Stack](#technology-stack)
- [License](#license)

---

## Motivation

Regulatory compliance for Class C medical device software is complex, expensive, and traditionally manual. Commercial QMS tools (Ketryx ~$50K/yr, Greenlight Guru ~$30K/yr, MasterControl ~$100K+/yr) provide workflow management but lack deep code-level intelligence.

MSTool-AI-QMS takes a fundamentally different approach:

1. **Code-Aware Compliance** — Reads the actual source code via GitHub API, not just metadata. Understands which modules are Class C, which requirements are implemented, which tests exist.

2. **AI-Driven, Not Rule-Driven** — Uses Claude API (Anthropic) for intelligent analysis: root cause analysis, risk detection, form auto-fill, and natural language compliance chat.

3. **Autonomous Actions** — Goes beyond recommendations. The AI can generate CAPAs, fill regulatory forms, review code for compliance, and detect risks in real-time.

4. **Continuous Monitoring** — Every commit, every PR, every CI run is analyzed against IEC 62304 clauses in real-time.

---

## Key Capabilities

### 1. Compliance Dashboard
Real-time scoring engine that analyzes the MSTool-AI repository via GitHub API and computes weighted compliance scores across four dimensions:

| Standard | Weight | What It Measures |
|----------|--------|------------------|
| IEC 62304 | 35% | Test coverage, risk verification, documentation, input validation, auth coverage, CODEOWNERS |
| ISO 13485 | 30% | Document completeness, freshness, risk verification, test coverage, CODEOWNERS |
| IEC 81001-5-1 | 20% | Auth coverage, input validation, SOUP vulnerability, CODEOWNERS |
| CE Mark Overall | 15% | Weighted composite of all three + document completeness |

Includes: recent commits feed, CI pipeline status, auth coverage breakdown per route file, bar charts via Recharts.

### 2. Form Manager (TPL-01 to TPL-11)
Complete digital implementation of all 11 regulatory templates required by IEC 62304, ISO 13485, ISO 14971, IEC 81001-5-1, and EU MDR. Each template includes every field specified by the standard, organized by sections.

- **AI Auto-Fill** — Claude analyzes the codebase and pre-populates form fields with real data
- **Electronic Signatures** — Immutable signature records with user, role, and timestamp
- **PDF Export** — Professional PDFs via ReportLab with headers, watermarks, and signature blocks
- **Version Control** — Draft → In Review → Approved lifecycle with full audit trail
- **Firestore Persistence** — All forms survive server restarts

### 3. Traceability Explorer
Interactive graph visualization (@xyflow/react) showing the complete requirements-to-evidence chain:

```
Requirements (REQ-FUNC-XXX, REQ-SAFE-XXX, REQ-PERF-XXX)
    ↓ traces_to
Architecture (modules, interfaces)
    ↓ implemented_by
Code (backend services, frontend components)
    ↓ tested_by
Tests (unit tests, integration tests)

Requirements → mitigated_by → Risk Controls (HAZ-XXX, RC-XXX)
```

Parses real data from the repository: SRS for requirements, SAD for architecture, source code for REQ-ID references, test files for coverage, Risk Management File for hazards and controls.

**Orphan Detection**: Identifies requirements without tests, risk controls without verification, and code without requirement traceability — the exact gaps an auditor would find.

### 4. Audit Simulator
Simulates a real IEC 62304 Notified Body audit by checking 20 clauses (5.1–9.3) against actual repository evidence.

| Mode | Description | Checks |
|------|-------------|--------|
| **Full Audit** | All IEC 62304 clauses for Class C | 20 |
| **Random Commit** | Pick random commit, trace to requirements + CI + PRs | 3 |
| **Random Requirement** | Pick random REQ-ID, trace through code → tests → risk | 4 |

Evidence scoring: **STRONG** (full evidence) → **ADEQUATE** (partial) → **WEAK** (minimal) → **MISSING** (none).

Generates PDF audit reports with clause-by-clause results, identified gaps, and remediation recommendations.

### 5. SOUP Monitor
Software of Unknown Provenance management per IEC 62304 Clause 8 and IEC 81001-5-1:

- Parses `backend/requirements.txt` (Python) and `frontend/package.json` (npm)
- Classifies each dependency: **Class C** (clinical data: nibabel, numpy, scipy, pydicom), **Class B** (core app: fastapi, react), **Class A** (dev tools: pytest, vite)
- Scans for CVE vulnerabilities via NVD API 2.0
- Checks SBOM (CycloneDX) and SOUP review records
- Generates risk recommendations per dependency

### 6. Document Sync
Tracks all regulatory documents in `docs/` with freshness indicators:
- **Green** (< 30 days): Fresh
- **Yellow** (30–90 days): Review needed
- **Red** (> 90 days): Outdated — update required

Covers: IEC 62304, QMS, Clinical, Usability, MDR, AI Act documentation.

### 7. AI Compliance Assistant
Floating chat panel (available on every page) powered by Claude API with specialized QMS capabilities:

- **Detect Risks** — Analyzes recent commits for safety risks in Class C modules
- **Generate CAPA** — Full root cause analysis + 5 Whys + corrective/preventive actions from a problem description
- **Review Code** — IEC 62304 compliance review of any source file (fills TPL-03 automatically)
- **Compliance Chat** — Ask anything about IEC 62304, ISO 13485, EU MDR
- All actions logged to immutable audit trail

### 8. Operational Guide
Built-in guide page with:
- Daily workflow instructions per role (Developer, QA, QMS Manager)
- Template reference (TPL-01 to TPL-11) with when-to-use and responsible parties
- How-to for each page
- Roles & permissions matrix
- Audit preparation checklist (interactive)
- IEC 62304 clause-to-feature mapping

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                       │
│               Firebase Hosting (mstool-ai-qms.web.app)               │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │Dashboard │ │  Forms   │ │Traceab.  │ │  Audit   │ │   SOUP   │  │
│  │ Recharts │ │ Editor   │ │ @xyflow  │ │Simulator │ │ CVE Scan │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘  │
│       │             │            │             │             │        │
│  ┌────┴─────────────┴────────────┴─────────────┴─────────────┴────┐  │
│  │                    Axios + Firebase Auth Token                  │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
│                               │                                      │
│  ┌────────────────────────────┴───────────────────────────────────┐  │
│  │                     AI Assistant (Claude Chat)                  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS
┌───────────────────────────────┴──────────────────────────────────────┐
│                         BACKEND                                       │
│            Cloud Run (mstool-ai-qms-*.run.app)                       │
│                                                                       │
│  ┌─────────────────── FastAPI ────────────────────────────────────┐  │
│  │                                                                 │  │
│  │  /compliance/*    Scoring, auth coverage, documents, tests     │  │
│  │  /forms/*         CRUD, templates, fields, PDF, sign, approve  │  │
│  │  /audit/*         Run simulation, export PDF, history          │  │
│  │  /soup/*          Dependencies, CVE scan, summary              │  │
│  │  /users/*         Register, profile, roles, audit trail        │  │
│  │  /ai/*            Analyze, auto-fill, CAPA, review, chat      │  │
│  │                                                                 │  │
│  └───────┬───────────┬───────────┬───────────┬────────────────────┘  │
│          │           │           │           │                        │
│  ┌───────┴──┐ ┌──────┴──┐ ┌─────┴───┐ ┌────┴─────┐                 │
│  │ GitHub   │ │Firebase │ │ Claude  │ │  NVD     │                 │
│  │   API    │ │Admin SDK│ │   API   │ │  API     │                 │
│  │          │ │         │ │(Sonnet) │ │(CVE 2.0) │                 │
│  └────┬─────┘ └────┬────┘ └─────────┘ └──────────┘                 │
│       │            │                                                  │
└───────┼────────────┼──────────────────────────────────────────────────┘
        │            │
        ▼            ▼
   ┌─────────┐  ┌──────────┐
   │ GitHub  │  │Firestore │
   │  Repo   │  │  DB      │
   │medical- │  │qms_forms │
   │imaging- │  │qms_audit │
   │viewer   │  │qms_users │
   └─────────┘  └──────────┘
```

**Key Design Decisions:**
- **Separate application** — QMS does NOT modify medical device code. Read-only via GitHub API.
- **GitHub API over local filesystem** — Enables cloud deployment without local repo access.
- **Firebase Auth** — Shared infrastructure with MSTool-AI. Roles via custom claims.
- **Firestore** — Serverless, scales to zero, HIPAA-eligible, no database maintenance.
- **Cloud Run** — Serverless containers, auto-scaling, pay-per-request.

---

## AI Intelligence Layer

The AI service (`ai_service.py`) uses Claude API (Anthropic) with a specialized system prompt for IEC 62304 Class C compliance. It provides six capabilities:

### 1. Audit Analysis (`POST /ai/analyze-audit`)
Input: Audit result with per-clause scores.
Output: Risk assessment, prioritized recommendations, quick wins, blocker risks.
Each recommendation includes: severity, clause reference, action type, effort estimate, deadline.

### 2. Form Auto-Fill (`POST /ai/autofill`)
Input: Template ID (TPL-01 to TPL-11).
Process: Gathers relevant context from the repo (commits, CI, tests, risk file, dependencies) based on template type.
Output: Pre-populated field values with confidence scores and data sources.

### 3. CAPA Generation (`POST /ai/generate-capa`)
Input: Problem description, affected module, affected requirements.
Process: Reads actual module source code, performs 5 Whys analysis, assesses patient safety impact.
Output: Root cause analysis, risk assessment, corrective actions with deadlines, preventive actions, effectiveness checks.

### 4. Code Review (`POST /ai/review-code`)
Input: File path.
Process: Reads file from GitHub, evaluates against IEC 62304 checklist.
Output: TPL-03 Code Review Checklist data — coding standards, error handling, input validation, OWASP, traceability, issues found.

### 5. Risk Detection (`GET /ai/detect-risks`)
Process: Analyzes recent commits against Class C module list.
Output: Detected risks with severity, affected modules, related hazards, recommended actions, forms needed.

### 6. Compliance Chat (`POST /ai/chat`)
Free-form natural language interface for any compliance question. References IEC 62304 clauses, ISO 13485 sections, EU MDR articles.

---

## Regulatory Coverage

### IEC 62304:2006+A1:2015 — Medical Device Software Lifecycle

| Clause | Title | QMS Feature | Coverage |
|--------|-------|-------------|----------|
| 5.1 | Software Development Planning | Dashboard + TPL-10 | Automated |
| 5.2 | Software Requirements Analysis | Traceability + TPL-05 | Automated |
| 5.3 | Software Architectural Design | Traceability + TPL-05 | Automated |
| 5.4 | Software Detailed Design | Traceability | Automated |
| 5.5 | Unit Implementation & Verification | Dashboard + TPL-03/06 | Automated |
| 5.6 | Software Integration Testing | Dashboard (CI) + TPL-06 | Automated |
| 5.7 | Software System Testing | TPL-06 | Template |
| 5.8 | Software Release | TPL-02 | Template |
| 6.1 | Software Maintenance Plan | Doc Sync | Automated |
| 6.2 | Problem/Modification Analysis | TPL-01 + TPL-09 | Template + AI |
| 7.1 | Risk Analysis | Traceability + TPL-04 | Automated |
| 7.2 | Risk Control Measures | Traceability + TPL-04 | Automated |
| 7.3 | Risk Control Verification | TPL-04 | Template |
| 7.4 | Risk Mgmt of Changes | TPL-09 + AI Risk Detection | Automated + AI |
| 8.1 | Configuration Identification | SOUP + Dashboard | Automated |
| 8.2 | Change Control | TPL-09 | Template |
| 8.3 | Configuration Status Accounting | Dashboard + Git | Automated |
| 9.1 | Problem Reports | TPL-01 + AI CAPA | Template + AI |
| 9.2 | Investigation & Evaluation | AI CAPA (5 Whys) | AI |
| 9.3 | Advisory Notices | TPL-08 | Template |

### Additional Standards

| Standard | Scope | QMS Feature |
|----------|-------|-------------|
| ISO 13485:2016 | Quality Management System | Forms, Audit Trail, Document Control |
| ISO 14971:2019 | Risk Management | Traceability (HAZ/RC), TPL-04 |
| IEC 81001-5-1:2021 | Cybersecurity | SOUP Monitor, Auth Coverage |
| EU MDR 2017/745 | Medical Device Regulation | TPL-08, Compliance Scoring |
| EU AI Act 2024/1689 | AI Governance | Doc Sync (ai-act folder) |

---

## Compliance Scoring Algorithm

```python
# Per-metric scoring (0-100%)
breakdown = {
    "auth_coverage":     count_protected_endpoints / total_endpoints * 100,
    "input_validation":  count_validated_class_c_modules / total_class_c * 100,
    "test_coverage":     count_modules_with_tests / total_critical_modules * 100,
    "risk_verification": count_VERIFIED_controls / total_controls * 100,
    "doc_completeness":  count_existing_docs / expected_docs * 100,
    "doc_freshness":     heuristic_from_commit_activity,
    "soup_vulnerability": sbom_exists + reviews_exist → 50-90%,
    "codeowners":        count_class_c_in_codeowners / total_class_c * 100,
}

# Weighted standard scores
iec62304 = test*0.25 + risk*0.20 + docs*0.20 + validation*0.15 + auth*0.10 + owners*0.10
iso13485 = docs*0.30 + freshness*0.20 + risk*0.20 + test*0.15 + owners*0.15
cybersec = auth*0.30 + validation*0.25 + soup*0.25 + owners*0.20

# CE Mark composite
ce_mark = iec62304*0.35 + iso13485*0.30 + cybersec*0.20 + docs*0.15
```

---

## Form Templates (TPL-01 to TPL-11)

| ID | Title | Standard | Fields | Key Sections |
|----|-------|----------|--------|-------------|
| TPL-01 | Problem Report | IEC 62304 §9 | 19 | Identification, Problem Details, Investigation, CAPA, Verification, Resolution |
| TPL-02 | Release Checklist | IEC 62304 §5.8 | 17 | Release Info, Deliverables Checklist, Build Verification, Regulatory Checklist |
| TPL-03 | Code Review Checklist | IEC 62304 §5.5.3 | 18 | Review Info, Code Quality, Security, Safety, Performance, Findings |
| TPL-04 | Risk Control Verification | ISO 14971 §7.4 | 16 | Hazard, Risk Assessment, Control Measure, Verification, Residual Risk |
| TPL-05 | Design Review Record | IEC 62304 §5.3/5.4 | 12 | Review Info, Documents, Checks, Outcomes |
| TPL-06 | Test Execution Report | IEC 62304 §5.5.5 | 20 | Test Info, Environment, Results, Failures, Coverage, Anomalies |
| TPL-07 | SOUP Vulnerability Review | IEC 81001-5-1 §5.3.12 | 14 | Review Info, Package Analysis, Vulnerability Assessment, Risk, Follow-up |
| TPL-08 | Serious Incident Report | EU MDR Art. 87 | 18 | Identification, Device ID, Incident Details, Response, Investigation, Regulatory |
| TPL-09 | Change Control Record | IEC 62304 §8 | 17 | Request, Change Details, Impact Analysis, Classification, Implementation, Results |
| TPL-10 | Quality Gate Approval | IEC 62304 §5.1 | 14 | Gate Info, Criteria, Status, Risk Status, Quality Metrics, Decision |
| TPL-11 | Document Approval Record | ISO 13485 §4.2.4 | 13 | Document Info, Revision, Review Checklist, Distribution |

---

## Traceability Model

The traceability service parses five document types from the repository:

```
Source Document                    → Parsed Entities        → Node Type
─────────────────────────────────────────────────────────────────────────
SRS (02_Software_Requirements_*)   → REQ-FUNC/SAFE/PERF-XXX → requirement
SAD (03_Software_Architecture_*)   → Module definitions      → architecture
backend/app/services/*.py          → Code files + REQ refs   → code
backend/tests/unit/test_*.py       → Test files + module map → test
RMF (03_Risk_Management_File.md)   → HAZ-XXX, RC-XXX         → risk_control
```

Edge construction:
- `REQ → CODE`: Code files containing `REQ-XXX` in source
- `CODE → TEST`: Module name matching (`test_{module}` ↔ `{module}_service`)
- `REQ → RISK`: Co-occurrence within 500 chars in RMF
- `ARCH → CODE`: Module name substring matching
- `REQ → ARCH`: Keyword matching from requirement descriptions

---

## Audit Engine

The audit engine checks each IEC 62304 clause by verifying the existence and quality of evidence in the repository:

**Evidence Collection Methods:**
- Document existence check (e.g., SDP at `docs/iec62304/01_*.md`)
- Content keyword analysis (e.g., "lifecycle", "deliverable" in SDP)
- Requirement ID extraction and counting (regex: `REQ-[A-Z]+-\d+`)
- Test file enumeration and count
- CI workflow detection and success rate
- CODEOWNERS file analysis
- Risk control verification status counting

**Scoring:**
- ≥90% checks pass → **STRONG**
- ≥60% checks pass → **ADEQUATE**
- \>0% checks pass → **WEAK**
- 0% → **MISSING**

**Readiness Score** = weighted average of all clause scores (0–100%).

---

## SOUP Monitoring

### Safety Classification (IEC 62304)

| Class | Criteria | Examples |
|-------|----------|----------|
| **C** | Used in clinical data processing, directly affects diagnosis | nibabel, numpy, scipy, pydicom, scikit-image |
| **B** | Core application functionality, indirect safety impact | fastapi, firebase-admin, react, uvicorn, anthropic |
| **A** | Development/build tools only, no runtime impact | pytest, vite, typescript, eslint |

### CVE Scanning
- Source: NVD API v2.0 (`services.nvd.nist.gov/rest/json/cves/2.0`)
- Priority: Class C and B dependencies scanned first
- Output: CVE ID, CVSS score, severity, description, fix availability
- Rate limiting: respects NVD API limits (6 req/min without key)

---

## Security & Authentication

| Layer | Implementation |
|-------|----------------|
| **Identity** | Firebase Authentication (Email/Password + Google OAuth) |
| **Authorization** | Role-based access control via Firebase custom claims |
| **API Security** | Bearer token verification on all mutating endpoints |
| **Token Refresh** | Automatic refresh on 401 via Axios interceptor |
| **Audit Trail** | Immutable Firestore log of every action (who, what, when) |
| **Secrets** | `.env` and `env.yaml` excluded from git |

### Roles

| Role | Create Forms | Approve Forms | Run Audits | Manage Users | View Audit Trail |
|------|:---:|:---:|:---:|:---:|:---:|
| Admin | Y | Y | Y | Y | Y |
| QMS Manager | Y | Y | Y | Y | Y |
| Developer | Y | - | - | - | - |
| QA | Y | - | - | - | - |
| Clinical Advisor | - | - | - | - | - |
| Viewer | - | - | - | - | - |

First registered user automatically receives **Admin** role.

---

## Deployment Architecture

| Component | Service | URL |
|-----------|---------|-----|
| Frontend | Firebase Hosting | [mstool-ai-qms.web.app](https://mstool-ai-qms.web.app) |
| Backend | Google Cloud Run | [mstool-ai-qms-*.run.app](https://mstool-ai-qms-354942400159.us-central1.run.app) |
| Database | Cloud Firestore | Project: `mstool-ai-qms` |
| Auth | Firebase Auth | Project: `mstool-ai-qms` |
| Monitored Repo | GitHub API | `nicolasbonilla/medical-imaging-viewer` |

### Deploy Commands

```bash
# Frontend → Firebase Hosting
cd frontend && npm run build
cd .. && npx firebase deploy --only hosting --project mstool-ai-qms

# Backend → Cloud Run
cd backend
gcloud run deploy mstool-ai-qms \
  --source . \
  --project mstool-ai-qms \
  --region us-central1 \
  --env-vars-file env.yaml
```

---

## API Reference

### Health
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/` | No | Health check |
| GET | `/api/health` | No | API health |

### Compliance (7 endpoints)
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/v1/compliance/score` | Yes | Compliance scores with breakdown |
| GET | `/api/v1/compliance/auth-coverage` | Yes | Auth coverage per route file |
| GET | `/api/v1/compliance/documents` | Yes | Regulatory document inventory |
| GET | `/api/v1/compliance/tests` | Yes | Test file inventory |
| GET | `/api/v1/compliance/commits` | Yes | Recent commits from GitHub |
| GET | `/api/v1/compliance/pull-requests` | Yes | Pull requests from GitHub |
| GET | `/api/v1/compliance/ci-runs` | Yes | CI workflow runs |
| GET | `/api/v1/compliance/traceability` | Yes | Full traceability graph |

### Forms (9 endpoints)
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/v1/forms/templates` | No | List all 11 templates |
| GET | `/api/v1/forms/templates/{id}` | No | Template details |
| GET | `/api/v1/forms/templates/{id}/fields` | No | Template field definitions |
| POST | `/api/v1/forms/` | Editor | Create form from template |
| GET | `/api/v1/forms/` | Yes | List forms (filter by template/status) |
| GET | `/api/v1/forms/{id}` | Yes | Get form details |
| PUT | `/api/v1/forms/{id}` | Editor | Update form fields |
| POST | `/api/v1/forms/{id}/sign` | Yes | Add electronic signature |
| POST | `/api/v1/forms/{id}/approve` | Editor | Approve form |
| GET | `/api/v1/forms/{id}/pdf` | Yes | Export form as PDF |
| DELETE | `/api/v1/forms/{id}` | Editor | Delete form |

### Audit (3 endpoints)
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/api/v1/audit/run` | Yes | Run audit simulation |
| GET | `/api/v1/audit/history` | Yes | Audit history |
| POST | `/api/v1/audit/export-pdf` | Yes | Export audit report PDF |

### SOUP (4 endpoints)
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| GET | `/api/v1/soup/dependencies` | Yes | List all dependencies |
| GET | `/api/v1/soup/summary` | Yes | SOUP summary stats |
| POST | `/api/v1/soup/scan` | Yes | Scan for CVE vulnerabilities |
| GET | `/api/v1/soup/dependency/{name}` | Yes | Single dependency detail |

### Users (4 endpoints)
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/api/v1/users/me` | Yes | Register/get profile |
| GET | `/api/v1/users/me` | Yes | Get profile |
| GET | `/api/v1/users/` | Manager | List all users |
| PUT | `/api/v1/users/role` | Manager | Set user role |
| GET | `/api/v1/users/audit-trail` | Manager | View audit trail |

### AI Intelligence (6 endpoints)
| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | `/api/v1/ai/analyze-audit` | Yes | AI audit analysis + recommendations |
| POST | `/api/v1/ai/autofill` | Yes | AI form auto-fill from code |
| POST | `/api/v1/ai/generate-capa` | Yes | AI CAPA generation (5 Whys) |
| POST | `/api/v1/ai/review-code` | Yes | AI code review (TPL-03) |
| GET | `/api/v1/ai/detect-risks` | Yes | AI risk detection in recent changes |
| POST | `/api/v1/ai/chat` | Yes | AI compliance chat |

**Total: 34 API endpoints**

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Google Cloud SDK (for Firebase Admin)
- Firebase project with Auth + Firestore enabled

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Configure .env
cp .env.example .env  # Edit with your credentials:
# GITHUB_TOKEN=ghp_...
# ANTHROPIC_API_KEY=sk-ant-...  (optional, for AI features)
# GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceaccount.json

uvicorn app.main:app --port 8010 --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev  # Opens on http://localhost:5174
```

---

## Operational Guide

See [docs/QMS_Operational_Guide.md](docs/QMS_Operational_Guide.md) for the complete step-by-step guide, or access it from the **Guide** page in the application.

---

## Technology Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| FastAPI 0.115 | REST API framework |
| Firebase Admin SDK 6.5+ | Auth verification, Firestore |
| Anthropic Claude API | AI intelligence (Sonnet) |
| httpx | GitHub API + NVD API client |
| ReportLab | PDF generation |
| Pydantic 2.9 | Data validation |

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 + TypeScript | UI framework |
| Vite 6 | Build tool |
| Tailwind CSS 3.4 | Styling |
| Zustand | State management (auth) |
| @xyflow/react 12 | Traceability graph |
| Recharts | Dashboard charts |
| Firebase SDK | Auth (email + Google) |
| Axios | HTTP client with token refresh |
| Lucide React | Icons |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Firebase Hosting | Frontend CDN |
| Google Cloud Run | Backend containers |
| Cloud Firestore | Document database |
| Firebase Auth | Identity + RBAC |
| GitHub API | Repository analysis |
| NVD API 2.0 | CVE vulnerability data |

---

## License

Proprietary. All rights reserved.

---

<p align="center">
  <strong>MSTool-AI-QMS</strong> — AI-powered regulatory compliance for Class C medical device software<br/>
  <sub>IEC 62304 : ISO 13485 : ISO 14971 : IEC 81001-5-1 : EU MDR 2017/745 : EU AI Act 2024/1689</sub>
</p>