"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, KeyRound } from "lucide-react";

// NOTE: text is English for now; it moves into the 7 translation files in step 5.

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"password" | "link">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(
    params.get("error") === "link"
      ? { kind: "error", text: "That link has expired or was already used. Ask for a new one below." }
      : params.get("error") === "not-on-team"
        ? { kind: "error", text: "Your account isn't active on the team list. Ask a team leader." }
        : null,
  );

  const supabase = createClient();
  const emailRedirect = () => `${window.location.origin}/auth/callback?next=${params.get("next") ?? "/"}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg({ kind: "error", text: "Wrong email or password." });
      } else {
        router.replace(params.get("next") ?? "/");
        router.refresh();
      }
    } else {
      // shouldCreateUser: false → only invited members can get a link
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false, emailRedirectTo: emailRedirect() },
      });
      setMsg(
        error
          ? { kind: "error", text: "We couldn't send a link. Is this the email a team leader invited?" }
          : { kind: "ok", text: "Check your inbox — we sent you a login link." },
      );
    }
    setBusy(false);
  }

  async function forgot() {
    if (!email) return setMsg({ kind: "error", text: "Type your email first." });
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/welcome` });
    setMsg({ kind: "ok", text: "If you're on the team, a reset link is on its way." });
    setBusy(false);
  }

  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-brand text-brand-contrast text-xl font-semibold">
            e
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">emet HQ</h1>
          <p className="mt-1 text-sm text-muted">€30K revenue · €15K profit · June 2027</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm">
            {(["password", "link"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setMsg(null); }}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition ${
                  mode === m ? "bg-surface shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {m === "password" ? <KeyRound size={15} /> : <Mail size={15} />}
                {m === "password" ? "Password" : "Email link"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Email">
              <input
                type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input" placeholder="you@example.com"
              />
            </Field>
            {mode === "password" && (
              <Field label="Password">
                <input
                  type="password" required autoComplete="current-password" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="input"
                />
              </Field>
            )}
            {msg && (
              <p role="status" className={`text-sm ${msg.kind === "error" ? "text-bad" : "text-ok"}`}>{msg.text}</p>
            )}
            <button
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-medium text-brand-contrast transition hover:opacity-90 disabled:opacity-60"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === "password" ? "Log in" : "Send me a login link"}
            </button>
            {mode === "password" && (
              <button type="button" onClick={forgot} className="w-full text-center text-sm text-muted hover:text-ink">
                Forgot password?
              </button>
            )}
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Invite only. Not on the team list? Ask a team leader.
        </p>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
