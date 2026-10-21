import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { loadBoard, BOARD_TABLES } from "@/lib/boards";
import { loadKpis } from "@/lib/kpi-data";
import { Avatar, ViewOnlyBadge } from "@/components/ui";
import { LazyBoard as Board } from "@/components/board/board-lazy";
import { KpiCards } from "@/components/kpi-cards";
import { LiveRefresh } from "@/components/live-refresh";
import { BlockersTool } from "@/components/tools/blockers";
import { FinanceTools } from "@/components/tools/finance";
import { CustomerTools } from "@/components/tools/customer";
import { MarketingTools } from "@/components/tools/marketing";
import { CommunicationsTools } from "@/components/tools/communications";
import { TeamLeaderTools } from "@/components/tools/team-leader";
import type { ToolProps, ToolTab } from "@/components/tools/types";
import { ToolWorkspace } from "@/components/shell/tool-workspace";
import { AssistantBubble } from "@/components/shell/assistant-bubble";
import { LayoutDashboard, KanbanSquare, ListChecks, FolderOpen, FolderKanban } from "lucide-react";
import { AssignTasks } from "@/components/tools/team-tasks";
import { loadProjectPeople, loadMyProjects } from "@/lib/projects-server";
import { MyProjects } from "@/components/projects/my-projects";
import { Drive } from "@/components/documents/drive";
import { StorageBar } from "@/components/documents/storage-bar";
import { loadTeamTasks } from "@/lib/team-tasks";
import { SectionAssistant } from "@/components/shell/section-assistant";
import { createClient } from "@/lib/supabase/server";
import { PageHero } from "@/components/shell/page-hero";
import { MemberOrbit } from "@/components/shell/hero-visuals";
import { groupHero } from "@/lib/hero-data";
import { loadFinanceDash } from "@/lib/finance-dash";
import { loadMarketingDash } from "@/lib/marketing-dash";
import { MarketingDashboard } from "@/components/marketing/marketing-dashboard";
import { FinanceDashboard } from "@/components/finance/finance-dashboard";
import { todayISO } from "@/lib/format";
import { GroupIcon } from "@/components/group-icon";

/** Quick things to ask the assistant in each section (shown as chips under the chat). */
const STARTERS: Record<string, string[]> = {
  finance: ["logSale", "addExpense", "addTask"], marketing: ["planPost", "logDm", "addTask"], customer: ["addProspect", "logProblem", "addTask"],
  communications: ["recordDecision", "addTask"], "team-leader": ["whatsLate", "recordDecision", "addTask"],
};

/** The hero's buttons per group: the first is the main action. `edit` = only for people who can edit this group. */
const ACTIONS: Record<string, { key: string; tab?: string; href?: string; edit?: boolean }[]> = {
  finance: [{ key: "logSale", tab: "books", edit: true }, { key: "ledgers", tab: "ledgers" }, { key: "overview", tab: "money" }],
  marketing: [{ key: "newContent", tab: "content" }, { key: "myWeek", tab: "my-week" }, { key: "pulse", tab: "pulse" }],
  customer: [{ key: "prospects", tab: "sales" }, { key: "findClients", href: "/scout" }, { key: "complaints", tab: "complaints" }],
  communications: [{ key: "decisions", tab: "decisions" }, { key: "morale", tab: "morale" }, { key: "board", tab: "board" }],
  "team-leader": [{ key: "health", tab: "health" }, { key: "generalBoard", href: "/board" }, { key: "outreach", tab: "outreach" }],
};

const TOOLS: Record<string, (p: ToolProps) => Promise<ToolTab[]>> = {
  finance: FinanceTools,
  customer: CustomerTools,
  marketing: MarketingTools,
  communications: CommunicationsTools,
  "team-leader": TeamLeaderTools,
};

