import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Field, type Row } from "@/components/data-table";
import { StatusPill } from "@/components/status";
import { onTimeRate, groupHealth, type CardLite } from "@/lib/metrics";
import { pct, todayISO } from "@/lib/format";
import { trainingWeeks, mondayOf } from "@/lib/daily-brief";
import { BlockersTool } from "./blockers";
import { TrainingLeaders } from "./training-leaders";
import type { ToolProps, ToolTab } from "./types";

export async function TeamLeaderTools(props: ToolProps): Promise<ToolTab[]> {
  const { editable, session, allMembers } = props;
  const t = await getTranslations("tools");
  const tg = await getTranslations("group.names");
  const locale = await getLocale();
  const supabase = await createClient();
  const today = todayISO();
  const [notes, outreach, cards, boards, blockers, training] = await Promise.all([
    supabase.from("meeting_notes").select("*").order("meeting_date", { ascending: false }).returns<Row[]>(),
    supabase.from("outreach").select("*").order("updated_at", { ascending: false }).returns<Row[]>(),
    supabase.from("cards").select("board_id, due_at, completed_at").returns<CardLite[]>(),
    supabase.from("boards").select("id, group_id").is("owner_id", null),
    supabase.from("blockers").select("group_id").eq("status", "open"),
    supabase.from("training_leaders").select("week_start, user_id").gte("week_start", mondayOf(today)).order("created_at"),
  ]);

  const boardGroup = new Map((boards.data ?? []).map((b) => [b.id as string, b.group_id as string | null]));
  // Team numbers leave out people's own private boards
  const allCards = (cards.data ?? []).filter((c) => boardGroup.has(c.board_id));
  const teamWide = onTimeRate(allCards);
  const perGroup = [
    { key: "general", label: `🏢 ${t("leader.general")}`, cards: allCards.filter((c) => boardGroup.get(c.board_id) === null), blockers: 0 },
    ...session.groups.map((g) => ({
      key: g.id, label: `${g.emoji} ${tg(g.slug)}`,
      cards: allCards.filter((c) => boardGroup.get(c.board_id) === g.id),
      blockers: (blockers.data ?? []).filter((b) => b.group_id === g.id).length,
    })),
  ];

  const noteFields: Field[] = [
    { key: "meeting_date", label: t("fields.date"), type: "date", required: true },
    { key: "notes", label: t("fields.notesAndActions"), type: "textarea", required: true },
    { key: "created_by", label: t("fields.writtenBy"), type: "person", form: false },
  ];
  const outreachFields: Field[] = [
    { key: "contact", label: t("fields.contactPerson"), type: "text", required: true },
    { key: "kind", label: t("fields.type"), type: "select", required: true, options: [
      { value: "school", label: t("outreachKinds.school") }, { value: "upperclassmen", label: t("outreachKinds.upperclassmen") }, { value: "other", label: t("outreachKinds.other") },
    ] },
    { key: "status", label: t("fields.status"), type: "select", required: true, options: [
      { value: "to_contact", label: t("status.toContact") }, { value: "contacted", label: t("status.contacted") },
      { value: "replied", label: t("status.replied") }, { value: "done", label: t("status.done") },
    ] },
    { key: "owner_id", label: t("fields.owner"), type: "person" },
    { key: "notes", label: t("fields.notes"), type: "textarea" },
  ];

  return [
    {
      id: "health", group: "numbers", label: t("leader.onTime"),
      node: (
        <div className="space-y-4">
          <div className="panel">
            <header className="px-5 pt-4 pb-3">
              <h3 className="font-semibold">{t("leader.onTime")}</h3>
              <p className="text-xs text-muted">{t("leader.onTimeHint", { rate: pct(teamWide.rate, locale) })}</p>
            </header>
            <ul className="divide-y divide-line border-t border-line">
              {perGroup.map((g) => {
                const r = onTimeRate(g.cards);
                return (
                  <li key={g.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                    <span className="flex-1">{g.label}</span>
                    <span className="tabular-nums text-muted">{t("leader.counts", { onTime: r.onTime, late: r.late, overdue: r.overdueOpen })}</span>
                    <span className="w-12 text-right font-medium tabular-nums">{pct(r.rate, locale)}</span>
                    <StatusPill status={groupHealth(r.overdueOpen, g.blockers, r.rate)} />
                  </li>
                );
              })}
            </ul>
          </div>
          {await BlockersTool(props)}
        </div>
      ),
    },
    {
      id: "training", group: "people", label: t("leader.training"),
      node: <TrainingLeaders weeks={trainingWeeks(today)} leaders={training.data ?? []} members={allMembers} thisWeek={mondayOf(today)} canEdit={session.isLeader} />,
    },
    {
      id: "meetings", group: "plan", label: t("leader.meetings"),
      node: (
        <DataTable table="meeting_notes" title={t("leader.meetings")} rows={notes.data ?? []} fields={noteFields} members={allMembers}
                   canEdit={editable} defaults={{ created_by: session.me.id, meeting_date: new Date().toISOString().slice(0, 10) }}
                   emptyText={t("leader.meetingsEmpty")} addLabel={t("leader.addMeeting")} />
      ),
    },
    {
      id: "outreach", group: "people", label: t("leader.outreach"),
      node: (
        <DataTable table="outreach" title={t("leader.outreach")} rows={outreach.data ?? []} fields={outreachFields} members={allMembers}
                   canEdit={editable} defaults={{ owner_id: session.me.id, kind: "school", status: "to_contact" }}
                   emptyText={t("leader.outreachEmpty")} addLabel={t("leader.addOutreach")} />
      ),
    },
  ];
}
