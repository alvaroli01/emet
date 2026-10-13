import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Field, type Row } from "@/components/data-table";
import { loadKpis } from "@/lib/kpi-data";
import { weekStart } from "@/lib/metrics";
import { Scorecard } from "./scorecard";
import { MoraleCheck } from "./morale";
import type { ToolProps } from "./types";

export async function CommunicationsTools({ group, editable, session, allMembers }: ToolProps) {
  const t = await getTranslations("tools");
  const tg = await getTranslations("group.names");
  const supabase = await createClient();
  const week = weekStart(Date.now());
  const [kpis, decisions, weekly, mine, comments] = await Promise.all([
    loadKpis(session.groups.find((g) => g.slug === "customer")?.id),
    supabase.from("decisions").select("*").order("date", { ascending: false }).returns<Row[]>(),
    supabase.rpc("morale_weekly"),
    supabase.from("morale_checks").select("score, comment").eq("week_start", week).eq("user_id", session.me.id).maybeSingle(),
    // RLS: only Communications + admins get other people's rows back
    editable
      ? supabase.from("morale_checks").select("id, week_start, user_id, score, comment").not("comment", "is", null)
          .order("week_start", { ascending: false }).limit(30)
      : Promise.resolve({ data: [] }),
  ]);

  const decisionFields: Field[] = [
    { key: "date", label: t("fields.date"), type: "date", required: true },
    { key: "decision", label: t("fields.decision"), type: "textarea", required: true },
    { key: "decided_by", label: t("fields.decidedBy"), type: "text" },
    { key: "group_id", label: t("fields.group"), type: "select",
      options: session.groups.map((g) => ({ value: g.id, label: `${g.emoji} ${tg(g.slug)}` })) },
  ];

  return (
    <section className="space-y-4">
      <h2 className="font-semibold">🗂️ {t("comms.title")}</h2>
      <Scorecard kpis={kpis} groups={session.groups} />
      <DataTable table="decisions" title={t("comms.decisions")} rows={decisions.data ?? []} fields={decisionFields}
                 members={allMembers} canEdit={editable} defaults={{ date: new Date().toISOString().slice(0, 10), group_id: group.id }}
                 emptyText={t("comms.decisionsEmpty")} addLabel={t("comms.addDecision")} />
      <MoraleCheck
        week={week}
        meId={session.me.id}
        mine={mine.data as { score: number; comment: string | null } | null}
        weekly={(weekly.data as { week_start: string; avg_score: number; responses: number }[] | null) ?? []}
        comments={(comments.data as { id: string; week_start: string; user_id: string; score: number; comment: string }[] | null) ?? []}
        canSeeComments={editable}
        members={allMembers}
      />
    </section>
  );
}
