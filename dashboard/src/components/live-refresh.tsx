"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-renders the page (fresh numbers from the server) whenever anyone changes one of these tables. */
export function LiveRefresh({ tables }: { tables: string[] }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    let channel = supabase.channel(`live-${key}`);
    for (const table of key.split(",")) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        // Several changes in a burst → one refresh
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => router.refresh(), 400);
      });
    }
    channel.subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [key, router]);

  return null;
}
