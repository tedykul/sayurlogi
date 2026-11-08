# NEXTAUTH_URL — Panduan Setup di VPS

Panduan lengkap cara konfigurasi `NEXTAUTH_URL` di file `.env` VPS SayurLogi.

> **🔥 Quick win**: Kalau VPS kamu cuma punya IP address (tidak punya domain), Google OAuth akan menolak (Error 400). Solusi tercepat: setup **Cloudflare Tunnel** (gratis, 10 menit) — lihat [CLOUDFLARE-TUNNEL-SETUP.md](./CLOUDFLARE-TUNNEL-SETUP.md). Setelah jalan, VPS akan dapat URL publik `https://sayurlogi.cfargotunnel.com` yang bisa dipakai sebagai `NEXTAUTH_URL`.

---

## 📖 Apa itu NEXTAUTH_URL?

`NEXTAUTH_URL` adalah environment variable yang dipakai NextAuth.js v4 untuk:

1. **Menentukan base URL aplikasi** — dipakai untuk generate callback URLs OAuth (Google, GitHub, dll)
2. **Verifikasi origin CSRF** — cegah serangan CSRF dari domain lain
3. **Redirect setelah login/logout** — tahu kemana harus kirim user setelah auth
4. **Generate session cookie** — cookie domain + path berdasarkan URL ini

### Kenapa penting?

Kalau `NEXTAUTH_URL` **salah** atau **kosong**, yang terjadi:
- ❌ Google OAuth redirect gagal (Error 400: redirect_uri_mismatch)
- ❌ Customer login session tidak tersimpan
- ❌ CSRF token mismatch terus-menerus
- ❌ Admin login redirect ke URL aneh

Kalau `NEXTAUTH_URL` **benar**:
- ✅ OAuth providers (Google/Midtrans) tahu kemana harus redirect
- ✅ Session cookie domain benar, login persisten
- ✅ CSRF protection bekerja optimal

---

## 🎯 Cara Cek URL VPS Kamu

Sebelum set `NEXTAUTH_URL`, ketahui dulu URL mana yang customer/user pakai untuk akses aplikasi.

### Test 1: Cek URL yang muncul di address bar

Buka aplikasi di browser. Lihat address bar:

| Yang terlihat di address bar | NEXTAUTH_URL yang benar |
|---|---|
| `http://100.110.249.2:3000` | `http://100.110.249.2:3000` |
| `http://localhost:3000` | `http://localhost:3000` |
| `https://sayurlogi.cfargotunnel.com` | `https://sayurlogi.cfargotunnel.com` |
| `https://sayurlogi.com` | `https://sayurlogi.com` |
| `http://sayurlogi.local:3000` | `http://sayurlogi.local:3000` |

**Aturan emas**: `NEXTAUTH_URL` = URL yang user lihat di address bar browser.

### Test 2: Cek dari dalam VPS

```bash
ssh tedykul@tedykulserver

# Cek IP publik VPS (kalau expose ke internet)
curl -s ifconfig.me
# Output: 103.xxx.xxx.xxx (IP publik)

# Cek IP lokal Tailscale
ip addr show tailscale0 | grep "inet " | awk '{print $2}' | cut -d/ -f1
# Output: 100.110.249.2 (IP Tailscale)

# Test aplikasi berjalan
curl -sI http://localhost:3000 | head -1
# Output: HTTP/1.1 200 OK
```

---

## ⚙️ Setup NEXTAUTH_URL di .env VPS

### Step 1: SSH ke VPS

```bash
ssh tedykul@tedykulserver
cd ~/sayurlogi
```

### Step 2: Backup .env dulu (safety net)

```bash
cp .env .env.bak.$(date +%Y%m%d-%H%M%S)
```

### Step 3: Edit .env

```bash
nano .env
# atau
vim .env
```

Cari baris `NEXTAUTH_URL=`. Kalau belum ada, tambahkan.

### Step 4: Set URL yang benar

Pilih salah satu skenario di bawah sesuai setup VPS kamu:

---

