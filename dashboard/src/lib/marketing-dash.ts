import "server-only";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import world from "world-atlas/countries-110m.json";
import { createClient } from "@/lib/supabase/server";
import { bestMetric, shareSaveRate, median, revenueByChannel, type Content, type Metric, type SaleAttr } from "@/lib/marketing";
import { weekStart } from "@/lib/metrics";

/** Everything the Marketing dashboard draws (fusedash-style): KPIs, channel pie, tag radar, bubble grid, map. */
export type MarketingDash = {
  posts: number; posts30: number; shareSave: number | null; bestFormat: string | null; inquiries30: number;
  channels: { name: string; value: number }[];
  radar: { tag: string; rate: number }[];
  bubbles: { rows: string[]; weeks: string[]; cells: { r: number; c: number; v: number }[] };
  map: { land: string; bilbao: [number, number]; madrid: [number, number]; barcelona: [number, number] };
  reach30: number; views30: number; revenue30: number; marketingRevenue30: number; orders30: number; conversion: number | null; dmsConverted: number;
  viewsWeekly: { week: string; views: number }[];
  channelCounts: { name: string; value: number }[];
  daily: { day: string; clicks: number; dms: number }[];
  top: { id: string; title: string; views: number; ssr: number | null; status: string; permalink: string | null }[];
  world: string; worldBilbao: [number, number];
};

const DAY = 864e5;
// A simple projection for Iberia: longitude −10…5, latitude 35.6…44.4 into a 600×400 box
const W = 600, H = 400, LON0 = -10, LON1 = 5, LAT0 = 35.6, LAT1 = 44.4;
const proj = (lon: number, lat: number): [number, number] => [((lon - LON0) / (LON1 - LON0)) * W, ((LAT1 - lat) / (LAT1 - LAT0)) * H];

