# MSTool-AI-QMS — Master Plan (v1.0)
## AI-First Medical Device Quality Management System

> **Status:** Strategic roadmap  
> **Owner:** Nicolás Bonilla  
> **Last updated:** 2026-04-16  
> **Scope:** 6 phases, ~24 weeks, AI-native architecture

---

## Executive Summary

MSTool-AI-QMS will become the first medical device Quality Management System that (a) continuously scores compliance from live Git activity, (b) ships validated AI agents with exportable validation dossiers, and (c) auto-closes compliance gaps end-to-end under human e-signature control.

This plan is backed by four parallel research streams into the competitive landscape, LLM/RAG architectures for regulated document systems, ML techniques for compliance prediction, and agentic AI frameworks. Every technical decision in this document cites real sources.

**Strategic thesis:** *Ketryx suggests; we close the loop.*

---

## Part 1 — The Honest State of the Product

Today MSTool-AI-QMS is a live-telemetry dashboard without memory. It correctly shows the current compliance posture of the MSTool-AI medical device repo, but it does not remember how we got here.

| Gap observed | Regulatory impact | Fix phase |
|---|---|---|
| No persistent audit trail beyond audit runs | Violates 21 CFR Part 11 §11.10(e) (time-stamped audit trails) | Phase 0 |
| No time-series charts on the "dashboard" | Word "dashboard" literally means panels with gauges and trends; we don't have them | Phase 2 |
| No release baselines | Cannot produce immutable snapshot for CE Mark / FDA submission | Phase 3 |
| No AI agents beyond generic chat | Ketryx ships 6 validated agents; we ship none | Phase 4 |
| No AI validation dossier | EU AI Act Art. 9 + FDA PCCP will require this by Aug 2027 | Phase 5 |
| No change impact / predictive ML | Polarion and Codebeamer ship "suspect links"; we don't | Phase 6 |

---

## Part 2 — Competitive Landscape (2025-2026 Research)

Deep web research across 10 leading vendors plus adjacent threats. Citations inline.

### 2.1 Direct competitors

