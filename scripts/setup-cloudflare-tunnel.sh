#!/usr/bin/env bash
# ============================================================
# SayurLogi — Cloudflare Tunnel Setup Script
# ============================================================
# Mengkonfigurasi Cloudflare Tunnel untuk VPS SayurLogi.
#
# Hasil: VPS accessible via https://<subdomain>.cfargotunnel.com
# - Gratis selamanya
# - HTTPS otomatis
# - Bypass CGNAT/NAT/firewall
# - Tidak perlu buka port di router
# - Google OAuth bisa dipakai (origin = domain publik)
#
# Prerequisites:
#   - Cloudflare account (gratis, daftar di cloudflare.com)
#   - SSH access ke VPS sebagai user dengan sudo
#   - VPS SayurLogi sudah running di port 3000
#
# Usage:
#   bash scripts/setup-cloudflare-tunnel.sh
#
# Interaktif: akan minta input subdomain + konfirmasi.
# ============================================================
set -euo pipefail

# Colors untuk output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; }
step() { echo -e "\n${BLUE}===${NC} $1"; }

# ============================================================
# Pre-flight checks
# ============================================================
step "Pre-flight checks"

# Cek OS
if [[ ! -f /etc/os-release ]]; then
  error "Tidak bisa detect OS. Script ini support Debian/Ubuntu/Fedora."
  exit 1
fi
. /etc/os-release
info "OS: $PRETTY_NAME"

# Cek sudo access
if ! sudo -v 2>/dev/null; then
  error "Script butuh sudo access. Jalankan sebagai user dengan sudo."
  exit 1
fi
info "Sudo access OK"

# Cek cloudflared sudah terinstall
if command -v cloudflared &>/dev/null; then
  CURRENT_VERSION=$(cloudflared --version 2>&1 | grep -oE ' [0-9.]+' || echo "unknown")
  warn "cloudflared sudah terinstall (version $CURRENT_VERSION)"
  read -p "Reinstall/upgrade? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    info "Skip install. Lanjut ke konfigurasi."
    SKIP_INSTALL=1
  else
    SKIP_INSTALL=0
  fi
else
  SKIP_INSTALL=0
fi

# Cek port 3000 (aplikasi SayurLogi)
step "Cek aplikasi SayurLogi"

if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -qE "^(200|302)$"; then
  info "SayurLogi running di port 3000 (HTTP 200/302 OK)"
else
  warn "SayurLogi tidak merespons di http://localhost:3000"
  warn "Pastikan PM2 running: pm2 status (harus ada 'sayurlogi' online)"
  read -p "Lanjut setup tunnel walau app belum jalan? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Setup dibatalkan. Jalankan PM2 dulu: pm2 start sayurlogi"
    exit 1
  fi
fi

# ============================================================
# Install cloudflared
# ============================================================
if [[ $SKIP_INSTALL -eq 0 ]]; then
  step "Install cloudflared"

  ARCH=$(uname -m)
  case $ARCH in
    x86_64)  ARCH_DEB="amd64"; ARCH_PKG="x86_64" ;;
    aarch64) ARCH_DEB="arm64";  ARCH_PKG="arm64"  ;;
    armv7l)  ARCH_DEB="arm";    ARCH_PKG="arm"    ;;
    *)
      error "Architecture tidak didukung: $ARCH"
      exit 1
      ;;
  esac

  if [[ "$ID" == "debian" || "$ID" == "ubuntu" || "$ID_LIKE" == *"debian"* ]]; then
    info "Install via .deb package (arch: $ARCH_DEB)..."
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH_DEB}.deb" -o /tmp/cloudflared.deb
    sudo dpkg -i /tmp/cloudflared.deb
    rm /tmp/cloudflared.deb
  elif [[ "$ID" == "fedora" || "$ID" == "centos" || "$ID" == "rhel" ]]; then
    info "Install via .rpm package (arch: $ARCH_DEB)..."
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${ARCH_DEB}.rpm" -o /tmp/cloudflared.rpm
    sudo rpm -i /tmp/cloudflared.rpm
    rm /tmp/cloudflared.rpm
  else
    error "OS tidak didukung auto-install. Install manual: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
    exit 1
  fi

  info "cloudflared terinstall: $(cloudflared --version 2>&1 | head -1)"
fi

# ============================================================
# Login ke Cloudflare
# ============================================================
step "Login ke Cloudflare"

if [[ -f ~/.cloudflared/cert.pem ]]; then
  info "Sudah login ke Cloudflare (cert.pem ada). Skip login."
