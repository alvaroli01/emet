import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms · emet HQ" };

/** Public terms page (needed for the "emet HQ" Notion app). Plain words, no login. */
export default function Terms() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-5 py-12 text-[15px] leading-relaxed">
      <h1 className="text-2xl font-semibold">Terms of use — emet HQ</h1>
      <p className="text-muted">Last updated 22 October 2026</p>
      <p>emet HQ is a free, private tool for the members of the emet student team. By using it you agree to:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>use it only for the team&apos;s work and your own studies;</li>
        <li>connect only accounts you&apos;re allowed to use (for example your own Notion, under your university&apos;s rules);</li>
        <li>keep other members&apos; information inside the team.</li>
      </ul>
      <p>The tool is provided as is, without warranties, by students for students. Features can change. Connections can be removed at any time from My connections.</p>
      <p>Contact: the emet team leader, Alvaro.</p>
    </main>
  );
}