**Ketryx** — our closest direct competitor  
- Ships 6 validated AI agents: Requirement Conflict, Redundancy Detection, Test Coverage, Anomaly Review, Change Request Review, Complaint  
- 5-step validated loop: Prompt → Analysis → Recommendations → Human Review → Sync  
- MCP server launched March 31, 2026 exposing compliance graph to IDE agents  
- $39M Series B funding; 4 of top 5 medical device manufacturers as customers  
- Sources: [ketryx.com/blog/ketryx-ai-agents](https://www.ketryx.com/blog/ketryx-ai-agents), [press release validated agents](https://www.prnewswire.com/news-releases/ketryx-launches-first-validated-ai-agents-to-accelerate-safety-critical-product-development-302443256.html), [MCP announcement](https://www.ketryx.com/press-release/ketryx-announces-mcp), [Series B coverage](https://www.rdworldonline.com/ketryx-raises-39-million-in-series-b-funding-to-expand-ai-compliance-tools-for-life-sciences/)

**Greenlight Guru** — market leader for MedTech QMS  
- **Halo** — ML recommendation engine for change management impact analysis  
- **Risk Intelligence** — NLP + statistical models mining FDA MAUDE database to auto-propose hazards  
- No LLM disclosed, not git-native  
- Sources: [Halo product page](https://www.greenlight.guru/intelligent-document-management-halo), [Risk Intelligence launch](https://www.greenlight.guru/blog/greenlight-guru-launches-ai-powered-solutions-to-enable-better-risk-management-for-the-medtech-industry), [21 CFR Part 11 guide](https://www.greenlight.guru/blog/21-cfr-part-11-guide)

**Qualio Compliance Intelligence** (Oct 2025, expanded Feb 2026)  
- AI-powered gap analysis: 30-40 min scan replaces 20+ week manual audit prep  
- LLM hosted in Qualio private cloud, no retention, pre-validated compliance frameworks  
- Cross-framework (ISO 13485, IEC 62304, FDA QMSR, EU MDR, ISO 27001, MDSAP)  
- Sources: [Qualio launch announcement](https://www.qualio.com/blog/announcing-compliance-intelligence), [Feb 26 release](https://docs.qualio.com/en/articles/13641485-february-26-launch-train-release-notes)

**Jama Connect Advisor** — #1 RMS in G2 Spring 2026 Grid  
- NLP requirement-quality checker (INCOSE rules + EARS notation)  
- Smart Suggest auto-proposes trace links; AI-generated test cases  
- Live Trace Explorer 2025 beta visualizes coverage gaps per item owner  
- Sources: [Jama AI page](https://www.jamasoftware.com/solutions/artificial-intelligence/), [Leveraging AI in RM](https://www.jamasoftware.com/blog/leveraging-artificial-intelligence-in-requirements-management/), [Live Trace Explorer recap](https://www.jamasoftware.com/blog/2025/06/17/webinar-recap-improve-traceability-and-enhance-coverage-with-live-trace-explorer/)

**Polarion X on Azure** (Siemens)  
- Ships with Azure OpenAI Copilot for smart requirement analysis, auto trace links, predictive insights  
- Third-party extensions: semantha, reQlab, AI Optimizer  
- Suspect links + Impact Analysis built-in  
- Sources: [Polarion AI](https://polarion.plm.automation.siemens.com/ai), [Polarion X on Azure](https://news.siemens.com/en-us/siemens-polarion-x-azure/), [MedPack IEC 62304](https://extensions.polarion.com/extensions/31-polarion-alm-medpack-iec-62304)

**Codebeamer AI 1.0** (PTC, January 2026)  
- Requirements Assistant (INCOSE/ISTQB quality checker)  
- Test Case Assistant (auto-generates test cases from requirements)  
- BMW adoption April 2026 as enterprise RMS standard  
- Sources: [PTC ALM 2026 release](https://www.ptc.com/en/news/2026/ptc-delivers-new-ai-functionality-with-new-alm-releases), [Codebeamer AI](https://www.ptc.com/en/products/codebeamer/codebeamer-ai)

**MasterControl Insights** — predictive analytics + unsupervised clustering on CAPA root causes  
**ComplianceQuest CQ.AI Agents** — built on Salesforce Agentforce + Einstein Trust Layer  
**Matrix Requirements** — siloed environment + zero-retention LLM agreement  
**Helix ALM** — per-entity audit trails, baseline comparison against historical data

Sources: [MasterControl Insights](https://www.mastercontrol.com/insights/), [CQ.AI Summer 25](https://www.newswire.com/news/compliancequest-unveils-summer-25-release-cq-ai-agents-usher-in-a-new-22649339), [Matrix Requirements](https://matrixone.health/products/matrix-requirements), [Helix ALM audit trails](https://help.perforce.com/helix-alm/helixalm/current/client/Content/ClientUser/Admin/ManagingAuditTrails.htm)

### 2.2 Adjacent threats

- **Anthropic Claude for Healthcare & Life Sciences** (Jan 2026 at JPM) — HIPAA-ready, BAA-signed, SOC 2 Type II. Sources: [Anthropic healthcare launch](https://www.anthropic.com/news/healthcare-life-sciences), [Claude in Microsoft Foundry](https://www.microsoft.com/en-us/microsoft-cloud/blog/healthcare/2026/01/11/bridging-the-gap-between-ai-and-medicine-claude-in-microsoft-foundry-advances-capabilities-for-healthcare-and-life-sciences-customers/)  
- **FDA Elsa** — agency-wide AI-assisted review deployed end of June 2025. Source: [King & Spalding FDA AI coverage](https://www.kslaw.com/news-and-insights/fda-announces-completion-of-ai-assisted-scientific-review-pilot-and-deployment-of-agency-wide-ai-assisted-review)  
- **FormlyAI** ($2M seed 2024) — "virtual Chief Regulatory Officer" auto-generating ISO 13485 docs. Source: [TechFundingNews](https://techfundingnews.com/formlyai-raises-2m-seed-to-accelerate-medical-device-certification/)

### 2.3 Gap analysis summary

| Capability | State of the art | MSTool-AI today |
|---|---|---|
| Audit trail per entity, immutable | Helix, MasterControl, Greenlight Part 11 | Only audit runs logged |
| Time-series trend charts | Jama Trace Scores, MasterControl Insights, Qualio graphs | None |
| Change impact (suspect links) | Polarion, Codebeamer, Greenlight Halo | None |
| Release baselines + diff | Jama, Codebeamer, Polarion, Helix | None |
| AI agents | Ketryx (6), Greenlight (2), CQ (5), Polarion (Azure GPT) | Chat only |
| Predictive compliance | MasterControl, Qualio, ComplianceQuest | None |
| Dev-tool integration (GitHub/CI) | **Ketryx only** | Native |
| Class C IEC 62304 focus | Matrix, Ketryx, Polarion MedPack | Native |

---

## Part 3 — The Six White Spaces (Where We Lead)

Based on the gap analysis, six opportunities where **no competitor ships anything today**:

### White space #1 — Commit→Compliance scoring in real time
The QMS industry came from the doc-centric world. Git-native QMS is rare; only Ketryx competes here. Our existing MSTool-AI-QMS already does this conceptually — we lean harder.

### White space #2 — Self-validating AI with exportable dossier
Every vendor talks about "validated AI" but none hand the customer an IQ/OQ/PQ dossier, PCCP change log, hallucination rate metrics, and drift monitoring as a regulatory artifact. Ketryx validates internally; we validate with the customer.

Source: [FDA PCCP Final Guidance (Dec 2024)](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence); [GMLP Principles](https://www.fda.gov/medical-devices/software-medical-device-samd/predetermined-change-control-plans-machine-learning-enabled-medical-devices-guiding-principles)

### White space #3 — Imaging/SaMD-specific compliance
All tools above are device-agnostic. **None** understand that our target device is a brain MRI segmentation pipeline; that model drift on new scanners is a PCCP trigger; that a lesion-classifier threshold change needs a new risk file sub-section. A QMS that understands NIfTI/DICOM, SynthSeg vs FreeSurfer, MAGNIMS validation — nobody is serving this vertical.

### White space #4 — Knowledge-Graph + RAG on our traceability
Everyone has trace graphs; nobody uses them as LLM context. Research ([RAGulating Compliance arXiv 2508.09893](https://arxiv.org/abs/2508.09893), [GraphCompliance arXiv 2510.26309](https://arxiv.org/html/2510.26309v1)) shows GraphRAG beats plain RAG on regulatory QA. MasterControl implements this approach ([RAG Compliance GenAI blog](https://www.mastercontrol.com/gxp-lifeline/rag-compliance-with-genai-multi-agent-knowledge-graph-approach-for-regulatory-qa/)). Our REQ→HAZ→TEST→CODE graph is already a knowledge graph; we need to surface it to every agent as structured context.

### White space #5 — PCCP execution engine
Only 16.7% of 2024 ML-enabled FDA approvals included a Predetermined Change Control Plan ([PMC12730494](https://pmc.ncbi.nlm.nih.gov/articles/PMC12730494/)). Everyone agrees PCCPs are the future; nobody has an engine that watches production metrics, fires retraining, captures artifacts, auto-updates the DHF, and queues regulatory submissions.

### White space #6 — Autonomous gap closure
Ketryx stops at "suggest." Our stack permits detect gap → create form → draft content → route to human for e-signature → commit to immutable ledger. This is the closed loop.

---

## Part 4 — Architectural Non-Negotiables

These principles govern every technical decision in this plan.

### 4.1 AI = SOUP (documented)
Each Claude model version is pinned (`claude-opus-4-6-20260205`) and registered as SOUP under IEC 62304 §5.3. This neutralizes the Notified Body's first objection.

Source: [Johner Institute validation of ML libraries](https://blog.johner-institute.com/iec-62304-medical-software/validation-of-machine-learning-libraries/)

### 4.2 Human-in-the-loop by risk class
- Class C modules → mandatory digital signature before action commits  
- Class B → human review within 72 hours  
- Class A → periodic sampling  

This keeps us out of EU AI Act high-risk classification.

Source: [EU AI Act compliance for autonomous agents](https://www.covasant.com/blogs/eu-ai-act-compliance-autonomous-agents-enterprise-2026)

### 4.3 WORM-ledger with hash chain
Write-Once-Read-Many audit trail. Each entry references the SHA-256 of the previous entry. Tamper-evident by construction. This is the evidence artifact a Notified Body expects.

### 4.4 Sentence-level citations everywhere
Every AI output hyperlinks to (commit_sha, line_number, clause_id) verifiable references. Pattern from EU AI Act Article 9.

Source: [ShapeofAI citations pattern](https://www.shapeof.ai/patterns/citations), [FINOS AI Governance framework](https://air-governance-framework.finos.org/mitigations/mi-13_providing-citations-and-source-traceability-for-ai-generated-information.html)

### 4.5 Single-threaded supervisor + read-only workers
Following Cognition AI's guidance: avoid parallel subagents that can context-poison each other. Only the supervisor writes. Workers read and recommend.

Sources: [Cognition "Don't Build Multi-Agents"](https://cognition.ai/blog/dont-build-multi-agents), [Anthropic "When to use multi-agent systems"](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)

### 4.6 Model tiering by cost
- Haiku 4.5 → simple pattern matching (Traceability, SOUP Monitor)  
- Sonnet 4.6 → reasoning with citations (PR Review, Docs Drift, CAPA)  
- Opus 4.6 (1M context) → whole-project analysis (Audit Preparation supervisor, Impact Analysis)  

Prompt caching saves 90% on repeat input. Batch mode saves 50% overnight.

Source: [Anthropic prompt caching docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [Claude models overview](https://platform.claude.com/docs/en/about-claude/models/overview)

---

## Part 5 — Technology Stack (Final)

| Layer | Choice | Rationale | Source |
|---|---|---|---|
| LLM | Claude Opus 4.6 + Sonnet 4.6 + Haiku 4.5 | 1M context for whole-project analysis | [Anthropic models](https://platform.claude.com/docs/en/about-claude/models/overview) |
| Agent framework | Claude Agent SDK + LangGraph supervisor | Official SDK simplifies validation; LangGraph checkpointing for audit | [Claude Agent SDK](https://platform.claude.com/docs/en/home) |
| Observability | Langfuse (self-hosted, MIT) | Data sovereignty, HIPAA/GDPR, best agent trace UI | langfuse.com |
| Vector DB | pgvector on Cloud SQL Postgres | <5M vectors, data in our perimeter | [Encore vector DB guide](https://encore.dev/articles/best-vector-databases) |
| Graph DB | Neo4j Aura Free | Cypher natural for impact queries | neo4j.com |
| Embeddings | BGE-large-en-v1.5 + fine-tune on IEC 62304 corpus | Domain-specific wins +10% vs text-embedding-3-large | [Voyage Law-2 study](https://blog.voyageai.com/2024/04/15/domain-specific-embeddings-and-retrieval-legal-edition-voyage-law-2/) |
| ML traditional | XGBoost + SHAP, Prophet, BERTopic | All interpretable (auditor requirement) | [Datadog anomaly algorithms](https://docs.datadoghq.com/monitors/types/anomaly/) |
| MCP | FastMCP + WORM-ledger gateway | Anticipates MCP 2026 audit-trail roadmap | [MCP 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) |
| Time-series | TimescaleDB extension on Postgres | Hypertable compression, fast trend queries | timescale.com |
| Digital signatures | Cloud KMS + PKCS#7 detached | 21 CFR Part 11 compliant | [21 CFR Part 11](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11) |

---

## Part 6 — Six-Phase Roadmap

### Phase 0 — Foundations (Week 1-2)
**Goal:** Fix critical bugs, establish memory substrate.

- Fix Firebase project mismatch (Cloud Run writing to wrong project suspected)  
- Universal mutation middleware in FastAPI auto-logging to `qms_audit_trail`  
- Hash chain: each entry stores `prev_hash + content_hash` for tamper evidence  
- Daily cron `store_score_snapshot()` into TimescaleDB hypertable  
- Health check endpoint `/system` showing config + last write + latency

### Phase 1 — Activity Feed (Week 2-3)
**Goal:** 21 CFR Part 11 §11.10(e) compliant audit trail visible to users.

- Backend: `/activity/feed` with user/type/date filters, `/activity/diff/{id}` returns JSON diff  
- Frontend: Activity page with GitHub-style timeline, real-time via polling  
- AI: Activity Summarizer (Haiku 4.5) weekly email summary

### Phase 2 — Time-Series Analytics (Week 3-5)
**Goal:** The dashboard earns its name.

- Backend: `/compliance/score-history` with granularity, event overlays endpoint  
- Backend: Prophet regression sentinel cron → auto-create `qms_alerts` when actual < forecast 95% PI ([Prophet paper](https://facebook.github.io/prophet/))  
- Frontend: Sparklines inline in every dashboard card (Recharts)  
- Frontend: Trends section with multi-line chart + event markers + 7d/30d/90d/365d selector  
- AI: Trend Analyst Agent (Sonnet 4.6) explains dips on click  
- ML: CE Mark Readiness Monte Carlo (NeuralProphet), SHAP waterfall per gap

Sources: [NeuralProphet](https://neuralprophet.com/), [SHAP perspective 2025](https://advanced.onlinelibrary.wiley.com/doi/10.1002/aisy.202400304)

### Phase 3 — Release Baselines (Week 5-7)
**Goal:** Immutable snapshots for submission; diff viewer for what changed.

- Backend: `qms_baselines` model, POST/baselines creates snapshot, GET/baselines/{v1}/diff/{v2}  
- Backend: GitHub webhook on tag push auto-creates baseline  
- Frontend: Releases page, diff viewer tabs (Requirements/Hazards/SOUP/Compliance/Activity)  
- Frontend: Export CE Mark Submission Package ZIP (audit PDF + SBOM + RTM XLSX + activity log + hash sheet)  
- AI: Release Notes Generator (Opus 4.6 + 1M ctx) drafts regulatory release notes from diff

### Phase 4 — AI Agent Platform (Week 7-14)
**Goal:** 10 validated agents in production, framework for more.

**Infrastructure:**
- Claude Agent SDK + LangGraph supervisor + Langfuse self-hosted  
- Agent Skills folders: `/skills/iec62304/`, `/skills/iso14971/`, `/skills/samd_brain_mri/`  
- Knowledge Graph Neo4j with traceability + regulatory SPO triplets  
- WORM-ledger MCP gateway

**10 agents (ordered by impact × feasibility):**

| # | Agent | Trigger | Model |
|---|---|---|---|
| 1 | Traceability Agent | PR opened | Haiku 4.5 |
| 2 | SOUP Monitor Agent | Cron daily 2am | Haiku 4.5 |
| 3 | PR Compliance Reviewer | PR opened | Sonnet 4.6 |
| 4 | Documentation Drift Agent | Daily + on backend commits | Sonnet 4.6 |
| 5 | CAPA Drafter Agent | On CI failure / bug report | Sonnet 4.6 |
| 6 | Clause Chat Agent | User-initiated | Sonnet 4.6 + KG-RAG |
| 7 | Audit Preparation Agent | User-initiated | Opus 4.6 supervisor + Sonnet workers |
| 8 | Risk Analyst Agent | Class C code change | Sonnet 4.6 + extended thinking |
| 9 | Regulatory Watch Agent | Cron weekly | Haiku daily + Sonnet summary |
| 10 | Autonomous Gap-Closer | Gap detected | Opus 4.6 supervisor |

Each agent gets per-agent validation: 200+ golden prompts with expected citations, hallucination rate threshold < 1% per GMLP Principle 10.

Sources: [Cognition multi-agent guidance](https://cognition.ai/blog/dont-build-multi-agents), [Anthropic multi-agent blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)

### Phase 5 — Self-Validating AI (Week 14-18)
**Goal:** The unique moat — our AI produces its own validation dossier.

- Backend: Agent Validation Suite runner with golden prompts per agent  
- Backend: Drift Detector daily canary (10 prompts) vs last week → alert if >5% divergence  
- Backend: PCCP Generator (Claude Opus 4.6) from Anthropic changelog + golden suite diff  
- Frontend: AI Validation page (QMS Manager only) with agents, last run, pass rate, drift  
- Frontend: Export AI Validation Dossier PDF (auditor-ready)  
- AI: Validator Meta-Agent (Opus 4.6) reviews the 10 agents weekly  
- Safety: Constitutional Classifiers on input/output boundary of Class-C-affecting agents

Sources: [FDA PCCP final guidance](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence), [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/next-generation-constitutional-classifiers), [Ketryx validated agents methodology](https://www.ketryx.com/blog/ketryx-wants-its-validated-ai-agents-to-accelerate-compliance-workflows)

### Phase 6 — Predictive + Explainable (Week 18-24)
**Goal:** One step ahead of Ketryx with change impact + failure prediction.

- Backend: Clause-Level Audit Failure Predictor (XGBoost) trained on historical audits  
- Backend: Change Impact Analyzer (ProReFiCIA pattern) — Opus 4.6 with full SRS+RMF+diff in 1M ctx  
- Backend: Suspect Links Engine — REQ change marks downstream as `suspect=true`  
- Backend: Missing Trace Link Predictor (HGNNLink-style GNN or BERT pairwise)  
- Backend: Imaging/SaMD Semgrep rules (NIfTI/DICOM/voxel bounds)  
- Frontend: Dashboard "Forecast" section with CE Mark date + per-clause failure heatmap  
- Frontend: Traceability suspect badges  
- Frontend: PR view "This PR affects REQ-X, test Y, hazard Z — re-verification needed"  
- Experimental: Voice-driven audit prep (Whisper + Claude + Computer Use)

Sources: [LiSSA ICSE 2025 traceability](https://conf.researchr.org/details/icse-2025/icse-2025-research-track/192/LiSSA-Toward-Generic-Traceability-Link-Recovery-through-Retrieval-Augmented-Generati), [ProReFiCIA arXiv 2511.00262](https://arxiv.org/pdf/2511.00262), [HGNNLink 2025](https://link.springer.com/article/10.1007/s10515-025-00528-2), [LApredict ISSTA'21](https://lingming.cs.illinois.edu/publications/issta2021a.pdf), [SZZ Unleashed](https://github.com/wogscpar/SZZUnleashed)

---

## Part 7 — Parallel Execution Strategy

Phases 0-2 are sequential (foundation). Phases 3-6 parallelize across four logical sub-agents:

| Sub-agent | Domain | Git worktree |
|---|---|---|
| Agent-Backend-Core | FastAPI routes, Firestore persistence, cron jobs | worktree/backend-core |
| Agent-Backend-AI | Claude SDK, LangGraph, agents, MCP gateway | worktree/backend-ai |
| Agent-Frontend | React components, pages, charts, AI sidebar | worktree/frontend |
| Agent-Infra | Cloud Run, TimescaleDB, Neo4j, pgvector, secrets | worktree/infra |

---

## Part 8 — Success Metrics

| Metric | Baseline (2026-04) | Target (2026-10) | Competitor benchmark |
|---|---|---|---|
| Activity trail coverage | ~10% | 100% mutations | Helix ALM: 100% |
| Time-series charts | 0 | 8 trends visible | Jama Trace Scores: 3 |
| AI agents in production | 0 | 10 validated | Ketryx: 6 |
| Release baselines signed | 0 | Auto on each git tag | Jama/Codebeamer: yes |
| AI Validation Dossier PDF | does not exist | signable PDF | **no competitor has this** |
| Hash-chain audit ledger | no | yes, WORM | **no competitor has this** |
| Brain MRI-aware rules | 0 | 15+ Semgrep rules | **no competitor has this** |
| Claude API cost | ~$0 | <$800/mo with caching | n/a |

---

## Part 9 — Risk Register

| Risk | Probability | Mitigation |
|---|---|---|
| Claude API cost explosion | High | Model tiering + prompt caching (90% savings) + batch mode (50% savings) + hard rate limits |
| Agent hallucinations on Class C | Medium | Constitutional Classifiers + self-consistency voting + mandatory e-signature |
| FDA/Notified Body rejects AI | Low if PCCP followed | Each agent documented as SOUP + auto-generated PCCP + Langfuse evidence chain |
| Scope creep | High | Kill criterion: Phase 0-2 in 4 weeks; recut Phase 6 if slipping |
| Firestore cost with audit trail | Medium | TimescaleDB for time-series; Firestore for entities only; BigQuery archival after 90d |
| EU AI Act high-risk classification | High if we automate without HITL | Mandatory human sign-off for Class C actions |

---

## Part 10 — References

Research synthesized from four parallel agents. Full source list:

**Competitor analysis:**
- Ketryx: [AI agents](https://www.ketryx.com/blog/ketryx-ai-agents), [MCP announcement](https://www.ketryx.com/press-release/ketryx-announces-mcp), [validated agents launch](https://www.prnewswire.com/news-releases/ketryx-launches-first-validated-ai-agents-to-accelerate-safety-critical-product-development-302443256.html), [Series B coverage](https://www.rdworldonline.com/ketryx-raises-39-million-in-series-b-funding-to-expand-ai-compliance-tools-for-life-sciences/)
- Greenlight Guru: [Halo](https://www.greenlight.guru/intelligent-document-management-halo), [Risk Intelligence](https://www.greenlight.guru/blog/greenlight-guru-launches-ai-powered-solutions-to-enable-better-risk-management-for-the-medtech-industry), [21 CFR Part 11 guide](https://www.greenlight.guru/blog/21-cfr-part-11-guide), [G2 reviews](https://www.g2.com/products/greenlight-guru-quality-management-system/reviews)
- Qualio: [launch](https://www.qualio.com/blog/announcing-compliance-intelligence), [Feb 26 release](https://docs.qualio.com/en/articles/13641485-february-26-launch-train-release-notes), [PRNewswire](https://www.prnewswire.com/news-releases/qualio-announces-compliance-intelligence-the-ai-powered-solution-advancing-its-industry-leading-life-sciences-grc-platform-302583316.html)
- Jama: [AI page](https://www.jamasoftware.com/solutions/artificial-intelligence/), [Leveraging AI blog](https://www.jamasoftware.com/blog/leveraging-artificial-intelligence-in-requirements-management/), [Live Trace Explorer](https://www.jamasoftware.com/blog/2025/06/17/webinar-recap-improve-traceability-and-enhance-coverage-with-live-trace-explorer/)
- Polarion: [AI](https://polarion.plm.automation.siemens.com/ai), [Polarion X on Azure](https://news.siemens.com/en-us/siemens-polarion-x-azure/), [IEC 62304 MedPack](https://extensions.polarion.com/extensions/31-polarion-alm-medpack-iec-62304)
- Codebeamer: [PTC ALM 2026](https://www.ptc.com/en/news/2026/ptc-delivers-new-ai-functionality-with-new-alm-releases), [Codebeamer AI](https://www.ptc.com/en/products/codebeamer/codebeamer-ai)
- MasterControl: [Insights](https://www.mastercontrol.com/insights/), [RAG Compliance blog](https://www.mastercontrol.com/gxp-lifeline/rag-compliance-with-genai-multi-agent-knowledge-graph-approach-for-regulatory-qa/)
- ComplianceQuest: [AI page](https://www.compliancequest.com/ai/), [Summer 25](https://www.newswire.com/news/compliancequest-unveils-summer-25-release-cq-ai-agents-usher-in-a-new-22649339)
- Matrix: [MatrixOne Health](https://matrixone.health/products/matrix-requirements)
- Helix ALM: [audit trails](https://help.perforce.com/helix-alm/helixalm/current/client/Content/ClientUser/Admin/ManagingAuditTrails.htm)

**LLM/RAG architecture:**
- [Hybrid retrieval regulatory arXiv 2502.16767](https://arxiv.org/abs/2502.16767)
- [GraphRAG for compliance arXiv 2508.09893](https://arxiv.org/abs/2508.09893)
- [GraphCompliance arXiv 2510.26309](https://arxiv.org/html/2510.26309v1)
- [Jina ColBERT v2](https://jina.ai/news/jina-colbert-v2-multilingual-late-interaction-retriever-for-embedding-and-reranking/)
- [SaulLM legal model arXiv 2504.04945](https://arxiv.org/html/2504.04945v1)
- [LiSSA traceability ICSE 2025](https://conf.researchr.org/details/icse-2025/icse-2025-research-track/192/LiSSA-Toward-Generic-Traceability-Link-Recovery-through-Retrieval-Augmented-Generati)
- [ProReFiCIA arXiv 2511.00262](https://arxiv.org/pdf/2511.00262)
- [CompliBench arXiv 2604.12312](https://arxiv.org/html/2604.12312)
- [MetaRAG](https://ceur-ws.org/Vol-4136/iaai6.pdf)
- [Constitutional Classifiers](https://www.anthropic.com/research/next-generation-constitutional-classifiers)
- [Anthropic prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Claude healthcare launch](https://www.anthropic.com/news/healthcare-life-sciences)

**ML for compliance prediction:**
- [Datadog anomaly algorithms](https://docs.datadoghq.com/monitors/types/anomaly/)
- [Grafana AI/ML observability](https://grafana.com/blog/identify-anomalies-outlier-detection-forecasting-how-grafana-cloud-uses-ai-ml-to-make-observability-easier/)
- [NeuralProphet arXiv 2111.15397](https://arxiv.org/pdf/2111.15397)
- [Anomaly-Transformer ICLR 2022](https://github.com/thuml/Anomaly-Transformer)
- [Google Cloud DORA 2025](https://cloud.google.com/blog/products/ai-machine-learning/announcing-the-2025-dora-report)
- [LApredict ISSTA'21](https://lingming.cs.illinois.edu/publications/issta2021a.pdf)
- [SZZ Unleashed GitHub](https://github.com/wogscpar/SZZUnleashed)
- [SZZ refined 2024](https://link.springer.com/article/10.1007/s10664-024-10511-2)
- [HGNNLink trace link recovery 2025](https://link.springer.com/article/10.1007/s10515-025-00528-2)
- [T-BERT FSE 2021](https://arxiv.org/abs/2102.04411)
- [BERTopic vs LDA Sage 2025](https://journals.sagepub.com/doi/10.1177/14413582251399667)
- [FDA FAERS network analysis 2025](https://link.springer.com/article/10.1007/s40264-025-01609-7)
- [SHAP/LIME XAI 2025](https://advanced.onlinelibrary.wiley.com/doi/10.1002/aisy.202400304)
- [Snyk DeepCode AI Fix](https://github.com/snyk/deepcode_ai_fix)
- [BGE-M3](https://huggingface.co/BAAI/bge-m3)
- [Voyage Law-2 domain embeddings study](https://blog.voyageai.com/2024/04/15/domain-specific-embeddings-and-retrieval-legal-edition-voyage-law-2/)

**Agentic AI:**
- [Claude models overview](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Cognition "Don't Build Multi-Agents"](https://cognition.ai/blog/dont-build-multi-agents)
- [Anthropic multi-agent blog](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)
- [MCP 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [LangGraph production comparison](https://sparkco.ai/blog/langgraph-vs-crewai-vs-autogen-2025-production-showdown)
- [Anthropic Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)

**Regulatory:**
- [FDA PCCP Final Guidance 2024](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/marketing-submission-recommendations-predetermined-change-control-plan-artificial-intelligence)
- [GMLP Principles](https://www.fda.gov/medical-devices/software-medical-device-samd/predetermined-change-control-plans-machine-learning-enabled-medical-devices-guiding-principles)
- [Johner Institute SOUP ML libraries](https://blog.johner-institute.com/iec-62304-medical-software/validation-of-machine-learning-libraries/)
- [EU AI Act agent compliance](https://www.covasant.com/blogs/eu-ai-act-compliance-autonomous-agents-enterprise-2026)
- [IEC 62304 Edition 2 changes](https://intuitionlabs.ai/pdfs/iec-62304-edition-2-2026-medical-device-software-changes.pdf)
- [FDA Elsa AI deployment](https://www.kslaw.com/news-and-insights/fda-announces-completion-of-ai-assisted-scientific-review-pilot-and-deployment-of-agency-wide-ai-assisted-review)
- [MDCG 2025-6 on EU AI Act + MDR](https://medenvoyglobal.com/blog/the-eu-ai-act-and-notified-bodies/)

---

**End of Master Plan v1.0.**
