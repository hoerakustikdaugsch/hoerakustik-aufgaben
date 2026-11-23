// AkuWin-Brücke für das Hörakustik-Daugsch-Portal (Supabase Edge Function "akuwin")
// - nur für angemeldete Team-Mitglieder
// - der AkuWin-Server hat ein nicht öffentlich vertrauenswürdiges Zertifikat. Deshalb wird
//   die Verbindung über den SHA-256-Fingerabdruck des Zertifikats abgesichert (Pinning):
//   Zugangsdaten werden nur gesendet, wenn der Fingerabdruck exakt passt.
// - Secrets (im Supabase-Dashboard → Edge Functions → Secrets):
//     AKUWIN_URL          z. B. https://20155.ipnhosting.de:25850/akuwin-api
//     AKUWIN_USER         API-Benutzer
//     AKUWIN_PASSWORD     Passwort (trägt der Inhaber selbst ein)
//     AKUWIN_CERT_SHA256  Fingerabdruck des Server-Zertifikats (aus action "diag")
import tls from "node:tls";
import { Buffer } from "node:buffer";

const BASE = (Deno.env.get("AKUWIN_URL") ?? "https://20155.ipnhosting.de:25850/akuwin-api").replace(/\/+$/, "");
const PIN = (Deno.env.get("AKUWIN_CERT_SHA256") ?? "").replace(/[^0-9a-f]/gi, "").toLowerCase();
const USER = Deno.env.get("AKUWIN_USER") ?? "";
const PASS = Deno.env.get("AKUWIN_PASSWORD") ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

type Raw = { status: number; headers: Record<string, string>; body: Uint8Array; cert: Record<string, unknown> };

function dechunk(b: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const dec = new TextDecoder();
  while (i < b.length) {
    let j = i;
    while (j < b.length - 1 && !(b[j] === 13 && b[j + 1] === 10)) j++;
    const size = parseInt(dec.decode(b.slice(i, j)).split(";")[0].trim(), 16);
    if (!size) break;
    const s = j + 2;
    for (let k = s; k < s + size && k < b.length; k++) out.push(b[k]);
    i = s + size + 2;
  }
  return new Uint8Array(out);
}

// HTTP/1.1 über TLS mit Zertifikat-Pinning (ohne öffentliche CA-Prüfung)
function raw(method: string, path: string, headers: Record<string, string> = {}, body?: string, pin = true): Promise<Raw> {
  const u = new URL(BASE + path);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let cert: Record<string, unknown> = {};
    const timer = setTimeout(() => { sock.destroy(); reject(new Error("Zeitüberschreitung bei AkuWin")); }, 20000);
    const sock = tls.connect({ host: u.hostname, port: Number(u.port) || 443, servername: u.hostname, rejectUnauthorized: false }, () => {
      // deno-lint-ignore no-explicit-any
      const pc: any = sock.getPeerCertificate(true) || {};
      const fp = String(pc.fingerprint256 || "").replace(/[^0-9a-f]/gi, "").toLowerCase();
      cert = { subject: pc.subject, issuer: pc.issuer, valid_from: pc.valid_from, valid_to: pc.valid_to, fingerprint256: pc.fingerprint256, subjectaltname: pc.subjectaltname,
        pem: pc.raw ? "-----BEGIN CERTIFICATE-----\n" + Buffer.from(pc.raw).toString("base64").match(/.{1,64}/g)!.join("\n") + "\n-----END CERTIFICATE-----" : undefined };
      if (pin && (!PIN || fp !== PIN)) { clearTimeout(timer); sock.destroy(); reject(Object.assign(new Error(PIN ? "Zertifikat passt nicht zum hinterlegten Fingerabdruck" : "Kein Zertifikat-Fingerabdruck hinterlegt"), { cert })); return; }
      const bodyBuf = body != null ? Buffer.from(body) : null;
      const h: Record<string, string> = { Host: u.host, Connection: "close", Accept: "application/json", "User-Agent": "hd-portal/1", ...headers };
      if (bodyBuf) h["Content-Length"] = String(bodyBuf.length);
      sock.write(`${method} ${u.pathname}${u.search} HTTP/1.1\r\n` + Object.entries(h).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n");
      if (bodyBuf) sock.write(bodyBuf);
    });
    sock.on("data", (d: Buffer) => chunks.push(d));
    sock.on("error", (e: Error) => { clearTimeout(timer); reject(Object.assign(e, { cert })); });
    sock.on("end", () => {
      clearTimeout(timer);
      const all = new Uint8Array(Buffer.concat(chunks));
      let sep = -1;
      for (let i = 0; i < all.length - 3; i++) if (all[i] === 13 && all[i + 1] === 10 && all[i + 2] === 13 && all[i + 3] === 10) { sep = i; break; }
      if (sep < 0) { reject(Object.assign(new Error("Ungültige Antwort von AkuWin"), { cert })); return; }
      const head = new TextDecoder().decode(all.slice(0, sep)).split("\r\n");
      const status = Number(head[0].split(" ")[1]);
      const hs: Record<string, string> = {};
      for (const l of head.slice(1)) { const i = l.indexOf(":"); if (i > 0) hs[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); }
      let b = all.slice(sep + 4);
      if ((hs["transfer-encoding"] || "").includes("chunked")) b = dechunk(b);
      resolve({ status, headers: hs, body: b, cert });
    });
  });
}
const text = (r: Raw) => new TextDecoder().decode(r.body);

