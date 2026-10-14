import type { SupabaseClient } from "@supabase/supabase-js";
import { accessToken, getSecret, setSecret, upload, serviceDb } from "@/lib/drive";

/**
 * "emet Books": a live Google Sheet mirror of the Finance ledgers (the database stays the master copy).
 * Uses the team Google connection (drive.file scope: enough for a sheet the app creates itself).
 * Each tab is rewritten in full from the database, so the sheet can never drift; formulas make
 * Projects and Monthly Summary work on their own when opened in Excel.
 */
export const TABS = ["Sales", "Expenses", "Stock", "Projects", "Monthly Summary", "Audit Log"] as const;
type Tab = (typeof TABS)[number];
const NOTE = "Edit in emet HQ. Changes made here get overwritten. · Edita en emet HQ: los cambios aquí se sobrescriben.";
const TABLE_TABS: Record<string, Tab[]> = {
  sales: ["Sales", "Projects", "Monthly Summary", "Audit Log"],
  expenses: ["Expenses", "Projects", "Monthly Summary", "Audit Log"],
  inventory: ["Stock", "Audit Log"],
  projects: ["Projects", "Audit Log"],
};
type Cell = string | number | null;

/** All tab contents, built from the database. Row 1 = note, row 2 = headers, data from row 3. */
export async function buildTabs(db: SupabaseClient): Promise<Record<Tab, Cell[][]>> {
  const [sales, expenses, stock, projects, people, audit] = await Promise.all([
    db.from("sales").select("*").order("date").order("created_at"),
    db.from("expenses").select("*").order("date").order("created_at"),
    db.from("inventory").select("*").order("product"),
    db.from("projects").select("*").order("created_at"),
    db.from("profiles").select("id, full_name"),
    db.from("finance_audit").select("*").order("at", { ascending: false }).limit(1000),
  ]);
  const name = new Map((people.data ?? []).map((p) => [p.id, p.full_name]));
  const proj = new Map((projects.data ?? []).map((p) => [p.id, p.name]));
  const who = (id: string | null) => (id ? name.get(id) ?? "" : "");
  const at = (ts: string | null) => (ts ? ts.slice(0, 16).replace("T", " ") : "");

  const s = (sales.data ?? []).map((r, i) => [r.date, r.description, Number(r.amount), Number(r.cost), `=C${i + 3}-D${i + 3}`, r.channel ?? "",
    r.payment_method ?? "", r.project_id ? proj.get(r.project_id) ?? "" : "General", who(r.logged_by), at(r.created_at), r.reverses_id ?? "", r.reason ?? "", r.id]);
  const e = (expenses.data ?? []).map((r) => [r.date, r.description, r.category ?? "", Number(r.amount), r.payment_method ?? "",
    r.project_id ? proj.get(r.project_id) ?? "" : "General", r.receipt_path ? "yes" : "", who(r.logged_by), at(r.created_at), r.reverses_id ?? "", r.reason ?? "", r.id]);
  const st = (stock.data ?? []).map((r, i) => [r.product, r.sku ?? "", r.stock, r.unit_cost === null ? "" : Number(r.unit_cost), r.price === null ? "" : Number(r.price), `=C${i + 3}*D${i + 3}`, r.low_stock ?? "", r.id]);
  const pnames = [...(projects.data ?? []).map((p) => [p.name, p.status, p.budget === null ? "" : Number(p.budget)]), ["General", "", ""]];
  const pr = pnames.map(([n, status, budget], i) => {
    const row = i + 3;
    return [n, status, budget, `=SUMIFS(Sales!C:C,Sales!H:H,A${row})`, `=SUMIFS(Sales!D:D,Sales!H:H,A${row})`, `=SUMIFS(Expenses!D:D,Expenses!F:F,A${row})`,
      `=D${row}-E${row}-F${row}`, `=IF(E${row}+F${row}>0,G${row}/(E${row}+F${row}),"")`, `=IF(C${row}="","",E${row}+F${row}-C${row})`];
  });
  const months: Cell[][] = [];
  const first = new Date("2026-10-01T12:00:00Z");
  for (let d = new Date(first), i = 0; d <= new Date(); d.setUTCMonth(d.getUTCMonth() + 1), i++) {
    const row = i + 3, m = d.toISOString().slice(0, 10);
    months.push([m, `=SUMIFS(Sales!C:C,Sales!A:A,">="&A${row},Sales!A:A,"<"&EDATE(A${row},1))`, `=SUMIFS(Sales!D:D,Sales!A:A,">="&A${row},Sales!A:A,"<"&EDATE(A${row},1))`,
      `=SUMIFS(Expenses!D:D,Expenses!A:A,">="&A${row},Expenses!A:A,"<"&EDATE(A${row},1))`, `=B${row}-C${row}-D${row}`, `=IF(B${row}>0,E${row}/B${row},"")`]);
  }
  const au = (audit.data ?? []).map((a) => {
    const rec = (a.after ?? a.before ?? {}) as Record<string, unknown>;
    const changed = a.before && a.after ? Object.keys(a.after).filter((k) => k !== "updated_at" && JSON.stringify(a.before[k]) !== JSON.stringify(a.after[k]))
      .map((k) => `${k}: ${a.before[k] ?? "—"} → ${a.after[k] ?? "—"}`).join("; ") : "";
    return [at(a.at), who(a.actor_id), a.table_name, a.action, String(rec.description ?? rec.name ?? rec.product ?? ""), changed];
  });
  const tab = (headers: string[], rows: Cell[][]): Cell[][] => [[NOTE], headers, ...rows];
  return {
    Sales: tab(["Date", "Description", "Amount €", "Cost of goods €", "Gross profit €", "Channel", "Payment method", "Project", "Logged by", "Logged at", "Reverses", "Reason", "ID"], s),
    Expenses: tab(["Date", "Description", "Category", "Amount €", "Payment method", "Project", "Receipt", "Logged by", "Logged at", "Reverses", "Reason", "ID"], e),
    Stock: tab(["Product", "SKU", "Stock", "Unit cost €", "Price €", "Stock value €", "Low-stock alert at", "ID"], st),
    Projects: tab(["Project", "Status", "Budget €", "Revenue €", "Cost of goods €", "Expenses €", "Net profit €", "ROI", "Over budget €"], pr),
    "Monthly Summary": tab(["Month", "Revenue €", "Cost of goods €", "Expenses €", "Net profit €", "Net margin"], months),
    "Audit Log": tab(["When", "Who", "Table", "Action", "What", "Changes"], au),
  };
}

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
async function gfetch(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`google ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

/** Creates the "emet Books" spreadsheet once (frozen headers, € and date formats, read-only note). */
async function ensureSheet(db: SupabaseClient, token: string): Promise<string> {
  const existing = await getSecret(db, "books_sheet_id");
  if (existing) return existing;
  const created = await gfetch(token, SHEETS, { method: "POST", body: JSON.stringify({
    properties: { title: "emet Books", locale: "es_ES", timeZone: "Europe/Madrid" },
    sheets: TABS.map((title, i) => ({ properties: { sheetId: i, title, gridProperties: { frozenRowCount: 2 } } })),
  }) });
  const id = created.spreadsheetId as string;
  const money: Record<Tab, number[]> = { Sales: [2, 3, 4], Expenses: [3], Stock: [3, 4, 5], Projects: [2, 3, 4, 5, 6, 8], "Monthly Summary": [1, 2, 3, 4], "Audit Log": [] };
  const requests = TABS.flatMap((title, sheetId) => [
    { repeatCell: { range: { sheetId, startRowIndex: 1, endRowIndex: 2 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: "userEnteredFormat.textFormat.bold" } },
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { textFormat: { italic: true, foregroundColor: { red: 0.55, green: 0.35, blue: 0 } } } }, fields: "userEnteredFormat.textFormat" } },
    ...money[title].map((c) => ({ repeatCell: { range: { sheetId, startRowIndex: 2, startColumnIndex: c, endColumnIndex: c + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: "CURRENCY", pattern: "#,##0.00 €" } } }, fields: "userEnteredFormat.numberFormat" } })),
    ...(["Sales", "Expenses", "Monthly Summary"].includes(title) ? [{ repeatCell: { range: { sheetId, startRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 },
      cell: { userEnteredFormat: { numberFormat: { type: "DATE", pattern: title === "Monthly Summary" ? "mmmm yyyy" : "dd/mm/yyyy" } } }, fields: "userEnteredFormat.numberFormat" } }] : []),
    ...(["Projects", "Monthly Summary"].includes(title) ? [{ repeatCell: { range: { sheetId, startRowIndex: 2, startColumnIndex: title === "Projects" ? 7 : 5, endColumnIndex: title === "Projects" ? 8 : 6 },
      cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0.0%" } } }, fields: "userEnteredFormat.numberFormat" } }] : []),
  ]);
  await gfetch(token, `${SHEETS}/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests }) });
  await setSecret(db, "books_sheet_id", id);
  return id;
}