let landCache: string | null = null;
function iberiaPath() {
  if (landCache) return landCache;
  const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
  const fc = feature(topo, topo.objects.countries) as unknown as { features: { id?: string; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
  const keep = new Set(["724", "620", "250", "504", "020"]); // Spain, Portugal, France, Morocco, Andorra
  let d = "";
  for (const f of fc.features) {
    if (!keep.has(String(f.id))) continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    for (const poly of polys) for (const ring of poly) {
      d += ring.map(([lon, lat], i) => { const [x, y] = proj(lon, lat); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join("") + "Z";
    }
  }
  return (landCache = d);
}

let worldCache: string | null = null;
const wproj = (lon: number, lat: number): [number, number] => [((lon + 180) / 360) * 1000, ((90 - lat) / 180) * 500];
function worldPath() {
  if (worldCache) return worldCache;
  const topo = world as unknown as Topology<{ countries: GeometryCollection }>;
  const fc = feature(topo, topo.objects.countries) as unknown as { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } | null }[] };
  let d = "";
  for (const f of fc.features) {
    if (!f.geometry) continue;
    const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][]);
    for (const poly of polys) for (const ring of poly) {
      // skip rings that wrap around the antimeridian (they draw lines across the map)
      if (ring.some(([lon], i) => i && Math.abs(lon - ring[i - 1][0]) > 180)) continue;
      d += ring.map(([lon, lat], i) => { const [x, y] = wproj(lon, lat); return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`; }).join("") + "Z";
    }
  }
  return (worldCache = d);
}

export async function loadMarketingDash(): Promise<MarketingDash> {
  const sb = await createClient();
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();
  const since14 = new Date(Date.now() - 13 * DAY).toISOString().slice(0, 10);
  const [items, metrics, sales, codes, inq, clicks, dmRows] = await Promise.all([
    sb.from("content_items").select("*"), sb.from("content_metrics").select("*"),
    sb.from("sales").select("amount, heard_about, code, utm_source, reverses_id").gte("date", since30.slice(0, 10)),
    sb.from("discount_codes").select("code, channel"),
    sb.from("inquiries").select("id", { count: "exact", head: true }).gte("date", since30.slice(0, 10)),
    sb.from("go_clicks").select("at").gte("at", since14),
    sb.from("inquiries").select("date, converted_sale_id").gte("date", since30.slice(0, 10)),
  ]);
  const c = (items.data ?? []) as Content[], m = (metrics.data ?? []) as Metric[];
  const posted = c.filter((x) => x.posted_at);
  const recent = posted.filter((x) => x.posted_at! >= since30);
  const ssr = median(recent.map((x) => shareSaveRate(bestMetric(x.id, m))).filter((x): x is number => x !== null));

  // Best format by median share+save rate (at least 1 post)
  const byFormat = new Map<string, number[]>();
  for (const x of posted) { const f = x.tags?.format, r = shareSaveRate(bestMetric(x.id, m)); if (f && r !== null) byFormat.set(f, [...(byFormat.get(f) ?? []), r]); }
  const formats = [...byFormat].map(([tag, rs]) => ({ tag, rate: median(rs) ?? 0 })).sort((a, b) => b.rate - a.rate);

  const codeChannel = Object.fromEntries((codes.data ?? []).map((x) => [x.code, x.channel]));
  const channels = revenueByChannel(((sales.data ?? []) as SaleAttr[]).filter((x) => Number(x.amount) > 0 && !x.reverses_id), codeChannel).map((x) => ({ name: x.channel, value: x.revenue }));

  // Bubble grid: rows = message hooks (or formats), columns = last 8 weeks, size = views that week
  const weeks = Array.from({ length: 8 }, (_, i) => new Date(Date.parse(weekStart(Date.now()) + "T00:00:00Z") - (7 - i) * 7 * DAY).toISOString().slice(0, 10));
  const rowKey = (x: Content) => x.tags?.hook_message ?? x.tags?.format ?? null;
  const rows = [...new Set(posted.map(rowKey).filter((x): x is string => !!x))].slice(0, 7);
  const cells: { r: number; c: number; v: number }[] = [];
  rows.forEach((row, r) => weeks.forEach((w, ci) => {
    const v = posted.filter((x) => rowKey(x) === row && weekStart(x.posted_at!) === w).reduce((a, x) => a + (bestMetric(x.id, m)?.views ?? 0), 0);
    if (v) cells.push({ r, c: ci, v });
  }));

  const best = (id: string) => bestMetric(id, m);
  const reach30 = recent.reduce((a, x) => a + (best(x.id)?.reach ?? 0), 0);
  const views30 = recent.reduce((a, x) => a + (best(x.id)?.views ?? 0), 0);
  const realSales = ((sales.data ?? []) as SaleAttr[]).filter((x) => Number(x.amount) > 0 && !x.reverses_id);
  const revenue30 = realSales.reduce((a, x) => a + Number(x.amount), 0);
  const MKT = ["instagram", "tiktok", "whatsapp", "ambassador", "poster"];
  const marketingRevenue30 = realSales.filter((x) => MKT.includes(x.heard_about ?? "") || (x.code && MKT.includes(codeChannel[x.code] ?? "")) || !!x.utm_source).reduce((a, x) => a + Number(x.amount), 0);
  const dms = dmRows.data ?? [];
  const counts = new Map<string, number>();
  for (const x of realSales) counts.set(x.heard_about ?? "unknown", (counts.get(x.heard_about ?? "unknown") ?? 0) + 1);
  const days14 = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * DAY).toISOString().slice(0, 10));
  const top = [...posted].map((x) => ({ id: x.id, title: x.title, views: best(x.id)?.views ?? 0, ssr: shareSaveRate(best(x.id)), status: x.status, permalink: x.permalink ?? null }))
    .sort((a, b) => b.views - a.views).slice(0, 6);
  return {
    reach30, views30, revenue30, marketingRevenue30, orders30: realSales.length,
    conversion: dms.length ? dms.filter((x) => x.converted_sale_id).length / dms.length : null, dmsConverted: dms.filter((x) => x.converted_sale_id).length,
    viewsWeekly: weeks.map((w) => ({ week: w, views: posted.filter((x) => weekStart(x.posted_at!) === w).reduce((a, x) => a + (best(x.id)?.views ?? 0), 0) })),
    channelCounts: ["instagram", "tiktok", "whatsapp", "stall", "friend", "poster", "ambassador", "other"].map((k) => ({ name: k, value: counts.get(k) ?? 0 })),
    daily: days14.map((d) => ({ day: d, clicks: (clicks.data ?? []).filter((x) => String(x.at).slice(0, 10) === d).length, dms: dms.filter((x) => x.date === d).length })),
    top, world: worldPath(), worldBilbao: wproj(-2.935, 43.263),
    posts: posted.length, posts30: recent.length, shareSave: ssr, bestFormat: formats[0]?.tag ?? null, inquiries30: inq.count ?? 0,
    channels, radar: formats.slice(0, 6), bubbles: { rows, weeks, cells },
    map: { land: iberiaPath(), bilbao: proj(-2.935, 43.263), madrid: proj(-3.70, 40.42), barcelona: proj(2.17, 41.39) },
  };
}
