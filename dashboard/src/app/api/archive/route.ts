import { NextResponse, type NextRequest } from "next/server";
import { archiveBatch } from "@/lib/drive";

export const maxDuration = 60;

/** Moves meeting audio older than 30 days to Google Drive. Called nightly (cron secret). */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json(await archiveBatch(50_000));
}
