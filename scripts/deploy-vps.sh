#!/usr/bin/env bash
# ============================================================
# SayurLogi VPS deploy script (manual fallback)
# ============================================================
# Dipakai oleh:
#   1. GitHub Action (auto-deploy via SSH)
#   2. Manual run di VPS: bash scripts/deploy-vps.sh
#
# Yang dilakukan:
#   - Backup .env (5 backup terakhir)
#   - git fetch + reset --hard origin/main
#   - bun install (dengan frozen-lockfile kalau ada)
#   - bun run build (kecuali --skip-build)
#   - pm2 restart semua proses SayurLogi
#
# Usage:
#   bash scripts/deploy-vps.sh             # full deploy
#   bash scripts/deploy-vps.sh --skip-build  # skip build (hanya restart)
#   bash scripts/deploy-vps.sh --dry-run      # preview tanpa eksekusi
# ============================================================
set -euo pipefail

# Args parsing
SKIP_BUILD=false
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --dry-run) DRY_RUN=true ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

# Project path (auto-detect dari lokasi script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "🚀 SayurLogi deploy started at $(date '+%Y-%m-%d %H:%M:%S')"
echo "   Project: $PROJECT_DIR"
echo "   Skip build: $SKIP_BUILD"
echo "   Dry run: $DRY_RUN"
echo ""

if [ "$DRY_RUN" = "true" ]; then
  echo "(DRY RUN — tidak ada yang dieksekusi)"
  echo "  Akan jalankan:"
  echo "    git fetch origin main"
  echo "    git reset --hard origin/main"
  echo "    bun install"
  [ "$SKIP_BUILD" = "false" ] && echo "    bun run build"
  echo "    pm2 restart sayurlogi erpnext-sync backup-monitor"
  exit 0
fi

START_TIME=$(date +%s)

# Backup .env (safety net)
if [ -f .env ]; then
  BACKUP_FILE=".env.bak.$(date +%Y%m%d-%H%M%S)"
  cp .env "$BACKUP_FILE"
  # Auto-cleanup: simpan 5 backup terakhir
  ls -t .env.bak.* 2>/dev/null | tail -n +6 | xargs -r rm 2>/dev/null || true
  echo "✓ .env backup → $BACKUP_FILE"
else
  echo "⚠️  .env tidak ditemukan — lanjut tanpa backup"
fi

# [1/4] Git pull
echo ""
echo "📦 [1/4] Git fetch + reset..."
git fetch origin main
BEFORE=$(git log -1 --pretty=format:'%h' 2>/dev/null || echo "unknown")
git reset --hard origin/main
AFTER=$(git log -1 --pretty=format:'%h' 2>/dev/null || echo "unknown")
if [ "$BEFORE" = "$AFTER" ]; then
  echo "   ✓ Already at latest: $AFTER"
else
  echo "   ✓ Updated: $BEFORE → $AFTER"
  echo "   Latest commit: $(git log -1 --pretty=format:'%s')"
fi

# [2/4] Install dependencies
echo ""
echo "📚 [2/4] Install dependencies..."
if [ -f bun.lockb ]; then
  bun install --frozen-lockfile 2>/dev/null || {
    echo "   ⚠️  --frozen-lockfile gagal, fallback ke bun install biasa..."
    bun install
  }
else
  bun install
fi
echo "   ✓ Dependencies installed"

# [3/4] Build
if [ "$SKIP_BUILD" = "false" ]; then
  echo ""
  echo "🔨 [3/4] Build production (may take 1-2 min)..."
  bun run build
  echo "   ✓ Build complete"
else
  echo ""
  echo "⏭️  [3/4] Build skipped (--skip-build)"
fi

# [4/4] Restart PM2
echo ""
echo "🔄 [4/4] Restart PM2 processes..."

pm2 restart sayurlogi --update-env 2>/dev/null && echo "   ✓ sayurlogi restarted" || {
  echo "   ⚠️  sayurlogi restart failed — trying reload..."
  pm2 reload sayurlogi 2>/dev/null && echo "   ✓ sayurlogi reloaded" || echo "   ❌ sayurlogi: failed to restart"
}

pm2 restart erpnext-sync --update-env 2>/dev/null && echo "   ✓ erpnext-sync restarted" || echo "   - erpnext-sync: skipped (not found)"
pm2 restart backup-monitor --update-env 2>/dev/null && echo "   ✓ backup-monitor restarted" || echo "   - backup-monitor: skipped (not found)"

# Audit trail
echo "$(date '+%Y-%m-%d %H:%M:%S') | $(git log -1 --pretty=format:'%h') | $(git log -1 --pretty=format:'%s' | head -c 60)" >> ~/deploy.log

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "============================================"
echo "✅ Deploy complete! Duration: ${DURATION}s"
echo "   $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""
echo "Cek status:"
echo "  pm2 status"
echo "  pm2 logs sayurlogi --lines 20"
echo ""
echo "Cek di browser (Tailscale): http://100.110.249.2:3000"