async function writeTabs(token: string, id: string, data: Record<Tab, Cell[][]>, tabs: Tab[]) {
  await gfetch(token, `${SHEETS}/${id}/values:batchClear`, { method: "POST", body: JSON.stringify({ ranges: tabs.map((t) => `'${t}'!A1:Z`) }) });
  await gfetch(token, `${SHEETS}/${id}/values:batchUpdate`, { method: "POST", body: JSON.stringify({
    valueInputOption: "USER_ENTERED", data: tabs.map((t) => ({ range: `'${t}'!A1`, values: data[t].map((r) => r.map((c) => (c === null ? "" : c))) })),
  }) });
}

export async function booksStatus(db = serviceDb()) {
  const [token, id, pending] = await Promise.all([getSecret(db, "google_refresh_token"), getSecret(db, "books_sheet_id"), db.rpc("sheet_sync_pending")]);
  return { connected: !!token, pending: (pending.data as number | null) ?? 0, sheetUrl: id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null };
}

/** Writes every tab that has queued changes (or all tabs when forced). Failed writes stay queued for the next try. */
export async function syncBooks(force = false): Promise<{ synced: string[]; pending: number; error?: string }> {
  const db = serviceDb();
  const token = await accessToken();
  const { data: queue } = await db.from("sheet_sync_queue").select("id, tab").order("id");
  const pending = new Set((queue ?? []).flatMap((q) => TABLE_TABS[q.tab] ?? []));
  if (force) TABS.forEach((t) => pending.add(t));
  if (!pending.size) return { synced: [], pending: 0 };
  if (!token) return { synced: [], pending: pending.size, error: "not-connected" };
  const maxId = Math.max(0, ...(queue ?? []).map((q) => q.id));
  try {
    const id = await ensureSheet(db, token);
    await writeTabs(token, id, await buildTabs(db), [...pending] as Tab[]);
    if (maxId) await db.from("sheet_sync_queue").delete().lte("id", maxId);
    return { synced: [...pending], pending: 0 };
  } catch (e) {
    const msg = String((e as Error).message).slice(0, 300);
    if (maxId) {
      for (const q of queue ?? []) await db.from("sheet_sync_queue").update({ attempts: 1, last_error: msg }).eq("id", q.id);
    }
    return { synced: [], pending: pending.size, error: msg };
  }
}

