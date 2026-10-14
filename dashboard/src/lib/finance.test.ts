import { test } from "node:test";
import assert from "node:assert/strict";
import { summary, roi, cashExpected, breakEven, daysOfStock, costToWin, wowGrowth, reversalOf, type SaleRow, type ExpenseRow } from "./finance.ts";

const sale = (p: Partial<SaleRow>): SaleRow => ({ id: crypto.randomUUID(), date: "2026-10-14", description: "s", amount: 0, cost: 0, channel: null, payment_method: "cash", project_id: null, logged_by: null, created_at: "", ...p });
const exp = (p: Partial<ExpenseRow>): ExpenseRow => ({ id: crypto.randomUUID(), date: "2026-10-14", description: "e", category: "other", amount: 0, payment_method: "cash", project_id: null, logged_by: null, created_at: "", ...p });

test("summary: gross, net, margins, AOV; reversals cancel but don't count as orders", () => {
  const s = [sale({ amount: "100", cost: "40" }), sale({ amount: 50, cost: 10 }), sale({ amount: -50, cost: -10, reverses_id: "x" })];
  const r = summary(s, [exp({ amount: 20 })]);
  assert.equal(r.revenue, 100); assert.equal(r.gross, 60); assert.equal(r.net, 40);
  assert.equal(r.grossMargin, 0.6); assert.equal(r.orders, 2); assert.equal(r.aov, 50);
});

test("ROI = net ÷ (cost of goods + expenses)", () => {
  assert.equal(roi(40, 40, 20), 66.7);
  assert.equal(roi(0, 0, 0), null);
});

test("cash expected in the box", () => {
  assert.equal(cashExpected([sale({ amount: 30 }), sale({ amount: 20, payment_method: "bizum" })], [exp({ amount: 12 })]), 18);
});

test("break-even: revenue still needed to cover this month's expenses", () => {
  assert.equal(breakEven([sale({ amount: 100, cost: 50 })], [exp({ amount: 80 })]), 60); // 30 gap at 50% margin
  assert.equal(breakEven([sale({ amount: 100, cost: 50 })], [exp({ amount: 20 })]), 0);
});

test("days of stock left from the last 28 days of linked sales", () => {
  const s = [sale({ item_id: "a", quantity: 14, date: "2026-10-10" }), sale({ item_id: "a", quantity: 14, date: "2026-09-25" })];
  assert.equal(daysOfStock(20, "a", s, "2026-10-14"), 20);
  assert.equal(daysOfStock(20, "b", s, "2026-10-14"), null);
});

test("cost to win a customer, week-over-week growth, reversal shape", () => {
  assert.equal(costToWin([exp({ category: "marketing", amount: 30 }), exp({ amount: 99 })], 3), 10);
  assert.equal(costToWin([], 0), null);
  assert.equal(wowGrowth([sale({ amount: 150, date: "2026-10-13" }), sale({ amount: 100, date: "2026-10-05" })], "2026-10-14"), 0.5);
  assert.deepEqual(reversalOf({ id: "1", description: "Tote", amount: "24", cost: 6 }, "typo", "2026-10-14"),
    { date: "2026-10-14", description: "↺ Tote", amount: -24, cost: -6, reverses_id: "1", reason: "typo" });
});
