"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GlassCard } from "@/components/marketing/GlassCard";
import { HeroDragonShell } from "@/components/marketing/HeroDragonShell";
import { authClient } from "@/lib/auth-client";
import { btnPrimary } from "@/lib/ui/button-classes";
import { glassInput, glassLabel, glassMuted, glassTitle } from "@/lib/ui/glass-marketing";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await authClient.signIn.email({
      email,
      password,
      rememberMe,
    });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? "Anmeldung fehlgeschlagen");
      return;
    }
    router.push("/calendar");
    router.refresh();
  };

  return (
    <HeroDragonShell>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <GlassCard className="w-full max-w-sm !px-8 !py-8">
        <h1 className={glassTitle}>Anmelden</h1>
        <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
          <div>
            <label className={glassLabel}>E-Mail</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={glassInput}
            />
          </div>
          <div>
            <label className={glassLabel}>Passwort</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={glassInput}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#cdc3b8]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Angemeldet bleiben
          </label>
          {error && <p className="text-sm text-[#f0a0a0]">{error}</p>}
          <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
            {pending ? "…" : "Einloggen"}
          </button>
        </form>
        <p className={`mt-6 text-center ${glassMuted}`}>
          Noch kein Konto?{" "}
          <Link
            href="/register"
            className="font-medium text-[#f0b868] underline-offset-2 hover:underline"
          >
            Registrieren
          </Link>
        </p>
        </GlassCard>
      </div>
    </HeroDragonShell>
  );
}
