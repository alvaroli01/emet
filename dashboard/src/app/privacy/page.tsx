import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy · emet HQ" };

/** Public privacy page (needed for the "emet HQ" Notion app). Plain words, no login. */
export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-5 py-12 text-[15px] leading-relaxed">
      <h1 className="text-2xl font-semibold">Privacy — emet HQ</h1>
      <p className="text-muted">Last updated 22 October 2026</p>
      <p>emet HQ is the private team dashboard of emet, a non-profit student team in the LEINN Internacional programme (Mondragon University). Only invited team members can log in.</p>
      <h2 className="pt-2 text-lg font-semibold">What we read and store</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Your name, email and the work you add in the dashboard (tasks, notes, sales…), stored in our database (Supabase, EU).</li>
        <li><b>Notion:</b> only if you connect it yourself, and only the pages you choose in Notion&apos;s own screen. We show them to you, save dashboard content to the page you pick, and let Ask emet read them for your questions. We don&apos;t copy your Notion content into our database.</li>
        <li>Connection keys (Notion, Groq, Mistral, Google Calendar link) are encrypted and only used for you. Nobody else in the team, admins included, can see them.</li>
      </ul>
      <h2 className="pt-2 text-lg font-semibold">What we never do</h2>
      <p>We don&apos;t sell or share your data, show ads, or use it for anything outside the team&apos;s work.</p>
      <h2 className="pt-2 text-lg font-semibold">Your control</h2>
      <p>Disconnect Notion (or any connection) at any time in My connections; you can also remove emet HQ in Notion&apos;s settings. Ask the team leader to delete your account and data.</p>
      <p>Contact: the emet team leader, Alvaro.</p>
    </main>
  );
}
