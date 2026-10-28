// Gate in front of MiroFish on the Hugging Face Space: only people sent from emet (signed pass) get in.
// emet signs "<expiry>.<hmac>" with MIROFISH_SECRET (dashboard/src/lib/mirofish.ts); the first visit trades the
// ?pass= for a cookie, later requests (pages, assets, /api) carry the cookie. Everything else goes to MiroFish untouched
// (Host is rewritten because vite preview only answers its own host).
import http from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";

export function sign(secret, exp) {
  return createHmac("sha256", secret).update(`mirofish:${exp}`).digest("hex");
}

/** True when the pass was signed with the secret and hasn't expired. */
export function validPass(pass, secret, now = Date.now()) {
  if (!pass || !secret) return false;
  const [exp, mac] = String(pass).split(".");
  if (!/^\d+$/.test(exp ?? "") || !/^[0-9a-f]{64}$/.test(mac ?? "") || Number(exp) * 1000 < now) return false;
  return timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(sign(secret, exp), "hex"));
}

function cookie(req, name) {
  const m = (req.headers.cookie ?? "").match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

const LOCKED = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>MiroFish</title>
<body style="font:16px system-ui;background:#111;color:#eee;display:grid;place-items:center;height:100vh;margin:0">
<p>Open MiroFish from <a style="color:#f97316" href="https://emet-hq.vercel.app/g/marketing">emet → Marketing → Prediction agent</a>.</p>`;

export function startGate({ port = 7860, target = 3000, secret = process.env.GATE_SECRET } = {}) {
  if (!secret || secret.length < 32) throw new Error("GATE_SECRET missing or shorter than 32 characters");
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    if (url.pathname === "/healthz") return res.writeHead(200, { "content-type": "text/plain" }).end("ok");
    const pass = url.searchParams.get("pass");
    if (pass && validPass(pass, secret)) {
      url.searchParams.delete("pass");
      // Partitioned: the Space runs inside emet's page, so the cookie is a third-party one
      return res.writeHead(302, {
        location: url.pathname + url.search,
        "set-cookie": `mf_pass=${encodeURIComponent(pass)}; Path=/; Max-Age=43200; Secure; HttpOnly; SameSite=None; Partitioned`,
      }).end();
    }
    if (!validPass(cookie(req, "mf_pass"), secret)) return res.writeHead(401, { "content-type": "text/html; charset=utf-8" }).end(LOCKED);
    const up = http.request({ host: "127.0.0.1", port: target, method: req.method, path: req.url, headers: { ...req.headers, host: `127.0.0.1:${target}` } }, (r) => {
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    });
    up.on("error", () => { if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" }); res.end("MiroFish is starting, try again in a minute."); });
    req.pipe(up);
  }).setTimeout(0).listen(port, "0.0.0.0");
}

if (import.meta.url === `file://${process.argv[1]}`) startGate();
