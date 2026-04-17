<p align="center">
  <img src="https://img.shields.io/badge/IEC_62304-Class_C-red?style=for-the-badge" alt="IEC 62304 Class C" />
  <img src="https://img.shields.io/badge/ISO_13485-QMS-blue?style=for-the-badge" alt="ISO 13485" />
  <img src="https://img.shields.io/badge/EU_MDR-2017%2F745-purple?style=for-the-badge" alt="EU MDR" />
  <img src="https://img.shields.io/badge/AI_Powered-Claude_Sonnet_4-orange?style=for-the-badge" alt="AI Powered" />
  <img src="https://img.shields.io/badge/MCP-Model_Context_Protocol-teal?style=for-the-badge" alt="MCP" />
  <img src="https://img.shields.io/badge/Status-Production-green?style=for-the-badge" alt="Production" />
</p>

# MSTool-AI-QMS

## AI-Powered Quality Management System for IEC 62304 Class C Medical Device Software

An autonomous regulatory compliance platform that leverages **large language models (LLMs)**, **agentic AI architectures**, and **Model Context Protocol (MCP)** to continuously monitor, audit, and enforce quality standards for [MSTool-AI](https://github.com/nicolasbonilla/medical-imaging-viewer) — a brain MRI analysis and multiple sclerosis lesion tracking tool classified as **Class C** (highest safety class) under IEC 62304:2006+A1:2015.

> **Production**: [mstool-ai-qms.web.app](https://mstool-ai-qms.web.app)  
> **API**: [Cloud Run /api/docs](https://mstool-ai-qms-354942400159.us-central1.run.app/api/docs)  
> **Monitored Device**: [app.mstool-ai.com](https://app.mstool-ai.com)
>
> 📚 **Operator docs**: [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md) ·
> [docs/USER_GUIDE.md](docs/USER_GUIDE.md) ·
> [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Latest Capabilities (April 2026)

| Capability | Surface | Backed by |
|---|---|---|
| **10 validated AI agents** | Agents page | Claude Haiku 4.5 / Sonnet 4.5 / Opus 4.6 |
| **Constitutional Classifier guardrails** | Every agent run | Haiku safety classifier on output |
| **AI Validation Dossier (IQ/OQ/PQ + PCCP)** | Insights → Download | FDA PCCP Final Guidance Aug 2025 |
| **Drift Canary suite** | Agents page → "Run canaries" | Weekly cron + Firestore-backed history |
| **PCCP Generator** | Agents page → "Generate PCCP" | Opus 4.6 supervisor over agent inventory |
| **Agent Skills bundles** | `backend/app/agents/skills/` | Anthropic Agent Skills pattern |
| **MCP Gateway (IDE integration)** | `/api/v1/mcp` | JSON-RPC 2.0; 7 tools exposed |
| **Cryptographic e-signatures** | Releases → Sign | Cloud KMS RSA-PSS-SHA256 (HMAC fallback) |
| **GitHub PR auto-review** | Webhooks → PR Reviewer agent | Posts comment + check run on PR open/sync |
| **WORM ledger with hash chain** | Activity page | Firestore transaction-based prev_hash + content_hash |
| **In-process scheduler with leader election** | `/system/scheduler/status` | APScheduler + Firestore leases |
| **Rate limiting (slowapi + Firestore caps)** | `/api/v1/agents/*/invoke` | Per-user/min, per-user/day, global/hour |
| **Real Dashboard with 5 charts** | Dashboard | Recharts: trend, radial, CI bars, heatmap, sparklines |
| **CE Mark Submission Package ZIP** | Releases → Export | One-click bundle for FDA / Notified Body |

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Problem Statement](#2-problem-statement)
3. [What Is MSTool-AI-QMS](#3-what-is-mstool-ai-qms)
4. [Why This Matters — Regulatory Context](#4-why-this-matters--regulatory-context)
5. [System Architecture](#5-system-architecture)
6. [AI Architecture — The Intelligence Layer](#6-ai-architecture--the-intelligence-layer)
7. [Model Context Protocol (MCP) Integration](#7-model-context-protocol-mcp-integration)
8. [Agentic AI — From Recommendations to Actions](#8-agentic-ai--from-recommendations-to-actions)
9. [LLM-Powered Capabilities in Detail](#9-llm-powered-capabilities-in-detail)
10. [Compliance Scoring — Computational Model](#10-compliance-scoring--computational-model)
11. [Traceability Graph — Knowledge Representation](#11-traceability-graph--knowledge-representation)
12. [Audit Engine — Automated Evidence Verification](#12-audit-engine--automated-evidence-verification)
13. [SOUP Monitoring — Software Supply Chain Security](#13-soup-monitoring--software-supply-chain-security)
14. [Form Templates — Structured Regulatory Evidence](#14-form-templates--structured-regulatory-evidence)
15. [Security Model](#15-security-model)
16. [Deployment Architecture](#16-deployment-architecture)
17. [API Reference (111+ Endpoints)](#17-api-reference-34-endpoints)
18. [Technology Stack](#18-technology-stack)
19. [Comparison with Commercial QMS Tools](#19-comparison-with-commercial-qms-tools)
20. [Future Work — Research Directions](#20-future-work--research-directions)
21. [References](#21-references)

---

## 1. Abstract

Regulatory compliance for Class C medical device software under IEC 62304 requires continuous verification of requirements traceability, risk management, configuration control, and lifecycle documentation across hundreds of artifacts. This process is traditionally manual, error-prone, and constitutes a significant portion of development cost (estimated 30-40% of total effort in regulated software projects).

**MSTool-AI-QMS** introduces an AI-native approach to quality management that fundamentally differs from existing commercial solutions. Rather than digitizing manual workflows (the approach taken by Ketryx, Greenlight Guru, MasterControl, and similar tools), this platform employs:

1. **Code-level static analysis via GitHub API** — directly reads source code, test files, and documentation from the medical device repository to compute compliance metrics
2. **Large Language Model reasoning (Claude Sonnet 4, Anthropic)** — performs root cause analysis, code review, risk detection, and form auto-fill using a specialized regulatory compliance system prompt
3. **Model Context Protocol (MCP) architecture** — enables the LLM to interact with external systems (repository, database, CI/CD) through a standardized tool-use interface
4. **Agentic workflows** — the system doesn't just recommend actions but can autonomously generate CAPAs, fill regulatory forms, review code, and detect risks

The platform monitors the MSTool-AI repository (a brain MRI viewer with AI-powered segmentation, volumetry, lesion tracking, and clinical report generation) and provides real-time compliance scoring against IEC 62304, ISO 13485, IEC 81001-5-1, EU MDR 2017/745, and EU AI Act 2024/1689.

---

## 2. Problem Statement

### The Compliance Gap in AI-Powered Medical Devices

Modern medical device software increasingly incorporates machine learning models (segmentation networks, classification models, anomaly detection), creating a regulatory challenge: how do you apply a deterministic compliance framework (IEC 62304) to software that includes non-deterministic AI components?

**Specific challenges for MSTool-AI:**

| Challenge | IEC 62304 Requirement | MSTool-AI Context |
|-----------|----------------------|-------------------|
| Traceability | Every code module must trace to a requirement | 30+ backend services, 106 requirements, 36+ risk controls |
| Risk Management | Every hazard must have a verified risk control | Brain volumetry errors could lead to misdiagnosis |
| SOUP Management | Every third-party library must be assessed | 40+ Python packages, 20+ npm packages including ONNX Runtime |
| Configuration Control | Every change must be impact-assessed | 8 Class C modules with patient safety implications |
| Verification | Every requirement must have test evidence | Unit tests, integration tests, CI pipeline |
| Documentation | 33+ regulatory documents must stay current | SDP, SRS, SAD, RMF, test plans, release records |

**The cost problem**: Commercial QMS solutions (Ketryx ~$50K/year, Greenlight Guru ~$30K/year, MasterControl ~$100K+/year, Veeva Vault ~$200K+/year) provide workflow management but lack the deep code-level intelligence and AI capabilities required for software-intensive medical devices.

**Our hypothesis**: A QMS that can **read and understand the actual source code** and **reason about compliance using LLMs** can automate 60-80% of manual compliance work while providing higher accuracy than human-only review.

---

## 3. What Is MSTool-AI-QMS

MSTool-AI-QMS is a **companion application** (separate codebase, separate deployment) that continuously monitors the MSTool-AI medical device repository via GitHub API and provides:

### Core Functions

| Function | Description | AI Role |
|----------|-------------|---------|
| **Compliance Dashboard** | Real-time scoring across 4 standards with 8 sub-metrics | Scoring algorithm with heuristic weighting |
| **Form Manager** | 11 regulatory templates (178 total fields) with CRUD, signatures, PDF export | **LLM auto-fills forms** from code analysis |
| **Traceability Explorer** | Interactive graph (242 nodes, 216 edges) showing REQ→ARCH→CODE→TEST→RISK | **LLM-assisted gap detection** |
| **Audit Simulator** | 20 IEC 62304 clauses checked against real evidence | **LLM generates remediation plans** |
| **SOUP Monitor** | Dependency parsing + NVD CVE scanning + safety classification | **LLM risk assessment** per dependency |
| **AI Assistant** | Floating chat for any compliance question | **LLM reasoning** about IEC 62304/ISO 13485/EU MDR |
| **Risk Detector** | Monitors commits for safety-relevant changes | **LLM classifies risk** of code changes |
| **CAPA Generator** | Generates root cause analysis + corrective/preventive actions | **LLM performs 5 Whys analysis** |
| **Code Reviewer** | Reviews source files against IEC 62304 checklist | **LLM fills TPL-03** automatically |

### What It Does NOT Do
- Does **not** modify the medical device source code (read-only via GitHub API)
- Does **not** replace human judgment for patient safety decisions
- Does **not** make autonomous regulatory submissions
- Every AI output is presented for human review before any action is taken

---

## 4. Why This Matters — Regulatory Context

### IEC 62304 Software Safety Classification

IEC 62304:2006+A1:2015 classifies medical device software into three safety classes based on the severity of harm that could result from a software failure:

| Class | Severity | Requirements | MSTool-AI Modules |
|-------|----------|-------------|-------------------|
| **A** | No injury or damage to health possible | Basic lifecycle process | Configuration, UI components |
| **B** | Non-serious injury possible | A + detailed design, unit verification | API routes, authentication |
| **C** | Death or serious injury possible | B + additional detailed requirements | `ai_segmentation_service.py`, `brain_volumetry_service.py`, `brain_report_service.py`, `lesion_analysis_service.py`, `ms_region_classifier.py`, `nifti_utils.py`, `dicom_utils.py`, `edgeAI.worker.ts` |

**MSTool-AI has 8 Class C modules** — these perform brain MRI analysis where errors could lead to missed lesions, incorrect volumetric measurements, or erroneous clinical reports affecting treatment decisions for multiple sclerosis patients.

### EU MDR and CE Marking

The EU Medical Devices Regulation (2017/745) requires manufacturers to demonstrate conformity through a Technical Documentation file that includes software lifecycle documentation per IEC 62304. A Notified Body audit examines this documentation in detail.

**MSTool-AI-QMS automates the preparation and continuous maintenance of this documentation.**

### The EU AI Act Dimension

MSTool-AI incorporates AI models (segmentation networks, classification models). The EU AI Act (2024/1689) classifies medical AI as **high-risk** (Annex III, point 5), requiring:
- Risk management system (Article 9) → **Covered by our Risk Management integration**
- Data governance (Article 10) → **Tracked in documentation**
- Technical documentation (Article 11) → **Automated by our Doc Sync**
- Transparency (Article 13) → **AI report service includes model provenance**
- Human oversight (Article 14) → **All AI outputs require human review**

---

## 5. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                              │
│                Firebase Hosting (mstool-ai-qms.web.app)                │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │Dashboard │ │  Forms   │ │Traceab.  │ │  Audit   │ │   SOUP   │    │
│  │ Recharts │ │ Editor   │ │ @xyflow  │ │Simulator │ │ CVE Scan │    │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │
│  ┌────┴───────┐ ┌───┴────┐ ┌────┴────┐ ┌─────┴────┐ ┌─────┴────┐    │
│  │  Guide    │ │ Login  │ │Doc Sync │ │AI Assist │ │  Users   │    │
│  │ (Docs)    │ │Firebase│ │Freshness│ │ (Chat)   │ │  (RBAC)  │    │
│  └────┬──────┘ └───┬────┘ └────┬────┘ └─────┬────┘ └─────┬────┘    │
│       └────────────┴──────────┴────────────┴────────────┘           │
│                            │ Axios + Bearer Token                    │
└────────────────────────────┼─────────────────────────────────────────┘
                             │ HTTPS (TLS 1.3)
┌────────────────────────────┼─────────────────────────────────────────┐
│                    APPLICATION LAYER                                  │
│              Cloud Run (Serverless Containers)                        │
│                                                                       │
│  ┌──────────────────── FastAPI 0.115 ─────────────────────────────┐  │
│  │  /compliance/*  │  /forms/*  │  /audit/*  │  /soup/*  │ /ai/* │  │
│  │  /users/*       │  /traceability                               │  │
│  └────────┬────────┴────────┬──┴────────┬───┴─────┬──────┴───────┘  │
│           │                 │           │         │                   │
│  ┌────────┴──────────┐     │    ┌──────┴──────┐  │                  │
│  │  INTELLIGENCE     │     │    │  ANALYSIS   │  │                  │
│  │     LAYER         │     │    │    LAYER    │  │                  │
│  │                   │     │    │             │  │                  │
│  │ ┌──────────────┐  │     │    │ compliance  │  │                  │
│  │ │  ai_service   │  │     │    │ traceability│  │                  │
│  │ │  (Claude API) │  │     │    │ audit_engine│  │                  │
│  │ │              │  │     │    │ soup_service│  │                  │
│  │ │ - analyze    │  │     │    │ pdf_service │  │                  │
│  │ │ - autofill   │  │     │    │             │  │                  │
│  │ │ - capa       │  │     │    └──────┬──────┘  │                  │
│  │ │ - review     │  │     │           │         │                  │
│  │ │ - detect     │  │     │    ┌──────┴──────┐  │                  │
│  │ │ - chat       │  │     │    │  DATA       │  │                  │
│  │ └──────┬───────┘  │     │    │  ACCESS     │  │                  │
│  │        │          │     │    │             │  │                  │
│  └────────┼──────────┘     │    │ github_svc  │  │                  │
│           │                │    │ firestore   │  │                  │
│           │                │    │ form_tpl    │  │                  │
│           │                │    └──────┬──────┘  │                  │
│           ▼                │           │         │                  │
│  ┌─────────────┐   ┌──────┴────┐  ┌───┴───┐  ┌──┴──────┐          │
│  │  Anthropic  │   │ Firebase  │  │GitHub │  │  NVD    │          │
│  │  Claude API │   │ Admin SDK │  │  API  │  │  API    │          │
│  │  (Sonnet 4) │   │           │  │       │  │(CVE2.0)│          │
│  └─────────────┘   └───────────┘  └───────┘  └─────────┘          │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
                             │              │
                    ┌────────┴──┐    ┌──────┴──────┐
                    │ Firestore │    │   GitHub    │
                    │           │    │   Repo      │
                    │ qms_forms │    │ medical-    │
                    │ qms_audit │    │ imaging-    │
                    │ qms_users │    │ viewer      │
                    └───────────┘    │ (106 REQs)  │
                                     │ (8 Class C) │
                                     │ (11 tests)  │
                                     │ (33+ docs)  │
                                     └─────────────┘
```

### Architectural Principles

1. **Read-Only Observer Pattern** — The QMS never modifies the medical device repository. All analysis is performed via read-only GitHub API calls. This is a deliberate safety decision: a QMS bug should never be able to corrupt the medical device.

2. **Separation of Concerns** — Intelligence (Claude API), Data Access (GitHub API, Firestore), Analysis (scoring, traceability, audit), and Presentation (React) are cleanly separated. Any component can be replaced independently.

3. **Serverless-First** — Cloud Run (backend) and Firebase Hosting (frontend) scale to zero when not in use. No standing infrastructure costs during idle periods.

4. **Immutable Audit Trail** — Every action (form creation, signature, audit run, AI query) is logged to Firestore with user identity, timestamp, and action details. This audit trail itself satisfies ISO 13485 Section 4.2.4 requirements for record control.

---

## 6. AI Architecture — The Intelligence Layer

### 6.1 LLM Selection and Rationale

We use **Claude Sonnet 4** (Anthropic, model ID: `claude-sonnet-4-20250514`) for all AI capabilities. The selection criteria:

| Criterion | Why Claude Sonnet 4 |
|-----------|-------------------|
| **Context window** | 200K tokens — can process entire regulatory documents + source code in a single call |
| **Safety alignment** | Anthropic's Constitutional AI training reduces hallucination in safety-critical contexts |
| **Structured output** | Reliable JSON generation for form auto-fill and structured analysis |
| **Tool use** | Native function calling support for future MCP integration |
| **Reasoning quality** | Superior performance on document analysis and multi-step reasoning tasks |
| **Cost efficiency** | ~$3/M input, $15/M output tokens — 10x cheaper than Opus for routine analysis |

### 6.2 System Prompt Engineering

The AI service uses a carefully crafted system prompt that establishes the LLM's role as an IEC 62304 regulatory expert. Key design decisions:

```python
SYSTEM_PROMPT = """You are an expert IEC 62304 / ISO 13485 regulatory compliance
AI assistant for MSTool-AI, a Class C medical device software for brain MRI analysis.

Your role:
- Analyze compliance data and provide specific, actionable recommendations
- Generate content for regulatory forms (TPL-01 to TPL-11) based on real code and data
- Perform root cause analysis and generate CAPAs
- Review code for safety and compliance issues
- Detect risks in code changes

Rules:
- Always reference specific IEC 62304 clauses, ISO 13485 sections, or EU MDR articles
- Be specific — name files, requirement IDs, hazard IDs
- Prioritize patient safety above all else
- When recommending actions, be concrete: "Create TPL-04 for HAZ-003" not "consider reviewing risks"
- Format output as structured JSON when requested
- Use severity levels: CRITICAL, HIGH, MEDIUM, LOW
"""
```

**Prompt design principles:**

1. **Domain grounding** — The prompt specifies the exact medical device (brain MRI analysis), safety class (C), and applicable standards. This constrains the LLM's responses to the relevant regulatory domain.

2. **Specificity mandate** — "Be specific — name files, requirement IDs" prevents generic compliance advice and forces the LLM to reference actual artifacts from the repository.

3. **Safety-first hierarchy** — "Prioritize patient safety above all else" establishes the correct priority ordering for the medical device context.

4. **Structured output** — JSON response format enables programmatic consumption of AI outputs (e.g., auto-filling form fields, creating action items).

### 6.3 Context Augmentation Strategy

Each AI capability uses a different context augmentation strategy depending on the task:

```
┌──────────────────────────────────────────────────────────┐
│                   AI Service Call Flow                     │
│                                                           │
│  User Request                                             │
│       │                                                   │
│       ▼                                                   │
│  ┌─────────────────┐                                      │
│  │ Context Gatherer │ ── Selects relevant data ──┐        │
│  └────────┬────────┘                             │        │
│           │                                      │        │
│  ┌────────┴──────────────────────────────────────┴───┐    │
│  │              Context Sources                       │    │
│  │                                                    │    │
│  │  TPL-01,09 → Recent commits (GitHub API)          │    │
│  │  TPL-02    → CI runs + test files + package.json  │    │
│  │  TPL-03    → Recent PRs (GitHub API)              │    │
│  │  TPL-04    → Risk Management File (full text)     │    │
│  │  TPL-06    → Test files + CI results              │    │
│  │  TPL-07    → requirements.txt (all dependencies)  │    │
│  │  TPL-11    → Document inventory (docs/iec62304/)  │    │
│  │  CAPA      → Module source code (first 3000 chars)│    │
│  │  Review    → Full file content (first 8000 chars) │    │
│  │  Risks     → Commit messages + Class C module list│    │
│  └────────────────────────┬──────────────────────────┘    │
│                           │                               │
│                           ▼                               │
│  ┌────────────────────────────────────────────────────┐   │
│  │         Claude Sonnet 4 API Call                    │   │
│  │  System: IEC 62304 expert prompt                   │   │
│  │  User: Task-specific prompt + gathered context     │   │
│  │  Max tokens: 2048-4096                             │   │
│  └────────────────────────┬───────────────────────────┘   │
│                           │                               │
│                           ▼                               │
│  ┌────────────────────────────────────────────────────┐   │
│  │         JSON Response Parsing                       │   │
│  │  - Extract JSON from markdown code blocks          │   │
│  │  - Fallback to raw text if parsing fails           │   │
│  │  - Return structured data to frontend              │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

This **Retrieval-Augmented Generation (RAG)** pattern — where we retrieve real data from the repository before prompting the LLM — ensures that AI outputs are grounded in actual evidence rather than the model's parametric knowledge.

---

## 7. Model Context Protocol (MCP) Integration

### 7.1 What Is MCP

The **Model Context Protocol** (Anthropic, 2024) is an open standard for connecting LLMs to external data sources and tools. It provides a standardized interface for:

- **Resources**: Read-only data the LLM can access (documents, database records)
- **Tools**: Functions the LLM can invoke to take actions (create PR, update document, run test)
- **Prompts**: Pre-defined prompt templates for common workflows

### 7.2 MCP in MSTool-AI Ecosystem

The parent MSTool-AI application already implements MCP servers for medical imaging:

```
MSTool-AI MCP Servers (existing):
├── imaging_server.py    → Brain imaging tools (metadata, slices, segmentation)
├── segmentation_server.py → AI segmentation (auto, interactive, volumetry)
└── report_server.py     → Report generation (templates, differential diagnosis)
```

MSTool-AI-QMS extends this MCP architecture for regulatory compliance:

### 7.3 QMS MCP Architecture (Current + Planned)

```
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Server Architecture                       │
│                                                                  │
│  ┌──────────────────── CURRENT (via AI Service) ─────────────┐  │
│  │                                                            │  │
│  │  The ai_service.py acts as a proto-MCP layer:              │  │
│  │                                                            │  │
│  │  Tools (actions the AI can take):                          │  │
│  │  ├── analyze_audit(result) → recommendations              │  │
│  │  ├── autofill_form(template_id) → field values            │  │
│  │  ├── generate_capa(description) → root cause + actions    │  │
│  │  ├── review_code(file_path) → compliance checklist        │  │
│  │  ├── detect_risks() → risk assessment                     │  │
│  │  └── chat(message) → natural language response            │  │
│  │                                                            │  │
│  │  Resources (data the AI can read):                         │  │
│  │  ├── GitHub API → source code, docs, commits, PRs, CI     │  │
│  │  ├── Firestore → forms, audit trail, user profiles        │  │
│  │  └── NVD API → CVE vulnerability data                     │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────── PLANNED (FastMCP) ────────────────────┐  │
│  │                                                            │  │
│  │  qms_documents_server.py (MCP over stdio/SSE):             │  │
│  │  ├── Tool: read_document(path) → document content         │  │
│  │  ├── Tool: update_document(path, content) → confirmation  │  │
│  │  ├── Tool: create_document(template, data) → new doc      │  │
│  │  ├── Resource: docs/iec62304/* → all regulatory docs      │  │
│  │  └── Resource: docs/qms/* → QMS procedures                │  │
│  │                                                            │  │
│  │  qms_compliance_server.py:                                 │  │
│  │  ├── Tool: run_audit(mode) → audit results                │  │
│  │  ├── Tool: get_score() → compliance scores                │  │
│  │  ├── Tool: get_traceability() → graph data                │  │
│  │  ├── Tool: create_form(template, fields) → form record    │  │
│  │  └── Prompt: audit_preparation → guided audit workflow     │  │
│  │                                                            │  │
│  │  qms_capa_server.py:                                       │  │
│  │  ├── Tool: analyze_problem(description) → CAPA            │  │
│  │  ├── Tool: create_pr(title, changes) → GitHub PR          │  │
│  │  ├── Tool: update_risk_file(hazard) → RMF update          │  │
│  │  └── Prompt: incident_response → guided CAPA workflow     │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Transport options:                                              │
│  ├── stdio (for Claude Desktop / Claude Code integration)        │
│  └── SSE over HTTP (for web-based AI assistant)                  │
│                                                                  │
│  Launch: python -m app.mcp.qms_server --sse --port 8011         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Why MCP Matters for QMS

Traditional QMS tools are closed systems. MCP transforms the QMS into an **AI-accessible knowledge base and action interface**:

| Without MCP | With MCP |
|-------------|----------|
| Human reads audit report, manually creates action items | AI reads audit result → generates CAPA → creates form → assigns to team |
| Human checks SOUP list monthly, manually queries NVD | AI monitors dependency changes → scans CVEs → creates TPL-07 review |
| Human traces requirements manually in a spreadsheet | AI traverses code → finds REQ references → builds traceability graph |
| Human writes code review checklist from memory | AI reads PR diff → evaluates against IEC 62304 → fills TPL-03 |

The MCP architecture enables **any MCP-compatible AI client** (Claude Desktop, Claude Code, custom agents) to interact with the QMS, making compliance a natural part of the development workflow rather than a separate burden.

---

## 8. Agentic AI — From Recommendations to Actions

### 8.1 The Spectrum of AI Autonomy in QMS

```
Level 0: Manual         — Human does everything
Level 1: Informational  — AI shows scores, human decides (most QMS tools)
Level 2: Suggestive     — AI recommends actions, human executes
Level 3: Assistive      — AI drafts actions, human reviews and approves  ← WE ARE HERE
Level 4: Autonomous     — AI executes actions, human monitors
Level 5: Self-Healing   — AI detects + fixes + verifies without human
```

**MSTool-AI-QMS operates at Level 3** — the AI generates complete outputs (CAPAs, form data, code reviews, risk assessments) that are presented to the human for review before any action is taken. This is the appropriate autonomy level for a Class C medical device context where patient safety requires human oversight (EU AI Act Article 14).

### 8.2 Agentic Capabilities

| Agent | Trigger | Analysis | Action | Human Gate |
|-------|---------|----------|--------|:----------:|
| **CAPA Agent** | User describes problem | LLM performs 5 Whys, reads module code | Generates corrective + preventive actions, suggests forms | Review before creating |
| **Code Review Agent** | User specifies file | LLM reads source code from GitHub | Fills TPL-03 checklist, identifies issues with line numbers | Review before saving |
| **Risk Detection Agent** | User triggers or scheduled | LLM analyzes recent commits vs Class C modules | Flags risks, suggests TPL-09 Change Control | Review before acting |
| **Audit Analysis Agent** | After audit run | LLM analyzes per-clause results | Prioritized remediation plan with effort estimates | Review before executing |
| **Auto-Fill Agent** | User creates a form | LLM reads relevant repo data per template type | Pre-populates form fields with real data | Review before saving |
| **Compliance Chat Agent** | User asks question | LLM reasons about IEC 62304/ISO 13485/EU MDR | Natural language guidance with clause references | Informational |

### 8.3 Agent Implementation Pattern

Each agent follows the same three-phase pattern:

```python
class AIService:
    def agent_action(self, input_data):
        # Phase 1: GATHER — Retrieve relevant context from external sources
        context = self._gather_context(input_data)  # GitHub API, Firestore, NVD
        
        # Phase 2: REASON — LLM analyzes context with task-specific prompt
        prompt = self._build_prompt(input_data, context)
        response = self._call_claude(prompt)  # Claude Sonnet 4
        
        # Phase 3: STRUCTURE — Parse LLM output into actionable data
        return self._parse_response(response)  # JSON extraction + validation
```

This pattern ensures that AI outputs are always **grounded in real data** (Phase 1), **reasoned through by a capable LLM** (Phase 2), and **structured for programmatic use** (Phase 3).

---

## 9. LLM-Powered Capabilities in Detail

### 9.1 CAPA Generation (Corrective and Preventive Action)

**Input**: Problem description + optional module name + optional requirement IDs

**Process**:
1. If module specified, reads first 3000 chars of source code from GitHub
2. Constructs prompt with problem context + code + IEC 62304 Class C framing
3. LLM performs root cause analysis using **5 Whys** methodology
4. LLM assesses risk using ISO 14971 severity/probability matrix
5. LLM generates corrective actions with deadlines and verification methods
6. LLM generates preventive actions with implementation types
7. LLM specifies effectiveness checks with timeline and metrics

**Output structure**:
```json
{
  "root_cause_analysis": {
    "category": "software_defect|design_flaw|requirements_gap|process_failure|human_error",
    "description": "...",
    "contributing_factors": ["..."],
    "five_whys": ["Why 1", "Why 2", "Why 3", "Why 4", "Why 5"]
  },
  "risk_assessment": {
    "severity": "Catastrophic|Critical|Serious|Minor|Negligible",
    "probability": "Frequent|Probable|Occasional|Remote|Improbable",
    "risk_level": "Unacceptable|ALARP|Acceptable",
    "patient_safety_impact": "..."
  },
  "corrective_actions": [...],
  "preventive_actions": [...],
  "effectiveness_check": {...},
  "forms_to_create": [{"template_id": "TPL-XX", "reason": "..."}]
}
```

### 9.2 AI Code Review

**Input**: File path (e.g., `backend/app/services/brain_volumetry_service.py`)

**Process**:
1. Reads full file content from GitHub API (up to 8000 chars)
2. Evaluates against TPL-03 Code Review Checklist criteria:
   - Coding standards compliance
   - Error handling adequacy
   - Input validation presence
   - OWASP Top 10 security review
   - Hardcoded credential detection
   - Logging practices (no PII)
   - Requirement traceability (REQ-ID references)
   - Risk control implementation
   - Memory management
   - Resource cleanup
3. Identifies specific issues with line numbers and severity

**Clinical significance**: For Class C modules, a code review failure on input validation or error handling could mean that malformed DICOM/NIfTI data causes incorrect brain measurements — directly impacting patient diagnosis.

### 9.3 Risk Detection

**Input**: None (analyzes recent repository activity)

**Process**:
1. Fetches last 5 commits from GitHub API
2. Compares commit messages and affected files against the Class C module list
3. LLM classifies each change by risk level
4. Identifies missing change control documentation

**Output**: List of detected risks with severity, affected modules, related hazards (HAZ-XXX), recommended actions, and forms needed (TPL-09 for change control, TPL-04 for risk verification).

### 9.4 Form Auto-Fill

**Input**: Template ID (TPL-01 through TPL-11)

**Process**:
1. Template-specific context gathering (see Section 6.3)
2. LLM generates realistic field values based on actual repository data
3. Each field includes a confidence score (0.0–1.0) and source attribution

**Example**: For TPL-06 (Test Execution Report), the AI reads the test file list and CI run results, then fills in: test_date, test_level ("Unit"), total_tests (count from files), passed/failed (from CI), coverage percentages (from CI artifacts), environment details (from package.json/requirements.txt).

---

## 10. Compliance Scoring — Computational Model

### 10.1 Metric Computation

Each of the 8 sub-metrics is computed by analyzing the actual repository:

| Metric | Data Source | Computation |
|--------|------------|-------------|
| `auth_coverage` | `backend/app/api/routes/*.py` | Count of `get_current_active_user` dependency injections / total async endpoint functions |
| `input_validation` | 5 Class C service files | Presence of `raise ValueError` or `REQ-SAFE-005` reference per file |
| `test_coverage` | `backend/tests/unit/test_*.py` | Count of modules with corresponding test file / 8 critical modules |
| `risk_verification` | `docs/iec62304/records/risk_verification/*.md` | Count of "VERIFIED" / (count of "VERIFIED" + "PARTIAL") in latest record |
| `doc_completeness` | `docs/{iec62304,qms,clinical,usability,mdr,ai-act}/*.md` | Count of existing .md files / expected count (33 total) |
| `doc_freshness` | Recent 100 commits | Heuristic: commits with "doc"/"compliance"/"iec"/"iso" in message → activity score |
| `soup_vulnerability` | `docs/iec62304/SBOM_CycloneDX.json` + `records/soup_reviews/` | SBOM exists + reviews exist → 50-90% scale |
| `codeowners_coverage` | `.github/CODEOWNERS` | Count of 8 Class C filenames found in CODEOWNERS / 8 |

### 10.2 Standard Score Formulas

```
IEC 62304 = test×0.25 + risk×0.20 + docs×0.20 + validation×0.15 + auth×0.10 + owners×0.10

ISO 13485 = docs×0.30 + freshness×0.20 + risk×0.20 + test×0.15 + owners×0.15

Cybersecurity = auth×0.30 + validation×0.25 + soup×0.25 + owners×0.20

CE Mark = IEC_62304×0.35 + ISO_13485×0.30 + Cybersecurity×0.20 + docs×0.15
```

The weights reflect the relative importance of each metric according to the standard's emphasis. For example, IEC 62304 heavily weights test coverage (0.25) and risk verification (0.20) because these are the most common audit findings for Class C software.

---

## 11. Traceability Graph — Knowledge Representation

### 11.1 Graph Schema

The traceability graph is a **directed acyclic graph (DAG)** with typed nodes and edges:

```
Node types: {requirement, architecture, code, test, risk_control}
Edge types: {traces_to, implemented_by, tested_by, mitigated_by}
```

### 11.2 Node Extraction

| Node Type | Source | Extraction Method |
|-----------|--------|-------------------|
| `requirement` | SRS markdown | Regex: `(REQ-[A-Z]+-\d+)\s*[:\|]\s*(.+)` |
| `architecture` | SAD markdown (or default 10 known modules) | Regex: `#+\s+(?:Module\|Component\|Service)[\s:]+(.+)` |
| `code` | `backend/app/services/*.py`, `utils/*.py`, key frontend components | GitHub directory listing + content analysis |
| `test` | `backend/tests/unit/test_*.py` | GitHub directory listing + test function counting |
| `risk_control` | Risk Management File | Regex: `(HAZ-\d+)\s*[:\|]` and `(RC-\d+)\s*[:\|]` |

### 11.3 Edge Construction

| Edge | Source → Target | Method |
|------|----------------|--------|
| `implemented_by` | REQ → CODE | Scan source code for `REQ-XXX` string matches |
| `tested_by` | CODE → TEST | Module name matching: `test_{module}` ↔ `{module}_service` |
| `mitigated_by` | REQ → RISK | Co-occurrence of REQ-ID within 500 chars of HAZ/RC in RMF |
| `traces_to` | REQ → ARCH | Keyword overlap between requirement description and module name |
| `implemented_by` | ARCH → CODE | Module name substring matching |

### 11.4 Orphan Detection

Orphans represent compliance gaps — the exact findings an auditor would identify:

| Orphan Type | IEC 62304 Clause | Computation |
|-------------|-----------------|-------------|
| Requirements without tests | 5.5 (Verification) | REQs with no transitive path to any TEST node |
| Risk controls without verification | 7.3 (Risk Control Verification) | RISK nodes with no `mitigated_by` incoming edges |
| Code without requirements | 5.2 (Requirements) | CODE nodes with no `implemented_by` incoming edges from REQ |

### 11.5 Current Graph Statistics (Live Data)

```
Nodes: 242 (106 requirements, 10 architecture, 30 code, 10 tests, 86 risk controls)
Edges: 216 (18 implemented_by, 10 tested_by, 158 mitigated_by, 30 traces_to)
Orphan requirements: 105 (many REQs not yet referenced in code)
Orphan code: 26 (modules without explicit REQ traceability)
```

---

## 12. Audit Engine — Automated Evidence Verification

### 12.1 Clause Coverage

The audit engine checks **20 IEC 62304 clauses** organized in 5 groups:

| Group | Clauses | Checks Per Clause | Evidence Sources |
|-------|---------|-------------------|-----------------|
| Development (5.1–5.8) | 8 | 3–5 | SDP, SRS, SAD, test files, CI, CODEOWNERS, package.json |
| Maintenance (6.1–6.2) | 2 | 2 | SDP content analysis, change control docs |
| Risk Management (7.1–7.4) | 4 | 3–4 | RMF content, HAZ/RC counts, VERIFIED status, verification records |
| Configuration (8.1–8.3) | 3 | 2–3 | Git (implied), SBOM, CODEOWNERS, commit history |
| Problem Resolution (9.1–9.3) | 3 | 2 | Templates, CAPA docs, MDR incident docs |

### 12.2 Evidence Scoring Algorithm

```python
ratio = checks_passed / total_checks

if ratio >= 0.9: score = "STRONG"    # Full evidence
elif ratio >= 0.6: score = "ADEQUATE"  # Partial evidence
elif ratio > 0: score = "WEAK"        # Minimal evidence
else: score = "MISSING"               # No evidence
```

### 12.3 Readiness Score

```
readiness = mean(score_map[clause.score] for clause in all_clauses)

where score_map = {STRONG: 100, ADEQUATE: 75, WEAK: 40, MISSING: 0}
```

Target: **>95% for external audit**, >80% during active development.

---

## 13. SOUP Monitoring — Software Supply Chain Security

### 13.1 Safety Classification Per IEC 62304

| Class | Criteria | Packages |
|-------|----------|----------|
| **C** | Directly processes clinical data; error could affect diagnosis | nibabel, numpy, scipy, pydicom, scikit-image, onnxruntime |
| **B** | Core application logic; indirect safety impact | fastapi, firebase-admin, react, uvicorn, pydantic, anthropic |
| **A** | Development/build only; no runtime presence | pytest, vite, typescript, eslint, tailwindcss |

### 13.2 CVE Scanning Pipeline

```
requirements.txt + package.json
         │
         ▼
    Parse dependencies (name, version, pinned?)
         │
         ▼
    Classify safety class (A/B/C)
         │
         ▼
    Priority scan: Class C first, then B
         │
         ▼
    NVD API 2.0 query per dependency
    (https://services.nvd.nist.gov/rest/json/cves/2.0)
         │
         ▼
    Parse CVSS v3.1 scores + severity
         │
         ▼
    Generate recommendations per vulnerability
```

---

## 14. Form Templates — Structured Regulatory Evidence

11 templates with **178 total fields** covering every regulatory record required by IEC 62304, ISO 13485, ISO 14971, IEC 81001-5-1, and EU MDR:

| ID | Title | Standard | Fields | Sections |
|----|-------|----------|--------|----------|
| TPL-01 | Problem Report | IEC 62304 §9 | 19 | Identification, Problem Details, Investigation, CAPA, Verification, Resolution |
| TPL-02 | Release Checklist | IEC 62304 §5.8 | 17 | Release Info, Deliverables, Build Verification, Regulatory |
| TPL-03 | Code Review Checklist | IEC 62304 §5.5.3 | 18 | Review Info, Code Quality, Security, Safety, Performance, Findings |
| TPL-04 | Risk Control Verification | ISO 14971 §7.4 | 16 | Hazard, Risk Assessment, Control Measure, Verification, Residual Risk |
| TPL-05 | Design Review Record | IEC 62304 §5.3/5.4 | 12 | Review Info, Documents, Checks, Outcomes |
| TPL-06 | Test Execution Report | IEC 62304 §5.5.5 | 20 | Test Info, Environment, Results, Failures, Coverage, Anomalies |
| TPL-07 | SOUP Vulnerability Review | IEC 81001-5-1 §5.3.12 | 14 | Review Info, Package Analysis, Vulnerability Assessment, Risk |
| TPL-08 | Serious Incident Report | EU MDR Art. 87 | 18 | Identification, Device ID, Incident, Response, Investigation, Regulatory |
| TPL-09 | Change Control Record | IEC 62304 §8 | 17 | Request, Change Details, Impact Analysis, Classification, Implementation |
| TPL-10 | Quality Gate Approval | IEC 62304 §5.1 | 14 | Gate Info, Criteria, Status, Risk Status, Quality Metrics, Decision |
| TPL-11 | Document Approval Record | ISO 13485 §4.2.4 | 13 | Document Info, Revision, Review Checklist, Distribution |

---

## 15. Security Model

| Layer | Implementation |
|-------|----------------|
| Identity | Firebase Authentication (Email/Password + Google OAuth 2.0) |
| Authorization | RBAC via Firebase custom claims (6 roles) |
| API Security | Bearer token verification on all mutating endpoints |
| Token Lifecycle | Automatic refresh on 401 via Axios interceptor |
| Audit Trail | Immutable Firestore log (who, what, when, details) |
| Secrets Management | `.env` and `env.yaml` in `.gitignore`, Cloud Run env vars |
| Transport | HTTPS/TLS 1.3 (enforced by Cloud Run + Firebase Hosting) |

---

## 16. Deployment Architecture

| Component | Service | URL | Cost Model |
|-----------|---------|-----|------------|
| Frontend | Firebase Hosting | mstool-ai-qms.web.app | Free tier (10GB/month) |
| Backend | Cloud Run | mstool-ai-qms-*.run.app | Pay-per-request (~$0) |
| Database | Firestore | mstool-ai-qms project | Free tier (1GB) |
| Auth | Firebase Auth | mstool-ai-qms project | Free tier (50K MAU) |
| AI | Claude API | api.anthropic.com | ~$3-15/M tokens |
| CVE Data | NVD API | services.nvd.nist.gov | Free |
| Repo Data | GitHub API | api.github.com | Free (5000 req/hr) |

---

## 17. API Reference (111+ Endpoints)

See the interactive Swagger documentation at: [/api/docs](https://mstool-ai-qms-354942400159.us-central1.run.app/api/docs)

**Endpoint groups**: Health (2), Compliance (8), Forms (11), Audit (3), SOUP (4), Users (5), AI Intelligence (6)

---

## 18. Technology Stack

| Layer | Technologies |
|-------|-------------|
| **AI/ML** | Claude Sonnet 4 (Anthropic), NVD CVE API, GitHub code analysis |
| **Backend** | FastAPI 0.115, Python 3.11, Firebase Admin SDK, httpx, ReportLab, Pydantic 2.9 |
| **Frontend** | React 18, TypeScript, Vite 6, Tailwind CSS 3.4, @xyflow/react, Recharts, Zustand |
| **Auth** | Firebase Authentication (Email + Google OAuth), JWT custom claims |
| **Database** | Cloud Firestore (serverless document DB) |
| **Infrastructure** | Cloud Run (containers), Firebase Hosting (CDN), GitHub API |
| **Protocol** | MCP (Model Context Protocol) — planned full implementation |

---

## 19. Comparison with Commercial QMS Tools

| Capability | MSTool-AI-QMS | Ketryx ($50K/yr) | Greenlight Guru ($30K/yr) | MasterControl ($100K+/yr) |
|-----------|:---:|:---:|:---:|:---:|
| IEC 62304 clause-by-clause audit | **Automated (20 clauses)** | Partial | Manual | Manual |
| Code-level traceability | **GitHub API (real-time)** | Git integration | None | None |
| AI form auto-fill | **Claude (code-aware)** | Limited | None | NLP classification |
| CAPA generation with 5 Whys | **AI-powered** | None | Workflow | Predictive |
| Code review for compliance | **AI reads actual code** | PR validation | None | None |
| Risk detection in commits | **AI classifies changes** | None | None | None |
| MCP integration | **Planned (FastMCP)** | None | None | None |
| Compliance chat (NL) | **Claude (IEC 62304 expert)** | None | None | None |
| Cost | **~$0 (free tier)** | ~$50,000/yr | ~$30,000/yr | ~$100,000+/yr |

---

## 20. Future Work — Research Directions

### 20.1 Full MCP Server Implementation
Deploy FastMCP servers that expose all QMS capabilities as MCP tools, enabling Claude Desktop and Claude Code to interact with the QMS directly during development.

### 20.2 Autonomous CAPA Resolution (Level 4)
AI agent that can: detect bug in CI → generate root cause analysis → create fix PR → update risk file → create verification test → submit for review. Requires careful safety gating for Class C context.

### 20.3 Continuous Compliance Monitoring
GitHub webhook integration to analyze every PR in real-time: check requirement traceability, run risk assessment, validate Class C review requirements, block merge if compliance gaps detected.

### 20.4 Multi-Agent Regulatory Team
CrewAI or Claude Agent SDK implementation where specialized agents collaborate: Quality Engineer (writes CAPAs), Risk Manager (updates risk files), Regulatory Specialist (checks standard compliance), Security Reviewer (SOUP/CVE analysis).

### 20.5 Predictive Compliance Scoring
ML model trained on historical audit findings, CAPA frequency, and documentation completeness to predict audit readiness and identify at-risk areas before gaps materialize.

### 20.6 Regulatory Intelligence
NLP agent monitoring FDA guidance documents, EU MDCG guidance, and standard updates. Automatically parses new requirements and maps them to existing QMS gaps.

---

## 21. References

1. IEC 62304:2006+A1:2015 — Medical device software — Software life cycle processes
2. ISO 13485:2016 — Medical devices — Quality management systems
3. ISO 14971:2019 — Medical devices — Application of risk management
4. IEC 81001-5-1:2021 — Health software and health IT systems safety, effectiveness and security
5. EU MDR 2017/745 — Regulation on medical devices
6. EU AI Act 2024/1689 — Harmonised rules on artificial intelligence
7. Anthropic (2024) — Model Context Protocol specification
8. Anthropic (2025) — Claude Sonnet 4 technical report
9. MDCG 2019-11 — Guidance on qualification and classification of software (EU MDR)
10. FDA (2023) — Computer Software Assurance for Production and Quality System Software

---

<p align="center">
  <strong>MSTool-AI-QMS</strong><br/>
  AI-Powered Regulatory Compliance for Class C Medical Device Software<br/><br/>
  <sub>IEC 62304 : ISO 13485 : ISO 14971 : IEC 81001-5-1 : EU MDR 2017/745 : EU AI Act 2024/1689</sub><br/>
  <sub>Powered by Claude Sonnet 4 (Anthropic) | Model Context Protocol | FastAPI | React | Firebase | Cloud Run</sub>
</p>