## 📋 Skenario NEXTAUTH_URL

### Skenario 1: Akses via Tailscale IP (LANJAANG, tanpa domain)

**Kalau user akses via `http://100.110.249.2:3000`:**

```env
# .env di VPS
NEXTAUTH_URL=http://100.110.249.2:3000
```

**Cocok kalau**:
- VPS + client semua di Tailscale
- Tidak butuh akses dari internet publik
- Hanya untuk internal/dev

**⚠️ Batasan**:
- Google OAuth tidak akan jalan (Google policy tolak IP address sebagai origin)
- Midtrans payment notification dari server eksternal tidak bisa reach VPS
- Hanya device yang terhubung Tailscale yang bisa akses

---

### Skenario 2: Cloudflare Tunnel (RECOMMENDED — gratis, stabil)

**Kalau pakai Cloudflare Tunnel** → VPS expose via `https://sayurlogi.cfargotunnel.com`:

```env
# .env di VPS
NEXTAUTH_URL=https://sayurlogi.cfargotunnel.com
```

**Setup Cloudflare Tunnel** (sekali, ~5 menit):

```bash
ssh tedykul@tedykulserver

# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb

# Login ke Cloudflare (buka link yang muncul)
cloudflared tunnel login

# Buat tunnel
cloudflared tunnel create sayurlogi

# Setup config
mkdir -p ~/.cloudflared
TUNNEL_ID=$(cloudflared tunnel list | grep sayurlogi | awk '{print $1}')
cat > ~/.cloudflared/config.yml <<EOF
tunnel: ${TUNNEL_ID}
credentials-file: /home/tedykul/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: sayurlogi.cfargotunnel.com
    service: http://localhost:3000
  - service: http_status:404
EOF

# Setup DNS otomatis
cloudflared tunnel route dns sayurlogi sayurlogi.cfargotunnel.com

# Install sebagai systemd service (auto-start on boot)
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Test
curl -sI https://sayurlogi.cfargotunnel.com | head -1
# Output: HTTP/2 200
```

**Kelebihan**:
- ✅ HTTPS otomatis (Google terima)
- ✅ Gratis selamanya
- ✅ URL tidak berubah
- ✅ Bypass CGNAT/firewall
- ✅ Tidak perlu buka port di router
- ✅ Google OAuth akan jalan (origin = `https://sayurlogi.cfargotunnel.com`)

---

### Skenario 3: Ngrok (untuk testing cepat)

**Kalau pakai ngrok** → URL `https://abc123.ngrok-free.app`:

```env
# .env di VPS
NEXTAUTH_URL=https://abc123.ngrok-free.app
```

**Setup ngrok** (~2 menit):

```bash
ssh tedykul@tedykulserver

# Install ngrok
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok-v3-stable-linux-amd64.tgz | tar xz -C /tmp
sudo mv /tmp/ngrok /usr/local/bin/

# Daftar di https://dashboard.ngrok.com/signup (gratis)
# Copy authtoken dari https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken YOUR_NGROK_TOKEN

# Jalankan ngrok (di background, pakai tmux/screen)
tmux new-session -d -s ngrok 'ngrok http 3000 --log=stdout'

# Cek URL ngrok
sleep 3
curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'])"
# Output: https://abc123.ngrok-free.app

# Update NEXTAUTH_URL di .env
sed -i 's|NEXTAUTH_URL=.*|NEXTAUTH_URL=https://abc123.ngrok-free.app|' .env

# Restart PM2
pm2 restart sayurlogi
```

**⚠️ Catatan ngrok free**:
- URL berubah tiap restart ngrok → harus update `NEXTAUTH_URL` + Google origin
- Limit 40 connections/minute
- Ada banner "Visit site" yang mengganggu UI
- Tidak cocok untuk produksi, cuma untuk testing

---

### Skenario 4: Domain Publik (profesional, produksi)

**Kalau beli domain** (mis. `sayurlogi.com`):

```env
# .env di VPS
NEXTAUTH_URL=https://sayurlogi.com
```

