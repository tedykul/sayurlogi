import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// ============================================================
// seed-admin — idempotent upsert of the default super_admin user.
// ============================================================
// Usage (3 ways, in priority order):
//
//   1. CLI argument (EASIEST for one-time reset):
//      bun run scripts/seed-admin.ts "MyPassword123!"
//
//   2. Env var (for scripted/CI use):
//      ADMIN_PASSWORD='MyPassword123!' bun run scripts/seed-admin.ts
//
//   3. Interactive prompt (if neither provided):
//      bun run scripts/seed-admin.ts
//      → script will prompt for password (input hidden)
//
// Optional env vars:
//   ADMIN_EMAIL  (default: admin@sayurlogi.id)
//   ADMIN_NAME   (default: "Super Admin")
//
// Safe to re-run: if the user already exists, password + name +
// role are refreshed. Other fields (active, lastLoginAt) untouched.
//
// Security:
//   - No hardcoded default password.
//   - Minimum 8 chars (reasonable; not too restrictive like 12).
//   - Password is logged ONLY as length, never the actual value.
// ============================================================

async function promptPassword(): Promise<string> {
  process.stdout.write("Enter admin password (min 8 chars): ");
  // Disable echo for password input
  const fd = await import("fs").then((m) => m.openSync(0, "r"));
  const wasRaw = process.stdin.isTTY;
  if (wasRaw) process.stdin.setRawMode?.(true);
  let password = "";
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      const char = chunk.toString();
      // Enter key (CR or LF) submits
      if (char === "\r" || char === "\n") {
        process.stdout.write("\n");
        if (wasRaw) process.stdin.setRawMode?.(false);
        process.stdin.pause();
        resolve(password);
      } else if (char === "\u0003") {
        // Ctrl+C
        process.stdout.write("\n");
        process.exit(1);
      } else if (char === "\u007f" || char === "\b") {
        // Backspace
        if (password.length > 0) {
          password = password.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else {
        password += char;
        process.stdout.write("*");
      }
    });
  }).finally(() => {
    try { (import("fs").then((m) => m.closeSync(fd))); } catch {}
  });
}

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@sayurlogi.id")
    .toLowerCase()
    .trim();
  const name = process.env.ADMIN_NAME || "Super Admin";

  // Password source priority: CLI arg → env var → interactive prompt
  let password = "";
  const cliArg = process.argv[2];
  if (cliArg) {
    password = cliArg;
    console.log("📌 Using password from CLI argument");
  } else if (process.env.ADMIN_PASSWORD) {
    password = process.env.ADMIN_PASSWORD;
    console.log("📌 Using password from ADMIN_PASSWORD env var");
  } else {
    console.log("📌 No password provided via CLI arg or env var.");
    console.log("   Will prompt interactively (input hidden with '*').");
    password = await promptPassword();
  }

  if (!password) {
    console.error("❌ Password is required.");
    console.error("   Usage: bun run scripts/seed-admin.ts \"YourPassword!\"");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error(`❌ Password too short (${password.length} chars). Minimum 8 required.`);
    console.error("   Tip: use a mix of letters, numbers, and symbols.");
    process.exit(1);
  }

  console.log("\n🌱 Seeding admin user...");
  console.log(`   email:    ${email}`);
  console.log(`   name:     ${name}`);
  console.log(`   password: ${password.length} chars (not shown for security)`);
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.user.upsert({
    where: { email },
    update: {
      passwordHash,
      name,
      role: "super_admin",
      // Ensure admin user is active (in case it was disabled before)
      active: true,
    },
    create: {
      email,
      name,
      passwordHash,
      role: "super_admin",
      active: true,
    },
  });

  console.log(`\n  ✓ Admin user saved: ${user.id}`);
  console.log(`\n✅ Done! Login credentials:`);
  console.log(`   ┌─────────────────────────────────────────────┐`);
  console.log(`   │  Email:    ${email.padEnd(33)}│`);
  console.log(`   │  Password: ${"*".repeat(password.length).padEnd(33)}│`);
  console.log(`   │  Role:     super_admin${" ".repeat(23)}│`);
  console.log(`   └─────────────────────────────────────────────┘`);
  console.log(`\n💡 Open admin panel: Ctrl+Shift+A (desktop) or footer button (mobile)`);
  console.log(`⚠️  If still can't login after this:`);
  console.log(`   1. Run: pm2 restart sayurlogi  (to reload env + DB connection)`);
  console.log(`   2. Clear browser cookies for the site`);
  console.log(`   3. Try again. If still fails, check 'bun run scripts/check-admin.ts'`);
}

main()
  .catch((e) => {
    console.error("❌ seed-admin failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
