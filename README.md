# SayurLogi 🥬

![Deploy](https://github.com/tedykul/sayurlogi/actions/workflows/deploy-vps.yml/badge.svg)
[![License: Private](https://img.shields.io/badge/license-private-red.svg)](#license)

Toko online sayur & buah segar — Next.js 16 + Prisma + SQLite.
Terintegrasi ERPNext untuk inventory + Midtrans untuk payment.

## CI/CD

Auto-deploy ke VPS tiap push ke `main` via GitHub Actions.

| Status | Last Deploy | Commit |
|---|---|---|
| ![Deploy](https://github.com/tedykul/sayurlogi/actions/workflows/deploy-vps.yml/badge.svg) | [Lihat history](https://github.com/tedykul/sayurlogi/actions) | `main` branch |

**Setup pertama kali?** Baca [SETUP-CICD.md](./SETUP-CICD.md) (~15 menit, sekali setup).

**Deploy manual di VPS:**
```bash
cd ~/sayurlogi
bash scripts/deploy-vps.sh           # full deploy
bash scripts/deploy-vps.sh --skip-build  # skip build, hanya restart PM2
bash scripts/deploy-vps.sh --dry-run     # preview tanpa eksekusi
```

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Database**: Prisma ORM + SQLite
- **Auth**: NextAuth.js v4 (admin) + custom session (customer)
- **UI**: Tailwind CSS 4 + shadcn/ui (New York)
- **State**: Zustand (client) + TanStack Query (server)
- **Payment**: Midtrans
- **ERP**: ERPNext (REST API sync)

## Quick Start

```bash
# 1. Install dependencies
bun install

# 2. Setup database
cp .env.example .env
# Edit .env: set DATABASE_URL to absolute path
bun run db:push

# 3. Run dev server
bun run dev
# Open http://localhost:3000
```

## Admin Access

- Tekan `Ctrl+Shift+A` di storefront, atau klik gear icon di footer
- Login dengan email + password (User table) atau password-gate (legacy)
- First-time setup: run `bun run scripts/seed-admin.ts`

## Production Deploy

Lihat [DEPLOYMENT.md](./DEPLOYMENT.md) untuk panduan lengkap VPS deploy.

### Hosting providers yang support

| Provider | Cara deploy |
|---|---|
| **Vercel** | Connect GitHub repo → auto-deploy on push |
| **Railway** | Connect GitHub → add env vars → deploy |
| **Render** | Connect GitHub → build command `bun run build` |
| **VPS (PM2)** | `git pull && bun install && bun run build && pm2 restart` |

## Environment Variables

Lihat [`.env.example`](./.env.example) untuk daftar lengkap.

Wajib:
- `DATABASE_URL` — SQLite file path
- `NEXTAUTH_SECRET` — random 32-char string
- `NEXTAUTH_URL` — public URL (untuk OAuth redirects)

Opsional (tergantung fitur):
- `ADMIN_PASSWORD` — legacy password gate (kosongkan di production)
- `GOOGLE_CLIENT_ID` — customer Google Sign-In
- `ERPNEXT_URL` + `ERPNEXT_API_KEY` + `ERPNEXT_API_SECRET` — inventory sync
- `MIDTRANS_SERVER_KEY` + `MIDTRANS_CLIENT_KEY` — payment gateway

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/                # API routes (REST)
│   ├── deploy/             # Source download for VPS transfer
│   ├── home-client.tsx     # Main storefront (client component)
│   └── page.tsx            # Server component (fetches initial data)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── grocery/            # Customer-facing components
│   └── admin/              # Admin dashboard sections
├── lib/                    # Shared utilities (db, auth, erpnext, etc.)
└── mini-services/          # Standalone services (erpnext-sync, backup-monitor)
```

## License

Private — All rights reserved.