// Anmeldung bei AkuWin: Token wird kurz zwischengespeichert. Der genaue Weg wird nach Sichtung der Swagger-Datei ergänzt.
let token: { v: string; exp: number } | null = null;
async function authHeaders(): Promise<Record<string, string>> {
  const mode = Deno.env.get("AKUWIN_AUTH") ?? "basic";
  if (mode === "basic") return { Authorization: "Basic " + btoa(unescape(encodeURIComponent(USER + ":" + PASS))) };
  if (token && token.exp > Date.now()) return { Authorization: "Bearer " + token.v };
  const path = Deno.env.get("AKUWIN_LOGIN_PATH") ?? "/api/auth/login";
  const r = await raw("POST", path, { "Content-Type": "application/json" }, JSON.stringify({ username: USER, password: PASS, userName: USER }));
  const t = text(r);
  let v = "";
  try { const j = JSON.parse(t); v = j.token || j.access_token || j.accessToken || j.jwt || ""; } catch { v = t.replace(/^"|"$/g, ""); }
  if (r.status >= 300 || !v) throw new Error("AkuWin-Anmeldung fehlgeschlagen (" + r.status + ")");
  token = { v, exp: Date.now() + 10 * 60 * 1000 };
  return { Authorization: "Bearer " + v };
}

