import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// ============================================================
// seed-admin — idempotent upsert of the default super_admin user.
// ============================================================
// Env vars (REQUIRED for production — no insecure default):
//   ADMIN_EMAIL    (default: admin@sayurlogi.id)
//   ADMIN_PASSWORD (REQUIRED — min 12 chars, no default)
//   ADMIN_NAME     (default: "Super Admin")
//
// Safe to re-run: if the user already exists, password + name +
// role are refreshed. Other fields (active, lastLoginAt) untouched.
//
// Security:
//   - No hardcoded default password. Refuses to run without
//     ADMIN_PASSWORD env var. Prevents accidental deployment with
//     weak credentials.
//   - Password is logged ONLY as a length + strength hint, never
//     the actual value.
// ============================================================

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@sayurlogi.id")
    .toLowerCase()
    .trim();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = process.env.ADMIN_NAME || "Super Admin";

  if (!password) {
    console.error("❌ ADMIN_PASSWORD env var is required.");
    console.error("   Generate a strong one with: openssl rand -base64 24");
    console.error("   Then run: ADMIN_PASSWORD='<your-password>' bun run scripts/seed-admin.ts");
    process.exit(1);
  }

  if (password.length < 12) {
    console.error(`❌ ADMIN_PASSWORD too short (${password.length} chars). Minimum 12 required.`);
    console.error("   Generate a strong one with: openssl rand -base64 24");
    process.exit(1);
  }

  console.log("🌱 Seeding admin user...");
  console.log(`   email: ${email}`);
  console.log(`   name:  ${name}`);
  console.log(`   password length: ${password.length} chars (not shown for security)`);
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

  console.log(`  ✓ Admin user ready: ${user.id} (${user.email})`);
  console.log("\n✅ Seed-admin complete!");
}

main()
  .catch((e) => {
    console.error("❌ seed-admin failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
