# 🚀 SayurLogi — Deployment Guide (Docker + Frappe Docker)

Panduan deploy production yang proper, aman, dan reproducible. Menggunakan Docker untuk storefront + Frappe Docker untuk ERPNext.

---

## 📐 Arsitektur Production

```
                    Internet (HTTPS)
                         │
                         ▼
              ┌─────────────────────┐
              │  Customer browser   │
              │  https://sayurlogi.id │
              └─────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│  VPS Production                                      │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Docker Network (sayurlogi-net)              │    │
│  │                                              │    │
│  │  ┌──────────────────┐  ┌──────────────────┐ │    │
│  │  │  caddy (443/80)   │  │  erpnext (8000)  │ │    │
│  │  │  SSL auto (Let's   │  │  Frappe + MariaDB│ │    │
│  │  │  Encrypt)          │  │  + Redis + Queue │ │    │
│  │  └────────┬──────────┘  └────────▲─────────┘ │    │
│  │           │                        │           │    │
│  │           ▼                        │           │    │
│  │  ┌──────────────────┐             │           │    │
│  │  │  storefront (3000)│─────────────┘           │    │
│  │  │  Next.js standalone│   ERPNext sync         │    │
│  │  │  + SQLite volume  │   (internal network)   │    │
│  │  └──────────────────┘                        │    │
│  │                                              │    │
│  │  ┌──────────────────┐                        │    │
│  │  │  backup-monitor   │                        │    │
│  │  │  (3011)           │                        │    │
│  │  └──────────────────┘                        │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### Komponen

| Container | Image | Port | Fungsi |
|---|---|---|---|
| **caddy** | caddy:2-alpine | 80, 443 | Reverse proxy + SSL otomatis |
| **storefront** | sayurlogi:latest | 3000 (internal) | Next.js app |
| **erpnext** | frappe/erpnext | 8000 (internal) | ERP backend |
| **backup-monitor** | sayurlogi-backup:latest | 3011 (internal) | Backup health check |

---

## 📋 Prerequisites

### 1. VPS

- Ubuntu 22.04+ / Debian 12+
- RAM minimal 4GB (recommended 8GB untuk ERPNext)
- Disk minimal 40GB
- Akses root/sudo

### 2. Domain

- Domain sudah dibeli (misal `sayurlogi.id`)
- DNS A record pointing ke VPS IP:
  ```
  @    A    YOUR_VPS_IP
  www  A    YOUR_VPS_IP
  ```

### 3. Tailscale (Opsional, untuk ERPNext admin)

- ERPNext tidak di-expose ke public
- Akses ERPNext admin via Tailscale only

---

## 🔧 Step 1: Install Docker + Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add user ke docker group
sudo usermod -aG docker $USER

# Logout + login lagi (supaya group change aktif)
exit
# Login kembali

# Verify
docker --version
docker compose version
```

---

## 🔧 Step 2: Setup Frappe Docker (ERPNext)

```bash
# Clone Frappe Docker
cd /opt
sudo git clone https://github.com/frappe/frappe_docker.git
cd frappe_docker

# Generate env file
sudo cp example.env .env

# Edit .env — sesuaikan:
# - SITE_NAME=sayurlogi
# - DB_ROOT_PASSWORD=<strong-password>
# - ADMIN_PASSWORD=<strong-password>
# - ERPNEXT_URL=https://erp.sayurlogi.id  (atau http://erpnext:8000 untuk internal)

# Start ERPNext
sudo docker compose \
  -f compose.yaml \
  -f overrides/compose.multi-bench.yaml \
  up -d

# Wait for initialization (2-3 minutes)
# Check status:
sudo docker compose ps

# Create site
sudo docker compose exec backend bench new-site sayurlogi \
  --admin-password <strong-password> \
  --db-root-password <strong-password>

# Install ERPNext apps
sudo docker compose exec backend bench --site sayurlogi install-app erpnext

# Setup API access
# Login ke ERPNext (via Tailscale: http://100.x.x.x:8000)
# User: Administrator
# Password: <admin-password>
# Settings → User → Administrator → API Access → Generate Keys
# Save API Key + API Secret
```

---

## 🔧 Step 3: Build Storefront Docker Image

### 3a. Buat Dockerfile

```bash
cd ~/sayurlogi

cat > Dockerfile << 'EOF'
# Stage 1: Build
FROM oven/bun:1 AS builder
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build Next.js
RUN bun run build

# Stage 2: Production
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy prisma + scripts
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/mini-services ./mini-services
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

# Start
CMD ["bun", "server.js"]
EOF
```

### 3b. Buat .dockerignore

