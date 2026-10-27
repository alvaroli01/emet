import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { createTranslator } from "next-intl";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { pushPayload, type PushNote } from "@/lib/push";

/**
 * Phone notifications: the database calls this (pg_net, see migration 0044) for each new notification worth a push,
 * with a secret only the database knows (it checks it for us). It sends the alert, in the person's language, to every phone they turned it on for, and
 * forgets phones the push service no longer knows.
 */
export async function POST(request: NextRequest) {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const { data: ok } = await db.rpc("check_push_secret", { p: token });
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return NextResponse.json({ error: "no-vapid" }, { status: 500 });
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "missing" }, { status: 400 });

  const { data: n } = await db.from("notifications").select("id, user_id, kind, data, link").eq("id", id).maybeSingle();
  if (!n) return NextResponse.json({ error: "not-found" }, { status: 404 });
  const [{ data: subs }, { data: who }] = await Promise.all([
    db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", n.user_id),
    db.from("profiles").select("locale").eq("id", n.user_id).maybeSingle(),
  ]);
  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const locale = isLocale(who?.locale) ? who.locale : DEFAULT_LOCALE;
  const messages = (await import(`../../../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages });
  const payload = JSON.stringify(pushPayload(n as PushNote, (key, values) => t(key as never, values as never)));

  webpush.setVapidDetails("https://emet-hq.vercel.app", pub, priv);
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: "high" });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.id); // phone unsubscribed or app removed
    }
  }));
  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
  return NextResponse.json({ sent, removed: gone.length });
}
