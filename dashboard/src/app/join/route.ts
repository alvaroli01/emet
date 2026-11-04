import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) redirect("/");

  const { me } = await getSession();
  const supabase = await createClient();

  const { data: invite } = await supabase.from("project_invites").select("project_id").eq("token", token).maybeSingle();
  if (!invite) return new Response("Invalid invite", { status: 404 });

  const { error: memberError } = await supabase.from("project_members").insert({
    project_id: invite.project_id,
    user_id: me.id,
  }).select().single();

  if (memberError && !memberError.message.includes("duplicate")) {
    return new Response("Failed to join project", { status: 500 });
  }

  redirect(`/projects/${invite.project_id}`);
}
