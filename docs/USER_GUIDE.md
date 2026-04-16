# User Guide — MSTool-AI-QMS

For QMS Managers, Developers, QA, Clinical Advisors, and Admins of the
MSTool-AI medical device project.

## What is this?

MSTool-AI-QMS is the Quality Management System that watches the
MSTool-AI medical-imaging viewer repository in real time. It scores
compliance against IEC 62304, ISO 13485, ISO 14971, IEC 81001-5-1, and
EU MDR / FDA QMSR continuously, runs validated AI agents to help with
the day-to-day QMS work, and produces auditor-ready evidence on demand.

Live URL: https://mstool-ai-qms.web.app

## The 5 things you should know

1. **The Dashboard is now an actual dashboard** — charts of compliance
   over time, CI history, activity heatmap, per-area sparklines.
2. **Activity** is the WORM (Write Once Read Many) audit trail. Every
   mutation in the system is hash-chained. 21 CFR Part 11 §11.10(e).
3. **Releases** are immutable baselines. One click downloads a CE Mark
   Submission Package ZIP.
4. **Agents** are 10 Claude-powered helpers. Some advisory, some
   require your e-signature before action.
5. **Insights** has the predictive ML + AI Validation Dossier export.

## Daily workflow by role

### Developer
- Open a PR → the **PR Reviewer** agent posts a compliance review
  comment + sets a check-run status. Block-level findings prevent merge.
- If you see a "✨ AI-drafted" form on the **Forms** page,
  the Autonomous Gap-Closer detected a gap and proposed it for you.

### QA
- Run **Audit** weekly — choose Full IEC 62304 Audit. Discrepancies are
  surfaced per clause.
- Watch the **Insights** page for at-risk clause predictions and the
  gap waterfall.
- Sign agent runs that require approval (purple checkmarks on Agents page).

### QMS Manager
- Create **Releases** at every milestone. Sign each baseline.
- Once per quarter, click "Generate PCCP" on Agents page to refresh
  the AI Validation Dossier for FDA submission.
- Review **Activity** for unexpected mutations (foreign user agents,
  off-hours activity).

### Clinical Advisor
- Use **Clause Chat** agent to ask "How do I show evidence for
  ISO 14971 §7.3?" — answers come with citations.
- Review Risk Analyst agent's hazard proposals on PRs that touch
  Class C modules.

### Admin
- Watch **System Usage** (Insights → Methodology card) for Claude
  budget consumption.
- Re-set `ANTHROPIC_API_KEY` after Cloud Build deploys (it should
  persist now via `--update-env-vars`, but verify).
- Periodically run "Verify ledger" to confirm WORM integrity.

## What the 10 agents do

| Agent | Tier | What it does | When it runs |
|---|---|---|---|
| Traceability | Haiku | Flags commits missing REQ-IDs | On demand + on PR |
| SOUP Monitor | Haiku | Analyzes CVEs against your dependency context | Daily 03:00 UTC + on demand |
| PR Reviewer | Sonnet | Reviews PRs against IEC 62304 §5.5-5.8 | On every PR open/sync |
| Doc Drift | Sonnet | Detects drift between code and SRS/SDS/RMF | On demand |
| CAPA Drafter | Sonnet | Drafts 5-whys + corrective + preventive | On demand (you provide problem) |
| Clause Chat | Sonnet | Cited Q&A about compliance | On demand |
| Audit Prep | Opus 4.6 | Whole-project audit prep + draft Q&A | On demand |
| Risk Analyst | Sonnet | Proposes hazards from Class C diffs | On demand |
| Regulatory Watch | Sonnet | Weekly digest FDA/EU/IEC updates | Weekly Mon 06:00 UTC |
| Autonomous Gap-Closer | Opus 4.6 | Drafts forms to close gaps end-to-end | On demand |

Every agent output requires human e-signature before it changes
Class C state. Constitutional Classifiers screen outputs for safety
before you ever see them.

## Compliance scoring — the two scores

Health Score (Dashboard banner, blue): real-time telemetry. Continuous
percentage. Rewards partial progress.

Audit Verdict (Audit page, purple): per-clause grade STRONG / ADEQUATE /
WEAK / MISSING with discrete points (100/75/40/0). Penalizes gaps
strictly. This is what an actual auditor produces.

They differ because they measure the same project with different lenses.
"Why two scores?" modal explains the formula and worked example.

## The MCP gateway (advanced)

Any IDE that supports MCP (Claude Code, Cursor, Windsurf) can query
the QMS read-only:

```jsonc
// In your MCP client config:
{
  "mstool-ai-qms": {
    "url": "https://mstool-ai-qms-209356685171.us-central1.run.app/api/v1/mcp",
    "headers": {"Authorization": "Bearer <firebase-id-token>"}
  }
}
```

Tools available: `compliance.score`, `traceability.stats`, `baselines.latest`,
`soup.summary`, `gaps.top`, `audit.run-status`, `predict.clauses`.

Every IDE-agent call is logged into the same WORM ledger as direct UI
actions, so an auditor can trace every external query back to its caller.

## Frequently asked questions

**Q: I see "Charts will appear shortly". What now?**
APScheduler captures snapshots every hour. The first one runs at
:05 minutes past the hour. You can also trigger one manually via
`POST /api/v1/system/snapshot/trigger` (admin only).

**Q: An agent returned a stub answer.**
`ANTHROPIC_API_KEY` is missing or invalid on Cloud Run. Re-set it
per the deployment runbook.

**Q: My e-signature on a baseline shows "valid: true, method: hmac_sha256_dev".**
You haven't configured Cloud KMS yet. The signature works for internal
use but isn't FDA-grade. See deployment runbook → "Bootstrap a Cloud KMS
signing key".

**Q: Activity feed shows my own actions.**
Yes — that's the point of an audit trail. Even your own actions are
recorded for accountability.

**Q: How do I export evidence for an audit?**
Releases page → click a baseline → "Submission Package ZIP" downloads
audit_report.pdf + traceability.xlsx + soup_inventory.json + activity_log.json
+ ai_dossier.json + README.md + HASHES.txt in one ZIP.
