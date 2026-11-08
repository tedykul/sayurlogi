# Cloudflare Tunnel Setup — Panduan Lengkap

Panduan setup Cloudflare Tunnel untuk SayurLogi VPS. Hasil akhir: VPS accessible via `https://sayurlogi.cfargotunnel.com` (gratis, HTTPS otomatis, bypass firewall).

**Total waktu setup**: ~10 menit

---

## 🎯 Kenapa Cloudflare Tunnel?

Masalah yang dipecahkan:

| Masalah | Solusi Cloudflare Tunnel |
|---|---|
| VPS hanya punya IP address → Google OAuth reject (Error 400) | Dapat domain publik `.cfargotunnel.com` |
| Tailscale IP (`100.110.249.2`) tidak reachable dari internet | Tunnel expose VPS ke internet via Cloudflare edge |
| Setup SSL manual rumit (Let's Encrypt, certbot, renew) | HTTPS otomatis + auto-renew |
| CGNAT / NAT / firewall block inbound | Tunnel pakai outbound connection (port 7844) |
| Hosting berbayar (Vercel, Railway) | **Gratis selamanya** untuk tunnel + 1 subdomain |
| ISP block port 80/443 | Tidak perlu buka port inbound |

---

## 📋 Prerequisites

- ✅ VPS SayurLogi running (PM2 jalan, port 3000 listening)
- ✅ SSH access ke VPS (`ssh tedykul@tedykulserver`)
- ✅ Cloudflare account gratis (daftar di https://cloudflare.com → "Sign up")
- ⚠️ Tidak perlu punya domain! Default pakai `*.cfargotunnel.com` (gratis)

---

## 🚀 Quick Setup (Opsi A: Pakai installer script)

Script `scripts/setup-cloudflare-tunnel.sh` otomatisasi semua langkah.

### Step 1: SSH ke VPS

```bash
ssh tedykul@tedykulserver
cd ~/sayurlogi
git pull origin main
```

### Step 2: Jalankan installer

```bash
bash scripts/setup-cloudflare-tunnel.sh
```

Script akan:
1. Cek OS + sudo access
2. Install `cloudflared` (auto-detect Debian/Ubuntu/Fedora/CentOS + arch x86_64/arm64/arm)
3. Cek aplikasi SayurLogi di port 3000
4. Buka browser untuk login Cloudflare (kalau belum login)
5. Buat tunnel (default name: `sayurlogi`)
6. Setup DNS route (`<subdomain>.cfargotunnel.com`)
7. Generate config file (`~/.cloudflared/config.yml`)
8. **Test tunnel** 5 detik (verify https:// response 200/302)
9. Install systemd service (auto-start on boot)
10. Print summary + URL tunnel + next steps

### Step 3: Update Google Cloud Console + NEXTAUTH_URL

Ikuti output script (next steps section):
- Tambah origin `https://sayurlogi.cfargotunnel.com` di Google OAuth Client
- Update `NEXTAUTH_URL` di `.env` VPS
- Restart PM2: `pm2 restart sayurlogi --update-env`

Selesai! 🎉

---

## 🛠️ Manual Setup (Opsi B: Step-by-step)

Kalau prefer setup manual tanpa script, ikuti langkah berikut:

### Step 1: Install cloudflared

```bash
ssh tedykul@tedykulserver

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
  x86_64)  DEB_ARCH="amd64" ;;
  aarch64) DEB_ARCH="arm64" ;;
  armv7l)  DEB_ARCH="arm" ;;
esac

# Download + install
curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-${DEB_ARCH}.deb" -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb
rm /tmp/cloudflared.deb

# Verify
cloudflared --version
```

### Step 2: Login ke Cloudflare

```bash
cloudflared tunnel login
```

Browser akan terbuka di VPS (atau copy URL ke laptop). Login dengan akun Cloudflare kamu. Pilih domain (atau bikin subdomain default). Setelah sukses, `cert.pem` tersimpan di `~/.cloudflared/`.

### Step 3: Buat tunnel

```bash
cloudflared tunnel create sayurlogi
```

Output:
```
Created tunnel sayurlogi with id xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Tunnel ID disimpan di `~/.cloudflared/<TUNNEL_ID>.json` (credentials).

### Step 4: Setup DNS route

```bash
# Pilih subdomain (default: sayurlogi → sayurlogi.cfargotunnel.com)
SUBDOMAIN="sayurlogi"
HOSTNAME="${SUBDOMAIN}.cfargotunnel.com"

cloudflared tunnel route dns sayurlogi $HOSTNAME
```

### Step 5: Buat config file

```bash
TUNNEL_ID=$(cloudflared tunnel list | grep "^sayurlogi " | awk '{print $2}')
cat > ~/.cloudflared/config.yml <<EOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $HOSTNAME
    service: http://localhost:3000
  - service: http_status:404
EOF
```

### Step 6: Test tunnel (foreground)

```bash
# Jalankan di foreground untuk lihat log
cloudflared tunnel run sayurlogi
```

Buka `https://sayurlogi.cfargotunnel.com` di browser. Kalau berhasil return 200/302, tunnel jalan. Tekan `Ctrl+C` untuk stop.

### Step 7: Install systemd service (auto-start on boot)

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Verify
sudo systemctl status cloudflared
# Expected: active (running)
```

### Step 8: Update settings (Google + NEXTAUTH_URL + Midtrans)

Lihat step "After Setup" di bawah.

---

## 🎯 After Setup: Update Settings

Setelah tunnel jalan dengan URL `https://sayurlogi.cfargotunnel.com`, update 3 hal:

### 1. Google Cloud Console (untuk Google Sign-In)

1. Buka https://console.cloud.google.com/apis/credentials
2. Klik OAuth Client ID (`189857750169-...`)
3. Scroll ke **"Authorized JavaScript origins"** → klik **"+ ADD URI"**
4. Tambah:
   ```
   https://sayurlogi.cfargotunnel.com
   ```
5. Save → tunggu 5-10 menit supaya propagate

### 2. NEXTAUTH_URL di .env VPS

```bash
ssh tedykul@tedykulserver
cd ~/sayurlogi
cp .env .env.bak.$(date +%Y%m%d-%H%M%S)  # backup
nano .env
```

Edit baris `NEXTAUTH_URL`:
```env
# Ganti dari:
# NEXTAUTH_URL=http://100.110.249.2:3000
# Ke:
NEXTAUTH_URL=https://sayurlogi.cfargotunnel.com
```

Save, lalu restart PM2 dengan reload env:
```bash
pm2 restart sayurlogi --update-env
```

Verify:
```bash
pm2 env sayurlogi | grep NEXTAUTH_URL
# Expected: NEXTAUTH_URL=https://sayurlogi.cfargotunnel.com
```

### 3. Midtrans Dashboard (untuk webhook payment)

1. Buka https://dashboard.midtrans.com → Settings → Configuration
2. Update:
   - **Payment Notification URL**: `https://sayurlogi.cfargotunnel.com/api/payments/midtrans/webhook`
   - **Finish Redirect URL**: `https://sayurlogi.cfargotunnel.com/checkout/success`
   - **Error Redirect URL**: `https://sayurlogi.cfargotunnel.com/checkout/error`
3. Save

---

## 🧪 Verify Setup

### Test 1: Tunnel accessible

```bash
curl -sI https://sayurlogi.cfargotunnel.com | head -1
# Expected: HTTP/2 200 (atau 302/301)
```

### Test 2: Google Sign-In jalan

1. Buka `https://sayurlogi.cfargotunnel.com` di browser
2. Klik **"Masuk akun"** di kanan-atas
3. Klik tombol Google (putih pill dengan logo G)
4. Popup Google muncul → pilih akun
5. **Harus sukses login** (tidak ada Error 400 lagi!)

Kalau masih error, cek:
- Authorized JavaScript origins di Google Cloud Console sudah benar (HTTPS, tanpa trailing slash)
- Tunggu 10 menit (Google cache origin change)
- Hard refresh browser (Ctrl+Shift+R)

### Test 3: Midtrans webhook

```bash
# Bikin test order via API (POST /api/checkout)
# Lalu cek Midtrans dashboard → notification tab → apakah webhook terkirim?
```

### Test 4: systemd auto-start

```bash
# Restart VPS (test auto-start)
sudo reboot

# Setelah VPS up, cek cloudflared auto-start
ssh tedykul@tedykulserver
sudo systemctl is-active cloudflared
# Expected: active
```

---

## 🔧 Maintenance Commands

```bash
# Cek status
sudo systemctl status cloudflared

# Lihat log (realtime)
sudo journalctl -u cloudflared -f

# Restart tunnel (kalau ada masalah)
sudo systemctl restart cloudflared

# Stop tunnel (kalau mau maintenance)
sudo systemctl stop cloudflared

# Start tunnel
sudo systemctl start cloudflared

# Disable auto-start on boot
sudo systemctl disable cloudflared

# Uninstall service (kalau mau hapus)
sudo cloudflared service uninstall

# Cek config
cat ~/.cloudflared/config.yml

# List semua tunnel di account
cloudflared tunnel list

# Delete tunnel (kalau mau recreate)
cloudflared tunnel delete sayurlogi
```

---

## 🚨 Troubleshooting

### Masalah 1: `cloudflared tunnel login` gagal / browser tidak terbuka

**Symptom**: Command `cloudflared tunnel login` hangs, browser tidak terbuka di VPS.

**Fix**: Copy URL yang muncul ke browser di laptop kamu:
```bash
$ cloudflared tunnel login
# Output akan muncul URL seperti:
# https://dash.cloudflare.com/argotunnel?...
# Copy URL ini, buka di browser laptop
```

Setelah login sukses di browser, download `cert.pem` dan copy ke VPS:
```bash
# Di laptop
scp cert.pem tedykul@tedykulserver:~/.cloudflared/cert.pem
```

### Masalah 2: Tunnel service tidak start

**Symptom**: `sudo systemctl start cloudflared` gagal, status inactive.

**Fix**:
```bash
# Lihat error detail
sudo journalctl -u cloudflared -n 50 --no-pager

# Cek config file ada + valid
ls -la ~/.cloudflared/config.yml
cat ~/.cloudflared/config.yml

# Cek credentials file ada
ls -la ~/.cloudflared/*.json

# Coba run manual untuk lihat error
cloudflared tunnel run sayurlogi
```

### Masalah 3: DNS tidak resolve

**Symptom**: `https://sayurlogi.cfargotunnel.com` return 404 atau tidak resolve.

**Fix**:
```bash
# Cek DNS record di Cloudflare
cloudflared tunnel route ip show sayurlogi

# Re-create DNS route
cloudflared tunnel route dns sayurlogi sayurlogi.cfargotunnel.com

# Cek di public DNS
dig sayurlogi.cfargotunnel.com
# Expected: CNAME pointing to <tunnel_id>.cfargotunnel.com
```

### Masalah 4: Google OAuth masih error 400

**Symptom**: Setelah setup tunnel, login Google tetap error `redirect_uri_mismatch` / `invalid_request`.

**Fix**:
1. **Cek URL address bar browser** saat buka app. Harus persis `https://sayurlogi.cfargotunnel.com` (tidak ada trailing slash, port, atau path).
2. **Cek Google Cloud Console** → Authorized JavaScript origins → harus contain URL itu persis.
3. **Tunggu 5-10 menit** — Google cache origin changes.
4. **Hard refresh browser** (Ctrl+Shift+R / Cmd+Shift+R) atau buka Incognito.

### Masalah 5: `cloudflared` update major version

**Symptom**: Tunnel stop working setelah system upgrade atau cloudflared update.

**Fix**:
```bash
# Cek version
cloudflared --version

# Download + install versi terbaru
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb
sudo dpkg -i /tmp/cloudflared.deb
rm /tmp/cloudflared.deb

# Restart service
sudo systemctl restart cloudflared
```

### Masalah 6: Bandwidth / latency tinggi

**Symptom**: Loading lambat, terutama dari Indonesia.

**Fix**: Cloudflare Tunnel gratis pakai edge network Cloudflare global. Untuk Indonesia, region terdekat adalah **Singapore (SIN)**. Cek region yang dipakai:
```bash
# Lihat log untuk region info
sudo journalctl -u cloudflared -n 100 | grep -i region
```

Kalau region bukan SIN, hubungi Cloudflare support atau upgrade ke Cloudflare Tunnel Enterprise (bisa pilih region spesifik).

---

## 📊 Cost Comparison

| Provider | Cost | Bandwidth | Limitations |
|---|---|---|---|
| **Cloudflare Tunnel** | **GRATIS** | **Unlimited** | 1000 tunnels/account, 1 subdomain default |
| Ngrok free | Gratis | 1 GB/bulan | URL berubah tiap restart, banner "Visit site" |
| Ngrok paid | $8/bulan | Unlimited | Static URL |
| Vercel | Gratis 100 GB/bulan | 100 GB | SQLite tidak persistent |
| Railway | $5/bulan | Unlimited | Postgres included |
| VPS + custom domain + Caddy | $5 VPS + $10 domain/tahun | Unlimited | Setup SSL manual |

**Kesimpulan**: Cloudflare Tunnel adalah paling murah (gratis) + paling mudah (auto-SSL + auto-renew) + paling reliable (Cloudflare edge).

---

## 🔒 Security Notes

### Apakah traffic di-encrypt?

**Ya**, end-to-end HTTPS:
- Client browser ↔ Cloudflare edge: HTTPS (TLS 1.3)
- Cloudflare edge ↔ VPS (cloudflared): mTLS (encrypted tunnel)
- VPS ↔ Next.js app (localhost:3000): HTTP (tidak perlu HTTPS karena dalam satu mesin)

### Apakah Cloudflare bisa lihat traffic?

**Tidak untuk HTTPS** (kalau Full mode aktif). Cloudflare cuma lihat SNI + IP, tidak bisa baca body request/response.

Untuk content filtering (WAF, bot management), enable "Cloudflare Access" (tambahan layer auth sebelum tunnel).

### Apakah IP VPS bocor?

**Tidak**. Yang tampil ke publik adalah Cloudflare edge IP, bukan IP VPS kamu. VPS tetap private (hanya Cloudflare Tunnel yang bisa reach).

### Apakah bisa revoke tunnel?

**Ya**:
```bash
# Stop tunnel
sudo systemctl stop cloudflared

# Delete tunnel
cloudflared tunnel delete sayurlogi

# Revoke cert
rm ~/.cloudflared/cert.pem
```

Setelah delete, public URL langsung tidak accessible.

---

## 📚 Resource Tambahan

- [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [cloudflared GitHub](https://github.com/cloudflare/cloudflared)
- [Cloudflare pricing](https://www.cloudflare.com/plans/) — Zero Trust Free includes 50 users
- [Community forum](https://community.cloudflare.com/c/zero-trust)

---

## 🎉 Selamat!

Setelah setup selesai, kamu punya:
- ✅ **Production HTTPS URL** (`https://sayurlogi.cfargotunnel.com`)
- ✅ **Google Sign-In jalan** (origin terdaftar)
- ✅ **Midtrans webhook bisa terima notifikasi** dari server Midtrans
- ✅ **Auto SSL** (Cloudflare manage, auto-renew)
- ✅ **Auto-start on boot** (systemd service)
- ✅ **Gratis selamanya**

Selamat deploy! 🚀
