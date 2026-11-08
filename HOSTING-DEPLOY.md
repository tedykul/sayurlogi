# Deploy ke Vercel / Railway / Render / Cloudflare Tunnel

Panduan cepat deploy SayurLogi ke platform hosting populer. Setelah repo di GitHub, deploy tinggal beberapa klik.

> **🔥 Rekomendasi**: Kalau VPS kamu sudah jalan tapi tidak punya domain publik (cuma IP), pakai **Cloudflare Tunnel** (gratis, 10 menit setup). Lihat [CLOUDFLARE-TUNNEL-SETUP.md](./CLOUDFLARE-TUNNEL-SETUP.md) untuk panduan lengkap.

---

## 🚀 Vercel (RECOMMENDED untuk Next.js)

Vercel adalah pembuat Next.js — paling mulus untuk deploy. Free tier: 100GB bandwidth/bulan, auto SSL, global CDN.

### Step 1: Connect repo
1. Buka https://vercel.com/new
2. Login dengan GitHub
3. Klik **"Import Project"** → pilih repo `tedykul/sayurlogi`
4. Framework preset: **Next.js** (auto-detect dari `next.config.ts`)
5. Vercel akan otomatis baca `vercel.json` + `package.json`

### Step 2: Set environment variables
Di halaman "Configure Project", scroll ke "Environment Variables". Tambahkan semua dari `.env.example`:

| Variable | Value | Notes |
|---|---|---|
| `DATABASE_URL` | `file:/tmp/sayurlogi.db` atau pakai Vercel Postgres | SQLite tidak persisten di serverless — pakai external DB untuk production |
| `NEXTAUTH_SECRET` | generate di https://generate-secret.vercel.app/ | Wajib, 32 char random |
| `NEXTAUTH_URL` | `https://sayurlogi.vercel.app` | Domain Vercel kamu (update setelah deploy pertama) |
| `ADMIN_PASSWORD` | (kosongkan) | Pakai email+password via User table |
| `GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` | Dari Google Cloud Console |
| `ERPNEXT_URL` | `http://100.110.249.2:8001` (atau domain publik ERPNext) | Tidak harus, kalau pakai mock mode |
| `ERPNEXT_API_KEY` | `b836c3800d2a734` | Bisa skip kalau tidak pakai ERPNext |
| `ERPNEXT_API_SECRET` | (isi) | |
| `MIDTRANS_SERVER_KEY` | `Mid-server-xxxxx` | Untuk payment gateway |
| `MIDTRANS_CLIENT_KEY` | `Mid-client-xxxxx` | |
| `SMTP_HOST` | `smtp.gmail.com` | Kalau pakai Gmail SMTP |
| `SMTP_PORT` | `587` | |
| `SMTP_USER` | `you@gmail.com` | |
| `SMTP_PASS` | (16-char App Password) | Generate di myaccount.google.com/apppasswords |
| `SMTP_FROM_EMAIL` | `noreply@sayurlogi.com` | |
| `SMTP_FROM_NAME` | `SayurLogi` | |

### Step 3: Deploy
Klik **"Deploy"**. Build akan jalan 2-3 menit. Setelah sukses, Vercel kasih URL `https://sayurlogi.vercel.app`.

### Step 4: Update Google Console + Midtrans
Setelah punya domain Vercel:
1. **Google Cloud Console** → Credentials → OAuth Client ID → tambah origin:
   ```
   https://sayurlogi.vercel.app
   ```
2. **Midtrans Dashboard** → Settings → Configuration:
   - Payment Notification URL: `https://sayurlogi.vercel.app/api/payments/midtrans/webhook`
   - Finish Redirect URL: `https://sayurlogi.vercel.app/checkout/success`
   - Error Redirect URL: `https://sayurlogi.vercel.app/checkout/error`
3. Update `NEXTAUTH_URL` di Vercel env vars → save → auto-redeploy

### ⚠️ SQLite limitation di Vercel
SQLite tidak persistent di serverless (filesystem ephemeral). Untuk production:
- **Option A**: Pakai Vercel Postgres (free 60h/bulan, $0.18/GB after) — perlu sedikit refaktor Prisma schema (`provider = "postgresql"`)
- **Option B**: Pakai external Postgres (Neon, Supabase, Railway Postgres)
- **Option C**: Pakai Turso (libSQL — distributed SQLite, free tier 9GB)

Untuk quick deploy tanpa refaktor, pakai VPS (PM2 + SQLite) — sesuai `DEPLOYMENT.md`.

