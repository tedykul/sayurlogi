"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Status = "idle" | "loading" | "success";

/**
 * Newsletter signup form — captures email, persists via /api/newsletter.
 * Used in footer. Idempotent (re-subscribing returns "already subscribed").
 */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  const validate = (): boolean => {
    if (!email) {
      setError("Email wajib diisi");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Format email tidak valid");
      return false;
    }
    setError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus("success");
        toast.success(data.message);
        setEmail("");
      } else {
        setStatus("idle");
        setError(data.message || "Gagal berlangganan");
        toast.error(data.message || "Gagal berlangganan");
      }
    } catch {
      setStatus("idle");
      setError("Koneksi gagal. Coba lagi.");
      toast.error("Koneksi gagal. Coba lagi.");
    }
  };

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold text-primary">Berhasil berlangganan!</p>
          <p className="text-xs text-muted-foreground">
            Cek email kamu untuk konfirmasi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2" noValidate>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            placeholder="email@kamu.com"
            disabled={status === "loading"}
            className="h-10 pl-9 pr-3 rounded-lg bg-background"
            aria-label="Email untuk newsletter"
            aria-invalid={!!error}
            aria-describedby={error ? "newsletter-error" : undefined}
          />
        </div>
        <Button
          type="submit"
          disabled={status === "loading"}
          className="h-10 rounded-lg px-4 shadow-sm shrink-0"
        >
          {status === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Langganan"
          )}
        </Button>
      </div>
      {error && (
        <p
          id="newsletter-error"
          className="flex items-center gap-1 text-xs text-destructive"
          role="alert"
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
      <p className="text-[10px] text-muted-foreground">
        Dapatkan info promo & tips sehat. Bisa unsubscribe kapan saja.
      </p>
    </form>
  );
}