**Setup domain + SSL**:

```bash
ssh tedykul@tedykulserver

# 1. Setup DNS A record di registrar domain (di luar VPS)
#    A    sayurlogi.com    103.xxx.xxx.xxx    (IP publik VPS)

# 2. Install Caddy (auto-SSL Let's Encrypt)
sudo apt install caddy

# 3. Configure Caddy sebagai reverse proxy
echo "sayurlogi.com {
  reverse_proxy localhost:3000
}" | sudo tee /etc/caddy/Caddyfile

# 4. Restart Caddy
sudo systemctl restart caddy

# 5. Test (setelah DNS propagate, 5-30 menit)
curl -sI https://sayurlogi.com | head -1
# Output: HTTP/2 200
```

**Update .env**:
```env
NEXTAUTH_URL=https://sayurlogi.com
```

**Restart PM2**:
```bash
pm2 restart sayurlogi
```

---

### Skenario 5: Multi-environment (dev + prod)

Kalau kamu punya beberapa environment, set `NEXTAUTH_URL` per environment:

```env
# .env untuk development (laptop lokal)
NEXTAUTH_URL=http://localhost:3000

# .env untuk staging (VPS testing)
NEXTAUTH_URL=https://staging.sayurlogi.com

# .env untuk production (VPS live)
NEXTAUTH_URL=https://sayurlogi.com
```

**Jangan pernah** set `NEXTAUTH_URL=http://localhost:3000` di VPS production — itu akan menyebabkan OAuth redirect ke localhost (yang dari device user bukan VPS).

---

## 🔄 Setelah Update NEXTAUTH_URL

### Step 1: Restart PM2

**WAJIB** setelah edit `.env`:

```bash
pm2 restart sayurlogi --update-env
```

Parameter `--update-env` penting supaya PM2 reload environment variables baru. Tanpa ini, PM2 masih pakai env lama.

### Step 2: Update Google Cloud Console (kalau pakai Google OAuth)

Buka https://console.cloud.google.com/apis/credentials → edit Client ID → tambah origin URL baru di "Authorized JavaScript origins":

```
https://sayurlogi.cfargotunnel.com   (atau domain kamu)
```

Save → tunggu 5-10 menit → propagate.

### Step 3: Update Midtrans Dashboard (kalau pakai Midtrans)

Buka https://dashboard.midtrans.com → Settings → Configuration:

- **Payment Notification URL**: `https://sayurlogi.cfargotunnel.com/api/payments/midtrans/webhook`
- **Finish Redirect URL**: `https://sayurlogi.cfargotunnel.com/checkout/success`
- **Error Redirect URL**: `https://sayurlogi.cfargotunnel.com/checkout/error`

### Step 4: Verify

```bash
# Test dari VPS
curl -sI https://sayurlogi.cfargotunnel.com/api/auth/session
# Output: HTTP/2 200

# Test dari luar (laptop)
curl -sI https://sayurlogi.cfargotunnel.com
# Output: HTTP/2 200

# Test Google OAuth
# Buka browser → https://sayurlogi.cfargotunnel.com → klik "Masuk akun" → klik Google
# Harus sukses login
```

---

## 🧪 Verifikasi NEXTAUTH_URL Benar

### Test 1: Cek env di runtime

```bash
ssh tedykul@tedykulserver
cd ~/sayurlogi

# Cek via Node
node -e "console.log(process.env.NEXTAUTH_URL)"
# Output: https://sayurlogi.cfargotunnel.com (atau URL kamu)

# Atau cek via API endpoint
curl -s http://localhost:3000/api/auth/providers | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('google', {}).get('signinUrl', 'NOT SET'))"
# Output: http://localhost:3000/api/auth/signin/google (kalau NEXTAUTH_URL=http://localhost:3000)
```

### Test 2: Cek PM2 env

```bash
pm2 env sayurlogi 2>&1 | grep NEXTAUTH
# Output: NEXTAUTH_URL=https://sayurlogi.cfargotunnel.com
```

