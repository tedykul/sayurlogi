import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

// ============================================================
// check-admin — diagnostic tool for admin login issues.
// ============================================================
// Run: bun run scripts/check-admin.ts
// Or with test password: bun run scripts/check-admin.ts "MyPassword123!"
//
// Reports:
//   - All User rows (email, role, active, has password, last login)
//   - ADMIN_PASSWORD env var status (set/empty)
//   - Test password against all users (if provided as arg)
//   - Recommendations to fix login
// ============================================================

async function main() {
  const testPassword = process.argv[2];

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SayurLogi Admin Diagnostic");
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Check ADMIN_PASSWORD env var
  const adminPwd = process.env.ADMIN_PASSWORD || "";
  console.log("📋 ADMIN_PASSWORD env var:");
  if (adminPwd) {
    console.log(`   ✅ Set (length: ${adminPwd.length} chars)`);
    console.log(`   → Mode 2 (password-only, no email) is ACTIVE`);
    console.log(`   → Login: leave email blank, password = the env var value`);
  } else {
    console.log(`   ⚠️  Not set (empty)`);
    console.log(`   → Mode 2 disabled. User MUST login with email + password`);
  }
  console.log("");

  // 2. List all admin users
  console.log("👥 Users in database:");
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      passwordHash: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (users.length === 0) {
    console.log("   ❌ NO USERS in database!");
    console.log("   → This is why login fails. Run seed-admin first:");
    console.log("     bun run scripts/seed-admin.ts \"YourPassword123!\"");
  } else {
    console.log(`   Found ${users.length} user(s):\n`);
    for (const u of users) {
      const hasHash = !!u.passwordHash;
      const hashAge = u.updatedAt.toISOString().split("T")[0];
      console.log(`   ┌─ ${u.email} ─────────────────────────────────┐`);
      console.log(`   │  id:         ${u.id}`);
      console.log(`   │  name:       ${u.name}`);
      console.log(`   │  role:       ${u.role}`);
      console.log(`   │  active:     ${u.active ? "✅ true" : "❌ false (DISABLED)"}`);
      console.log(`   │  hasHash:    ${hasHash ? "✅ yes" : "❌ no (no password set)"}`);
      console.log(`   │  lastLogin:  ${u.lastLoginAt?.toISOString() || "never"}`);
      console.log(`   │  updated:    ${hashAge}`);
      console.log(`   └──────────────────────────────────────────────┘\n`);
    }
  }

  // 3. Test password if provided
  if (testPassword && users.length > 0) {
    console.log("🔐 Testing password against all users...\n");
    let matched = false;
    for (const u of users) {
      if (!u.passwordHash) {
        console.log(`   ⚠️  ${u.email}: no passwordHash set — skip`);
        continue;
      }
      const valid = await bcrypt.compare(testPassword, u.passwordHash);
      console.log(`   ${valid ? "✅" : "❌"} ${u.email}: ${valid ? "MATCH! ← This is your account" : "no match"}`);
      if (valid) matched = true;
    }
    if (!matched) {
      console.log(`\n❌ Password doesn't match ANY user.`);
      console.log(`   Reset with: bun run scripts/seed-admin.ts "${testPassword}"`);
    }
  } else if (testPassword) {
    console.log(`\n⚠️  Password provided but no users to test against.`);
  }

  // 4. Recommendations
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Diagnosis & Recommendations");
  console.log("═══════════════════════════════════════════════════════════\n");

  const issues: string[] = [];
  if (users.length === 0) issues.push("No admin user in DB → run seed-admin");
  const disabledUsers = users.filter((u) => !u.active);
  if (disabledUsers.length > 0) issues.push(`Disabled users: ${disabledUsers.map((u) => u.email).join(", ")}`);
  const noHashUsers = users.filter((u) => !u.passwordHash);
  if (noHashUsers.length > 0) issues.push(`Users without password: ${noHashUsers.map((u) => u.email).join(", ")}`);

  if (issues.length === 0) {
    console.log("✅ All looks good. Login should work.");
    console.log(`   Use email: ${users[0].email}`);
    console.log(`   Password: whatever you set via seed-admin`);
  } else {
    console.log("❌ Issues found:");
    for (const issue of issues) console.log(`   • ${issue}`);
    console.log("\n🔧 To fix:");
    console.log(`   bun run scripts/seed-admin.ts "YourNewPassword123!"`);
    console.log(`   pm2 restart sayurlogi  # reload env + DB connection`);
  }
  console.log("\n═══════════════════════════════════════════════════════════");
}

main()
  .catch((e) => {
    console.error("❌ check-admin failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
