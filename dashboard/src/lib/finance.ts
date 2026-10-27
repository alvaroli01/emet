/** Finance calculations (pure, tested). Amounts may arrive as strings from Postgres numerics. */
export type Method = "cash" | "bizum" | "card" | "transfer" | "other";
export type SaleRow = { id: string; date: string; description: string; amount: number | string; cost: number | string; channel: string | null; payment_method: Method | null; project_id: string | null; item_id?: string | null; quantity?: number; reverses_id?: string | null; logged_by: string | null; created_at: string };
export type ExpenseRow = { id: string; date: string; description: string; category: string | null; amount: number | string; payment_method: Method | null; project_id: string | null; receipt_path?: string | null; reverses_id?: string | null; subscription_id?: string | null; logged_by: string | null; created_at: string };
export type Project = { id: string; name: string; description: string | null; owner_id: string | null; status: "planning" | "live" | "closed"; starts_on: string | null; ends_on: string | null; budget: number | string | null; color: string; goal?: number | string | null; expected_profit?: number | string | null };
export const METHODS: Method[] = ["cash", "bizum", "card", "transfer", "other"];

const n = (v: unknown) => Number(v) || 0;
const round2 = (v: number) => Math.round(v * 100) / 100;

export function inRange<T extends { date: string }>(rows: T[], from: string | null, to: string | null) {
  return rows.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
}

export function summary(sales: SaleRow[], expenses: ExpenseRow[]) {
  const revenue = sales.reduce((a, s) => a + n(s.amount), 0);
  const cogs = sales.reduce((a, s) => a + n(s.cost), 0);
  const spend = expenses.reduce((a, e) => a + n(e.amount), 0);
  const gross = revenue - cogs;
  const net = gross - spend;
  const realSales = sales.filter((s) => !s.reverses_id && n(s.amount) > 0);
  return {
    revenue: round2(revenue), cogs: round2(cogs), expenses: round2(spend), gross: round2(gross), net: round2(net),
    grossMargin: revenue > 0 ? gross / revenue : null,
    netMargin: revenue > 0 ? net / revenue : null,
    orders: realSales.length,
    units: realSales.reduce((a, s) => a + (s.quantity ?? 1), 0),
    aov: realSales.length ? round2(revenue / realSales.length) : null,
  };
}

/** ROI = net profit ÷ total spend (cost of goods + expenses), as a percentage. */
export function roi(net: number, cogs: number, expenses: number): number | null {
  const spend = cogs + expenses;
  return spend > 0 ? Math.round((net / spend) * 1000) / 10 : null;
}

/** What should be in the cash box: cash taken in minus cash paid out (all time). */
export function cashExpected(sales: SaleRow[], expenses: ExpenseRow[]) {
  const cin = sales.filter((s) => s.payment_method === "cash").reduce((a, s) => a + n(s.amount), 0);
  const cout = expenses.filter((e) => e.payment_method === "cash").reduce((a, e) => a + n(e.amount), 0);
  return round2(cin - cout);
}

export function byMethod(sales: SaleRow[], expenses: ExpenseRow[]) {
  return METHODS.map((m) => ({
    method: m,
    in: round2(sales.filter((s) => (s.payment_method ?? "other") === m).reduce((a, s) => a + n(s.amount), 0)),
    out: round2(expenses.filter((e) => (e.payment_method ?? "other") === m).reduce((a, e) => a + n(e.amount), 0)),
  })).map((r) => ({ ...r, balance: round2(r.in - r.out) }));
}

export function sumBy<T>(rows: T[], key: (r: T) => string, value: (r: T) => number) {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + value(r));
  return [...m.entries()].map(([k, v]) => ({ key: k, value: round2(v) })).filter((x) => x.value !== 0).sort((a, b) => b.value - a.value);
}

/** Break-even for a month: how much more revenue is needed so gross profit covers that month's expenses. */
export function breakEven(monthSales: SaleRow[], monthExpenses: ExpenseRow[]) {
  const s = summary(monthSales, monthExpenses);
  if (s.expenses <= s.gross) return 0;
  const margin = s.grossMargin ?? 0.5; // no sales yet: assume the 50% target margin
  return round2((s.expenses - s.gross) / Math.max(0.05, margin));
}

/** Week-over-week revenue growth, comparing the last 7 days with the 7 before. */
export function wowGrowth(sales: SaleRow[], today: string) {
  const d = (k: number) => new Date(Date.parse(today + "T12:00:00Z") - k * 864e5).toISOString().slice(0, 10);
  const thisWeek = summary(inRange(sales, d(6), today), []).revenue;
  const lastWeek = summary(inRange(sales, d(13), d(7)), []).revenue;
  return lastWeek > 0 ? (thisWeek - lastWeek) / lastWeek : null;
}

/** Days of stock left at the pace of the last 28 days of linked sales. */
export function daysOfStock(stock: number, itemId: string, sales: SaleRow[], today: string): number | null {
  const from = new Date(Date.parse(today + "T12:00:00Z") - 27 * 864e5).toISOString().slice(0, 10);
  const sold = inRange(sales, from, today).filter((s) => s.item_id === itemId && !s.reverses_id).reduce((a, s) => a + (s.quantity ?? 1), 0);
  if (sold === 0) return null;
  return Math.floor(stock / (sold / 28));
}

/** Cost to win a customer: marketing expenses ÷ new customers won in the Customer pipeline. */
export function costToWin(expenses: ExpenseRow[], customersWon: number) {
  const m = expenses.filter((e) => e.category === "marketing").reduce((a, e) => a + n(e.amount), 0);
  return customersWon > 0 ? round2(m / customersWon) : null;
}

/** Reversing entry for a ledger row: same date bucket = today, negative amounts, linked to the original. */
export function reversalOf<T extends { id: string; description: string; amount: number | string }>(row: T & { cost?: number | string }, reason: string, today: string) {
  return { date: today, description: `↺ ${row.description}`, amount: -n(row.amount), ...(row.cost !== undefined ? { cost: -n(row.cost) } : {}), reverses_id: row.id, reason };
}