else
  echo
  echo "Browser akan terbuka. Login ke Cloudflare, pilih domain (atau"
  echo "buat domain gratis: cloudflare.com > Sign up > Add a site >"
  echo "pakai domain yang sudah kamu punya, atau beli domain baru di"
  echo "Cloudflare Registrar ~$10/tahun)."
  echo
  echo "Kalau tidak punya domain, cloudflared tetap bisa jalan pakai"
  echo "subdomain default *.cfargotunnel.com (gratis)."
  echo
  read -p "Tekan Enter untuk buka browser login Cloudflare..."

  cloudflared tunnel login

  if [[ ! -f ~/.cloudflared/cert.pem ]]; then
    error "Login gagal. cert.pem tidak ditemukan."
    error "Coba ulang: cloudflared tunnel login"
    exit 1
  fi
  info "Login sukses. cert.pem tersimpan."
fi

# ============================================================
# Buat tunnel
# ============================================================
step "Buat tunnel"

DEFAULT_TUNNEL_NAME="sayurlogi"
read -p "Nama tunnel (default: $DEFAULT_TUNNEL_NAME): " TUNNEL_NAME
TUNNEL_NAME=${TUNNEL_NAME:-$DEFAULT_TUNNEL_NAME}

# Cek tunnel existing
EXISTING_TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | grep "^$TUNNEL_NAME " | awk '{print $2}' || echo "")

if [[ -n "$EXISTING_TUNNEL_ID" ]]; then
  info "Tunnel '$TUNNEL_NAME' sudah ada (id: $EXISTING_TUNNEL_ID)"
  TUNNEL_ID="$EXISTING_TUNNEL_ID"
else
  info "Buat tunnel baru: $TUNNEL_NAME"
  CREATE_OUTPUT=$(cloudflared tunnel create "$TUNNEL_NAME")
  # Output: "Created tunnel sayurlogi with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  TUNNEL_ID=$(echo "$CREATE_OUTPUT" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}')

  if [[ -z "$TUNNEL_ID" ]]; then
    error "Gagal buat tunnel. Output: $CREATE_OUTPUT"
    exit 1
  fi
  info "Tunnel created. ID: $TUNNEL_ID"
fi

# ============================================================
# Pilih subdomain
# ============================================================
step "Pilih subdomain"

DEFAULT_SUBDOMAIN="$TUNNEL_NAME"
read -p "Subdomain (default: $DEFAULT_SUBDOMAIN, hasil: $DEFAULT_SUBDOMAIN.cfargotunnel.com): " SUBDOMAIN
SUBDOMAIN=${SUBDOMAIN:-$DEFAULT_SUBDOMAIN}
TUNNEL_HOSTNAME="${SUBDOMAIN}.cfargotunnel.com"

info "URL tunnel akan: https://$TUNNEL_HOSTNAME"

# ============================================================
# Setup DNS route
# ============================================================
step "Setup DNS route"

# Cek apakah DNS sudah ada (idempotent)
EXISTING_DNS=$(cloudflared tunnel route dns "$TUNNEL_NAME" "$TUNNEL_HOSTNAME" 2>&1 || true)
if echo "$EXISTING_DNS" | grep -q "already exists\|Record already exists"; then
  info "DNS record untuk $TUNNEL_HOSTNAME sudah ada."
elif echo "$EXISTING_DNS" | grep -qi "error"; then
  warn "DNS route mungkin gagal: $EXISTING_DNS"
  warn "Coba manual: cloudflared tunnel route dns $TUNNEL_NAME $TUNNEL_HOSTNAME"
else
  info "DNS record created: $TUNNEL_HOSTNAME → tunnel:$TUNNEL_NAME"
fi

# ============================================================
# Create config file
# ============================================================
step "Buat config file"

mkdir -p ~/.cloudflared
CONFIG_FILE=~/.cloudflared/config.yml

cat > "$CONFIG_FILE" <<EOF
# Cloudflare Tunnel config — auto-generated by setup-cloudflare-tunnel.sh
# Last updated: $(date '+%Y-%m-%d %H:%M:%S')

tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json

# Routing rules: hostname → backend service
ingress:
  # SayurLogi storefront → Next.js app (port 3000)
  - hostname: $TUNNEL_HOSTNAME
    service: http://localhost:3000
  # Catch-all: return 404 for unknown hosts
  - service: http_status:404
EOF

info "Config file: $CONFIG_FILE"

# ============================================================
# Test tunnel (optional, before install systemd)
# ============================================================
step "Test tunnel (5 detik)"

