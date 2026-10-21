"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Trash2, Users, Calendar, Send } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import type { TeamTask } from "@/lib/team-tasks";

type Person = { id: string; full_name: string; avatar_url: string | null; group_id: string | null };
type Team = { id: string; name: string };

const dayLabel = (d: string, locale: string) => new Date(d + "T12:00:00Z").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Who has finished and who hasn't: a ticked avatar for done, a plain one for still to do. */
export function TaskPeople({ task }: { task: TeamTask }) {
  const t = useTranslations("teamTasks");
  const done = task.people.filter((p) => p.done_at).length;
  return (
    <div>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2"><span className="block h-full rounded-full bg-ok" style={{ width: `${task.people.length ? (done / task.people.length) * 100 : 0}%` }} /></span>
        {t("progress", { done, total: task.people.length })}
      </div>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {task.people.map((p) => (
          <li key={p.id} title={`${p.name}: ${p.done_at ? t("finished") : t("notYet")}`}
              className={`flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs ${p.done_at ? "bg-ok/15 text-ok-text" : "bg-surface-2 text-muted"}`}>
            <span className="relative"><Avatar name={p.name} src={p.avatar} size={22} />
              {p.done_at && <span className="absolute -right-1 -bottom-1 grid size-3.5 place-items-center rounded-full bg-ok text-[#06281a]"><Check size={9} strokeWidth={3} /></span>}
            </span>
            {p.name.split(" ")[0]}
            <span className="sr-only">{p.done_at ? t("finished") : t("notYet")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Team leader only: give a task to everyone, a whole team, several people or yourself — and follow who finished. */
export function AssignTasks({ tasks, people, teams, meId, projectId }: { tasks: TeamTask[]; people: Person[]; teams: Team[]; meId: string; projectId?: string }) {
  const t = useTranslations("teamTasks");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [due, setDue] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const everyone = people.length > 0 && picked.size === people.length;
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const addTeam = (gid: string) => setPicked((s) => new Set([...s, ...people.filter((p) => p.group_id === gid).map((p) => p.id)]));

  async function give(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !picked.size || saving) return;
    setSaving(true);
    const { data, error } = await supabase.from("team_tasks").insert({ title: title.trim(), details: details.trim(), due_on: due || null, project_id: projectId ?? null }).select("id").single();
    const res = data && !error ? await supabase.from("team_task_people").insert([...picked].map((user_id) => ({ task_id: data.id, user_id }))) : null;
    setSaving(false);
    if (error || res?.error) return toast("error", t("saveError"));
    toast("ok", t("sent", { count: picked.size }));
    setTitle(""); setDetails(""); setDue(""); setPicked(new Set());
    router.refresh();
  }
  async function remove(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("team_tasks").delete().eq("id", id);
    if (error) return toast("error", t("saveError"));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={give} className="panel space-y-4 p-5">
        <div>
          <h3 className="font-semibold">{t("newTask")}</h3>
          <p className="text-sm text-muted">{t("onlyLeaders")}</p>
        </div>
        <label className="block text-sm font-medium">{t("what")}
          <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("whatPlaceholder")} className="input mt-1.5" />
        </label>
        <label className="block text-sm font-medium">{t("details")}
          <textarea maxLength={2000} rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t("detailsPlaceholder")} className="input mt-1.5 resize-y" />
        </label>
        <label className="block w-fit text-sm font-medium">{t("due")}
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input mt-1.5" />
        </label>

        <fieldset>
          <legend className="text-sm font-medium">{t("who")} <span className="font-normal text-muted">· {t("picked", { count: picked.size })}</span></legend>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setPicked(everyone ? new Set() : new Set(people.map((p) => p.id)))} aria-pressed={everyone}
                    className={`flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${everyone ? "bg-brand text-white" : "bg-surface-2 ring-1 ring-line"}`}>
              <Users size={15} /> {t("everyone")}
            </button>
            <button type="button" onClick={() => toggle(meId)} aria-pressed={picked.has(meId)}
                    className={`min-h-10 rounded-full px-4 text-sm font-semibold ${picked.has(meId) ? "bg-brand text-white" : "bg-surface-2 ring-1 ring-line"}`}>{t("me")}</button>
            {teams.map((g) => (
              <button key={g.id} type="button" onClick={() => addTeam(g.id)} className="min-h-10 rounded-full bg-surface-2 px-4 text-sm ring-1 ring-line hover:ring-brand/50">+ {g.name}</button>
            ))}
            {picked.size > 0 && <button type="button" onClick={() => setPicked(new Set())} className="min-h-10 px-2 text-sm text-muted underline">{t("clear")}</button>}
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {people.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => toggle(p.id)} aria-pressed={picked.has(p.id)}
                        className={`flex min-h-10 items-center gap-2 rounded-full py-1 pr-3 pl-1 text-sm transition ${picked.has(p.id) ? "bg-brand/20 font-semibold ring-2 ring-brand" : "bg-surface-2 ring-1 ring-line"}`}>
                  <Avatar name={p.full_name} src={p.avatar_url} size={28} />
                  {p.id === meId ? `${p.full_name} (${t("me")})` : p.full_name}
                  {picked.has(p.id) && <Check size={14} className="text-brand" />}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        <button disabled={saving || !title.trim() || !picked.size}
                className="flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white transition disabled:opacity-40">
          <Send size={15} /> {t("give", { count: picked.size })}
        </button>
      </form>

      <section className="panel p-5">
        <h3 className="font-semibold">{t("given")}</h3>
        <ul className="mt-3 divide-y divide-line">
          {tasks.map((x) => (
            <li key={x.id} className="py-4 first:pt-1">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{x.title}</p>
                  {x.details && <p className="mt-0.5 text-sm text-muted">{x.details}</p>}
                  {x.due_on && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Calendar size={12} /> {dayLabel(x.due_on, locale)}</p>}
                </div>
                <button onClick={() => remove(x.id)} aria-label={t("delete")} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-bad-text"><Trash2 size={15} /></button>
              </div>
              <div className="mt-2"><TaskPeople task={x} /></div>
            </li>
          ))}
          {!tasks.length && <li className="py-8 text-center text-sm text-muted">{t("noneGiven")}</li>}
        </ul>
      </section>
    </div>
  );
}

/** My Tasks: the tasks the team leader gave me, with a tick — and who else has finished. */
export function MyTeamTasks({ tasks, meId }: { tasks: TeamTask[]; meId: string }) {
  const t = useTranslations("teamTasks");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [busy, setBusy] = useState<string | null>(null);
  async function tick(task: TeamTask, done: boolean) {
    setBusy(task.id);
    const { error } = await supabase.from("team_task_people").update({ done_at: done ? new Date().toISOString() : null }).eq("task_id", task.id).eq("user_id", meId);
    setBusy(null);
    if (error) return toast("error", t("saveError"));
    router.refresh();
  }
  const sorted = [...tasks].sort((a, b) => Number(!!a.people.find((p) => p.id === meId)?.done_at) - Number(!!b.people.find((p) => p.id === meId)?.done_at));
  if (!tasks.length) return null;
  return (
    <section id="team-tasks" className="scroll-mt-20">
      <h2 className="mb-2 text-sm font-semibold">{t("fromLeader")} <span className="text-muted tabular-nums">· {tasks.filter((x) => !x.people.find((p) => p.id === meId)?.done_at).length}</span></h2>
      <ul className="panel divide-y divide-line">
        {sorted.map((x) => {
          const mine = x.people.find((p) => p.id === meId);
          const done = !!mine?.done_at;
          return (
            <li key={x.id} className="flex items-start gap-3 px-5 py-4">
              <button onClick={() => tick(x, !done)} disabled={busy === x.id} role="checkbox" aria-checked={done} aria-label={done ? t("untick", { title: x.title }) : t("tick", { title: x.title })}
                      className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ring-2 transition ${done ? "bg-ok text-[#06281a] ring-ok" : "ring-line hover:ring-brand"}`}>
                {done && <Check size={16} strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${done ? "text-muted line-through" : ""}`}>{x.title}</p>
                {x.project && <a href={`/projects/${x.project.id}?tab=tasks`} className="mt-0.5 inline-block rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted hover:text-link">{x.project.name}</a>}
                {x.details && <p className="mt-0.5 text-sm text-muted">{x.details}</p>}
                {x.due_on && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Calendar size={12} /> {dayLabel(x.due_on, locale)}</p>}
                <div className="mt-2.5"><TaskPeople task={x} /></div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
