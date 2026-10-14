// What the section assistant may prepare for a person to confirm. Pure (used on the server to clean the AI's
// proposals and in the browser to save them); the database's permission rules still decide who may write.

export type FieldSpec = { name: string; type: "text" | "money" | "date" | "select"; required?: boolean; options?: readonly string[]; max?: number };
export type Kind = { table: string; sections: readonly string[]; fields: readonly FieldSpec[]; tab?: string };

const PAY = ["cash", "bizum", "card", "transfer", "other"] as const;
const HEARD = ["instagram", "tiktok", "friend", "stall", "whatsapp", "ambassador", "poster", "other"] as const;
const ALL = ["finance", "marketing", "customer", "communications", "team-leader"] as const;

export const KINDS = {
  task: { table: "cards", sections: ALL, tab: "board", fields: [{ name: "title", type: "text", required: true, max: 160 }, { name: "due", type: "date" }] },
  sale: { table: "sales", sections: ["finance"], tab: "ledgers", fields: [
    { name: "description", type: "text", required: true, max: 160 }, { name: "amount", type: "money", required: true }, { name: "cost", type: "money" },
    { name: "date", type: "date" }, { name: "payment_method", type: "select", options: PAY }, { name: "heard_about", type: "select", options: HEARD }] },
  expense: { table: "expenses", sections: ["finance"], tab: "ledgers", fields: [
    { name: "description", type: "text", required: true, max: 160 }, { name: "amount", type: "money", required: true }, { name: "date", type: "date" },
    { name: "category", type: "select", options: ["stock", "marketing", "tools", "transport", "printing", "events", "other"] }, { name: "payment_method", type: "select", options: PAY }] },
  content: { table: "content_items", sections: ["marketing"], tab: "content", fields: [
    { name: "title", type: "text", required: true, max: 160 }, { name: "planned_for", type: "date" }, { name: "platform", type: "select", options: ["instagram", "tiktok", "other"] }] },
  inquiry: { table: "inquiries", sections: ["marketing", "customer"], tab: "attribution", fields: [
    { name: "handle", type: "text", max: 80 }, { name: "product", type: "text", max: 120 }, { name: "date", type: "date" }] },
  prospect: { table: "prospects", sections: ["customer"], tab: "sales", fields: [{ name: "name", type: "text", required: true, max: 120 }, { name: "contact", type: "text", max: 160 }] },
  complaint: { table: "complaints", sections: ["customer"], tab: "complaints", fields: [{ name: "customer", type: "text", required: true, max: 120 }, { name: "issue", type: "text", required: true, max: 400 }] },
  decision: { table: "decisions", sections: ["communications", "team-leader"], tab: "decisions", fields: [{ name: "decision", type: "text", required: true, max: 400 }, { name: "date", type: "date" }] },
  blocker: { table: "blockers", sections: ["finance", "marketing", "customer", "communications"], tab: "blockers", fields: [{ name: "description", type: "text", required: true, max: 300 }] },
} as const satisfies Record<string, Kind>;
export type KindName = keyof typeof KINDS;

export function kindsFor(section: string): KindName[] {
  return (Object.keys(KINDS) as KindName[]).filter((k) => (KINDS[k].sections as readonly string[]).includes(section));
}

/** Clean one proposed record: only known fields, right types, required ones present. null = unusable. */
export function cleanValues(kind: KindName, raw: unknown): Record<string, string | number> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: Record<string, string | number> = {};
  for (const f of KINDS[kind].fields as readonly FieldSpec[]) {
    const v = r[f.name];
    if (v === undefined || v === null || v === "") { if (f.required) return null; continue; }
    if (f.type === "money") {
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^\d.,-]/g, "").replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) { if (f.required) return null; continue; }
      out[f.name] = Math.round(n * 100) / 100;
    } else if (f.type === "date") {
      const s = String(v).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))) out[f.name] = s; else if (f.required) return null;
    } else if (f.type === "select") {
      const s = String(v).toLowerCase().trim();
      if (f.options?.includes(s)) out[f.name] = s; else if (f.required) return null;
    } else {
      const s = String(v).trim().slice(0, f.max ?? 200);
      if (s) out[f.name] = s; else if (f.required) return null;
    }
  }
  return out;
}

export type Action =
  | { type: "open_tool"; tab: string }
  | { type: "create"; kind: KindName; values: Record<string, string | number> };

/** Keep only actions this section allows, with cleaned values; at most 3. */
export function cleanActions(section: string, raw: unknown, tabs: string[]): Action[] {
  if (!Array.isArray(raw)) return [];
  const allowed = kindsFor(section);
  const out: Action[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const x = a as Record<string, unknown>;
    if (x.type === "open_tool" && typeof x.tab === "string" && tabs.includes(x.tab)) out.push({ type: "open_tool", tab: x.tab });
    else if (x.type === "create" && typeof x.kind === "string" && (allowed as string[]).includes(x.kind)) {
      const values = cleanValues(x.kind as KindName, x.values);
      if (values) out.push({ type: "create", kind: x.kind as KindName, values });
    }
    if (out.length >= 3) break;
  }
  return out;
}