export default async function GroupPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const t = await getTranslations("group");
  const session = await getSession();
  const group = session.groups.find((g) => g.slug === slug);
  if (!group) notFound();

  const [board, kpis] = await Promise.all([
    loadBoard(slug),
    loadKpis(session.groups.find((g) => g.slug === "customer")?.id),
  ]);
  if (!board) notFound();
  const members = board.members.filter((m) => m.group_id === group.id);
  const editable = session.canEditGroup(group.id);
  const Tools = TOOLS[slug];
  const props: ToolProps = { group, editable, session, allMembers: board.members };
  const groupKpis = kpis.filter((k) => k.group_id === group.id);
  const tt = await getTranslations("tools");
  const th = await getTranslations("hero");
  const toolTabs = Tools ? await Tools(props) : [];
  const ta = await getTranslations("assist");
  const { data: aiKey } = await (await createClient()).from("ai_keys").select("last4").maybeSingle();
  const financeDash = slug === "finance" ? await loadFinanceDash(todayISO()) : null;
  const marketingDash = slug === "marketing" ? await loadMarketingDash() : null;
  // Team leader only: give tasks to everyone / several people / yourself (only leaders and admins see this tool)
  const tk = await getTranslations("teamTasks");
  const assignTool = slug === "team-leader" && session.isAdmin ? [{
    id: "assign", group: "work" as const, label: tk("tool"), icon: <ListChecks size={16} />,
    node: <AssignTasks tasks={await loadTeamTasks(undefined, undefined, true)} people={board.members} meId={session.me.id} projects={await loadProjectPeople(await createClient())}
                       teams={session.groups.map((g) => ({ id: g.id, name: t(`names.${g.slug}`) }))} />,
  }] : [];
  // Team leader only: company documents everyone can open on their own profile
  const td = await getTranslations("documents");
  const docsTool = slug === "team-leader" && session.isAdmin ? [{
    id: "documents", group: "work" as const, label: td("tool"), icon: <FolderOpen size={16} />,
    node: <div className="space-y-3"><StorageBar /><Drive scope="company" canEdit meId={session.me.id} /></div>,
  }] : [];
  // Team leader only: every project, and where new projects are created
  const tp = await getTranslations("projects");
  const projectsTool = slug === "team-leader" && session.isAdmin ? [{
    id: "projects", group: "work" as const, label: tp("allTitle"), icon: <FolderKanban size={16} />,
    node: <MyProjects projects={await loadMyProjects(await createClient(), session.me.id, true)} canCreate people={board.members} today={todayISO()} title={tp("allTitle")} />,
  }] : [];
  const allTools = [
    ...assignTool,
    ...projectsTool,
    ...docsTool,
    { id: "board", group: "work", label: t("board"), icon: <KanbanSquare size={16} />, node: <Suspense><Board data={board} viewer={session.viewer} /></Suspense> },
    ...toolTabs,
    ...(slug !== "team-leader" ? [{ id: "blockers", group: "work" as const, label: tt("blockers.title"), node: await BlockersTool({ ...props, onlyThisGroup: true }) }] : []),
  ];
  const hero = await groupHero(slug, session.me.id, group.id, todayISO());
  const firstName = session.me.full_name.split(" ")[0];
  const assistantNode = (
          <SectionAssistant section={slug} greeting={ta("greeting", { name: firstName, section: t(`names.${slug}`) })} helper={ta("helper")} groupId={group.id} boardId={board.board.id} listId={[...board.lists].sort((a, b) => a.position - b.position)[0]?.id ?? null}
                            meId={session.me.id} hasKey={!!aiKey} tools={allTools.map((x) => ({ id: x.id, label: x.label }))}
                            starters={[
                              ...hero.needs.slice(0, 2).map((n) => ({ label: th(`needs.${n.key}`, { count: n.count, ...(n.values ?? {}) }), tab: n.tab })),
                              ...(STARTERS[slug] ?? []).map((k) => ({ label: ta(`starters.${k}`), prompt: ta(`starterPrompts.${k}`) })),
                            ].slice(0, 5)} />
  );
  const heroKey = ["finance", "marketing", "customer", "communications", "team-leader"].includes(slug) ? slug : "default";

  return (
    <div className="space-y-6">
      <LiveRefresh tables={[...BOARD_TABLES, "kpi_targets", "blockers", "sales", "expenses", "inventory", "prospects",
        "complaints", "content_posts", "campaigns", "design_requests", "experiments", "follower_snapshots",
        "decisions", "morale_checks", "meeting_notes", "outreach", "profiles", "team_tasks", "team_task_people"]} />

      <ToolWorkspace initial={tab} groups={{ work: th("tabGroups.work"), plan: th("tabGroups.plan"), numbers: th("tabGroups.numbers"), people: th("tabGroups.people") }}
        tools={[{ id: "overview", group: "overview", label: th("overviewTool"), icon: <LayoutDashboard size={16} />, node: (
          <div className="space-y-6">
      {slug === "marketing" && marketingDash ? (
        <MarketingDashboard d={marketingDash} />
      ) : slug === "finance" && financeDash ? (
        <FinanceDashboard d={financeDash} canEdit={editable} />
      ) : (
        <PageHero
        section={{ label: th("teamLabel"), icon: <GroupIcon slug={slug} size={14} />, color: group.color }}
        title={t(`names.${slug}`)}
        subtitle={th(`groups.${heroKey}.subtitle`)}
        lines={hero.needs.length ? hero.needs.map((n) => ({
          text: th(`needs.${n.key}`, { count: n.count, ...(n.values ?? {}) }), tone: n.tone,
          href: n.href ?? (n.tab ? `/g/${slug}?tab=${n.tab}` : undefined),
        })) : [{ text: th("allClear"), tone: "ok" as const }]}
        stats={hero.stats.map((x) => ({ label: th(`stats.${x.key}`), value: x.value, kind: x.kind }))}
        actions={(ACTIONS[slug] ?? []).filter((a) => !a.edit || editable).map((a, i) => ({ label: th(`actions.${a.key}`), href: a.href ?? `/g/${slug}?tab=${a.tab}`, primary: i === 0 }))}
        visual={slug === "communications" ? <MemberOrbit slug={slug} color={group.color} people={members} /> : undefined}
        visualTitle={slug === "communications" ? th(`series.${hero.seriesKey}`) : undefined}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex -space-x-2">
              {members.slice(0, 6).map((m) => <span key={m.id} title={m.full_name} className="rounded-full ring-2 ring-surface"><Avatar name={m.full_name} src={m.avatar_url} size={28} /></span>)}
            </div>
            <span className="text-sm text-muted">{members.length ? members.map((m) => m.full_name.split(" ")[0]).join(", ") : t("noMembers")}</span>
            {session.me.group_id === group.id && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">{t("yourTeam")}</span>}
            {!editable && <ViewOnlyBadge />}
          </div>
        }
      />
      )}

      {groupKpis.length > 0 && (
        <section className="panel p-4 sm:p-5">
          <KpiCards kpis={groupKpis} canEdit={editable} inline />
        </section>
      )}

          </div>
        ) }, ...allTools]} />

      <AssistantBubble label={ta("bubble")}>{assistantNode}</AssistantBubble>
    </div>
  );
}
