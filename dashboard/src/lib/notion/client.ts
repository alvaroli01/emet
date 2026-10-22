/**
 * Tiny Notion API client (tested): the member's own token, the current Notion-Version, one automatic token renewal on
 * 401 (the new pair is handed to onTokens to be saved), and waiting out "slow down" (429) the way Notion asks.
 */
export const NOTION_VERSION = "2026-03-11";
export const API = "https://api.notion.com/v1";

export class NotionError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export type Tokens = { access: string; refresh: string | null };
export type Session = {
  tokens: Tokens;
  refresh?: (refreshToken: string) => Promise<Tokens>;
  onTokens?: (t: Tokens) => unknown;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function notion(s: Session, path: string, init: { method?: string; body?: unknown } = {}): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const doFetch = s.fetchImpl ?? fetch, sleep = s.sleep ?? wait;
  let renewed = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await doFetch(`${API}${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${s.tokens.access}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    if (res.ok) return res.json();
    if (res.status === 401 && !renewed && s.refresh && s.tokens.refresh) {
      renewed = true;
      s.tokens = await s.refresh(s.tokens.refresh);
      await s.onTokens?.(s.tokens);
      continue;
    }
    if (res.status === 429 && attempt < 2) {
      await sleep(Math.min(10, Number(res.headers.get("retry-after")) || 1) * 1000);
      continue;
    }
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new NotionError(res.status, body.message ?? `Notion error ${res.status}`);
  }
  throw new NotionError(429, "Notion is busy, try again in a moment");
}
