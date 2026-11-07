# CI/CD Setup Guide — Auto-Deploy ke VPS via GitHub Actions

Panduan ini menjelaskan cara setup auto-deploy ke VPS tiap `git push` ke `main`.

Total waktu setup: **~15 menit**.

---

## 📋 Prerequisites

- ✅ Repo sudah di GitHub (sudah: https://github.com/tedykul/sayurlogi)
- ✅ VPS aktif & bisa di-SSH (`ssh tedykul@tedykulserver`)
- ✅ PM2 menjalankan `sayurlogi` di VPS
- ✅ Workflow file sudah ada di repo: `.github/workflows/deploy-vps.yml`

---

## 🔑 Step 1: Generate SSH Key Pair untuk GitHub Actions

SSH key pair dibutuhkan supaya GitHub Actions bisa SSH ke VPS tanpa password.

### 1.1 Generate di laptop/komputer kamu

```bash
# Generate ED25519 key (recommended, lebih aman + cepat dari RSA)
ssh-keygen -t ed25519 -C "github-actions@sayurlogi" -f ~/.ssh/sayurlogi-ga-key -N ""

# Hasilnya 2 file:
#   ~/.ssh/sayurlogi-ga-key       (PRIVATE — untuk GitHub Secrets)
#   ~/.ssh/sayurlogi-ga-key.pub   (PUBLIC — untuk VPS authorized_keys)
```

⚠️ **PENTING**: Jangan kasih passphrase (pakai `-N ""`) — kalau pakai passphrase, GitHub Action tidak bisa dekrip tanpa interaksi.

### 1.2 Lihat private key (akan di-paste ke GitHub Secrets)

```bash
cat ~/.ssh/sayurlogi-ga-key
```

Outputnya kira-kira begini (copy SEMUA termasuk header/footer):

```
-----BEGIN OPENSSH PRIVATE KEY-----
v3ewq2Nlc3Nlci1lZDI1NTE5QGd......
...baris-baris base64...
-----END OPENSSH PRIVATE KEY-----
```

---

## 🖥️ Step 2: Tambahkan Public Key ke VPS

### 2.1 Copy public key ke VPS

```bash
# Dari laptop, copy ke VPS:
ssh-copy-id -i ~/.ssh/sayurlogi-ga-key.pub tedykul@tedykulserver

# Atau manual:
cat ~/.ssh/sayurlogi-ga-key.pub | ssh tedykul@tedykulserver "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

### 2.2 Verifikasi SSH key bekerja (dari laptop)

```bash
# Test login pakai key baru (harus TIDAK diminta password)
ssh -i ~/.ssh/sayurlogi-ga-key tedykul@tedykulserver "echo '✓ SSH key works!' && whoami && pwd"
```

Output expected:
```
✓ SSH key works!
tedykul
/home/tedykul
```

Kalau masih diminta password, cek:
- Permission `~/.ssh` di VPS harus `700`
- Permission `~/.ssh/authorized_keys` di VPS harus `600`
- Public key di VPS harus match private key di laptop

---

## 🔐 Step 3: Tambahkan Secrets di GitHub

### 3.1 Buka halaman Secrets

1. Login ke https://github.com
2. Buka repo: https://github.com/tedykul/sayurlogi
3. Klik tab **Settings** → **Secrets and variables** → **Actions**
4. Klik tombol hijau **"New repository secret"**

### 3.2 Tambahkan secrets berikut (6 secrets)

#### Secret 1: `VPS_HOST`

| Field | Value |
|---|---|
| Name | `VPS_HOST` |
| Secret | `100.110.249.2` (IP VPS kamu di Tailscale) |

Atau kalau punya domain publik, pakai domain: `sayurlogi.example.com`

#### Secret 2: `VPS_USER`

| Field | Value |
|---|---|
| Name | `VPS_USER` |
| Secret | `tedykul` |

#### Secret 3: `VPS_SSH_KEY` ⚠️ PALING PENTING

| Field | Value |
|---|---|
| Name | `VPS_SSH_KEY` |
| Secret | (paste SEMUA isi file `~/.ssh/sayurlogi-ga-key`, termasuk `-----BEGIN...` dan `-----END...`) |

Format yang benar:
```
-----BEGIN OPENSSH PRIVATE KEY-----
...isi base64...
-----END OPENSSH PRIVATE KEY-----
```

#### Secret 4: `VPS_PORT` (optional)

| Field | Value |
|---|---|
| Name | `VPS_PORT` |
| Secret | `22` (default SSH port. Kalau VPS pakai port lain, isi di sini) |

#### Secret 5: `VPS_PROJECT_PATH` (optional)

| Field | Value |
|---|---|
| Name | `VPS_PROJECT_PATH` |
| Secret | `/home/tedykul/sayurlogi` (default kalau tidak diset) |

#### Secret 6: `VPS_PUBLIC_URL` (optional, untuk health check)

| Field | Value |
|---|---|
| Name | `VPS_PUBLIC_URL` |
| Secret | `http://100.110.249.2:3000` |

Jika diset, GitHub Action akan curl URL ini setelah deploy untuk verifikasi server up. Kalau tidak diset, health check di-skip.

---

## 🧪 Step 4: Test Workflow

### 4.1 Trigger manual (recommended untuk test pertama)

1. Buka https://github.com/tedykul/sayurlogi/actions
2. Klik workflow **"Deploy to VPS"** di sidebar kiri
3. Klik tombol **"Run workflow"** di kanan atas
4. Pilih branch `main`, biarkan `skip_build` unchecked
5. Klik **"Run workflow"** (tombol hijau)

### 4.2 Monitor eksekusi

- Klik run yang baru muncul
- Buka job **"🚀 Deploy to VPS"**
- Lihat log real-time tiap step

### 4.3 Expected output sukses

```
🚀 Deploy started at 2026-11-07 20:35:12
   Commit: 041ed77 merge: sync sandbox state...
   ✓ .env backup saved

📦 [1/4] Git fetch + reset...
   ✓ Code updated to 041ed77

📚 [2/4] Install dependencies...
   ✓ Dependencies installed

🔨 [3/4] Build production (may take 1-2 min)...
   ✓ Build complete

🔄 [4/4] Restart PM2 processes...
   ✓ sayurlogi restarted
   ✓ erpnext-sync restarted
   ✓ backup-monitor restarted

============================================
✅ Deploy complete! Duration: 87s
   2026-11-07 20:36:39
============================================
```

### 4.4 Health check

Setelah deploy, step "🏥 Health check" akan curl `VPS_PUBLIC_URL`. Kalau HTTP 200/302 → ✅ sukses. Kalau gagal 5x → workflow fail.

---

## 🎯 Step 5: Test Auto-Deploy

Sekarang setiap push ke `main` akan trigger deploy otomatis. Test:

```bash
# Di sandbox (atau laptop, kalau sudah setup git)
cd /path/to/sayurlogi
echo "<!-- test auto-deploy $(date) -->" >> README.md
git add README.md
git commit -m "test: trigger auto-deploy"
git push origin main
```

Buka https://github.com/tedykul/sayurlogi/actions — akan muncul workflow run baru otomatis.

---

## 📊 Status Badge untuk README

Workflow sudah include status badge. Tambahkan ke README.md (sudah saya tambahkan):

```markdown
![Deploy](https://github.com/tedykul/sayurlogi/actions/workflows/deploy-vps.yml/badge.svg)
```

Tampil sebagai: ![Deploy](https://github.com/tedykul/sayurlogi/actions/workflows/deploy-vps.yml/badge.svg)

- 🟢 Hijau = deploy terakhir sukses
- 🔴 Merah = deploy terakhir gagal
- 🟡 Kuning = sedang berjalan

---

## 🛠️ Troubleshooting

### Error: "Permission denied (publickey)"

**Penyebab**: Private key di GitHub Secret tidak match public key di VPS.

**Fix**:
```bash
# Verifikasi SSH dari laptop pakai key yang sama
ssh -i ~/.ssh/sayurlogi-ga-key tedykul@tedykulserver
# Kalau sukses tanpa password, berarti key-nya benar
# Kalau gagal, regenerate + ulangi Step 1 & 2
```

### Error: "Host key verification failed"

**Penyebab**: VPS host key belum di-trust oleh GitHub Action runner.

**Fix**: Tambahkan `key_path: ~/.ssh/known_hosts` dan set `proxy_command` di workflow, atau tambah `allenvs: true`. Alternatif: pakai `StrictHostKeyChecking=no` (kurang aman, tidak recommended untuk production).

Untuk kasus yang sama sekali baru, GitHub Action runner pakai container segar — `appleboy/ssh-action` sudah handle ini otomatis dengan fingerprint verification. Kalau masih gagal, cek apakah `VPS_HOST` benar (IP vs hostname).

### Error: "bun: command not found" di VPS

**Penyebab**: `bun` tidak terinstall di VPS atau tidak di PATH.

**Fix**:
```bash
ssh tedykul@tedykulserver
which bun || echo "bun not installed"
# Install kalau belum:
curl -fsSL https://bun.sh/install | bash
# Restart shell atau:
source ~/.bashrc
```

### Error: "pm2: command not found"

**Penyebab**: PM2 tidak di PATH user non-login shell (GitHub Action pakai non-login).

**Fix**: Edit workflow, ganti `pm2` jadi full path:
```bash
# Cari path pm2:
ssh tedykul@tedykulserver "which pm2"
# Biasanya: ~/.nvm/versions/node/v20.x.x/bin/pm2 atau /usr/local/bin/pm2

# Atau tambah PATH di awal script:
export PATH="$HOME/.bun/bin:$HOME/.nvm/versions/node/$(ls ~/.nvm/versions/node | tail -1)/bin:$PATH"
pm2 restart sayurlogi
```

### Deploy sukses tapi health check fail

**Kemungkinan**:
1. App start lambat (>5 detik) → tambah `sleep 15` di step health check
2. App crash setelah restart → cek `pm2 logs sayurlogi --lines 50`
3. URL salah → pastikan `VPS_PUBLIC_URL` benar (termasuk port kalau non-80)

### Workflow tidak trigger otomatis

**Kemungkinan**:
1. Push ke branch selain `main` → workflow hanya trigger di `main`
2. Commit message ada `[skip ci]` → hapus dari message
3. Workflow file ada syntax error → cek tab Actions, harus ada green check

---

## 🔒 Security Notes

### Apakah private key aman di GitHub Secrets?

**Ya, sangat aman.** GitHub Secrets:
- Di-encrypt at rest (AES-128)
- Tidak pernah tampil di logs (auto-masked)
- Tidak bisa di-read setelah diset (hanya bisa di-update)
- Hanya accessible oleh repo owner + collaborators yang diberi akses

### Kapan harus rotate SSH key?

Rotate kalau:
- Laptop kamu hilang/curi
- Ada orang keluar dari tim
- Ragu ada yang akses tanpa izin
- Best practice: setiap 6-12 bulan

### Cara revoke key:

```bash
# Di VPS: hapus baris yang sesuai dari authorized_keys
ssh tedykul@tedykulserver
nano ~/.ssh/authorized_keys  # hapus baris yang dimaksud

# Atau regenerate semua (kalau ragu):
# Hapus authorized_keys, lalu ulangi Step 1 & 2 dengan key baru
```

---

## 📚 Resource Tambahan

- [GitHub Actions docs](https://docs.github.com/en/actions)
- [appleboy/ssh-action (SSH action)](https://github.com/appleboy/ssh-action)
- [Encrypted secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Workflow syntax reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)

---

## 🎉 Setelah setup selesai

Setelah semua secrets diset + test workflow sukses, flow kerja kamu jadi:

1. **Edit code** di sandbox / laptop
2. **`git push origin main`**
3. **GitHub Action auto-deploy** (1-2 menit)
4. **PM2 restart otomatis** di VPS
5. **Health check** verify app up
6. **Get notified** kalau ada masalah

**Tidak perlu lagi**: SCP file, SSH manual, atau lupa deploy. Cukup `git push` dan sisanya otomatis. 🚀
