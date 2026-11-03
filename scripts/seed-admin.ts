import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// ============================================================
// seed-admin — idempotent upsert of the default super_admin user.
// ============================================================
// Env vars:
//   ADMIN_EMAIL (default: admin@sayurlogi.id)
//   ADMIN_PASSWORD (default: admin123)  — minimum 6 chars
//   ADMIN_NAME (default: "Super Admin")
//
// Safe to re-run: if the user already exists, password + name +
// role are refreshed. Other fields (active, lastLoginAt) untouched.
// ============================================================

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@sayurlogi.id")
    .toLowerCase()
    .trim();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Super Admin";

  console.log("🌱 Seeding admin user...");
  console.log(`   email: ${email}`);
  console.log(`   name:  ${name}`);

  if (password.length < 6) {
    throw new Error("ADMIN_PASSWORD must be at least 6 characters");
  }

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
