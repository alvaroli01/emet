"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";

type Person = { id: string; full_name: string; avatar_url: string | null; group_id: string | null };
type Team = { id: string; name: string; emoji: string };

/** Team Leader → "Send a notification": a short message to everyone, one team or chosen people (bell + phone). */
export function LeaderMessage({ people, teams, meId }: { people: Person[]; teams: Team[]; meId: string }) {
  const t = useTranslations("leaderMessage");
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [to, setTo] = useState<string>("all"); // "all" | "pick" | a team id
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const others = people.filter((p) => p.id !== meId);
  const users = to === "all" ? others.map((p) => p.id) : to === "pick" ? [...picked] : others.filter((p) => p.group_id === to).map((p) => p.id);

  async function send() {
    setBusy(true);
    const { data, error } = await supabase.rpc("leader_send", { p_users: users, p_text: text });
    setBusy(false);
    if (error) { toast("error", t("error")); return; }
    toast("ok", t("sent", { n: data as number }));
    setText(""); setPicked(new Set());
  }
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <section className="panel max-w-2xl space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("hint")}</p>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t("to")}</span>
        <select value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border border-line bg-surface px-3 py-2">
          <option value="all">{t("everyone", { n: others.length })}</option>
          {teams.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}
          <option value="pick">{t("pick")}</option>
        </select>
      </label>
      {to === "pick" && (
        <ul className="grid max-h-64 gap-1 overflow-y-auto sm:grid-cols-2">
          {others.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-surface-2">
                <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} />
                <Avatar name={p.full_name} src={p.avatar_url} size={22} /> <span className="truncate">{p.full_name}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <label className="block text-sm">
        <span className="mb-1 block font-medium">{t("message")}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 300))} rows={3} placeholder={t("placeholder")}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2" />
        <span className="mt-0.5 block text-right text-xs text-muted tabular-nums">{text.length}/300</span>
      </label>
      <button onClick={send} disabled={busy || !text.trim() || users.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast disabled:opacity-50">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {t("send", { n: users.length })}
      </button>
    </section>
  );
}
