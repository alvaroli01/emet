import { redirect } from "next/navigation";

/** My Tasks is part of the Tasks page now ("My tasks" tab, with my private board and Notion deadlines). */
export default async function MyTasksPage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const { card } = await searchParams;
  redirect(`/tasks?view=mine${card ? `&card=${encodeURIComponent(card)}` : ""}`);
}
