import { redirect } from "next/navigation";

/** The General board is part of the Tasks page now (EMET tasks); old links and bookmarks land there. */
export default function GeneralBoardPage() {
  redirect("/tasks?view=emet");
}
