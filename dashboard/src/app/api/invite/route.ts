import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Sends a Supabase invite email to a member. Only admins (Team Leaders) may call it.
 *  Uses the service-role key, which never leaves the server. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { profileId } = (await request.json().catch(() => ({}))) as { profileId?: string };
  if (!profileId) return NextResponse.json({ error: "missing" }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("email, active, user_id").eq("id", profileId).maybeSingle();
  if (!profile || !profile.active) return NextResponse.json({ error: "not-found" }, { status: 404 });
  if (profile.email.endsWith("@emet.invalid")) return NextResponse.json({ error: "placeholder-email" }, { status: 400 });

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return NextResponse.json({ error: "no-service-key" }, { status: 500 });
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });

  const origin = request.nextUrl.origin;
  const { error } = profile.user_id
    // Already has a login → send a fresh login link instead
    ? await admin.auth.signInWithOtp({ email: profile.email, options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` } })
    : await admin.auth.admin.inviteUserByEmail(profile.email, { redirectTo: `${origin}/auth/callback?next=/welcome` });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, resent: !!profile.user_id });
}
