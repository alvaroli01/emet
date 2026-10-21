import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

/** Notifications about new company documents link here; it opens your own profile's Documents. */
export default async function MyDocuments() {
  const { me } = await getSession();
  redirect(`/team/${me.id}#documents`);
}
