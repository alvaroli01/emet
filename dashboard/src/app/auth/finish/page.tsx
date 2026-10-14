"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase's free plan sends its standard invite emails, which return the login in the URL
 * fragment (#access_token=…). The server never sees a fragment, so the browser finishes here.
 */
export default function FinishLogin() {
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = new URLSearchParams(window.location.search).get("next") ?? "/";
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) { window.location.replace("/login?error=link"); return; }
    const type = hash.get("type");
    createClient().auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      window.location.replace(error ? "/login?error=link" : type === "invite" || type === "recovery" ? "/welcome" : safe);
    });
  }, []);
  return <main className="grid min-h-dvh place-items-center text-sm text-muted" aria-busy="true">…</main>;
}
