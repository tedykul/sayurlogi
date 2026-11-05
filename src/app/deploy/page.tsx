"use client";

import { useState } from "react";
import { Download, Loader2, CheckCircle2, AlertCircle, FileCode, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// ============================================================
// /deploy — download source code for VPS transfer.
// ============================================================
// No pre-auth check (avoids rate-limited /api/admin/login GET).
// The download endpoint itself validates the admin session cookie.
// If not authed, the download fails with 401 + toast error.
// ============================================================

export default function DeployPage() {
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    setDone(false);
    try {
      const res = await fetch("/api/deploy/download", {
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Download gagal" }));
        if (res.status === 401) {
          throw new Error("Anda belum login admin. Buka homepage, tekan Ctrl+Shift+A, login, lalu kembali ke halaman ini.");
        }
        throw new Error(err.message || "Download gagal");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sayurlogi-source-${new Date().toISOString().slice(0, 10)}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDone(true);
      toast.success("Download dimulai — cek folder Downloads Anda");
    } catch (err: any) {
      toast.error(err.message || "Download gagal");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/20 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold md:text-3xl">
            <Server className="h-7 w-7 text-primary" />
            Deploy ke VPS
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Download source code terbaru (tar.gz) untuk di-transfer ke VPS Anda.
          </p>
        </div>

        {/* Download button */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              Download Source Code
            </CardTitle>
            <CardDescription>
              File tar.gz berisi semua kode source SayurLogi (src, prisma, public, scripts, config).
              Siap di-extract di VPS. Wajib login admin dulu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDownload} disabled={downloading} size="lg" className="w-full">
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mengunduh...
                </>
              ) : done ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-500" />
                  Download selesai — download lagi?
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download Source Code (.tar.gz)
                </>
              )}
            </Button>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Jika gagal: buka homepage → Ctrl+Shift+A → login → kembali ke /deploy
            </p>
          </CardContent>
        </Card>

        {/* What's included */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Yang Termasuk</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                "src/", "prisma/", "public/", "scripts/",
                "mini-services/", "examples/",
                "package.json", "tsconfig.json", "next.config.ts",
                "deploy-vps.sh", "SECURITY-ROTATION.md",
              ].map((item) => (
                <Badge key={item} variant="secondary" className="font-mono text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* What's excluded */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Yang Dikecualikan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {[
                ".env (secrets)", ".git (history)", "node_modules",
                ".next (build)", "db/ (SQLite)", "upload/", "skills/",
              ].map((item) => (
                <Badge key={item} variant="outline" className="font-mono text-xs text-muted-foreground">
                  <AlertCircle className="h-3 w-3 mr-1 text-muted-foreground" />
                  {item}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cara Deploy di VPS</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full p-0 flex items-center justify-center">1</Badge>
                <div>
                  <p className="font-medium">Download file tar.gz di atas</p>
                  <p className="text-xs text-muted-foreground">Klik tombol download, file masuk ke folder Downloads</p>
                </div>
              </li>
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full p-0 flex items-center justify-center">2</Badge>
                <div>
                  <p className="font-medium">Transfer ke VPS</p>
                  <pre className="mt-1 rounded bg-secondary p-2 text-xs overflow-x-auto"><code>scp sayurlogi-source-*.tar.gz user@vps-anda:~/sayurlogi/</code></pre>
                </div>
              </li>
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full p-0 flex items-center justify-center">3</Badge>
                <div>
                  <p className="font-medium">Extract di VPS (overwrite existing files)</p>
                  <pre className="mt-1 rounded bg-secondary p-2 text-xs overflow-x-auto"><code>{`cd ~/sayurlogi
tar -xzf sayurlogi-source-*.tar.gz
bun install
bun run db:push
pm2 restart sayurlogi`}</code></pre>
                </div>
              </li>
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full p-0 flex items-center justify-center">4</Badge>
                <div>
                  <p className="font-medium">Set password admin baru di VPS</p>
                  <pre className="mt-1 rounded bg-secondary p-2 text-xs overflow-x-auto"><code>{`ADMIN_PASSWORD='bGwPTUkCTf13myjlLJAzEn7A' bun run scripts/seed-admin.ts`}</code></pre>
                </div>
              </li>
              <li className="flex gap-3">
                <Badge className="shrink-0 h-6 w-6 rounded-full p-0 flex items-center justify-center">5</Badge>
                <div>
                  <p className="font-medium">Commit + push dari VPS ke GitHub (agar VPS + GitHub sinkron)</p>
                  <pre className="mt-1 rounded bg-secondary p-2 text-xs overflow-x-auto"><code>{`cd ~/sayurlogi
git add -A
git commit -m "deploy: latest top bar fixes + features"
git push origin main`}</code></pre>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
