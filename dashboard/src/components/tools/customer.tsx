import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Field, type Row } from "@/components/data-table";
import { Avatar } from "@/components/ui";
import { weekStart } from "@/lib/metrics";
import { eur } from "@/lib/format";
import type { ToolProps, ToolTab } from "./types";

export const STAGES = ["new", "contacted", "interested", "won", "lost"] as const;
const PROSPECTS_PER_WEEK = 20;

export async function CustomerTools({ group, editable, session, allMembers }: ToolProps): Promise<ToolTab[]> {
  const t = await getTranslations("tools");
  const locale = await getLocale();
  const supabase = await createClient();
  const monthStart = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }).slice(0, 8) + "01";

  const [prospects, complaints, sales, target] = await Promise.all([
    supabase.from("prospects").select("*").order("updated_at", { ascending: false }).returns<Row[]>(),
    supabase.from("complaints").select("*").order("status").order("opened_at", { ascending: false }).returns<Row[]>(),
    supabase.from("sales").select("amount, rep_id, date").gte("date", monthStart),
    supabase.from("kpi_targets").select("target").eq("group_id", group.id).eq("metric", "Personal sales target").maybeSingle(),
  ]);

  const reps = allMembers.filter((m) => m.group_id === group.id);
  const personalTarget = target.data?.target === null || target.data?.target === undefined ? null : Number(target.data.target);
  const week = weekStart(Date.now());
  const p = (prospects.data ?? []) as unknown as { stage: string; owner_id: string | null; created_at: string }[];

  const stageOptions = STAGES.map((s) => ({ value: s, label: t(`stages.${s}`) }));
  const prospectFields: Field[] = [
    { key: "name", label: t("fields.name"), type: "text", required: true },
    { key: "contact", label: t("fields.contact"), type: "text", placeholder: "email / phone / @instagram" },
    { key: "stage", label: t("fields.stage"), type: "select", options: stageOptions, required: true },
    { key: "owner_id", label: t("fields.owner"), type: "person" },
    { key: "updated_at", label: t("fields.updated"), type: "date", form: false },
  ];
  const complaintFields: Field[] = [
    { key: "customer", label: t("fields.customer"), type: "text", required: true },
    { key: "issue", label: t("fields.issue"), type: "textarea", required: true },
    { key: "status", label: t("fields.status"), type: "select", required: true, options: [
      { value: "open", label: t("status.open") }, { value: "in_progress", label: t("status.inProgress") }, { value: "resolved", label: t("status.resolved") },
    ] },
    { key: "owner_id", label: t("fields.owner"), type: "person" },
    { key: "timer", label: t("fields.timer48"), type: "timer", start: "opened_at", end: "resolved_at", hours: 48 },
  ];

  return [
    {
      id: "sales", group: "work", label: t("customer.pipeline"),
      node: (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel p-5">
              <h3 className="font-semibold">{t("customer.repRevenue")}</h3>
              <p className="mb-3 text-xs text-muted">
                {t("customer.thisMonth")} · {t("customer.personalTarget")}: {personalTarget === null ? t("customer.tbd") : eur(personalTarget, locale)}
              </p>
              {reps.length ? (
                <ul className="space-y-3">
                  {reps.map((r) => {
                    const total = (sales.data ?? []).filter((s) => s.rep_id === r.id).reduce((a, s) => a + Number(s.amount), 0);
                    const share = personalTarget ? Math.min(1, total / personalTarget) : 0;
                    return (
                      <li key={r.id}>
                        <div className="flex items-center gap-2 text-sm">
                          <Avatar name={r.full_name} src={r.avatar_url} size={22} />
                          <span className="flex-1">{r.full_name}</span>
                          <span className="tabular-nums">{eur(total, locale)}</span>
                        </div>
                        {personalTarget !== null && (
                          <div className="mt-1.5 h-1.5 rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100}>
                            <div className="h-full rounded-full bg-series-1 transition-all" style={{ width: `${share * 100}%` }} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="text-sm text-muted">{t("customer.noReps")}</p>}
            </div>

            <div className="panel p-5">
              <h3 className="font-semibold">{t("customer.pipeline")}</h3>
              <p className="mb-3 text-xs text-muted">{t("customer.weeklyGoal", { count: PROSPECTS_PER_WEEK })}</p>
              <div className="mb-4 grid grid-cols-5 gap-1.5 text-center">
                {STAGES.map((s) => (
                  <div key={s} className="rounded-xl bg-surface-2 px-1 py-2">
                    <p className="text-lg font-semibold tabular-nums">{p.filter((x) => x.stage === s).length}</p>
                    <p className="text-[11px] text-muted">{t(`stages.${s}`)}</p>
                  </div>
                ))}
              </div>
              {reps.length > 0 && (
                <ul className="space-y-1.5 text-sm">
                  {reps.map((r) => {
                    const n = p.filter((x) => x.owner_id === r.id && weekStart(x.created_at) === week).length;
                    return (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <span>{r.full_name}</span>
                        <span className={`tabular-nums ${n >= PROSPECTS_PER_WEEK ? "font-medium text-ok-text" : "text-muted"}`}>
                          {t("customer.newThisWeek", { count: n, goal: PROSPECTS_PER_WEEK })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
          <DataTable table="prospects" title={t("customer.prospects")} rows={prospects.data ?? []} fields={prospectFields}
                     members={allMembers} canEdit={editable} defaults={{ owner_id: session.me.id, stage: "new" }}
                     emptyText={t("customer.prospectsEmpty")} addLabel={t("customer.addProspect")} />
        </div>
      ),
    },
    {
      id: "complaints", group: "work", label: t("customer.complaints"),
      node: (
        <DataTable table="complaints" title={t("customer.complaints")} rows={complaints.data ?? []} fields={complaintFields}
                   members={allMembers} canEdit={editable} defaults={{ owner_id: session.me.id, status: "open" }}
                   emptyText={t("customer.complaintsEmpty")} addLabel={t("customer.addComplaint")} />
      ),
    },
  ];
}
