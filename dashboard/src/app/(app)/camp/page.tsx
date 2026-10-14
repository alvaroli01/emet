import { getLocale, getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { weekStart, GOAL, pace } from "@/lib/metrics";
import { todayISO, eur } from "@/lib/format";
import { SectionTabs } from "@/components/section-tabs";
import { MountainLazy } from "@/components/summit/mountain-lazy";
import { WeekTab, type WeekPlan, type DueTask } from "@/components/camp/week";
import { AgendaTab, type AgendaItem } from "@/components/camp/agenda";
import { DocsTab, type Doc } from "@/components/camp/docs";
import { IdeasTab, type Idea } from "@/components/camp/ideas";
import { VaultTab } from "@/components/camp/vault";

type CardDue = { id: string; title: string; due_at: string; completed_at: string | null; boards: { slug: string; group_id: string | null } | null };
type SubDue = { id: string; text: string; due_on: string | null; done: boolean; cards: { id: string; title: string; boards: { slug: string; group_id: string | null } | null } | null };

/** Base camp: everyone's private working area. Only the owner can see it — the database enforces that. */
export default async function CampPage({ searchParams }: { searchParams: Promise<{ tab?: string; doc?: string }> }) {
  const { tab, doc: openDoc } = await searchParams;
  const t = await getTranslations("camp");
  const locale = await getLocale();
  const { me, groups } = await getSession();
  const supabase = await createClient();
  const week = weekStart(Date.now());
  const today = todayISO();

  const [plans, agenda, cards, subtasks, docs, ideas, vaultKey, vaultItems, members, sales, aiKey] = await Promise.all([
    supabase.from("week_plans").select("*").eq("owner_id", me.id).order("week_start", { ascending: false }).limit(8).returns<WeekPlan[]>(),
    supabase.from("agenda_items").select("*").eq("owner_id", me.id).gte("day", today).order("day").order("start_time").returns<AgendaItem[]>(),
    supabase.from("cards").select("id, title, due_at, completed_at, boards(slug, group_id), card_assignees!inner(user_id)")
      .eq("card_assignees.user_id", me.id).is("completed_at", null).not("due_at", "is", null).returns<CardDue[]>(),
    supabase.from("card_checklist_items").select("id, text, due_on, done, cards(id, title, boards(slug, group_id))")
      .eq("assignee_id", me.id).eq("done", false).returns<SubDue[]>(),
    supabase.from("docs").select("*").order("pinned", { ascending: false }).order("updated_at", { ascending: false }).returns<Doc[]>(),
    supabase.from("ideas").select("*").eq("owner_id", me.id).order("created_at").returns<Idea[]>(),
    supabase.from("vault_keys").select("salt, check_iv, check_data").eq("owner_id", me.id).maybeSingle(),
    supabase.from("vault_items").select("id, iv, data").eq("owner_id", me.id).order("created_at"),
    loadMembers(),
    supabase.from("sales").select("amount"),
    supabase.from("ai_keys").select("last4").maybeSingle(),
  ]);

  const slugOf = (b: { slug: string; group_id: string | null } | null | undefined) =>
    b?.group_id ? groups.find((g) => g.id === b.group_id)?.slug ?? null : null;
  const link = (b: { slug: string; group_id: string | null } | null | undefined, cardId: string) =>
    slugOf(b) ? `/g/${slugOf(b)}?card=${cardId}` : `/board?card=${cardId}`;

  // Everything with a date that is mine: cards I'm on, and small tasks given to me
  const due: DueTask[] = [
    ...(cards.data ?? []).map((c) => ({ id: c.id, title: c.title, day: c.due_at.slice(0, 10), href: link(c.boards, c.id), kind: "card" as const })),
    ...(subtasks.data ?? []).filter((s) => s.due_on && s.cards).map((s) => ({
      id: s.id, title: s.text, day: s.due_on!, href: link(s.cards!.boards, s.cards!.id), kind: "task" as const, parent: s.cards!.title,
    })),
  ].sort((a, b) => a.day.localeCompare(b.day));

  const revenue = (sales.data ?? []).reduce((a, s) => a + Number(s.amount), 0);
  const allDocs = docs.data ?? [];
  const myDocs = allDocs.filter((d) => d.owner_id === me.id);
  const sharedDocs = allDocs.filter((d) => d.owner_id !== me.id);
  const thisWeek = (plans.data ?? []).find((p) => p.week_start === week) ?? null;
  const openThisWeek = due.filter((d) => d.day < new Date(Date.parse(week) + 7 * 864e5).toISOString().slice(0, 10)).length;
  const firstName = me.full_name.split(" ")[0];

  return (
    <div className="space-y-6">
      <section className="panel grid overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-between gap-6 p-5 sm:p-7">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{t("title", { name: firstName })}</h1>
            <p className="mt-1 max-w-md text-sm text-muted">{t("subtitle")}</p>
          </div>
          <dl className="grid grid-cols-3 gap-4">
            <div><dt className="text-xs text-muted">{t("stats.dueThisWeek")}</dt><dd className="readout text-2xl">{openThisWeek}</dd></div>
            <div><dt className="text-xs text-muted">{t("stats.sharedWithMe")}</dt><dd className="readout text-2xl">{sharedDocs.length}</dd></div>
            <div><dt className="text-xs text-muted">{t("stats.daysLeft")}</dt><dd className="readout text-2xl">{pace(revenue, 0).daysLeft}</dd></div>
          </dl>
        </div>
        <div className="relative h-56 border-t border-line sm:h-64 md:h-auto md:min-h-[280px] md:border-t-0 md:border-l">
          <MountainLazy
            className="size-full"
            variant="camp"
            progress={Math.min(1, revenue / GOAL.revenue)}
            ariaLabel={t("sceneLabel")}
            labels={{ summit: t("summit"), camp: t("yourCamp", { name: firstName }), here: revenue > 0 ? eur(revenue, locale) : null }}
          />
        </div>
      </section>

      <SectionTabs label={t("sections")} initial={tab} tabs={[
        { id: "week", label: t("tabs.week"), node: <WeekTab week={week} plan={thisWeek} past={(plans.data ?? []).filter((p) => p.week_start !== week)} due={due} meId={me.id} /> },
        { id: "agenda", label: t("tabs.agenda"), node: <AgendaTab items={agenda.data ?? []} due={due} today={today} /> },
        { id: "docs", label: t("tabs.docs"), node: <DocsTab mine={myDocs} shared={sharedDocs} members={members} meId={me.id} ai={{ connected: !!aiKey.data, last4: aiKey.data?.last4 ?? null }} initialOpen={openDoc} /> },
        { id: "ideas", label: t("tabs.ideas"), node: <IdeasTab ideas={ideas.data ?? []} meId={me.id} /> },
        { id: "vault", label: t("tabs.vault"), node: <VaultTab keyRow={vaultKey.data} items={vaultItems.data ?? []} meId={me.id} /> },
      ]} />
    </div>
  );
}
