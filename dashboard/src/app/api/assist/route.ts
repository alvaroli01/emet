import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ownRing } from "@/lib/ai/ring-server";
import { call, CONTEXT, LANG } from "@/lib/lab/ai";
import { groupHero } from "@/lib/hero-data";
import { KINDS, kindsFor, cleanActions, type FieldSpec } from "@/lib/assist/kinds";
import { todayISO } from "@/lib/format";

export const maxDuration = 60;

type Msg = { role: "user" | "assistant"; content: string };

/**
 * Section assistant: answers in the section's context (its live numbers, open items and tools) and may propose
 * records for the person to confirm, or a tool to open. It never writes anything itself.
 * Uses the caller's own Groq key and only data the caller can already read (their own session + RLS).
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { section?: string; messages?: Msg[]; tools?: { id: string; label: string }[] };
  const section = String(body.section ?? "");
  const messages = (body.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-10)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  const tools = (body.tools ?? []).filter((x) => /^[a-z-]{2,30}$/.test(x.id)).slice(0, 20);
  if (!messages.length || !["finance", "marketing", "customer", "communications", "team-leader"].includes(section)) return NextResponse.json({ error: "bad-request" }, { status: 400 });

  const sb = await createClient();
  const [{ data: me }, { data: keyRow }, { data: group }] = await Promise.all([
    sb.rpc("my_profile_id"), sb.from("ai_keys").select("key_iv, key_data").maybeSingle(), sb.from("groups").select("id, name").eq("slug", section).maybeSingle(),
  ]);
  if (!me || !group) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!keyRow) return NextResponse.json({ error: "no-key" }, { status: 400 });
  const today = todayISO();
  const locale = await getLocale();

  // What the assistant knows about this section right now
  const hero = await groupHero(section, me as string, group.id, today);
  const recent = await recentRows(sb, section);
  const kinds = kindsFor(section);
  const kindDoc = kinds.map((k) => `- ${k}: ${(KINDS[k].fields as readonly FieldSpec[]).map((f) => `${f.name}${f.required ? "*" : ""}${f.options ? ` (${f.options.join("|")})` : f.type === "money" ? " (number, euros)" : f.type === "date" ? " (YYYY-MM-DD)" : ""}`).join(", ")}`).join("\n");

  const system = `You are emet's assistant inside the ${group.name} section of the team dashboard. Today is ${today}.
${CONTEXT}
Help the person do their work in this section fast: answer briefly (max 4 short sentences), point them to the right tool, and when they want to add something, prepare it as an action they confirm with one tap.
Never invent numbers about the business: use only the SECTION DATA. If something is unknown, say so. Write in ${LANG[locale] ?? "English"}.

SECTION DATA
Needs attention: ${hero.needs.map((n) => `${n.key}=${n.count}`).join(", ") || "nothing"}
Key numbers: ${hero.stats.map((s) => `${s.key}=${s.value ?? "?"}`).join(", ")}
Recent items:
${recent || "(none)"}

TOOLS in this section (id: name): ${tools.map((x) => `${x.id}: ${x.label}`).join("; ")}

RECORDS you may prepare (fields, * = required):
${kindDoc}

Reply with JSON only:
{"reply": "your answer", "suggestions": ["2-3 short follow-up things they might say next, in their language"],
 "actions": [{"type":"create","kind":"<one of: ${kinds.join(", ")}>","values":{...}} or {"type":"open_tool","tab":"<tool id>"}]}
Only include a create action when they clearly asked to add/log/plan something and you have the required fields; otherwise ask for what is missing. A create action is only a draft: say it is ready and that they can tap "Add it" — never say it was saved or logged. Dates: resolve "today", "tomorrow", "friday" to YYYY-MM-DD.`;

  const r = await call(ownRing(me as string, keyRow), {
    reasoning_effort: "low", temperature: 0.3, response_format: { type: "json_object" },
    messages: [{ role: "system", content: system }, ...messages],
  });
  if (!("ok" in r)) return NextResponse.json(r, { status: r.error === "limit" ? 429 : r.error === "bad-key" ? 401 : 502 });
  let j: Record<string, unknown> = {};
  try { j = JSON.parse(String(r.message.content ?? "{}")); } catch { /* fall through */ }
  const reply = typeof j.reply === "string" ? j.reply.slice(0, 1500) : "";
  if (!reply) return NextResponse.json({ error: "failed" }, { status: 502 });
  const suggestions = Array.isArray(j.suggestions) ? j.suggestions.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 80)).slice(0, 3) : [];
  return NextResponse.json({ reply, suggestions, actions: cleanActions(section, j.actions, tools.map((x) => x.id)) });
}

type SB = Awaited<ReturnType<typeof createClient>>;
/** A few recent rows per section so answers are concrete (titles, amounts, dates — no personal contact data). */
async function recentRows(sb: SB, section: string): Promise<string> {
  const lines: string[] = [];
  if (section === "finance") {
    const [s, e] = await Promise.all([
      sb.from("sales").select("date, description, amount").order("date", { ascending: false }).limit(8),
      sb.from("expenses").select("date, description, amount, category").order("date", { ascending: false }).limit(5),
    ]);
    for (const x of s.data ?? []) lines.push(`sale ${x.date} ${x.description} €${x.amount}`);
    for (const x of e.data ?? []) lines.push(`expense ${x.date} ${x.description} €${x.amount} ${x.category ?? ""}`);
  } else if (section === "marketing") {
    const { data } = await sb.from("content_items").select("title, status, planned_for, posted_at").order("created_at", { ascending: false }).limit(10);
    for (const x of data ?? []) lines.push(`content "${x.title}" ${x.status}${x.planned_for ? ` planned ${x.planned_for}` : ""}`);
  } else if (section === "customer") {
    const [p, c] = await Promise.all([
      sb.from("prospects").select("name, stage, updated_at").order("updated_at", { ascending: false }).limit(10),
      sb.from("complaints").select("customer, issue, status").neq("status", "resolved").limit(5),
    ]);
    for (const x of p.data ?? []) lines.push(`prospect ${x.name} (${x.stage})`);
    for (const x of c.data ?? []) lines.push(`open problem: ${x.customer} — ${String(x.issue).slice(0, 80)}`);
  } else {
    const [d, b] = await Promise.all([
      sb.from("decisions").select("date, decision").order("date", { ascending: false }).limit(5),
      sb.from("blockers").select("description").eq("status", "open").limit(6),
    ]);
    for (const x of d.data ?? []) lines.push(`decision ${x.date}: ${String(x.decision).slice(0, 100)}`);
    for (const x of b.data ?? []) lines.push(`open blocker: ${String(x.description).slice(0, 100)}`);
  }
  return lines.join("\n");
}
