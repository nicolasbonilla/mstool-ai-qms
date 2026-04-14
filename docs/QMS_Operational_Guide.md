# MSTool-AI-QMS — Operational Guide

## Quality Management System for IEC 62304 Class C Medical Device Software

**Document ID**: QMS-OPG-001  
**Version**: 1.0  
**Effective Date**: 2026-04-14  
**Classification**: Internal — For QMS Team Members  
**Applicable Standards**: IEC 62304:2006+A1:2015, ISO 13485:2016, IEC 81001-5-1:2021, EU MDR 2017/745  

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Access & Roles](#2-system-access--roles)
3. [Daily Workflow](#3-daily-workflow)
4. [Dashboard — Compliance Monitoring](#4-dashboard--compliance-monitoring)
5. [Forms — Regulatory Records](#5-forms--regulatory-records)
6. [Traceability — Requirement Coverage](#6-traceability--requirement-coverage)
7. [Audit — Simulation & Preparation](#7-audit--simulation--preparation)
8. [SOUP — Dependency Monitoring](#8-soup--dependency-monitoring)
9. [Document Sync — Regulatory Documents](#9-document-sync--regulatory-documents)
10. [Audit Trail — Immutable Action Log](#10-audit-trail--immutable-action-log)
11. [Roles & Responsibilities](#11-roles--responsibilities)
12. [Appendix A: Template Reference](#appendix-a-template-reference)
13. [Appendix B: IEC 62304 Clause Mapping](#appendix-b-iec-62304-clause-mapping)
14. [Appendix C: Audit Checklist](#appendix-c-audit-checklist)

---

## 1. Introduction

### 1.1 Purpose

This guide provides step-by-step instructions for daily operation of the MSTool-AI-QMS platform. It is designed for all team members involved in the development, quality assurance, and regulatory compliance of MSTool-AI, a Class C medical device software under IEC 62304.

### 1.2 Scope

The QMS platform monitors the MSTool-AI repository (`nicolasbonilla/medical-imaging-viewer`) and automates:

- **Compliance scoring** against IEC 62304, ISO 13485, IEC 81001-5-1
- **Form management** for all 11 regulatory templates (TPL-01 to TPL-11)
- **Traceability** from requirements to code to tests to risk controls
- **Audit simulation** for CE Mark readiness
- **SOUP monitoring** for dependency vulnerabilities
- **Document freshness** tracking for regulatory files

### 1.3 Access

- **Production URL**: https://mstool-ai-qms.web.app
- **Backend API**: https://mstool-ai-qms-354942400159.us-central1.run.app
- **API Documentation**: https://mstool-ai-qms-354942400159.us-central1.run.app/api/docs

---

## 2. System Access & Roles

### 2.1 First-Time Setup

1. Navigate to https://mstool-ai-qms.web.app
2. Click **"Create Account"** or **"Continue with Google"**
3. The first user registered becomes **Admin** automatically
4. Subsequent users start as **Viewer** — an Admin must assign roles

### 2.2 Roles

| Role | Permissions | Typical Person |
|------|------------|----------------|
| **Admin** | Full access. Manage users, run audits, approve forms, configure system | Project Lead |
| **QMS Manager** | Run audits, approve forms, manage users, view audit trail | Quality Manager |
| **Developer** | Create/edit forms, view dashboard, view traceability | Software Developer |
| **QA** | Create/edit forms, run tests, view all reports | QA Engineer |
| **Clinical Advisor** | View reports, sign clinical forms, review risk controls | Clinical Expert |
| **Viewer** | Read-only access to all dashboards and reports | Stakeholder/Auditor |

### 2.3 Assigning Roles

1. Log in as Admin or QMS Manager
2. The Admin navigates to the user management section
3. Select the user and assign the appropriate role
4. The user must log out and log back in for the role to take effect (Firebase custom claims refresh on token renewal)

---

## 3. Daily Workflow

### 3.1 For Developers

**Every morning:**
1. Open Dashboard — check compliance scores haven't dropped
2. Check SOUP page — any new CVE vulnerabilities?
3. Review any open forms assigned to you

**When making code changes:**
1. Ensure your change traces to a requirement (REQ-FUNC-XXX or REQ-SAFE-XXX)
2. If touching a Class C module, create a **TPL-03 Code Review Checklist** BEFORE merging
3. After merging, verify CI pipeline passes on Dashboard
4. If a new risk is introduced, create **TPL-04 Risk Control Verification**

**When fixing bugs:**
1. Create **TPL-01 Problem Report** documenting the issue
2. Fill in root cause analysis after investigation
3. After fix is merged, complete verification section
4. Get QMS Manager approval

### 3.2 For QA Engineers

**Every morning:**
1. Open Dashboard — check test coverage hasn't dropped
2. Check for any new Problem Reports (TPL-01) that need verification
3. Review SOUP page for new vulnerabilities

**When running tests:**
1. Create **TPL-06 Test Execution Report** for each test session
2. Record environment details (OS, versions, dependencies)
3. Document all failures with severity and linked requirements
4. Sign the form when complete

**Before each release:**
1. Complete **TPL-02 Release Checklist** — verify all deliverables
2. Run **Full Audit** simulation — target score >90%
3. Create **TPL-10 Quality Gate Approval**
4. Ensure all risk controls are verified (Traceability page)

### 3.3 For QMS Managers

**Weekly:**
1. Run a **Full Audit** simulation and review gaps
2. Review audit trail for completeness
3. Check document freshness on Doc Sync page — update any "Outdated" docs
4. Review and approve pending forms

**Monthly:**
1. Review SOUP dependency scan — ensure no unmitigated critical CVEs
2. Run **Random Commit Audit** and **Random Requirement Audit**
3. Export compliance PDF report for management review
4. Complete **TPL-07 SOUP Vulnerability Review** if new dependencies added
5. Update **TPL-11 Document Approval Record** for any revised documents

**Before external audit:**
1. Run Full Audit — score must be >95%
2. Review all Traceability orphans — no requirements without tests
3. Ensure all forms are signed and approved (no drafts for critical items)
4. Export all forms as PDFs for auditor review
5. Verify SOUP is current with latest CVE checks

### 3.4 For Clinical Advisors

**As needed:**
1. Review and sign **TPL-04 Risk Control Verification** forms
2. Review **TPL-08 Serious Incident Reports** if any incidents occur
3. Review AI report templates for clinical accuracy
4. Participate in **TPL-05 Design Review Records**

---

## 4. Dashboard — Compliance Monitoring

### 4.1 Overview

The Dashboard shows real-time compliance scores computed by analyzing the MSTool-AI repository via GitHub API.

### 4.2 Score Cards

| Score | Standard | Target | Critical Threshold |
|-------|----------|--------|-------------------|
| IEC 62304 | Software lifecycle | >95% | <80% requires immediate action |
| ISO 13485 | Quality management | >90% | <75% requires immediate action |
| Cybersecurity | IEC 81001-5-1 | >90% | <80% requires immediate action |
| CE Mark Overall | Weighted composite | >90% | <80% blocks release |

### 4.3 Breakdown Metrics

- **Authentication Coverage**: % of API endpoints with auth middleware
- **Input Validation**: % of Class C modules with proper validation
- **Test Coverage**: % of critical modules with unit tests
- **Risk Verification**: % of hazards with VERIFIED risk controls
- **Document Completeness**: % of required regulatory documents present
- **Document Freshness**: % of documents updated within 90 days
- **SOUP Vulnerability**: Status of dependency vulnerability management
- **CODEOWNERS Coverage**: % of Class C modules in CODEOWNERS file

### 4.4 Actions When Scores Drop

1. Identify which breakdown metric dropped
2. Click the metric to see details
3. Create appropriate remediation form:
   - Low test coverage → TPL-06 Test Execution Report
   - Missing docs → TPL-11 Document Approval Record
   - Risk verification gap → TPL-04 Risk Control Verification
   - Auth coverage gap → TPL-09 Change Control Record

---

## 5. Forms — Regulatory Records

### 5.1 Overview

The Forms page manages all 11 regulatory templates required by IEC 62304 and ISO 13485. Forms are stored in Firestore with full version history and electronic signatures.

### 5.2 Creating a Form

1. Click **"+ New"** button
2. Select the appropriate template (TPL-01 to TPL-11)
3. The form opens in **Draft** status
4. Fill in all required fields (marked with *)
5. Click **"Save"** to persist changes

### 5.3 Form Lifecycle

```
Draft → In Review → Approved → (Superseded when new version created)
```

1. **Draft**: Author fills in fields. Can be edited freely.
2. **In Review**: Author clicks "Submit for Review". QMS Manager reviews.
3. **Approved**: QMS Manager clicks "Approve". Form is locked.
4. **Superseded**: When a new version of the same form is approved.

### 5.4 Electronic Signatures

- Click **"Sign"** to add your electronic signature
- Your name, role, and timestamp are recorded
- Signatures are immutable — they cannot be removed
- Multiple signatures supported (author, reviewer, approver)

### 5.5 PDF Export

- Click **"PDF"** to download a formatted PDF
- PDF includes all field values, signatures, and metadata
- PDFs should be generated for auditor review

### 5.6 Template Quick Reference

| Template | When to Use | IEC 62304 Clause |
|----------|-------------|------------------|
| TPL-01 | Bug found or reported | Clause 9 |
| TPL-02 | Before each release | Clause 5.8 |
| TPL-03 | Every code review (mandatory for Class C) | Clause 5.5.3 |
| TPL-04 | When verifying risk controls | ISO 14971 7.4 |
| TPL-05 | Architecture/design reviews | Clause 5.3/5.4 |
| TPL-06 | After running test suites | Clause 5.5.5 |
| TPL-07 | Monthly dependency review | IEC 81001-5-1 5.3.12 |
| TPL-08 | Patient safety incident | EU MDR Article 87 |
| TPL-09 | Any change to the system | Clause 8 |
| TPL-10 | Before progressing to next phase | Clause 5.1 |
| TPL-11 | When approving/revising documents | ISO 13485 4.2.4 |

---

## 6. Traceability — Requirement Coverage

### 6.1 Overview

The Traceability page shows a visual graph connecting:

```
Requirements (REQ-FUNC-XXX, REQ-SAFE-XXX)
    ↓ traces_to
Architecture (modules, interfaces)
    ↓ implemented_by
Code (services, components)
    ↓ tested_by
Tests (unit tests, integration tests)

Requirements → mitigated_by → Risk Controls (HAZ-XXX, RC-XXX)
```

### 6.2 Reading the Graph

- **Blue nodes**: Requirements from the SRS
- **Purple nodes**: Architecture modules from the SAD
- **Green nodes**: Code files (services, components)
- **Amber nodes**: Test files
- **Red nodes**: Risk controls from the Risk Management File

### 6.3 Orphan Detection

Orphans indicate compliance gaps:

| Orphan Type | Meaning | Action Required |
|-------------|---------|-----------------|
| Requirement without test | No test verifies this requirement | Write test or create TPL-06 |
| Risk control without verification | Risk control not verified | Create TPL-04 |
| Code without requirement | Code exists but no REQ traces to it | Add REQ or justify in TPL-09 |

### 6.4 Auditor Questions the Traceability Answers

- "Show me the test that verifies requirement REQ-FUNC-040" → Click REQ-FUNC-040, follow tested_by edges
- "How is hazard HAZ-002 mitigated?" → Click HAZ-002, follow mitigated_by edges
- "What requirements does this module implement?" → Click the code node, see requirement edges

---

## 7. Audit — Simulation & Preparation

### 7.1 Audit Modes

| Mode | Description | When to Use |
|------|-------------|-------------|
| **Full Audit** | Checks all IEC 62304 clauses | Before external audit, monthly |
| **Random Commit** | Picks a random commit, traces to requirements | Weekly spot-check |
| **Random Requirement** | Picks a random REQ, traces all evidence | Weekly spot-check |

### 7.2 Running an Audit

1. Select audit mode
2. Click **"Run Audit"**
3. System analyzes the repository clause by clause
4. Results show per-clause scores:
   - **STRONG** (green): Full evidence found
   - **ADEQUATE** (yellow): Partial evidence
   - **WEAK** (orange): Minimal evidence
   - **MISSING** (red): No evidence found

### 7.3 Interpreting Results

- **Readiness Score >95%**: Ready for external audit
- **Readiness Score 80-95%**: Address gaps before audit
- **Readiness Score <80%**: Significant work needed

### 7.4 Addressing Gaps

For each gap identified:
1. Note the clause number and what's missing
2. Create the appropriate form to generate the evidence
3. Update the relevant document in the repository
4. Re-run the audit to verify the gap is closed

---

## 8. SOUP — Dependency Monitoring

### 8.1 Overview

SOUP (Software of Unknown Provenance) monitoring tracks all third-party dependencies used by MSTool-AI and checks for known vulnerabilities (CVEs).

### 8.2 Safety Classification

| Class | Criteria | Examples |
|-------|----------|----------|
| **Class C** | Used in clinical data processing | nibabel, numpy, scipy, pydicom |
| **Class B** | Core application functionality | fastapi, firebase-admin, react |
| **Class A** | Development/build tools only | pytest, vite, typescript |

### 8.3 CVE Monitoring

- Vulnerabilities are checked against the NVD (National Vulnerability Database)
- Severity levels: CRITICAL, HIGH, MEDIUM, LOW
- **CRITICAL and HIGH CVEs in Class C packages require immediate action**

### 8.4 Monthly Review Process

1. Open SOUP page
2. Click **"Scan for Vulnerabilities"**
3. Review any new CVEs found
4. For each CRITICAL/HIGH CVE:
   - Check if a fix version is available
   - If yes: plan upgrade, create TPL-09 Change Control
   - If no: document risk acceptance in TPL-07
5. Create **TPL-07 SOUP Vulnerability Review** with findings
6. Get QMS Manager approval

---

## 9. Document Sync — Regulatory Documents

### 9.1 Overview

Document Sync tracks all regulatory documents in the MSTool-AI repository under `docs/`.

### 9.2 Standards Tracked

| Directory | Standard | Expected Documents |
|-----------|----------|-------------------|
| `docs/iec62304/` | IEC 62304 | SDP, SRS, SAD, RMF, test plans, SBOM |
| `docs/qms/` | ISO 13485 | Quality manual, procedures, policies |
| `docs/clinical/` | Clinical | Clinical evaluation, GSPR checklist |
| `docs/usability/` | IEC 62366 | Usability engineering file |
| `docs/mdr/` | EU MDR | Technical documentation, declarations |
| `docs/ai-act/` | EU AI Act | AI risk classification, transparency |

### 9.3 Freshness Indicators

- **Green (Fresh)**: Modified within 30 days
- **Yellow (Review)**: Modified 30-90 days ago — review if still current
- **Red (Outdated)**: Not modified in >90 days — update required

### 9.4 When to Update Documents

- After any code change that affects requirements → update SRS
- After architecture changes → update SAD
- After new risk identification → update RMF
- After each release → update release notes
- Monthly → review all "Red" documents

---

## 10. Audit Trail — Immutable Action Log

### 10.1 Overview

Every action in the QMS is logged to an immutable audit trail in Firestore:

- Form creation, editing, signing, approval
- Audit runs and results
- User registration and role changes
- Document reviews

### 10.2 What is Logged

| Field | Description |
|-------|-------------|
| timestamp | UTC timestamp of the action |
| user_uid | Firebase UID of the user |
| user_email | Email of the user |
| action | Type of action (create_form, sign_form, run_audit, etc.) |
| resource_type | Type of resource affected (form, audit, user) |
| resource_id | ID of the affected resource |
| details | Additional context (template_id, role change, etc.) |

### 10.3 Accessing the Audit Trail

Only Admin and QMS Manager roles can access the full audit trail. This ensures regulatory compliance with ISO 13485 Section 4.2.4 requirements for document control.

---

## 11. Roles & Responsibilities

### 11.1 RACI Matrix

| Activity | Admin | QMS Manager | Developer | QA | Clinical |
|----------|-------|-------------|-----------|-----|----------|
| Compliance monitoring | A | R | I | I | I |
| Form creation | I | A | R | R | C |
| Form approval | I | R/A | - | C | C |
| Code review (TPL-03) | I | A | R | R | - |
| Risk verification (TPL-04) | I | A | C | R | R |
| Test execution (TPL-06) | I | I | C | R/A | - |
| SOUP review (TPL-07) | I | R/A | C | C | - |
| Release approval (TPL-02) | A | R | C | C | C |
| Audit simulation | I | R/A | I | C | C |
| User management | R/A | R | - | - | - |

R=Responsible, A=Accountable, C=Consulted, I=Informed

---

## Appendix A: Template Reference

### TPL-01: Problem Report (IEC 62304 Clause 9)

**Purpose**: Document and track software problems, bugs, and anomalies.

**Required fields**:
- Problem ID, date, reporter, severity, category
- Description, steps to reproduce, expected vs actual
- Affected module, requirement IDs, version
- Root cause analysis, corrective/preventive action
- Verification of correction, regression testing
- Disposition, resolution date
- Signatures: reporter, investigator, approver

### TPL-02: Release Checklist (IEC 62304 Clause 5.8)

**Purpose**: Verify all deliverables and quality gates before release.

**Required fields**:
- Release version, date, type
- Deliverable checklist (SDP, SRS, SAD, RMF, tests, SOUP, release notes)
- Build verification (CI, tests, coverage)
- Regulatory checklist (no open Class C issues, risk controls, traceability)
- Signatures: developer, QA, QMS manager, release authority

### TPL-03: Code Review Checklist (IEC 62304 Clause 5.5.3)

**Purpose**: Document code review findings for every change to Class C modules.

**Required fields**:
- Review ID, PR reference, module, reviewer(s)
- Coding standards, error handling, input validation
- Security review (OWASP), credentials, logging
- Safety checks, requirement traceability, risk controls
- Performance, naming, complexity
- Issues found, resolution
- Signatures: author, reviewer, approver

### TPL-04: Risk Control Verification (ISO 14971 Clause 7.4)

**Purpose**: Verify that risk control measures are effective.

**Required fields**:
- Hazard ID, description, severity, probability, risk level
- Control measure ID, description, type
- Verification method, date, result
- Residual risk assessment
- Benefit-risk analysis
- Signatures: risk analyst, verifier, approver

### TPL-05: Design Review Record (IEC 62304 Clause 5.3/5.4)

**Purpose**: Document design review meetings and decisions.

**Required fields**:
- Review ID, date, phase, participants
- Input/output documents, requirements coverage
- Safety/performance checks
- Action items with assignees
- Review outcome
- Signatures: design lead, reviewers, QMS manager

### TPL-06: Test Execution Report (IEC 62304 Clause 5.5.5)

**Purpose**: Record test execution results and coverage.

**Required fields**:
- Test run ID, date, level, tester
- Environment (OS, versions)
- Results (total, pass, fail, skip)
- Failed test details with linked requirements
- Code coverage per module
- Anomalies found
- Signatures: tester, QA lead, approver

### TPL-07: SOUP Vulnerability Review (IEC 81001-5-1 Clause 5.3.12)

**Purpose**: Monthly review of third-party dependency vulnerabilities.

**Required fields**:
- Review date, reviewer, SBOM version
- Package analysis (name, version, license, safety class)
- CVE check results, CVSS scores
- Mitigation for each vulnerability
- Risk assessment, acceptance
- Next review date
- Signatures: security reviewer, QMS manager

### TPL-08: Serious Incident Report (EU MDR Article 87)

**Purpose**: Report and investigate patient safety incidents.

**Required fields**:
- Incident ID, dates, reporter
- Device identification (UDI, version)
- Description, patient impact, severity
- Immediate corrective actions
- Root cause, FSCA
- Authority notification, EUDAMED reference
- Signatures: reporter, clinical advisor, QMS manager

### TPL-09: Change Control Record (IEC 62304 Clause 8)

**Purpose**: Document and control changes to the system.

**Required fields**:
- Change request ID, date, requestor, priority
- Description, reason, affected modules
- Impact analysis (requirements, risk, tests, docs)
- Classification (safety-related, regulatory)
- Implementation plan, verification results
- Signatures: requestor, developer, QA, QMS manager

### TPL-10: Quality Gate Approval (IEC 62304 Clause 5.1)

**Purpose**: Approve transition between development phases.

**Required fields**:
- Gate ID, phase, date
- Entrance/exit criteria checklists
- Deliverable status, open actions
- Risk status, quality metrics
- Go/No-Go decision
- Signatures: phase lead, QA, QMS manager

### TPL-11: Document Approval Record (ISO 13485 Clause 4.2.4)

**Purpose**: Document review and approval for regulatory documents.

**Required fields**:
- Document ID, title, version, date
- Document type, applicable standard
- Changes from previous version
- Review checklist (accuracy, completeness, consistency)
- Distribution list
- Signatures: author, reviewer, QMS manager

---

## Appendix B: IEC 62304 Clause Mapping

| Clause | Title | QMS Feature |
|--------|-------|-------------|
| 5.1 | Software Development Planning | Dashboard + TPL-10 |
| 5.2 | Software Requirements Analysis | Traceability + TPL-05 |
| 5.3 | Software Architectural Design | Traceability + TPL-05 |
| 5.4 | Software Detailed Design | Traceability + TPL-05 |
| 5.5 | Unit Implementation & Verification | Dashboard (tests) + TPL-03/06 |
| 5.6 | Integration Testing | Dashboard (CI) + TPL-06 |
| 5.7 | System Testing | TPL-06 |
| 5.8 | Software Release | TPL-02 |
| 6.1 | Maintenance Planning | Doc Sync |
| 6.2 | Problem/Modification Analysis | TPL-01 + TPL-09 |
| 7.1 | Risk Analysis | Traceability + TPL-04 |
| 7.2 | Risk Control | Traceability + TPL-04 |
| 7.3 | Risk Control Verification | TPL-04 |
| 7.4 | Risk Management of Changes | TPL-09 + TPL-04 |
| 8.1 | Configuration Identification | SOUP + Dashboard |
| 8.2 | Change Control | TPL-09 |
| 8.3 | Configuration Status Accounting | Dashboard + Git |
| 9.1 | Problem Reports | TPL-01 |
| 9.2 | Investigation | TPL-01 (root cause) |
| 9.3 | Advisory Notices | TPL-08 |

---

## Appendix C: Audit Preparation Checklist

Use this checklist before an external audit:

- [ ] Full Audit simulation score >95%
- [ ] All Traceability orphans resolved (no requirements without tests)
- [ ] All forms for current release signed and approved
- [ ] SOUP vulnerability scan run within last 30 days
- [ ] All regulatory documents "Fresh" (green) on Doc Sync
- [ ] All Class C modules have code review records (TPL-03)
- [ ] All hazards have verified risk controls (TPL-04)
- [ ] Release checklist (TPL-02) approved for current version
- [ ] Quality gate approval (TPL-10) signed for current phase
- [ ] Audit trail shows consistent usage over development period
- [ ] PDF exports of all critical forms available for auditor
- [ ] Team members can demonstrate live use of QMS platform

---

*Document generated by MSTool-AI-QMS v1.0 | IEC 62304 Class C Medical Device Software*