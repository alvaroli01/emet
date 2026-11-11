"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** The phone app (home-screen emet) always opens on Today (Alvaro, 2026-11-11): iPhones reopen the last page instead of
 *  the manifest's start page. On a fresh launch, or coming back after 5+ minutes away, it goes to /today — unless the
 *  app was opened by tapping a notification (the service worker adds ?pushed=1), which keeps its own page. */
export function StartOnToday() {
  const router = useRouter();
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!standalone) return;
    const go = () => { if (location.pathname !== "/today" && !new URLSearchParams(location.search).has("pushed")) router.replace("/today"); };
    try { if (!sessionStorage.getItem("emet-started")) { sessionStorage.setItem("emet-started", "1"); go(); } } catch { /* private mode */ }
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5 * 60e3) go();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [router]);
  return null;
}
