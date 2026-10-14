import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Field, type Row } from "@/components/data-table";
import { weekStart } from "@/lib/metrics";
import { FollowersChart } from "./followers-chart";
import type { ToolProps, ToolTab } from "./types";

export const PLATFORMS = ["Instagram", "TikTok", "LinkedIn", "Facebook", "YouTube", "X", "Other"];

export async function MarketingTools({ editable, session, allMembers }: ToolProps): Promise<ToolTab[]> {
  const t = await getTranslations("tools");
  const supabase = await createClient();
  const [posts, campaigns, designs, experiments, followers] = await Promise.all([
    supabase.from("content_posts").select("*").order("planned_for", { ascending: true, nullsFirst: false }).returns<Row[]>(),
    supabase.from("campaigns").select("*").order("starts_on", { ascending: false, nullsFirst: true }).returns<Row[]>(),
    supabase.from("design_requests").select("*").order("status").order("requested_at", { ascending: false }).returns<Row[]>(),
    supabase.from("experiments").select("*").order("created_at", { ascending: false }).returns<Row[]>(),
    supabase.from("follower_snapshots").select("*").order("week_start", { ascending: false }).returns<Row[]>(),
  ]);

  const platformOptions = PLATFORMS.map((p) => ({ value: p, label: p }));
  const week = weekStart(Date.now());
  const thisWeek = (posts.data ?? []).filter((p) => p.planned_for && weekStart(String(p.planned_for)) === week);
  const posted = thisWeek.filter((p) => p.status === "posted").length;

  const postFields: Field[] = [
    { key: "planned_for", label: t("fields.plannedFor"), type: "date", required: true },
    { key: "platform", label: t("fields.platform"), type: "select", options: platformOptions, required: true },
    { key: "title", label: t("fields.content"), type: "text", required: true },
    { key: "status", label: t("fields.status"), type: "select", required: true, options: [
      { value: "idea", label: t("status.idea") }, { value: "planned", label: t("status.planned") }, { value: "posted", label: t("status.posted") },
    ] },
    { key: "owner_id", label: t("fields.owner"), type: "person" },
  ];
  const campaignFields: Field[] = [
    { key: "name", label: t("fields.campaign"), type: "text", required: true },
    { key: "product", label: t("fields.product"), type: "text" },
    { key: "status", label: t("fields.status"), type: "select", required: true, options: [
      { value: "planned", label: t("status.planned") }, { value: "live", label: t("status.live") }, { value: "done", label: t("status.done") },
    ] },
    { key: "starts_on", label: t("fields.starts"), type: "date" },
    { key: "ends_on", label: t("fields.ends"), type: "date" },
    { key: "owner_id", label: t("fields.owner"), type: "person" },
    { key: "notes", label: t("fields.notes"), type: "textarea", list: false },
  ];
  const designFields: Field[] = [
    { key: "title", label: t("fields.request"), type: "text", required: true },
    { key: "details", label: t("fields.details"), type: "textarea", list: false },
    { key: "requested_by", label: t("fields.requestedBy"), type: "person", form: false },
    { key: "assignee_id", label: t("fields.designer"), type: "person" },
    { key: "status", label: t("fields.status"), type: "select", required: true, options: [
      { value: "open", label: t("status.open") }, { value: "in_progress", label: t("status.inProgress") }, { value: "delivered", label: t("status.delivered") },
    ] },
    { key: "timer", label: t("fields.timer48"), type: "timer", start: "requested_at", end: "delivered_at", hours: 48 },
  ];
  const experimentFields: Field[] = [
    { key: "hypothesis", label: t("fields.hypothesis"), type: "textarea", required: true },
    { key: "test", label: t("fields.test"), type: "textarea" },
    { key: "result", label: t("fields.result"), type: "textarea" },
    { key: "decision", label: t("fields.decision"), type: "text" },
    { key: "owner_id", label: t("fields.owner"), type: "person" },
  ];
  const followerFields: Field[] = [
    { key: "week_start", label: t("fields.week"), type: "date", required: true },
    { key: "platform", label: t("fields.platform"), type: "select", options: platformOptions, required: true },
    { key: "followers", label: t("fields.followers"), type: "number", required: true },
  ];

  return [
    {
      id: "content", label: t("marketing.calendar"),
      node: (
        <DataTable table="content_posts" title={t("marketing.calendar")} rows={posts.data ?? []} fields={postFields} members={allMembers}
                   canEdit={editable} defaults={{ owner_id: session.me.id, status: "planned" }}
                   emptyText={t("marketing.calendarEmpty")} addLabel={t("marketing.addPost")}
                   footer={<span className="text-muted">{t("marketing.thisWeek", { planned: thisWeek.length, posted })}</span>} />
      ),
    },
    {
      id: "campaigns", label: t("marketing.campaigns"),
      node: (
        <div className="space-y-4">
          <DataTable table="campaigns" title={t("marketing.campaigns")} rows={campaigns.data ?? []} fields={campaignFields} members={allMembers}
                     canEdit={editable} defaults={{ owner_id: session.me.id, status: "planned" }}
                     emptyText={t("marketing.campaignsEmpty")} addLabel={t("marketing.addCampaign")} />
          <DataTable table="experiments" title={t("marketing.experiments")} rows={experiments.data ?? []} fields={experimentFields} members={allMembers}
                     canEdit={editable} defaults={{ owner_id: session.me.id }}
                     emptyText={t("marketing.experimentsEmpty")} addLabel={t("marketing.addExperiment")} />
        </div>
      ),
    },
    {
      id: "followers", label: t("marketing.followerGrowth"),
      node: (
        <div className="space-y-4">
          <div className="panel p-5">
            <FollowersChart rows={(followers.data ?? []) as unknown as { platform: string; week_start: string; followers: number }[]} />
          </div>
          <DataTable table="follower_snapshots" title={t("marketing.followers")} rows={followers.data ?? []} fields={followerFields}
                     members={allMembers} canEdit={editable} defaults={{ week_start: week }}
                     emptyText={t("marketing.followersEmpty")} addLabel={t("marketing.addFollowers")} />
        </div>
      ),
    },
    {
      id: "design", label: t("marketing.designQueue"),
      node: (
        <DataTable table="design_requests" title={t("marketing.designQueue")} rows={designs.data ?? []} fields={designFields} members={allMembers}
                   canEdit={editable} canAdd addFields={["title", "details"]}
                   defaults={{ requested_by: session.me.id, status: "open" }}
                   emptyText={t("marketing.designEmpty")} addLabel={t("marketing.requestDesign")} />
      ),
    },
  ];
}
