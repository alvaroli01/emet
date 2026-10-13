"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Mail, KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LanguageSwitcher } from "@/components/preferences";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useTranslations("login");
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const initialError = params.get("error");
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    initialError === "link" ? { kind: "error", text: t("errors.linkExpired") }
      : initialError === "not-on-team" ? { kind: "error", text: t("errors.notOnTeam") }
      : null,
  );

  const supabase = createClient();
  const next = params.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ kind: "error", text: t("errors.wrongPassword") });
      } else {
        router.replace(safeNext);
        router.refresh();
      }
    } else {
      // shouldCreateUser: false → only invited members can get a link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}` },
      });
      setMsg(error ? { kind: "error", text: t("errors.linkFailed") } : { kind: "ok", text: t("linkSent") });
    }
    setBusy(false);
  }

  async function forgot() {
    if (!email) return setMsg({ kind: "error", text: t("errors.emailFirst") });
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/welcome` });
    setMsg({ kind: "ok", text: t("resetSent") });
    setBusy(false);
  }

  return (
    <main className="relative min-h-dvh grid place-items-center px-4 py-10">
      <div className="absolute top-3 right-3"><LanguageSwitcher /></div>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand text-xl font-semibold text-brand-contrast">e</div>
          <h1 className="text-2xl font-semibold tracking-tight">emet HQ</h1>
          <p className="mt-1 text-sm text-muted">{t("tagline")}</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm" role="tablist">
            {(["password", "link"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m}
                      onClick={() => { setMode(m); setMsg(null); }}
                      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition ${
                        mode === m ? "bg-surface shadow-sm" : "text-muted hover:text-ink"}`}>
                {m === "password" ? <KeyRound size={15} /> : <Mail size={15} />}
                {m === "password" ? t("password") : t("emailLink")}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">{t("email")}</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     className="input" placeholder="you@example.com" />
            </label>
            {mode === "password" && (
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">{t("password")}</span>
                <input type="password" required autoComplete="current-password" value={password}
                       onChange={(e) => setPassword(e.target.value)} className="input" />
              </label>
            )}
            {msg && <p role="status" className={`text-sm ${msg.kind === "error" ? "text-bad-text" : "text-ok-text"}`}>{msg.text}</p>}
            <button disabled={busy}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-medium text-brand-contrast transition hover:opacity-90 disabled:opacity-60">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === "password" ? t("logIn") : t("sendLink")}
            </button>
            {mode === "password" && (
              <button type="button" onClick={forgot} className="w-full text-center text-sm text-muted hover:text-ink">{t("forgot")}</button>
            )}
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted">{t("inviteOnly")}</p>
      </div>
    </main>
  );
}