function adminKeys(): string[] {
  const k: string[] = [];
  const sr = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); if (sr) k.push(sr);
  try { const o = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}"); for (const v of Object.values(o)) if (typeof v === "string") k.push(v); } catch { /* */ }
  return k;
}
async function requireUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const bearer = auth.replace(/^Bearer\s+/i, ""), apikey = req.headers.get("apikey") || "";
  // Test aus dem Supabase-Dashboard (Service-/Secret-Schlüssel)
  if (adminKeys().some((k) => k && (k === bearer || k === apikey))) return { id: "admin", email: "supabase-dashboard" };
  const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable_zmvmJy06hh-0ls68C7NDkA_hc2JvVkq";
  const r = await fetch(url + "/auth/v1/user", { headers: { Authorization: auth, apikey: key } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  let p: { action?: string; method?: string; path?: string; body?: unknown } = {};
  try { p = await req.json(); } catch { /* leer */ }
  const user = await requireUser(req);
  if (!user) return json({ error: "Nicht angemeldet" }, 401);
  try {
    if (p.action === "diag") {
      // liest nur das Zertifikat und die Erreichbarkeit – sendet keine Zugangsdaten
      let reach: unknown = null, cert: unknown = null;
      try { const r = await raw("GET", "/swagger/index.html", {}, undefined, false); reach = r.status; cert = r.cert; } catch (e) { reach = String(e); cert = (e as { cert?: unknown }).cert; }
      return json({ base: BASE, pinned: !!PIN, pinMatches: PIN && cert ? String((cert as { fingerprint256?: string }).fingerprint256 || "").replace(/[^0-9a-f]/gi, "").toLowerCase() === PIN : null,
        hasUser: !!USER, hasPassword: !!PASS, reach, cert });
    }
    if (p.action === "diag2") {
      // probiert verschiedene TLS-Wege (ohne Zugangsdaten) und meldet die genauen Fehler
      const u = new URL(BASE);
      const port = Number(u.port) || 443;
      const out: Record<string, unknown> = {};
      const req1 = `GET ${u.pathname}/swagger/index.html HTTP/1.1\r\nHost: ${u.host}\r\nConnection: close\r\n\r\n`;
      const readAll = async (c: Deno.Conn) => { const buf = new Uint8Array(4096); const n = await c.read(buf); return new TextDecoder().decode(buf.slice(0, n || 0)).split("\r\n")[0]; };
      // A: Deno.connectTls normal
      try { const c = await Deno.connectTls({ hostname: u.hostname, port }); await c.write(new TextEncoder().encode(req1)); out.A = await readAll(c); c.close(); } catch (e) { out.A = String(e); }
      // B: TCP + startTls mit Namen "localhost" (Zertifikat lautet auf localhost)
      try { const t = await Deno.connect({ hostname: u.hostname, port }); const c = await Deno.startTls(t, { hostname: "localhost" }); await c.write(new TextEncoder().encode(req1)); out.B = await readAll(c); c.close(); } catch (e) { out.B = String(e); }
      // C: node:https mit rejectUnauthorized:false
      try {
        const https = await import("node:https");
        out.C = await new Promise((res) => {
          const r = https.request({ host: u.hostname, port, path: u.pathname + "/swagger/index.html", method: "GET", rejectUnauthorized: false }, (resp) => {
            // deno-lint-ignore no-explicit-any
            const sock: any = resp.socket; let x509: unknown = null;
            try { const c = sock.getPeerX509Certificate?.(); if (c) x509 = { fp: c.fingerprint256, subject: c.subject, issuer: c.issuer, validTo: c.validTo, pem: c.toString() }; } catch (e) { x509 = String(e); }
            res({ status: resp.statusCode, x509 }); resp.resume();
          });
          r.on("error", (e) => res(String(e))); r.setTimeout(15000, () => { r.destroy(); res("timeout"); }); r.end();
        });
      } catch (e) { out.C = String(e); }
      // D: node:tls, warten auf secureConnect, X509 auslesen
      try {
        out.D = await new Promise((res) => {
          const s = tls.connect({ host: u.hostname, port, servername: u.hostname, rejectUnauthorized: false });
          const to = setTimeout(() => { s.destroy(); res("timeout"); }, 15000);
          s.on("secureConnect", () => {
            // deno-lint-ignore no-explicit-any
            const a: any = s; let x: unknown = null;
            try { const c = a.getPeerX509Certificate?.(); if (c) x = { fp: c.fingerprint256, pem: c.toString() }; } catch (e) { x = String(e); }
            res({ authorized: a.authorized, authError: String(a.authorizationError || ""), x509: x }); clearTimeout(to); s.destroy();
          });
          s.on("error", (e: Error) => { clearTimeout(to); res("error: " + String(e)); });
        });
      } catch (e) { out.D = String(e); }
      return json(out);
    }
    if (p.action === "swagger") {
      // öffentliche API-Beschreibung (ohne Zugangsdaten)
      const tries = ["/swagger/v1/swagger.json", "/swagger/swagger.json", "/swagger/docs/v1", "/swagger.json", "/openapi.json", "/swagger/v2/swagger.json"];
      const seen: Record<string, number> = {};
      for (const t of tries) {
        try { const r = await raw("GET", t, {}, undefined, false); seen[t] = r.status; if (r.status === 200) return json({ path: t, spec: JSON.parse(text(r)) }); } catch (e) { seen[t] = -1; console.log(t, String(e)); }
      }
      let index = "";
      try { index = text(await raw("GET", "/swagger/index.html", {}, undefined, false)).slice(0, 4000); } catch { /* */ }
      return json({ error: "Swagger-Datei nicht gefunden", seen, index }, 404);
    }
    if (p.action === "probe") {
      // ohne Zugangsdaten: zeigt Status/Kopfzeilen eines Pfads (z. B. um das Anmeldeverfahren zu erkennen)
      const path = String(p.path || "/");
      if (!path.startsWith("/") || path.includes("..")) return json({ error: "Ungültiger Pfad" }, 400);
      const r = await raw((p.method || "GET").toUpperCase(), path, p.body != null ? { "Content-Type": "application/json" } : {}, p.body != null ? JSON.stringify(p.body) : undefined, false);
      return json({ status: r.status, headers: r.headers, body: text(r).slice(0, 3000) });
    }
    if (p.action === "call") {
      // Lesender Zugriff auf erlaubte Pfade; schreibend nur, wenn ausdrücklich freigegeben
      const method = (p.method || "GET").toUpperCase();
      const path = String(p.path || "");
      if (!path.startsWith("/") || path.includes("..")) return json({ error: "Ungültiger Pfad" }, 400);
      const writeOk = (Deno.env.get("AKUWIN_ALLOW_WRITE") ?? "") === "1";
      if (method !== "GET" && !writeOk) return json({ error: "Schreibende Zugriffe sind noch nicht freigegeben" }, 403);
      if (!USER || !PASS) return json({ error: "AkuWin-Zugangsdaten fehlen in den Secrets (AKUWIN_USER / AKUWIN_PASSWORD)" }, 503);
      const r = await raw(method, path, { ...(await authHeaders()), ...(p.body != null ? { "Content-Type": "application/json" } : {}) }, p.body != null ? JSON.stringify(p.body) : undefined);
      const t = text(r);
      let data: unknown = t;
      try { data = JSON.parse(t); } catch { /* Text */ }
      console.log(`[akuwin] ${user.email} ${method} ${path} → ${r.status}`);
      return json({ status: r.status, data }, r.status >= 500 ? 502 : 200);
    }
    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