Kalau masih muncul URL lama, jalankan:
```bash
pm2 restart sayurlogi --update-env
```

### Test 3: Test Google OAuth flow

1. Buka `https://sayurlogi.cfargotunnel.com` di browser
2. Klik "Masuk akun"
3. Klik tombol Google
4. Pilih akun Google
5. **Harus**: redirect balik ke `https://sayurlogi.cfargotunnel.com` dengan session aktif

Kalau masih error `redirect_uri_mismatch`:
- Cek Google Cloud Console → Authorized redirect URIs (harus include `https://sayurlogi.cfargotunnel.com/api/auth/callback/google`)
- Tapi SayurLogi pakai GIS (JavaScript callback), bukan redirect URI — jadi bagian ini biarkan kosong

---

## 🚨 Troubleshooting

### Masalah 1: "Error 400: redirect_uri_mismatch" saat Google OAuth

**Penyebab**: `NEXTAUTH_URL` di .env tidak match dengan origin yang terdaftar di Google Cloud Console.

**Fix**:
1. Cek `NEXTAUTH_URL` di .env VPS:
   ```bash
   grep NEXTAUTH_URL ~/sayurlogi/.env
   ```
2. Pastikan sama persis dengan origin di Google Cloud Console → Authorized JavaScript origins
3. Restart PM2: `pm2 restart sayurlogi --update-env`

### Masalah 2: Session login customer hilang setelah refresh

**Penyebab**: `NEXTAUTH_URL` berubah → cookie domain tidak match → session tidak terbaca.

**Fix**:
- Pastikan `NEXTAUTH_URL` konsisten (jangan ganti-ganti)
- Kalau harus ganti, customer perlu login ulang (cookie domain lama invalid)

### Masalah 3: PM2 masih pakai env lama setelah edit .env

**Penyebab**: PM2 cache env, perlu flag `--update-env` untuk reload.

**Fix**:
```bash
pm2 restart sayurlogi --update-env

# Atau force delete + restart (kalau masih belum update)
pm2 delete sayurlogi
pm2 start ecosystem.config.js  # atau cara start yang kamu pakai
```

### Masalah 4: "NEXTAUTH_URL environment variable must be set" error

**Penyebab**: File `.env` tidak terbaca, atau PM2 start tanpa load .env.

**Fix**:
```bash
# Pastikan .env ada di root project
ls -la ~/sayurlogi/.env

# Cek isi
cat ~/sayurlogi/.env | grep NEXTAUTH

# Pastikan PM2 start dari folder project
pm2 delete sayurlogi
cd ~/sayurlogi
pm2 start "bun run start" --name sayurlogi
```

### Masalah 5: HTTPS mixed content warning

**Penyebab**: `NEXTAUTH_URL` pakai HTTPS, tapi ada asset (gambar/script) dari HTTP.

**Fix**:
- Pastikan semua asset pakai relative path atau HTTPS
- Cek CSP header: `upgrade-insecure-requests` otomatis upgrade HTTP→HTTPS

---

## 📋 Checklist Setup NEXTAUTH_URL

- [ ] Cek URL yang user pakai untuk akses (address bar browser)
- [ ] Edit `.env` di VPS: `NEXTAUTH_URL=<URL yang benar>`
- [ ] Restart PM2: `pm2 restart sayurlogi --update-env`
- [ ] Verify via `pm2 env sayurlogi | grep NEXTAUTH`
- [ ] Update Google Cloud Console → Authorized JavaScript origins (tambah URL baru)
- [ ] Update Midtrans dashboard (kalau pakai Midtrans) → Notification URL + Redirect URLs
- [ ] Test Google Sign-In flow di browser (kalau pakai Google Auth)
- [ ] Test customer login + session persist
- [ ] Test webhook Midtrans (kalau pakai Midtrans)

---

## 📊 Contoh File .env VPS (Reference)

Berikut contoh `.env` lengkap untuk VPS dengan Cloudflare Tunnel:

