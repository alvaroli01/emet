import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findCities } from "@/lib/scout/web";

/** City picker (OpenStreetMap Nominatim). Logged-in members only; results cached a day. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const country = request.nextUrl.searchParams.get("country") ?? undefined;
  const lang = request.nextUrl.searchParams.get("lang") ?? "en";
  if (q.length < 2) return NextResponse.json([]);
  const sb = await createClient();
  const { data } = await sb.auth.getClaims();
  if (!data?.claims?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const cities = await findCities(q.slice(0, 80), country?.slice(0, 2), lang.slice(0, 2));
  return NextResponse.json(cities, { headers: { "Cache-Control": "private, max-age=86400" } });
}