### Auto-deploy
Setelah connect, setiap `git push origin main` akan auto-trigger deploy. Branch preview otomatis untuk PR.

---

## 🚂 Railway

Railway cocok kalau butuh backend long-running (tidak serverless). Support SQLite persistent. Free trial $5 credit, kemudian $5/bulan untuk hobby.

### Step 1: Connect repo
1. Buka https://railway.app → "New Project" → "Deploy from GitHub repo"
2. Pilih `tedykul/sayurlogi`
3. Railway auto-detect Next.js + baca `railway.json`

### Step 2: Tambah PostgreSQL database (recommended)
1. Di project, klik **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway auto-provision + kasih `DATABASE_URL`
3. Update `DATABASE_URL` di service env vars pakai connection string Railway Postgres

### Step 3: Set env vars
Sama seperti Vercel (lihat tabel di atas). Railway UI lebih friendly untuk env management.

### Step 4: Setup custom domain (optional)
1. Settings → Networking → "Generate Domain"
2. Dapat URL `sayurlogi.up.railway.app`
3. Atau connect custom domain (bayar ~$10/tahun untuk domain + DNS)

### Step 5: Run Prisma migration
Railway auto-run `bun run db:push` saat build (sesuai `railway.json`). Kalau perlu manual:
```bash
railway run bun run db:push
```

### Auto-deploy
Setiap `git push origin main` → auto-redeploy. Railway juga support preview environments per-PR.

---

## 🌐 Render

Alternatif lain, support persistent disk untuk SQLite. Free tier: 750 jam/bulan (sleep setelah 15 menit idle).

### Step 1: Create service
1. https://render.com → "New+" → "Web Service"
2. Connect GitHub repo `tedykul/sayurlogi`
3. Build command: `bun install && bun run build`
4. Start command: `bun run start`

### Step 2: Tambah persistent disk (untuk SQLite)
1. Service settings → "Disks" → "Add Disk"
2. Mount path: `/opt/data`
3. Size: 1GB (free)
4. Update `DATABASE_URL` env: `file:/opt/data/sayurlogi.db`

### Step 3: Set env vars
Sama seperti Vercel/Railway (lihat tabel di atas).

### Step 4: Custom domain
Free URL: `sayurlogi.onrender.com`. Custom domain butuh paid plan ($7/bulan).

---

## 📋 Comparison Matrix

| Provider | Free Tier | SQLite Support | Auto-Deploy | Custom Domain | SSL | Best For |
|---|---|---|---|---|---|---|
| **Cloudflare Tunnel** ⭐ | **Gratis selamanya** | ✅ Native | Manual | ✅ Free subdomain `.cfargotunnel.com` | ✅ Auto | VPS yang sudah running, butuh domain publik gratis |
| **Vercel** | 100GB BW, 100h build | ❌ Ephemeral | ✅ | ✅ Free | ✅ Auto | Next.js production, PR preview |
| **Railway** | $5 credit trial | ✅ Persistent | ✅ | ✅ $5/mo | ✅ Auto | Full-stack + DB |
| **Render** | 750h, sleeps | ✅ With disk | ✅ | ✅ $7/mo | ✅ Auto | Simple hosting |
| **VPS (PM2)** | ~$5/mo VPS | ✅ Native | Manual | ✅ Free domain | ✅ Caddy auto | Full control, no limit |

---

## 🎯 Rekomendasi

| Scenario | Pakai |
|---|---|
| **VPS sudah jalan, butuh domain publik** ⭐ | **Cloudflare Tunnel** (gratis, 10 menit — lihat [CLOUDFLARE-TUNNEL-SETUP.md](./CLOUDFLARE-TUNNEL-SETUP.md)) |
| **Demo / staging / preview** | Vercel (free, cepat, PR preview) |
| **Production small traffic** | Railway (Postgres included, $5/mo) |
| **Production medium traffic** | VPS (PM2 + SQLite/Postgres) — sesuai DEPLOYMENT.md |
| **Production high traffic** | Vercel + Neon Postgres + Redis cache |

---

## 🔧 Quick deploy check

Setelah deploy, test endpoint utama:

```bash
# Health check
curl https://sayurlogi.vercel.app/api/products | jq length
# Expected: number > 0

# Auth check
curl https://sayurlogi.vercel.app/api/auth/session
# Expected: {} (empty session for guest)

# Admin content (public)
curl https://sayurlogi.vercel.app/api/admin/content | jq .success
# Expected: true
```

Kalau semua 200 OK → deploy sukses! 🎉
