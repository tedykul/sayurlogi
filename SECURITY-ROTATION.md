# Security Rotation Checklist

> Generated after `.env` purge from git history (Phase 2, item #4).

## What was purged

The following secrets were committed to git history (commit `c011629`,
now rewritten and purged) and MUST be considered COMPROMISED:

| Secret | Exposed Value (prefix) | Status |
|--------|----------------------|--------|
| `NEXTAUTH_SECRET` | `kmvEa80irxXPAfTAihQP6bMCulw...` | ⚠️ Compromised — rotate |
| `INTEGRATION_ENCRYPTION_KEY` | `192d1c78edd3c334c35c4e4ba99d8c50...` | ⚠️ Compromised — rotate |
| `WEBHOOK_SECRET` | `09bd0d6c3c839d1b0bf6040333bdbdf5...` | ⚠️ Compromised — rotate |
| `SYNC_WEBHOOK_SECRET` | `d7690c245865f089f7353023f6d5f977...` | ⚠️ Compromised — rotate |
| `ADMIN_PASSWORD` | `admin123` | ✅ Rotated (Phase 1, item #3) |

## Local purge — DONE ✓

- `.env` removed from all 67 commits in history via `git filter-repo`.
- Verified: `git log --all -p | rg <secret>` returns empty for all 4 secrets.
- `.env` is now in `.gitignore` (`.env*` pattern) and untracked.
- Backup branch `backup-before-purge` was also rewritten (filter-repo processes all refs).
- Old objects remain in `.git/` until garbage collection (`git reflog expire --expire=now --all && git gc --prune=now --aggressive`).

## Remote (GitHub) — REQUIRES FORCE PUSH

The GitHub remote (`origin`) still has the OLD history with secrets. To purge there:

```bash
# From a machine with GitHub credentials configured:
git push --force origin main
git push --force origin backup-before-purge  # if you want to keep the backup branch
```

⚠️ **Warning**: Force push rewrites all commit hashes. Anyone who cloned the
repo needs to re-clone or `git reset --hard origin/main`.

## Secret rotation — RECOMMENDED

Even after purging git history, the exposed secrets are still VALID until rotated.
Rotate each one:

### 1. NEXTAUTH_SECRET (signs session cookies)

```bash
# Generate new secret
NEW_SECRET=$(openssl rand -base64 32)
echo "NEXTAUTH_SECRET=$NEW_SECRET"

# Update .env on production VPS, then restart:
# pm2 restart sayurlogi
```

**Impact**: All existing admin sessions invalidated. Admins need to re-login.
Customer sessions (if any) also invalidated.

### 2. INTEGRATION_ENCRYPTION_KEY (encrypts DB-stored secrets)

```bash
NEW_KEY=$(openssl rand -hex 32)
echo "INTEGRATION_ENCRYPTION_KEY=$NEW_KEY"
```

**Impact**: Existing `IntegrationConfig` rows with `isSecret=true` become
undecryptable. Currently the dev DB has NO `IntegrationConfig` rows, so
rotation is safe here. On production VPS, check first:

```bash
# On VPS: count secret integrations
sqlite3 db/custom.db "SELECT COUNT(*) FROM IntegrationConfig WHERE isSecret=1;"
```

If count > 0, decrypt all secrets with the OLD key, rotate the key,
re-encrypt with the NEW key (script needed — contact dev).

### 3. WEBHOOK_SECRET + SYNC_WEBHOOK_SECRET

```bash
NEW_WEBHOOK=$(openssl rand -hex 24)
NEW_SYNC=$(openssl rand -hex 24)
echo "WEBHOOK_SECRET=$NEW_WEBHOOK"
echo "SYNC_WEBHOOK_SECRET=$NEW_SYNC"
```

**Impact**: ERPNext webhook deliveries will fail signature validation
until you update the webhook secret in ERPNext too:

```bash
# In ERPNext bench console (or via API):
# Update Webhook for Sales Order → set secret header to NEW_WEBHOOK
# Update Webhook for Item sync → set secret header to NEW_SYNC
```

### 4. ADMIN_PASSWORD — ALREADY ROTATED ✓

New password delivered out-of-band. Run on VPS to sync:

```bash
ADMIN_PASSWORD='<new-password>' bun run scripts/seed-admin.ts
```

## Post-rotation verification

```bash
# Verify login with new admin password
curl -X POST https://your-domain/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sayurlogi.id","password":"<new-password>"}'

# Verify webhook signature validation (create test order in ERPNext)
# Check sayurlogi logs for "webhook signature invalid" errors
```

## GitHub token (separate issue — #2, skipped)

The GitHub PAT `ghp_2Wex...` exposed in IM chat is NOT in this repo.
Revoke it at: https://github.com/settings/tokens
