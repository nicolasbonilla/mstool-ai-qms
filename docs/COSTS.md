# Cost Optimization — MSTool-AI-QMS

This document is the source of truth for production costs and the design
choices that keep them low. Update it when you change Cloud Run config,
add new agents, or change Claude budget caps.

## Current monthly estimate

| Component | Config | Estimated | Worst-case |
|---|---|---|---|
| **Cloud Run** | min=0, max=3, 512Mi, 1 vCPU, CPU-throttled | **~$0-5** | ~$15 |
| **Cloud Scheduler** | 6 free jobs (under 3-job free tier × 2 projects) | **$0** | $0 |
| **Firestore** | Reads/writes + storage | **~$1-3** | ~$10 |
| **Container Registry** | 2 tags per build × ~200MB | **~$0.50** | $1 |
| **Cloud Build** | ~10 deploys/mo × 3 min | **~$0.30** | $1 |
| **Firebase Hosting** | Static frontend | **$0** (under free tier) | $1 |
| **Anthropic Claude API** | Capped at 50/hr × 24 × 30 × $0.005 | **$0-50** typical | **$180** absolute max |
| **Total infra (excl. AI)** | | **~$2-9/month** | **~$28** |
| **Total with capped AI** | | **~$5-60/month** | **~$210** |

Compared to previous config (`min-instances=1`, 1Gi memory, no caps):
- Was: ~$50-65/month base + uncapped AI risk
- Now: ~$2-9/month base + capped AI risk
- **Savings: ~85% on infrastructure, AI now bounded**

## What enables scale-to-zero

The original min_instances=1 was justified because in-process APScheduler
needed the container alive 24/7. That's a $30-45/month decision for what
amounted to 6 cron invocations per day.

**Migration**: Cloud Scheduler now hits 6 HTTP endpoints (`/api/v1/cron/*`)
on schedule. Each invocation cold-starts Cloud Run if needed (~3s),
runs the job (~1-30s), and Cloud Run scales back to zero.

| Cron job | Schedule | Endpoint | Avg duration |
|---|---|---|---|
| Hourly snapshot | `:05 *` | /cron/snapshot | ~3s |
| Regression sentinel | `02:30 UTC` | /cron/sentinel | ~5s |
| SOUP monitor | `03:00 UTC` | /cron/soup-monitor | ~10s (Haiku call) |
| Firestore sweep | `04:15 UTC` | /cron/firestore-ttl-sweep | ~3s |
| Regulatory watch | `Mon 06:00 UTC` | /cron/regulatory-watch | ~15s (Sonnet call) |
| Drift canary | `Mon 07:00 UTC` | /cron/drift-canary | ~120s (10 agents × 1 prompt) |

Total Cloud Run-seconds per month: ~24h × 30d × 3.5s avg + weekly = **~9,000s**
That's well under the 180,000 free seconds/month tier.

## What protects Claude API spend

3 layers, all configurable via env vars:

| Layer | Default | Env var |
|---|---|---|
| Per-user/min (slowapi, in-memory) | 5/minute | `RATE_LIMIT_AGENT_PER_MIN` |
| Per-user/day (Firestore) | 30 | `MAX_AGENT_CALLS_PER_USER_DAY` |
| Global/hour (Firestore) | 50 | `MAX_CLAUDE_CALLS_PER_HOUR` |

Worst-case math (if every call were Opus at $0.015/call):
- 50/hour × 24h × 30d × $0.015 = **$540/month maximum**

Realistic case (mix of Haiku/Sonnet/Opus, average $0.005/call):
- 30/user/day × 5 active users × $0.005 = **$22/user-month**
- ~$10-30/month typical team usage

## What protects Firestore storage growth

`/cron/firestore-ttl-sweep` runs daily at 04:15 UTC and:

1. **Collapses hourly score snapshots older than 7 days into one daily average doc.**
   Without this: 24 docs/day × 365 days = 8,760 docs/year just for scores.
   With this: 7×24 + 358 = 526 docs/year.
2. **Prunes rate-limit counter buckets older than 7 days.**
3. **Audit trail (`qms_audit_trail`) is INTENTIONALLY NOT pruned** — that's
   our 21 CFR Part 11 §11.10(e) commitment. It grows linearly with team
   activity (~50 entries/day × 365 = ~18k entries/year, ~$0.05/year storage).

## What costs money if you're not careful

These are the things that can blow the budget if changed without thinking:

1. **Setting `min-instances >= 1`** — flips Cloud Run to always-allocated CPU. ~+$30-45/month per minimum instance.
2. **Removing rate limit caps** — Anthropic API has no native budget cap; you can spend $1000s in an afternoon if a bug retries forever.
3. **Adding sentence-transformers + storing embeddings in memory** — bumps memory requirement back to 1Gi (~+$15/month if min>0).
4. **Setting `MAX_CLAUDE_CALLS_PER_HOUR > 100`** — raises worst-case ceiling proportionally.
5. **Using Opus 4.6 for an agent that doesn't need 1M context** — Opus is ~6x more expensive than Sonnet and ~30x more than Haiku per token.

## Default model tier per agent

Reviewed for cost-vs-quality trade-off:

| Agent | Tier | Justification |
|---|---|---|
| Traceability | Haiku | Pattern matching commits |
| SOUP Monitor | Haiku | Read JSON CVE feed, classify |
| **Clause Chat** | **Haiku** (was Sonnet) | Skills bundle compensates for tier |
| PR Reviewer | Sonnet | Reasoning + citations on diffs |
| Doc Drift | Sonnet | Surgical edit proposals need quality |
| CAPA Drafter | Sonnet | Multi-section structured output |
| Risk Analyst | Sonnet | Hazard taxonomy reasoning |
| Regulatory Watch | Sonnet | Multi-source synthesis |
| **Audit Prep** | **Opus 4.6** | 1M context loads whole project |
| **Autonomous Gap Closer** | **Opus 4.6** | Whole-project context for fix drafting |

Only 2 of 10 agents use Opus. The rest are Haiku or Sonnet.

## How to verify cost behavior

```bash
# 1) Check Cloud Run is actually scaling to zero
gcloud run services describe mstool-ai-qms --region=us-central1 \
  --project=brain-mri-476110 \
  --format="value(spec.template.metadata.annotations.autoscaling.knative.dev/minScale)"
# Expected: "0"

# 2) Check Cloud Scheduler is alive
gcloud scheduler jobs list --location=us-central1 --project=brain-mri-476110
# Expected: 6 ENABLED jobs

# 3) Check rate-limit counters
curl -H "Authorization: Bearer <token>" \
  https://mstool-ai-qms-209356685171.us-central1.run.app/api/v1/system/usage

# 4) Check actual Cloud Run billing (last 30 days)
gcloud billing accounts list  # find your billing account ID
# Then in Cloud Console: Billing → Reports → filter by service=Cloud Run
```

## When you legitimately need to spend more

- **Heavy concurrent traffic**: bump `--max-instances=10` (each scaled instance is independent)
- **Need sentence-transformers semantic search**: set `--memory=1Gi` and install package
- **Cloud KMS for real e-signatures**: ~$0.06/month per key + $0.03/10k operations (negligible)
- **Add another active user**: ~$5/user-month at default caps
