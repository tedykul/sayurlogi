#!/bin/bash
# ============================================================
# SayurLogi — Deploy ke VPS (manual deploy)
# ============================================================
# Jalankan script ini di VPS Anda untuk:
#   1. Pull kode terbaru dari GitHub
#   2. Install dependencies
#   3. Push schema DB (topBarLocation field baru)
#   4. Build + restart PM2
#
# CARA PAKAI:
#   1. SSH ke VPS Anda
#   2. cd /path/to/sayurlogi  (sesuaikan dengan path VPS Anda)
#   3. Salin script ini ke VPS
#   4. chmod +x deploy-vps.sh
#   5. ./deploy-vps.sh
#
# PRASYARAT:
#   - Git repo sudah di-clone di VPS
#   - PM2 sudah terinstall + process "sayurlogi" sudah ada
#   - .env sudah ada di VPS (jangan commit .env!)
# ============================================================

set -euo pipefail

echo "=========================================="
echo "  SayurLogi — VPS Deploy Script"
echo "=========================================="
echo ""

# Step 1: Pull dari GitHub
echo "[1/5] Pull kode terbaru dari GitHub..."
git pull origin main
echo "  ✓ Pull selesai"
echo ""

# Step 2: Install dependencies
echo "[2/5] Install dependencies..."
if command -v bun &> /dev/null; then
  bun install
  echo "  ✓ bun install selesai"
else
  npm install
  echo "  ✓ npm install selesai"
fi
echo ""

# Step 3: Push schema ke DB (topBarLocation field baru)
echo "[3/5] Push schema ke DB (topBarLocation field)..."
bun run db:push
echo "  ✓ Schema synced"
echo ""

# Step 4: Build (production mode)
echo "[4/5] Build production..."
if [ -f "package.json" ]; then
  # Cek jika ada script build
  if grep -q '"build"' package.json; then
    bun run build
    echo "  ✓ Build selesai"
  else
    echo "  ℹ No build script, skip"
  fi
fi
echo ""

# Step 5: Restart PM2
echo "[5/5] Restart PM2 process..."
PM2_PROCESS="${1:-sayurlogi}"
pm2 restart "$PM2_PROCESS"
echo "  ✓ PM2 '$PM2_PROCESS' restarted"
echo ""

echo "=========================================="
echo "  ✓ DEPLOY SELESAI!"
echo "=========================================="
echo ""
echo "Verifikasi:"
echo "  1. Buka https://domain-anda"
echo "  2. Cek top bar — harusnya show 'Antar seluruh kota'"
echo "  3. Login admin (Ctrl+Shift+A)"
echo "  4. Tab Header — harusnya ada 4 field (Lokasi, Shipping, Telepon, Tagline)"
echo "  5. Edit + Simpan → reload → perubahan muncul"
echo ""
echo "Log PM2:"
echo "  pm2 logs $PM2_PROCESS --lines 20"