```bash
cat > .dockerignore << 'EOF'
node_modules
.next
.git
.env
.env.*
*.db
db/backups/
upload/
tool-results/
skills/
tests/
dev.log
server.log
EOF
```

### 3c. Build image

```bash
# Build
docker build -t sayurlogi:latest .

# Test image (sebelum deploy)
docker run --rm -p 3001:3000 \
  -e DATABASE_URL="file:/app/db/custom.db" \
  -e NEXTAUTH_SECRET="test-secret" \
  -e ADMIN_PASSWORD="test123" \
  sayurlogi:latest

# Buka http://localhost:3001 — verify storefront jalan
# Ctrl+C untuk stop
```

---

## 🔧 Step 4: Setup Docker Compose

### 4a. Buat docker-compose.yml

```yaml
version: "3.8"

services:
  # Storefront (Next.js)
  storefront:
    image: sayurlogi:latest
    container_name: sayurlogi-storefront
    restart: unless-stopped
    env_file: .env.production
    volumes:
      - storefront-db:/app/db
      - storefront-logs:/app/logs
    networks:
      - sayurlogi-net
    depends_on:
      - erpnext
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ERPNext sync service (cron)
  erpnext-sync:
    image: sayurlogi:latest
    container_name: sayurlogi-erpnext-sync
    restart: unless-stopped
    env_file: .env.production
    command: ["bun", "run", "mini-services/erpnext-sync/index.ts"]
    volumes:
      - storefront-db:/app/db
    networks:
      - sayurlogi-net
    depends_on:
      - storefront

  # Backup monitor
  backup-monitor:
    image: sayurlogi:latest
    container_name: sayurlogi-backup-monitor
    restart: unless-stopped
    env_file: .env.production
    command: ["bun", "run", "mini-services/backup-monitor/index.ts"]
    volumes:
      - storefront-db:/app/db
    networks:
      - sayurlogi-net

  # Caddy (reverse proxy + SSL)
  caddy:
    image: caddy:2-alpine
    container_name: sayurlogi-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile.prod:/etc/caddy/Caddyfile
      - caddy-data:/data
      - caddy-config:/config
    networks:
      - sayurlogi-net
    depends_on:
      - storefront

volumes:
  storefront-db:
  storefront-logs:
  caddy-data:
  caddy-config:

networks:
  sayurlogi-net:
    driver: bridge
```

### 4b. Buat Caddyfile untuk production

```bash
cat > Caddyfile.prod << 'EOF'
# Production Caddyfile — SSL otomatis via Let's Encrypt

sayurlogi.id, www.sayurlogi.id {
    # Reverse proxy ke storefront
    reverse_proxy storefront:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Security headers
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        Cross-Origin-Opener-Policy "same-origin"
    }

    # Compress responses
    encode gzip zstd

    # Cache static files
    @static path /static/* /_next/static/* /favicon.ico /robots.txt /manifest.json
    header @static Cache-Control "public, max-age=31536000, immutable"
}

# ERPNext — hanya via Tailscale (tidak public)
# Akses: http://100.x.x.x:8000 (Tailscale IP)
# TIDAK ditambahkan di Caddy untuk keamanan
EOF
```

### 4c. Buat .env.production

```bash
cat > .env.production << 'EOF'
# ============================================================
# Production Environment — SayurLogi
# ============================================================
# Generate secrets: openssl rand -base64 32 (untuk secret)
#                  openssl rand -hex 32 (untuk encryption key)
# JANGAN pakai value dari dev/testing!

# Database (SQLite, stored in Docker volume)
DATABASE_URL=file:/app/db/custom.db

# NextAuth
NEXTAUTH_SECRET=<generate-new-strong-secret>
NEXTAUTH_URL=https://sayurlogi.id

# Public URL
NEXT_PUBLIC_APP_URL=https://sayurlogi.id

# Admin (GANTI password default!)
ADMIN_PASSWORD=<strong-password>

# ERPNext (internal Docker network)
ERPNEXT_URL=http://erpnext:8000
ERPNEXT_API_KEY=<your-erpnext-api-key>
ERPNEXT_API_SECRET=<your-erpnext-api-secret>
ERPNEXT_SITE=sayurlogi
ERPNEXT_WAREHOUSE=Stores - S
ERPNEXT_COMPANY=SayurLogi

# Encryption (AES-256 untuk DB secrets)
INTEGRATION_ENCRYPTION_KEY=<generate-new-hex-32>

# Webhook secrets
WEBHOOK_SECRET=<generate-new-hex-24>
SYNC_WEBHOOK_SECRET=<generate-new-hex-24>

# Backup retention (days)
BACKUP_RETENTION_DAYS=30
EOF

# ⚠️ Edit file ini, ganti semua <...> dengan value yang benar!
nano .env.production
```

