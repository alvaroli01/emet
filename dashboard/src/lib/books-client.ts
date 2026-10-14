/** After any Finance write: ask the server to mirror the change to the "emet Books" Google Sheet (fire-and-forget). */
export function syncBooksSoon() {
  setTimeout(() => { fetch("/api/books/sync", { method: "POST", keepalive: true }).catch(() => {}); }, 400);
}
