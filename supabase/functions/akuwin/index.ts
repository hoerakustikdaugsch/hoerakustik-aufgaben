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

// ---------- Zertifikat ----------
// Der AkuWin-Server nutzt ein selbst ausgestelltes Zertifikat auf "localhost". Es wird einmalig aus dem
// TLS-1.2-Handshake gelesen (Certificate-Nachricht ist dort unverschlüsselt) und danach als EINZIGER
// vertrauenswürdiger Aussteller verwendet. Damit akzeptiert die Verbindung nur genau dieses Zertifikat (Pinning).
const TLS_NAME = Deno.env.get("AKUWIN_TLS_NAME") ?? "localhost";
let CERT_PEM = (Deno.env.get("AKUWIN_CERT_PEM") ?? "").replace(/\\n/g, "\n").trim();
const u8 = (...a: number[]) => new Uint8Array(a);
function cat(...p: Uint8Array[]) { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; }
const len2 = (n: number) => u8(n >> 8 & 255, n & 255), len3 = (n: number) => u8(n >> 16 & 255, n >> 8 & 255, n & 255);
const ext = (t: number, d: Uint8Array) => cat(len2(t), len2(d.length), d);
async function fetchCertDer(host: string, port: number): Promise<Uint8Array> {
  const sni = new TextEncoder().encode(host);
  const suites = [0xc02f, 0xc030, 0xc02b, 0xc02c, 0xc027, 0xc028, 0xc013, 0xc014, 0x009c, 0x009d, 0x003c, 0x002f, 0x0035];
  const exts = cat(
    ext(0x0000, cat(len2(sni.length + 3), u8(0), len2(sni.length), sni)),
    ext(0x000a, cat(len2(6), len2(0x0017), len2(0x0018), len2(0x001d))),
    ext(0x000b, u8(1, 0)),
    ext(0x000d, cat(len2(18), u8(4, 1, 5, 1, 6, 1, 4, 3, 5, 3, 8, 4, 8, 5, 8, 6, 2, 1))),
    ext(0xff01, u8(0)),
  );
  const body = cat(u8(3, 3), crypto.getRandomValues(new Uint8Array(32)), u8(0), len2(suites.length * 2), ...suites.map(len2), u8(1, 0), len2(exts.length), exts);
  const hs = cat(u8(1), len3(body.length), body);
  const rec = cat(u8(0x16, 3, 1), len2(hs.length), hs);
  const c = await Deno.connect({ hostname: host, port });
  try {
    await c.write(rec);
    let buf = new Uint8Array(0), hsBuf = new Uint8Array(0);
    const t0 = Date.now();
    while (Date.now() - t0 < 15000) {
      const chunk = new Uint8Array(16384); const n = await c.read(chunk); if (!n) break;
      buf = cat(buf, chunk.slice(0, n));
      while (buf.length >= 5) {
        const l = buf[3] << 8 | buf[4]; if (buf.length < 5 + l) break;
        const type = buf[0], frag = buf.slice(5, 5 + l); buf = buf.slice(5 + l);
        if (type === 0x15) throw new Error("Server hat den TLS-1.2-Aufbau abgelehnt (Alert " + frag[1] + ")");
        if (type === 0x16) hsBuf = cat(hsBuf, frag);
      }
      let i = 0;
      while (i + 4 <= hsBuf.length) {
        const ht = hsBuf[i], hl = hsBuf[i + 1] << 16 | hsBuf[i + 2] << 8 | hsBuf[i + 3];
        if (i + 4 + hl > hsBuf.length) break;
        if (ht === 11) { const m = hsBuf.slice(i + 4, i + 4 + hl); const cl = m[3] << 16 | m[4] << 8 | m[5]; return m.slice(6, 6 + cl); }
        i += 4 + hl;
      }
    }
    throw new Error("Kein Zertifikat im Handshake gefunden");
  } finally { try { c.close(); } catch { /* */ } }
}
const toPem = (der: Uint8Array) => "-----BEGIN CERTIFICATE-----\n" + btoa(String.fromCharCode(...der)).match(/.{1,64}/g)!.join("\n") + "\n-----END CERTIFICATE-----";
const pemDer = (pem: string) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
const sha256 = async (b: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", b))].map((x) => x.toString(16).padStart(2, "0")).join(":").toUpperCase();
async function certPem(): Promise<string> {
  if (CERT_PEM) return CERT_PEM;
  const u = new URL(BASE);
  const pem = toPem(await fetchCertDer(u.hostname, Number(u.port) || 443));
  // Nur übernehmen, wenn der Fingerabdruck zum hinterlegten Pin passt (falls einer hinterlegt ist)
  if (PIN && (await sha256(pemDer(pem))).replace(/:/g, "").toLowerCase() !== PIN) throw new Error("Zertifikat passt nicht zum hinterlegten Fingerabdruck");
  CERT_PEM = pem;
  return pem;
}

// HTTP/1.1 über TLS – vertraut ausschließlich dem AkuWin-Zertifikat
async function raw(method: string, path: string, headers: Record<string, string> = {}, body?: string, needPin = true): Promise<Raw> {
  const u = new URL(BASE + path);
  if (needPin && !PIN) throw new Error("Kein Zertifikat-Fingerabdruck hinterlegt (Secret AKUWIN_CERT_SHA256)");
  const pem = await certPem();
  const tcp = await Deno.connect({ hostname: u.hostname, port: Number(u.port) || 443 });
  const conn = await Deno.startTls(tcp, { hostname: TLS_NAME, caCerts: [pem] });
  const timer = setTimeout(() => { try { conn.close(); } catch { /* */ } }, 25000);
  try {
    const bodyBuf = body != null ? new TextEncoder().encode(body) : null;
    const h: Record<string, string> = { Host: u.host, Connection: "close", Accept: "application/json", "User-Agent": "hd-portal/1", ...headers };
    if (bodyBuf) h["Content-Length"] = String(bodyBuf.length);
    await conn.write(new TextEncoder().encode(`${method} ${u.pathname}${u.search} HTTP/1.1\r\n` + Object.entries(h).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n"));
    if (bodyBuf) await conn.write(bodyBuf);
    let all = new Uint8Array(0);
    while (true) { const b = new Uint8Array(32768); let n: number | null = null; try { n = await conn.read(b); } catch { break; } if (!n) break; all = cat(all, b.slice(0, n)); }
    let sep = -1;
    for (let i = 0; i < all.length - 3; i++) if (all[i] === 13 && all[i + 1] === 10 && all[i + 2] === 13 && all[i + 3] === 10) { sep = i; break; }
    if (sep < 0) throw new Error("Ungültige Antwort von AkuWin");
    const head = new TextDecoder().decode(all.slice(0, sep)).split("\r\n");
    const status = Number(head[0].split(" ")[1]);
    const hs: Record<string, string> = {};
    for (const l of head.slice(1)) { const i = l.indexOf(":"); if (i > 0) hs[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); }
    let b = all.slice(sep + 4);
    if ((hs["transfer-encoding"] || "").includes("chunked")) b = dechunk(b);
    return { status, headers: hs, body: b, cert: {} };
  } finally { clearTimeout(timer); try { conn.close(); } catch { /* */ } }
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
      // liest das Zertifikat und prüft die Verbindung – sendet keine Zugangsdaten
      const out: Record<string, unknown> = { base: BASE, tlsName: TLS_NAME, pinned: !!PIN, hasUser: !!USER, hasPassword: !!PASS, certFromSecret: !!(Deno.env.get("AKUWIN_CERT_PEM")) };
      try {
        const pem = await certPem(); const fp = await sha256(pemDer(pem));
        out.fingerprint256 = fp; out.pinMatches = PIN ? fp.replace(/:/g, "").toLowerCase() === PIN : null; out.pem = pem;
      } catch (e) { out.certError = String(e); }
      try { const r = await raw("GET", "/swagger/index.html", {}, undefined, false); out.reach = r.status; } catch (e) { out.reach = String(e); }
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