---

## 🔧 Step 5: Connect ERPNext (Frappe Docker) ke Storefront

ERPNext dan storefront harus di network Docker yang sama supaya bisa komunikasi.

### 5a. Connect networks

```bash
# Get Frappe Docker network name
docker network ls | grep frappe

# Connect storefront ke Frappe network
docker network connect frappe_docker_default sayurlogi-storefront

# Verify
docker exec sayurlogi-storefront ping -c 1 erpnext
```

### 5b. Update .env.production — ERPNEXT_URL

```bash
# Karena ERPNext di Docker network yang sama:
ERPNEXT_URL=http://erpnext:8000
# atau kalau beda network, pakai container IP:
# docker inspect erpnext | grep IPAddress
```

---

## 🚀 Step 6: Deploy!

```bash
# 1. Setup database (first time only)
docker exec sayurlogi-storefront bun run db:push

# 2. Seed products + content + coupons + admin
docker exec sayurlogi-storefront bun run scripts/seed-products.ts
docker exec sayurlogi-storefront bun run scripts/seed-content.ts
docker exec sayurlogi-storefront bun run scripts/seed-coupons.ts
docker exec sayurlogi-storefront bun run scripts/seed-admin.ts

# 3. Start all services
docker compose up -d

# 4. Verify
docker compose ps
curl -sI https://sayurlogi.id
# Expected: HTTP 301 → HTTPS

curl -sI https://sayurlogi.id/
# Expected: HTTP 200 + 🔒 SSL active

# 5. Test backup
docker exec sayurlogi-storefront bun run scripts/backup-db.ts

# 6. Setup cron backup (di host, bukan container)
crontab -e
# Tambahkan:
0 3 * * * docker exec sayurlogi-storefront bun run scripts/backup-db.ts >> /var/log/sayurlogi-backup.log 2>&1
```

---

## 🔒 Security Checklist (WAJIB sebelum go-live)

### 1. Rotate Secrets

```bash
# Generate semua secret baru
echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
echo "INTEGRATION_ENCRYPTION_KEY=$(openssl rand -hex 32)"
echo "WEBHOOK_SECRET=$(openssl rand -hex 24)"
echo "SYNC_WEBHOOK_SECRET=$(openssl rand -hex 24)"

# Update .env.production dengan value baru
nano .env.production

# Restart storefront
docker compose restart storefront
```

### 2. Ganti Password Admin

```bash
# Login ke admin dashboard (Ctrl+Shift+A)
# Settings → Users → Administrator → Change Password
# Pakai password kuat: 12+ chars, huruf besar+kecil+angka+simbol
```

### 3. Setup Firewall

```bash
# Hanya expose port 80, 443, dan SSH
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP (redirect ke HTTPS)
sudo ufw allow 443/tcp       # HTTPS
sudo ufw enable

# JANGAN expose port 3000, 8000, 3010, 3011 — internal only
```

### 4. Setup Fail2ban (anti brute-force SSH)

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 5. Disable Root Login SSH

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no (pakai SSH key only)
sudo systemctl restart sshd
```

### 6. Setup Logrotate (prevent disk full)

```bash
sudo cat > /etc/logrotate.d/sayurlogi << 'EOF'
/var/log/sayurlogi-*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 tedykul tedykul
}
EOF
```

---

## 📊 Monitoring

### Health Check Endpoints

```bash
# Storefront
curl -s http://localhost:3000/api/products | head -c 50

# Backup monitor
curl -s http://localhost:3011/health

# ERPNext (via Tailscale)
curl -s http://sayurlogi:8000/api/method/ping

# Docker containers
docker compose ps
docker stats
```

### Log Monitoring

```bash
# Storefront logs
docker compose logs storefront --tail 50

# ERPNext logs
docker compose -f /opt/frappe_docker/compose.yaml logs backend --tail 50

# Backup logs
docker exec sayurlogi-storefront cat logs/backup.log | tail -20

# Caddy access logs
docker compose logs caddy --tail 50
```

### Setup Uptime Monitoring (Gratis)

1. Daftar https://uptimerobot.com
2. Add monitor:
   - URL: `https://sayurlogi.id`
   - Check interval: 5 minutes
3. Add alert: email + Telegram/Discord

---

## 🔄 Maintenance

### Update Code (Deploy Baru)

