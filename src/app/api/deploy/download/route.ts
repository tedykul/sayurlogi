import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/admin-auth";
import { spawn } from "child_process";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ============================================================
// GET /api/deploy/download
// ============================================================
// Streams a tar.gz of the project source code (for VPS deployment).
//
// Why this exists: the dev environment has commits that haven't
// been pushed to GitHub (no GitHub credentials configured here).
// This endpoint lets the operator download the latest source as a
// tarball, transfer it to the VPS, extract, and deploy.
//
// Auth: requires admin session (so the endpoint isn't public).
//
// What's included:
//   - src/ (all source code)
//   - prisma/ (schema)
//   - public/ (static assets — sw.js, manifest, icons)
//   - scripts/ (seed-admin, etc.)
//   - mini-services/ (erpnext-sync, backup-monitor)
//   - examples/ (websocket demo)
//   - Config files: package.json, tsconfig.json, next.config.ts,
//     tailwind.config.ts, postcss.config.mjs, eslint.config.mjs,
//     components.json, .gitignore, Caddyfile
//   - deploy-vps.sh, SECURITY-ROTATION.md, DEPLOYMENT.md
//
// What's EXCLUDED (for security + size):
//   - .env (contains secrets)
//   - .git (would conflict with VPS git repo)
//   - node_modules (regenerated via bun install)
//   - .next (build output — regenerated on VPS)
//   - db/ (SQLite file — VPS has its own DB)
//   - upload/ (user-uploaded screenshots)
//   - tool-results/ (temp files)
//   - skills/ (AI skill files — not needed for deployment)
// ============================================================

const INCLUDE_PATHS = [
  "src",
  "prisma",
  "public",
  "scripts",
  "mini-services",
  "examples",
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "tailwind.config.ts",
  "postcss.config.mjs",
  "eslint.config.mjs",
  "components.json",
  ".gitignore",
  "Caddyfile",
  "deploy-vps.sh",
  "SECURITY-ROTATION.md",
  "DEPLOYMENT.md",
].filter((p) => {
  // Filter out non-existent paths at runtime
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    return fs.existsSync(p);
  } catch {
    return false;
  }
});

export async function GET(req: NextRequest) {
  const auth = await verifyAuth();
  if (!auth) {
    return NextResponse.json(
      { success: false, message: "Unauthorized. Login sebagai admin dulu." },
      { status: 401 }
    );
  }

  return new Promise<NextResponse>((resolve) => {
    // Use tar to create a gzip-compressed archive on stdout
    const tar = spawn("tar", ["czf", "-", ...INCLUDE_PATHS], {
      cwd: process.cwd(),
    });
    const chunks: Buffer[] = [];

    tar.stdout.on("data", (chunk) => chunks.push(chunk));

    tar.on("close", (code) => {
      if (code !== 0) {
        resolve(
          NextResponse.json(
            { success: false, message: `tar failed with code ${code}` },
            { status: 500 }
          )
        );
        return;
      }

      const buffer = Buffer.concat(chunks);
      const date = new Date().toISOString().slice(0, 10);
      const filename = `sayurlogi-source-${date}.tar.gz`;

      resolve(
        new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": "application/gzip",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Content-Length": String(buffer.length),
            "Cache-Control": "no-store",
          },
        })
      );
    });

    tar.on("error", (err) => {
      resolve(
        NextResponse.json(
          { success: false, message: `tar spawn error: ${err.message}` },
          { status: 500 }
        )
      );
    });
  });
}
