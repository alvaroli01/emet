import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { period, cardSeries, channelOf, type Unit } from "@/lib/today-periods";

/** Today's Sales / Tasks / Money cards for another week or month (the ‹ › control). Read as the member (RLS). */
export async function GET(request: NextRequest) {
  const unit = (request.nextUrl.searchParams.get("unit") === "month" ? "month" : "week") as Unit;
  const offset = Math.max(-36, Math.min(12, Math.trunc(Number(request.nextUrl.searchParams.get("offset")) || 0)));
  const today = todayISO();
  const p = period(unit, offset, today);
  const sb = await createClient();
  const [sales, done, due] = await Promise.all([
    p.future ? Promise.resolve({ data: [] }) : sb.from("sales").select("date, amount, heard_about, channel").gte("date", p.from).lte("date", p.to),
    p.future ? Promise.resolve({ data: [] }) : sb.from("cards").select("completed_at").not("completed_at", "is", null).gte("completed_at", `${p.prevFrom}T00:00:00Z`).lte("completed_at", `${p.to}T23:59:59Z`),
    p.future ? sb.from("cards").select("due_at").is("completed_at", null).gte("due_at", `${p.from}T00:00:00Z`).lte("due_at", `${p.to}T23:59:59Z`) : Promise.resolve({ data: [] }),
  ]);
  const series = cardSeries(p, today, {
    sales: ((sales.data ?? []) as { date: string; amount: number; heard_about: string | null; channel: string | null }[]).map((s) => ({ date: s.date, amount: Number(s.amount), channel: channelOf(s) })),
    done: ((done.data ?? []) as { completed_at: string }[]).map((x) => x.completed_at),
    due: ((due.data ?? []) as { due_at: string }[]).map((x) => x.due_at),
  });
  return NextResponse.json({ period: p, series });
}