```bash
cd ~/sayurlogi

# Pull code terbaru
git pull origin main

# Rebuild Docker image
docker build -t sayurlogi:latest .

# Restart (zero downtime)
docker compose up -d --no-deps storefront

# Migrate DB (kalau ada schema change)
docker exec sayurlogi-storefront bun run db:push
```

### Backup Manual

```bash
# Trigger backup manual
docker exec sayurlogi-storefront bun run scripts/backup-db.ts

# Copy backup ke komputer lokal (offsite)
scp -r tedykul@vps:/home/tedykul/sayurlogi/db/backups/ ./backups/
```

### Restore dari Backup

```bash
# Stop storefront
docker compose stop storefront

# Restore DB
docker cp db/backups/backup-YYYY-MM-DD-HHMM.db sayurlogi-storefront:/app/db/custom.db

# Start storefront
docker compose start storefront

# Verify
curl -s http://localhost:3000/api/products | python3 -c "import sys,json;print(len(json.load(sys.stdin)['products']),'products')"
```

### ERPNext Update

```bash
cd /opt/frappe_docker
sudo docker compose pull
sudo docker compose up -d
```

---

## 🆘 Troubleshooting

### Storefront tidak bisa connect ERPNext

```bash
# Check ERPNext container
docker compose -f /opt/frappe_docker/compose.yaml ps

# Check network connectivity
docker exec sayurlogi-storefront curl -s http://erpnext:8000/api/method/ping

# Check API key/secret
docker exec sayurlogi-storefront curl -s -H "Authorization: token KEY:SECRET" http://erpnext:8000/api/method/frappe.auth.get_logged_user
```

### SSL tidak jalan

```bash
# Check Caddy logs
docker compose logs caddy --tail 20

# Verify domain DNS
dig sayurlogi.id
# Harus resolve ke VPS IP

# Manual SSL cert request
docker exec sayurlogi-caddy caddy reload --config /etc/caddy/Caddyfile
```

### Backup gagal

```bash
# Check backup logs
docker exec sayurlogi-storefront cat logs/backup.log | tail -20

# Manual backup
docker exec sayurlogi-storefront bun run scripts/backup-db.ts

# Check disk space
df -h
```

### Rate limit terlalu ketat

Edit `src/lib/rate-limit-storefront.ts`, adjust `BUCKETS` config:
```typescript
checkout: { limit: 10, windowMs: 15 * 60 * 1000, blockMs: 15 * 60 * 1000 },
// naikkan limit dari 5 ke 10
```
Rebuild + restart.

---

## 📁 Struktur File Deployment

```
sayurlogi/
├── .env.production          # Secrets (JANGAN commit!)
├── .dockerignore
├── Dockerfile               # Build storefront image
├── docker-compose.yml       # Orchestrate semua containers
├── Caddyfile.prod           # Caddy config (SSL + reverse proxy)
├── Caddyfile                # Dev config (sandbox)
├── prisma/
│   └── schema.prisma
├── scripts/
│   ├── backup-db.ts         # Backup script
│   ├── seed-*.ts            # Seed scripts
├── mini-services/
│   ├── erpnext-sync/        # Cron sync service
│   └── backup-monitor/      # Backup health monitor
└── src/
    └── ...                  # Application code
```

---

## ✅ Pre-Launch Checklist

- [ ] Domain dibeli + DNS pointing ke VPS
- [ ] Docker + Docker Compose terinstall
- [ ] ERPNext (Frappe Docker) running
- [ ] API Key + Secret ERPNext di-generate
- [ ] Storefront Docker image di-build
- [ ] `.env.production` di-setup (semua secret di-rotate)
- [ ] `docker-compose.yml` + `Caddyfile.prod` di-config
- [ ] Database di-push + seeded
- [ ] SSL aktif (https://sayurlogi.id → 🔒)
- [ ] Firewall aktif (hanya 80, 443, 22)
- [ ] Fail2ban aktif
- [ ] SSH key-only login (no password)
- [ ] Backup cron job setup (daily 3AM)
- [ ] Backup monitor running
- [ ] Uptime monitoring setup (UptimeRobot)
- [ ] Password admin diganti (bukan admin123)
- [ ] Test checkout end-to-end (produk → checkout → payment)
- [ ] Test admin dashboard (login → orders → verify payment)
- [ ] Test WA notification (kalau configured)
- [ ] Test ERPNext sync (produk muncul dari ERPNext)

---

## 📞 Support

Jika ada masalah, check:
1. `docker compose ps` — semua container status
2. `docker compose logs <service> --tail 50` — error logs
3. `curl -sI https://sayurlogi.id/` — HTTP status
4. `df -h` — disk space
5. `free -m` — RAM usage

---

Dibuat dengan 🌱 untuk SayurLogi