/** Exports the live sheet as .xlsx (Drive), or null when Google isn't connected yet. */
export async function exportXlsx(): Promise<ArrayBuffer | null> {
  const db = serviceDb();
  const [token, id] = await Promise.all([accessToken(), getSecret(db, "books_sheet_id")]);
  if (!token || !id) return null;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.ok ? res.arrayBuffer() : null;
}

/** Builds the workbook locally (same tabs and formulas) — used when Google isn't connected. */
export async function buildXlsx(): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const data = await buildTabs(serviceDb());
  const wb = new ExcelJS.Workbook();
  wb.creator = "emet HQ";
  for (const t of TABS) {
    const ws = wb.addWorksheet(t, { views: [{ state: "frozen", ySplit: 2 }] });
    data[t].forEach((row, r) => {
      const xr = ws.addRow(row.map((c) => (typeof c === "string" && c.startsWith("=") ? { formula: c.slice(1) } : c)));
      if (r === 0) xr.font = { italic: true, color: { argb: "FF8A5A00" } };
      if (r === 1) xr.font = { bold: true };
    });
    ws.columns.forEach((c) => { c.width = 16; });
  }
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

/** Nightly: a dated .xlsx copy in the team Drive, keeping the last 30. */
export async function snapshotXlsx(): Promise<string | null> {
  const db = serviceDb();
  const token = await accessToken();
  const file = await exportXlsx();
  if (!token || !file) return null;
  let folder = await getSecret(db, "books_snapshots_folder");
  if (!folder) {
    const r = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "emet Books — daily copies", mimeType: "application/vnd.google-apps.folder" }) });
    folder = ((await r.json()) as { id?: string }).id ?? null;
    if (!folder) return null;
    await setSecret(db, "books_snapshots_folder", folder);
  }
  const day = new Date().toISOString().slice(0, 10);
  const id = await upload(token, folder, `emet Books ${day}.xlsx`, new Blob([file], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const list = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${folder}' in parents and trashed=false`)}&orderBy=name desc&fields=files(id,name)&pageSize=100`, { headers: { Authorization: `Bearer ${token}` } });
  const files = ((await list.json()) as { files?: { id: string }[] }).files ?? [];
  for (const f of files.slice(30)) await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  return id;
}
