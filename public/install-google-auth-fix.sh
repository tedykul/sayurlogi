#!/usr/bin/env bash
# SayurLogi — Google Auth loading fix installer
# Fixes:
#   1. CSP (next.config.ts): allow accounts.google.com script + iframe
#   2. GoogleSignInButton: watchdog polling + better loading/error UI
#
# MD5: 0b16def81e336160e20a514db6b87c91
set -euo pipefail

cd ~/sayurlogi 2>/dev/null || { echo "ERR: ~/sayurlogi tidak ditemukan"; exit 1; }

echo "==> Pull latest changes..."
git fetch origin main
git pull origin main --ff-only

echo "==> Install dependencies (jika perlu)..."
bun install --frozen-lockfile 2>/dev/null || bun install

echo "==> Build production..."
bun run build

echo "==> Restart PM2..."
pm2 restart sayurlogi

echo ""
echo "✅ Selesai. Verifikasi:"
echo "   - curl -sI http://100.110.249.2:3000/ | grep -i content-security"
echo "     Pastikan ada 'accounts.google.com' dan 'frame-src ... accounts.google.com'"
echo ""
echo "   - Buka storefront di browser → klik 'Masuk akun'"
echo "     Tombol Google harus tampil dalam 2-3 detik"
echo ""
echo "   - Jika masih loading >10s, cek:"
echo "     * Authorized JavaScript origins di Google Cloud Console"
echo "       (tambah http://100.110.249.2:3000)"
echo "     * Hard refresh browser (Ctrl+Shift+R) untuk clear cache"
