import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { DataTable, type Field, type Row } from "@/components/data-table";
import { weekStart, totals } from "@/lib/metrics";
import { todayISO } from "@/lib/format";
import type { Content, Metric, SaleAttr } from "@/lib/marketing";
import { Pulse } from "@/components/marketing/pulse";
import { ContentPipeline } from "@/components/marketing/content";
import { Briefs, type Brief } from "@/components/marketing/briefs";
import { Campaigns, type Campaign } from "@/components/marketing/campaigns";
import { Library } from "@/components/marketing/library";
import { Attribution, type GoLink } from "@/components/marketing/attribution";
import { MyWeek } from "@/components/marketing/my-week";
import { FollowersChart } from "./followers-chart";
import type { ToolProps, ToolTab } from "./types";

export const PLATFORMS = ["Instagram", "TikTok", "LinkedIn", "Facebook", "YouTube", "X", "Other"];
export const HEARD_ABOUT = ["instagram", "tiktok", "friend", "stall", "whatsapp", "ambassador", "poster", "other"] as const;

export async function MarketingTools({ group, editable, session, allMembers }: ToolProps): Promise<ToolTab[]> {
  const t = await getTranslations("tools");
  const tm = await getTranslations("marketing");
  const supabase = await createClient();
  const today = todayISO();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();
  const [items, metrics, glossary, briefs, campaigns, designs, experiments, followers, links, clicks, codes, sales, expenses, inquiries, swipes] = await Promise.all([
    supabase.from("content_items").select("*").order("planned_for", { ascending: true, nullsFirst: false }),
    supabase.from("content_metrics").select("*"),
    supabase.from("tag_glossary").select("tag_type, value").order("value"),
    supabase.from("briefs").select("*").order("created_at", { ascending: false }),
    supabase.from("campaigns").select("*").order("starts_on", { ascending: false, nullsFirst: true }),
    supabase.from("design_requests").select("*").order("status").order("requested_at", { ascending: false }).returns<Row[]>(),
    supabase.from("experiments").select("*").order("created_at", { ascending: false }).returns<Row[]>(),
    supabase.from("follower_snapshots").select("*").order("week_start", { ascending: false }).returns<Row[]>(),
    supabase.from("go_links").select("*").order("created_at", { ascending: false }),
    supabase.from("go_clicks").select("link_id, at").gte("at", since30),
    supabase.from("discount_codes").select("*").order("created_at", { ascending: false }).returns<Row[]>(),
    supabase.from("sales").select("date, amount, cost, heard_about, code, utm_source, reverses_id"),
    supabase.from("expenses").select("date, amount"),
    supabase.from("inquiries").select("*").order("date", { ascending: false }).returns<Row[]>(),
    supabase.from("swipe_file").select("*").order("created_at", { ascending: false }).returns<Row[]>(),
  ]);

  const me = session.me.id;
  const c = (items.data ?? []) as Content[];
  const m = (metrics.data ?? []) as Metric[];
  const s = (sales.data ?? []) as (SaleAttr & { date: string; cost: number | string })[];
  const codeChannel = Object.fromEntries((codes.data ?? []).map((x) => [String(x.code), String(x.channel)]));
  const profit = totals(s, expenses.data ?? []).profit;
  const members = allMembers.map((x) => ({ id: x.id, full_name: x.full_name }));
  const marketingPeople = allMembers.filter((x) => (x as { group_id?: string | null }).group_id === group.id);
  const leaderId = (marketingPeople.find((x) => /lead|líder|jefe/i.test((x as { role_title?: string | null }).role_title ?? "")) ?? null)?.id ?? null;
  const camp = (campaigns.data ?? []) as Campaign[];
  const host = (await headers()).get("host") ?? "emet-hq.vercel.app";
  const origin = `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;

  // Clicks per link (all of the last 30 days + last 7)
  const clickMap: Record<string, { total: number; week: number }> = {};
  const wk = Date.now() - 7 * 864e5;
  for (const k of clicks.data ?? []) {
    const e = (clickMap[k.link_id] ??= { total: 0, week: 0 });
    e.total++; if (Date.parse(k.at) >= wk) e.week++;
  }
  // Funnel, last 30 days
  const recent = c.filter((x) => x.posted_at && x.posted_at >= since30);
  const best = (id: string) => [168, 48, 24].map((a) => m.find((y) => y.content_id === id && y.age_hours === a)).find(Boolean);
  const sum = (k: keyof Metric) => recent.reduce((a, x) => a + Number(best(x.id)?.[k] ?? 0), 0);
  const inq30 = (inquiries.data ?? []).filter((x) => String(x.date) >= since30.slice(0, 10));
  const funnel = [
    { key: "views", value: sum("views") },
    { key: "profile", value: sum("profile_visits") },
    { key: "clicks", value: Math.max(sum("link_clicks"), (clicks.data ?? []).length) },
    { key: "inquiries", value: inq30.length },
    { key: "orders", value: s.filter((x) => x.date >= since30.slice(0, 10) && Number(x.amount) > 0 && !x.reverses_id).length },
  ];

  const platformOptions = PLATFORMS.map((p) => ({ value: p, label: p }));
  const week = weekStart(Date.now());
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
    { key: "hypothesis", label: t("fields.hypothesis"), type: "textarea", required: true, placeholder: tm("experiments.phHypothesis") },
    { key: "variable", label: tm("experiments.variable"), type: "text", placeholder: tm("experiments.phVariable") },
    { key: "test", label: t("fields.test"), type: "textarea", list: false },
    { key: "baseline", label: tm("experiments.baseline"), type: "number" },
    { key: "result_value", label: tm("experiments.result"), type: "number" },
    { key: "verdict", label: tm("experiments.verdict"), type: "select", options: ["better", "unclear", "worse"].map((v) => ({ value: v, label: tm(`experiments.v.${v}`) })) },
    { key: "decision", label: t("fields.decision"), type: "text", placeholder: tm("experiments.phDecision") },
    { key: "owner_id", label: t("fields.owner"), type: "person" },
  ];
  const followerFields: Field[] = [
    { key: "week_start", label: t("fields.week"), type: "date", required: true },
    { key: "platform", label: t("fields.platform"), type: "select", options: platformOptions, required: true },
    { key: "followers", label: t("fields.followers"), type: "number", required: true },
  ];
  const codeFields: Field[] = [
    { key: "code", label: tm("codes.code"), type: "text", required: true, placeholder: "STALL10" },
    { key: "channel", label: tm("codes.channel"), type: "select", required: true, options: HEARD_ABOUT.map((h) => ({ value: h, label: tm(`heard.${h}`) })) },
    { key: "label", label: tm("codes.label"), type: "text" },
    { key: "active", label: tm("codes.active"), type: "bool" },
  ];
  const inquiryFields: Field[] = [
    { key: "date", label: t("fields.date"), type: "date", required: true },
    { key: "platform", label: t("fields.platform"), type: "select", options: platformOptions.map((o) => ({ value: o.value.toLowerCase(), label: o.label })) },
    { key: "handle", label: tm("inquiries.handle"), type: "text", placeholder: "@…" },
    { key: "product", label: t("fields.product"), type: "text" },
    { key: "owner_id", label: t("fields.owner"), type: "person" },
  ];
  const swipeFields: Field[] = [
    { key: "title", label: tm("swipe.title"), type: "text", required: true },
    { key: "url", label: "URL", type: "text", placeholder: "https://" },
    { key: "notes", label: tm("swipe.notes"), type: "textarea", placeholder: tm("swipe.phNotes") },
    { key: "is_competitor", label: tm("swipe.competitor"), type: "bool" },
  ];
  // Codes usage: how many sales used each code
  const codeUse = new Map<string, number>();
  for (const x of s) if (x.code) codeUse.set(x.code, (codeUse.get(x.code) ?? 0) + 1);

  return [
    {
      id: "pulse", group: "numbers", label: tm("tabs.pulse"),
      node: <Pulse items={c} metrics={m} sales={s} profit={profit} codeChannel={codeChannel} today={today}
                   inquiries={(inquiries.data ?? []) as unknown as { date: string; converted_sale_id: string | null }[]} />,
    },
    {
      id: "my-week", group: "work", label: tm("tabs.myWeek"),
      node: <MyWeek me={me} items={c} metrics={m} today={today}
                    briefs={(briefs.data ?? []) as Brief[]}
                    designs={(designs.data ?? []) as unknown as { id: string; title: string; status: string; assignee_id: string | null; requested_at: string }[]} />,
    },
    {
      id: "content", group: "plan", label: tm("tabs.content"),
      node: <ContentPipeline items={c} metrics={m} glossary={(glossary.data ?? []) as { tag_type: Content["tags"] extends Partial<Record<infer K, string>> ? K : never; value: string }[]}
                             members={members} canEdit={editable} me={me} campaigns={camp.map((x) => ({ id: x.id, name: x.name }))} />,
    },
    {
      id: "briefs", group: "plan", label: tm("tabs.briefs"),
      node: (
        <div className="space-y-6">
          <Briefs briefs={(briefs.data ?? []) as Brief[]} members={members} campaigns={camp} canEdit={editable} me={me} leaderId={leaderId} />
          <Campaigns title={tm("tabs.campaigns")} campaigns={camp} items={c} metrics={m} members={members} canEdit={editable} me={me} />
        </div>
      ),
    },
    {
      id: "library", group: "numbers", label: tm("tabs.library"),
      node: (
        <div className="space-y-4">
          <Library items={c} metrics={m} />
          <DataTable table="experiments" title={tm("tabs.experiments")} rows={experiments.data ?? []} fields={experimentFields} members={allMembers}
                     canEdit={editable} defaults={{ owner_id: me }} emptyText={t("marketing.experimentsEmpty")} addLabel={t("marketing.addExperiment")} />
          <DataTable table="swipe_file" title={tm("swipe.heading")} rows={swipes.data ?? []} fields={swipeFields} members={allMembers}
                     canEdit={editable} emptyText={tm("swipe.empty")} addLabel={tm("swipe.add")} />
        </div>
      ),
    },
    {
      id: "attribution", group: "numbers", label: tm("tabs.attribution"),
      node: (
        <div className="space-y-4">
          <Attribution links={(links.data ?? []) as GoLink[]} clicks={clickMap} sales={s.filter((x) => Number(x.amount) > 0 && !x.reverses_id)} codeChannel={codeChannel}
                       funnel={funnel} canEdit={editable} origin={origin} />
          <DataTable table="discount_codes" title={tm("codes.heading")} rows={(codes.data ?? []).map((x) => ({ ...x, id: String(x.code), used: codeUse.get(String(x.code)) ?? 0 }))}
                     fields={[...codeFields, { key: "used", label: tm("codes.used"), type: "number", form: false }]} members={allMembers} idKey="code"
                     canEdit={editable} defaults={{ active: true }} emptyText={tm("codes.empty")} addLabel={tm("codes.add")} />
          <DataTable table="inquiries" title={tm("inquiries.heading")} rows={inquiries.data ?? []} fields={inquiryFields} members={allMembers}
                     canEdit={editable} defaults={{ owner_id: me, date: today, platform: "instagram" }} emptyText={tm("inquiries.empty")} addLabel={tm("inquiries.add")} />
        </div>
      ),
    },
    {
      id: "followers", group: "numbers", label: t("marketing.followerGrowth"),
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
      id: "design", group: "work", label: t("marketing.designQueue"),
      node: (
        <DataTable table="design_requests" title={t("marketing.designQueue")} rows={designs.data ?? []} fields={designFields} members={allMembers}
                   canEdit={editable} canAdd addFields={["title", "details"]}
                   defaults={{ requested_by: me, status: "open" }}
                   emptyText={t("marketing.designEmpty")} addLabel={t("marketing.requestDesign")} />
      ),
    },
  ];
}
