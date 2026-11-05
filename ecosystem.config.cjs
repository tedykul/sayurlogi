// ============================================================
// PM2 Ecosystem Config — SayurLogi production
// ============================================================
// Cara pakai:
//   pm2 delete sayurlogi          (hapus process lama + cached env)
//   pm2 start ecosystem.config.cjs
//   pm2 save                      (supaya auto-start saat reboot)
//
// File ini eksplisit TIDAK set ADMIN_PASSWORD → warning hilang.
// Admin login hanya via User table (email + password).
//
// envFilePath membaca .env untuk vars lain (DATABASE_URL, dll.)
// tapi kita override ADMIN_PASSWORD jadi kosong di sini.
// ============================================================

module.exports = {
  apps: [
    {
      name: "sayurlogi",
      script: "bun",
      args: ".next/standalone/server.js",
      cwd: "/home/tedykul/sayurlogi",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        // Explicitly empty — disables legacy password-gate.
        // Admin login only via User table (email + password).
        ADMIN_PASSWORD: "",
      },
      // Read .env file for other vars (DATABASE_URL, NEXTAUTH_SECRET, etc.)
      envFilePath: "/home/tedykul/sayurlogi/.env",
      // Logging
      error_file: "/home/tedykul/.pm2/logs/sayurlogi-error.log",
      out_file: "/home/tedykul/.pm2/logs/sayurlogi-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
    },
    {
      name: "erpnext-sync",
      script: "bun",
      args: "run index.ts",
      cwd: "/home/tedykul/sayurlogi/mini-services/erpnext-sync",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
      envFilePath: "/home/tedykul/sayurlogi/.env",
    },
    {
      name: "backup-monitor",
      script: "bun",
      args: "run index.ts",
      cwd: "/home/tedykul/sayurlogi/mini-services/backup-monitor",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      env: {
        NODE_ENV: "production",
      },
      envFilePath: "/home/tedykul/sayurlogi/.env",
    },
  ],
};
