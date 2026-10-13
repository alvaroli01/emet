"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";

/** First stop after an invite or password-reset link: choose a password. */
export default function WelcomePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to emet HQ 🎉</h1>
        <p className="text-sm text-muted">Choose a password so you can log in from any device.</p>
      </div>
      <Card>
        <form onSubmit={save} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">New password</span>
            <input type="password" autoComplete="new-password" value={password}
                   onChange={(e) => setPassword(e.target.value)} className="input" />
          </label>
          {error && <p className="text-sm text-bad">{error}</p>}
          <div className="flex gap-2">
            <button disabled={busy}
                    className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-medium text-brand-contrast hover:opacity-90 disabled:opacity-60">
              Save password
            </button>
            <button type="button" onClick={() => router.replace("/")}
                    className="rounded-xl border border-line px-4 text-sm text-muted hover:text-ink">
              Skip
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
