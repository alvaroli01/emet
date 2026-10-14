import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Field, type Row } from "@/components/data-table";
import type { ToolProps } from "./types";

/** Blockers: one group's on its tab; every group's on the Team Leader tab. */
export async function BlockersTool({ group, editable, session, allMembers, onlyThisGroup }: ToolProps & { onlyThisGroup?: boolean }) {
  const t = await getTranslations("tools");
  const supabase = await createClient();
  let q = supabase.from("blockers").select("*").order("status").order("created_at", { ascending: false });
  if (onlyThisGroup) q = q.eq("group_id", group.id);
  const { data } = await q.returns<Row[]>();
  const tg = await getTranslations("group.names");

  const fields: Field[] = [
    { key: "description", label: t("fields.blocker"), type: "textarea", required: true },
    ...(onlyThisGroup ? [] : [{
      key: "group_id", label: t("fields.group"), type: "select", required: true,
      options: session.groups.map((g) => ({ value: g.id, label: `${g.emoji} ${tg(g.slug)}` })),
    } as Field]),
    { key: "owner_id", label: t("fields.owner"), type: "person" },
    { key: "status", label: t("fields.status"), type: "select", required: true,
      options: [{ value: "open", label: t("status.open") }, { value: "resolved", label: t("status.resolved") }] },
    { key: "created_at", label: t("fields.raised"), type: "datetime", form: false },
  ];

  return (
    <DataTable table="blockers" title={t("blockers.title")} rows={data ?? []} fields={fields} members={allMembers}
               canEdit={onlyThisGroup ? editable : session.isAdmin}
               defaults={onlyThisGroup ? { group_id: group.id } : {}}
               emptyText={t("blockers.empty")} addLabel={t("blockers.add")} />
  );
}