```env
# ============================================================
# SayurLogi VPS Environment — Production
# ============================================================
# Last updated: 2026-11-07
# Setup: Cloudflare Tunnel (https://sayurlogi.cfargotunnel.com)
# ============================================================

# Database (SQLite — path harus ABSOLUTE)
DATABASE_URL=file:/home/tedykul/sayurlogi/db/custom.db

# NextAuth.js
# Generate secret: openssl rand -base64 32
NEXTAUTH_SECRET=your-generated-secret-32-chars-here
NEXTAUTH_URL=https://sayurlogi.cfargotunnel.com

# Admin login (kosongkan untuk force email+password login via User table)
ADMIN_PASSWORD=

# Google OAuth (customer sign-in)
# Dari: Google Cloud Console → Credentials → OAuth Client ID
GOOGLE_CLIENT_ID=189857750169-iu47uht5a8ojm08lsrea9n94ph23gr95.apps.googleusercontent.com

# ERPNext integration (REST API)
ERPNEXT_URL=http://localhost:8001
ERPNEXT_API_KEY=b836c3800d2a734
ERPNEXT_API_SECRET=your-erpnext-secret-here

# Midtrans payment gateway
MIDTRANS_SERVER_KEY=Mid-server-xxxxxx
MIDTRANS_CLIENT_KEY=Mid-client-xxxxxx

# Optional: Google Maps for delivery
GOOGLE_MAPS_API_KEY=
```

---

## 🔒 Security Notes

### Jangan commit .env ke Git

File `.gitignore` sudah include `.env*` — pastikan tidak pernah di-force add:

```bash
# Cek apakah .env pernah ter-commit (harus kosong)
git log --all -- .env

# Kalau pernah ke-commit, hapus dari history (HATI-HATI, rewrite history!)
git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env' --prune-empty --tag-name-filter cat -- --all
```

### NEXTAUTH_SECRET vs NEXTAUTH_URL

| Variable | Apa | Generate dengan |
|---|---|---|
| `NEXTAUTH_SECRET` | Random string untuk sign session cookie | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL aplikasi | URL yang user akses |

**Jangan pernah** pakai `NEXTAUTH_SECRET` yang sama antara dev dan production. Generate secret baru untuk tiap environment.

### Rotate NEXTAUTH_SECRET

Kalau secret bocor, rotate:

1. Generate secret baru: `openssl rand -base64 32`
2. Update `.env` VPS
3. `pm2 restart sayurlogi --update-env`
4. **Semua session customer + admin akan invalid** — mereka perlu login ulang

---

## 📚 Reference

- [NextAuth.js v4 docs — NEXTAUTH_URL](https://next-auth.js.org/configuration/options#nextauth_url)
- [NextAuth.js v4 — environment variables](https://next-auth.js.org/configuration/options#environment-variables)
- [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [ngrok docs](https://ngrok.com/docs)
- [Let's Encrypt (auto-SSL via Caddy)](https://letsencrypt.org/)

---

## 🎯 Quick Reference — Setup NEXTAUTH_URL (1 menit)

```bash
# 1. SSH ke VPS
ssh tedykul@tedykulserver
cd ~/sayurlogi

# 2. Backup .env
cp .env .env.bak.$(date +%Y%m%d-%H%M%S)

# 3. Edit .env, update NEXTAUTH_URL
nano .env
# Ganti: NEXTAUTH_URL=https://sayurlogi.cfargotunnel.com

# 4. Restart PM2 dengan --update-env (PENTING!)
pm2 restart sayurlogi --update-env

# 5. Verify
pm2 env sayurlogi | grep NEXTAUTH_URL
# Output: NEXTAUTH_URL=https://sayurlogi.cfargotunnel.com

# 6. Update Google Cloud Console (kalau pakai Google OAuth)
# https://console.cloud.google.com/apis/credentials
# Tambah origin: https://sayurlogi.cfargotunnel.com

# 7. Test Google Sign-In di browser
# Buka https://sayurlogi.cfargotunnel.com → login → harus sukses
```

Selesai! 🚀