info "Jalankan tunnel di foreground untuk test..."
echo
echo "Buka https://$TUNNEL_HOSTNAME di browser saat tunnel running."
echo "Tekan Ctrl+C untuk stop test, lalu lanjut install sebagai service."
echo

# Run in background, capture PID
cloudflared tunnel run "$TUNNEL_NAME" &
TUNNEL_PID=$!

# Wait 5 seconds for tunnel to establish
sleep 5

# Test if tunnel is up (curl via Cloudflare)
if curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$TUNNEL_HOSTNAME" | grep -qE "^(200|302|301)$"; then
  info "✅ Tunnel WORKING! https://$TUNNEL_HOSTNAME returns HTTP 200/302"
  TUNNEL_WORKS=1
else
  warn "Tunnel belum siap atau app belum return 200. Cek log:"
  warn "  curl -v https://$TUNNEL_HOSTNAME"
  TUNNEL_WORKS=0
fi

# Stop test tunnel
kill $TUNNEL_PID 2>/dev/null || true
wait $TUNNEL_PID 2>/dev/null || true

if [[ $TUNNEL_WORKS -eq 0 ]]; then
  read -p "Lanjut install sebagai systemd service? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    error "Setup dibatalkan. Tunnel bisa dijalankan manual: cloudflared tunnel run $TUNNEL_NAME"
    exit 1
  fi
fi

# ============================================================
# Install sebagai systemd service (auto-start on boot)
# ============================================================
step "Install systemd service"

sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

sleep 3
if sudo systemctl is-active --quiet cloudflared; then
  info "✅ cloudflared service running (auto-start on boot enabled)"
else
  error "cloudflared service tidak running. Cek log:"
  error "  sudo systemctl status cloudflared"
  error "  sudo journalctl -u cloudflared -n 50"
  exit 1
fi

# ============================================================
# Summary + next steps
# ============================================================
step "SELESAI! 🎉"

echo
echo -e "${GREEN}Cloudflare Tunnel aktif!${NC}"
echo
echo "   Public URL: ${BLUE}https://$TUNNEL_HOSTNAME${NC}"
echo "   Local app:  http://localhost:3000"
echo "   Tunnel ID:  $TUNNEL_ID"
echo "   Service:    cloudflared (systemd, auto-start on boot)"
echo
echo "${BLUE}=== LANGKAH SELANJUTNYA ===${NC}"
echo
echo "1. Update Google Cloud Console (untuk Google Sign-In):"
echo "   https://console.cloud.google.com/apis/credentials"
echo "   → OAuth Client ID → Edit → Authorized JavaScript origins"
echo "   → Tambah: https://$TUNNEL_HOSTNAME"
echo "   → Save"
echo
echo "2. Update NEXTAUTH_URL di .env VPS:"
echo "   nano ~/sayurlogi/.env"
echo "   → Ganti: NEXTAUTH_URL=https://$TUNNEL_HOSTNAME"
echo "   → Save, lalu: pm2 restart sayurlogi --update-env"
echo
echo "3. Update Midtrans dashboard (untuk webhook):"
echo "   https://dashboard.midtrans.com → Settings → Configuration"
echo "   → Payment Notification URL: https://$TUNNEL_HOSTNAME/api/payments/midtrans/webhook"
echo "   → Finish Redirect URL: https://$TUNNEL_HOSTNAME/checkout/success"
echo "   → Error Redirect URL: https://$TUNNEL_HOSTNAME/checkout/error"
echo
echo "4. Test semua di browser:"
echo "   - Buka https://$TUNNEL_HOSTNAME"
echo "   - Klik 'Masuk akun' → tombol Google harus jalan"
echo "   - Register customer baru → checkout → Midtrans → sukses"
echo
echo "${BLUE}=== COMMANDS PEMELIHARAAN ===${NC}"
echo
echo "  # Cek status tunnel"
echo "  sudo systemctl status cloudflared"
echo
echo "  # Lihat log (realtime)"
echo "  sudo journalctl -u cloudflared -f"
echo
echo "  # Restart tunnel (kalau ada masalah)"
echo "  sudo systemctl restart cloudflared"
echo
echo "  # Stop tunnel"
echo "  sudo systemctl stop cloudflared"
echo
echo "  # Uninstall (kalau mau hapus)"
echo "  sudo cloudflared service uninstall"
echo
echo "  # Cek tunnel config"
echo "  cat ~/.cloudflared/config.yml"
echo
echo "  # List tunnels di account"
echo "  cloudflared tunnel list"
echo
echo "${GREEN}Selamat! SayurLogi sekarang production-live via Cloudflare Tunnel 🚀${NC}"
