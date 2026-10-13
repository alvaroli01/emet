import { test } from "node:test";
import assert from "node:assert/strict";
import { computeKpis, kpiStatus } from "./kpis.ts";

const NOW = Date.parse("2026-11-04T12:00:00Z"); // Wednesday; week starts Mon 2 Nov
const base = { sales: [], expenses: [], cards: [], prospects: [], complaints: [], followers: [], designRequests: [], morale: [], customerReps: 2, now: NOW };

test("logged within 24h counts this week's entries", () => {
  const k = computeKpis({ ...base,
    sales: [{ date: "2026-11-02", amount: 10, cost: 0, created_at: "2026-11-02T18:00:00Z" },   // same day → ok
            { date: "2026-11-02", amount: 10, cost: 0, created_at: "2026-11-04T10:00:00Z" }],  // 2 days later → late
    expenses: [{ date: "2026-10-20", amount: 5, created_at: "2026-10-30T10:00:00Z" }] });      // last month → ignored
  assert.equal(k["Entries logged within 24h"], 50);
});

test("complaints within 48h, follower growth, prospects per rep, morale", () => {
  const k = computeKpis({ ...base,
    complaints: [{ opened_at: "2026-11-01T10:00:00Z", resolved_at: "2026-11-02T10:00:00Z" },  // in time
                 { opened_at: "2026-10-30T10:00:00Z", resolved_at: null }],                   // open, past 48h → late
    followers: [{ platform: "Instagram", week_start: "2026-10-26", followers: 100 }, { platform: "Instagram", week_start: "2026-11-02", followers: 130 },
                { platform: "TikTok", week_start: "2026-10-26", followers: 50 }, { platform: "TikTok", week_start: "2026-11-02", followers: 45 }],
    prospects: [{ created_at: "2026-11-03T09:00:00Z", owner_id: "a" }, { created_at: "2026-11-02T09:00:00Z", owner_id: "b" }, { created_at: "2026-10-28T09:00:00Z", owner_id: "a" }],
    morale: [{ week_start: "2026-10-26", avg_score: "3.5" }, { week_start: "2026-11-02", avg_score: "4.25" }] });
  assert.equal(k["Complaints resolved within 48h"], 50);
  assert.equal(k["Follower growth"], 25);
  assert.equal(k["New prospects per rep"], 1);
  assert.equal(k["Leads generated"], 2);
  assert.equal(k["Team morale average"], 4.25);
});

test("status: higher is better, except design turnaround", () => {
  assert.equal(kpiStatus("Profit margin", 52, 50), "good");
  assert.equal(kpiStatus("Profit margin", 44, 50), "warning");
  assert.equal(kpiStatus("Profit margin", 30, 50), "critical");
  assert.equal(kpiStatus("Design turnaround", 30, 48), "good");
  assert.equal(kpiStatus("Design turnaround", 70, 48), "critical");
  assert.equal(kpiStatus("Revenue", null, 30000), null);
});
