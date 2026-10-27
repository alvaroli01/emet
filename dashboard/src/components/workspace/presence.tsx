"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Records "I'm here" for the Team page's last active: on open and whenever the tab comes back (the database
 *  keeps at most one update every 5 minutes). */
export function Presence() {
  useEffect(() => {
    const supabase = createClient();
    const touch = () => { if (document.visibilityState === "visible") supabase.rpc("touch_presence").then(() => {}, () => {}); };
    touch();
    document.addEventListener("visibilitychange", touch);
    return () => document.removeEventListener("visibilitychange", touch);
  }, []);
  return null;
}
