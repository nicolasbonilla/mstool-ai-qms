# Deployment Runbook — MSTool-AI-QMS

This runbook is the authoritative source for how the QMS is deployed,
configured, and recovered. If anything in production differs from this
document, update the document.

## Production topology

| Component | Project | Service / Tool | Notes |
|---|---|---|---|
| Backend (FastAPI) | `brain-mri-476110` | Cloud Run `mstool-ai-qms` (us-central1) | min_instances=1, max=3, 1Gi memory |
| Frontend (React) | `mstool-ai-qms` | Firebase Hosting | https://mstool-ai-qms.web.app |
| Auth | `mstool-ai-qms` | Firebase Auth | Email/password + Google sign-in |
| Database | `mstool-ai-qms` | Firestore | Collections prefixed `qms_*` |
| Container registry | `brain-mri-476110` | GCR | `gcr.io/brain-mri-476110/mstool-ai-qms` |

Notice the cross-project arrangement: the backend image lives in
`brain-mri-476110` (same project as the medical-imaging-viewer because
that's where Cloud Build runs), but its Firestore data lives in the
separate `mstool-ai-qms` project. The `QMS_FIREBASE_PROJECT` env var
forces this routing — never depend on `GOOGLE_CLOUD_PROJECT`.

## Required environment variables

All variables below MUST be present on the Cloud Run service. The
`cloudbuild.yaml` only sets the public ones via `--update-env-vars`;
the secrets are configured out-of-band so they don't appear in the
git history.

| Var | Source | Set-up command |
|---|---|---|
| `GITHUB_REPO` | cloudbuild.yaml | preserved across deploys |
| `GOOGLE_CLOUD_PROJECT` | cloudbuild.yaml | should be `mstool-ai-qms` |
| `QMS_FIREBASE_PROJECT` | cloudbuild.yaml | always `mstool-ai-qms` |
| `ANTHROPIC_API_KEY` | manual | `gcloud run services update mstool-ai-qms --update-env-vars ANTHROPIC_API_KEY=sk-ant-...` |
| `GITHUB_WEBHOOK_SECRET` | manual | generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` then update Cloud Run + GitHub webhook UI |
| `GITHUB_TOKEN` | manual (optional) | needed for PR Reviewer to post comments |
| `GITHUB_TOKEN` | manual | GitHub personal access token for the medical-imaging-viewer repo. WITHOUT THIS the backend hits 60 req/hr rate limit → all pages crash. Must have `repo` scope. |
| `QMS_ESIGN_KMS_KEY` | manual (optional) | full Cloud KMS key resource name; falls back to HMAC dev mode if unset |
| `RATE_LIMIT_AGENT_PER_MIN` | optional | default `10/minute` |
| `MAX_CLAUDE_CALLS_PER_HOUR` | optional | default `100` |
| `MAX_AGENT_CALLS_PER_USER_DAY` | optional | default `80` |

## Deploy from local

```bash
# Backend (image build + Cloud Run deploy)
cd /c/Users/Nicolas/mstool-ai-qms
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=COMMIT_SHA=$(git rev-parse --short HEAD)

# Frontend
cd frontend
npm run build
npx firebase deploy --only hosting --project mstool-ai-qms

# Firestore rules (rare)
cd ..
npx firebase deploy --only firestore:rules --project mstool-ai-qms
```

## Verify a deploy

```bash
# Confirm latest revision + all 7 env vars present
gcloud run services describe mstool-ai-qms --region=us-central1 \
  --project=brain-mri-476110 \
  --format="value(spec.template.spec.containers[0].env[].name,status.latestReadyRevisionName)"
# Expected: GITHUB_REPO;GOOGLE_CLOUD_PROJECT;ANTHROPIC_API_KEY;QMS_FIREBASE_PROJECT;GITHUB_WEBHOOK_SECRET;CRON_SECRET;GITHUB_TOKEN

# Expected output (4 env vars at minimum):
# GITHUB_REPO;GOOGLE_CLOUD_PROJECT;ANTHROPIC_API_KEY;QMS_FIREBASE_PROJECT
# Revision should be the new one (mstool-ai-qms-NNNNN-XXX)

# Then in the browser, open https://mstool-ai-qms.web.app and check:
# - Dashboard charts populate within ~1 minute (or trigger via /system/snapshot/trigger)
# - Activity page shows your login as the latest entry
# - Agents page shows 10 agents + Skills + MCP tools sections
```

## Common tasks

### Re-set the Anthropic API key

```bash
gcloud run services update mstool-ai-qms --region=us-central1 \
  --project=brain-mri-476110 \
  --update-env-vars "ANTHROPIC_API_KEY=sk-ant-..."
```

### Configure GitHub webhook

1. Generate the secret:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
2. Set on Cloud Run:
   ```bash
   gcloud run services update mstool-ai-qms --region=us-central1 \
     --project=brain-mri-476110 \
     --update-env-vars "GITHUB_WEBHOOK_SECRET=<paste-secret>"
   ```
3. In GitHub repo settings → Webhooks → Add webhook:
   - Payload URL: `https://mstool-ai-qms-209356685171.us-central1.run.app/api/v1/webhooks/github`
   - Content type: `application/json`
   - Secret: `<paste same secret>`
   - Events: pushes, releases, pull requests

### Bootstrap a Cloud KMS signing key (optional, for real e-signatures)

```bash
PROJECT=mstool-ai-qms
LOCATION=us-central1
KEYRING=qms-esign
KEY=signing-key

gcloud kms keyrings create $KEYRING --location=$LOCATION --project=$PROJECT
gcloud kms keys create $KEY --keyring=$KEYRING --location=$LOCATION \
  --purpose=asymmetric-signing \
  --default-algorithm=rsa-sign-pss-2048-sha256 --project=$PROJECT

# Grant Cloud Run service account permission
gcloud kms keys add-iam-policy-binding $KEY --keyring=$KEYRING --location=$LOCATION \
  --member=serviceAccount:209356685171-compute@developer.gserviceaccount.com \
  --role=roles/cloudkms.signer --project=$PROJECT

# Set env var
KEY_NAME="projects/$PROJECT/locations/$LOCATION/keyRings/$KEYRING/cryptoKeys/$KEY/cryptoKeyVersions/1"
gcloud run services update mstool-ai-qms --region=us-central1 \
  --project=brain-mri-476110 \
  --update-env-vars "QMS_ESIGN_KMS_KEY=$KEY_NAME"
```

## Scheduled jobs

APScheduler runs in-process per Cloud Run instance. With `min_instances=1`
the scheduler is always alive. Leader election via Firestore
(`qms_settings/scheduler_leases/jobs/{name}`) prevents duplicate
execution if Cloud Run scales to N>1.

| Job | Cron | Effect |
|---|---|---|
| hourly_snapshot | `:05` of every hour | qms_score_history bucket write |
| daily_sentinel | `02:30 UTC` | Prophet + 2σ regression scan |
| daily_soup_monitor | `03:00 UTC` | NVD scan via SOUP Monitor agent |
| weekly_regulatory_watch | `Mon 06:00 UTC` | Regulatory Watch agent digest |
| weekly_drift_canary | `Mon 07:00 UTC` | Run all canary prompts + alert on drift |

Inspect leases:
```bash
curl -H "Authorization: Bearer <id-token>" \
  https://mstool-ai-qms-209356685171.us-central1.run.app/api/v1/system/scheduler/status
```

## Recovery

### Backend image won't deploy
Check Cloud Build logs:
```bash
gcloud builds list --limit=3
gcloud builds log <BUILD_ID>
```

### Charts on Dashboard are empty
1. Check `/system/health` — does it report 4 env vars and Firestore project = mstool-ai-qms?
2. Trigger a snapshot manually: `POST /api/v1/system/snapshot/trigger` (admin only).
3. Check `qms_score_history` collection in Firestore console.

### Agents return stub responses
- `ANTHROPIC_API_KEY` env var was not preserved across the last deploy.
- Re-set it (see "Re-set the Anthropic API key" above).

### WORM ledger appears tampered with
```bash
curl -H "Authorization: Bearer <admin-token>" \
  https://mstool-ai-qms-209356685171.us-central1.run.app/api/v1/system/ledger/verify?limit=2000
```
Returns `{valid: false, first_break: {sequence: N, ...}}` if tampered.
Investigate Firestore audit log around that sequence.
