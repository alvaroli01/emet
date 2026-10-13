"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui";

/** First stop after an invite or password-reset link: choose a password. */
export default function WelcomePage() {
  const t = useTranslations("welcome");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError(t("tooShort"));
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(t("error"));
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md space-y-6 pt-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")} 🎉</h1>
        <p className="text-sm text-muted">{t("subtitle")}</p>
      </div>
      <Card>
        <form onSubmit={save} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t("newPassword")}</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
          </label>
          {error && <p className="text-sm text-bad-text">{error}</p>}
          <div className="flex gap-2">
            <button disabled={busy} className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-medium text-brand-contrast hover:opacity-90 disabled:opacity-60">
              {t("save")}
            </button>
            <button type="button" onClick={() => router.replace("/")} className="rounded-xl border border-line px-4 text-sm text-muted hover:text-ink">
              {t("skip")}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
