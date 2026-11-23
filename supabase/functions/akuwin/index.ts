// AkuWin-Brücke für das Hörakustik-Daugsch-Portal (Supabase Edge Function "akuwin")
// - nur für angemeldete Team-Mitglieder (Prüfung des Supabase-Logins im Code)
// - der AkuWin-Server hat ein selbst ausgestelltes Zertifikat ohne Servernamen. Die Verbindung läuft deshalb
//   über TLS in reinem JavaScript; das empfangene Zertifikat wird exakt mit dem gepinnten verglichen,
//   erst danach werden Daten oder Zugangsdaten gesendet.
// - Secrets (Supabase-Dashboard → Edge Functions → Secrets):
//     AKUWIN_URL           Server-Wurzel, z. B. https://20155.ipnhosting.de:25850 (Routen: /akuwin-api/v6/…)
//     AKUWIN_USER          API-Benutzer
//     AKUWIN_PASSWORD      Passwort (trägt der Inhaber selbst ein)
//     AKUWIN_CERT_SHA256   optional: anderer Zertifikat-Fingerabdruck (Standard im Code)
//     AKUWIN_CREATOR_CODE  optional: Mitarbeiterkürzel beim Anlegen von Terminen (Standard GD)
//     AKUWIN_ALLOW_WRITE   optional: "1" erlaubt schreibende Aufrufe über "call"
// - Aktionen: diag · clients · audiograms · appointments · apptMeta · clientAppointments · createAppointment · call (nur GET)

import { makeTLSClient, setCryptoImplementation } from "npm:@reclaimprotocol/tls@0.1.5";
import { webcryptoCrypto } from "npm:@reclaimprotocol/tls@0.1.5/webcrypto";
setCryptoImplementation(webcryptoCrypto);

const BASE = (Deno.env.get("AKUWIN_URL") ?? "https://20155.ipnhosting.de:25850").replace(/\/+$/, "");
const PIN = (Deno.env.get("AKUWIN_CERT_SHA256") ?? "1F:7B:D7:DD:E7:EF:8C:12:13:8D:EF:88:55:0E:0B:EB:6B:C9:C8:99:05:45:71:1A:1B:88:4E:79:36:D9:FA:D5").replace(/[^0-9a-f]/gi, "").toLowerCase();
const USER = Deno.env.get("AKUWIN_USER") ?? "";
const PASS = Deno.env.get("AKUWIN_PASSWORD") ?? "";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

type Raw = { status: number; headers: Record<string, string>; body: Uint8Array };

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
// Der AkuWin-Server nutzt ein selbst ausgestelltes Zertifikat (CN localhost, gültig für 127.0.0.1). Es wird einmalig aus dem
// TLS-1.2-Handshake gelesen (Certificate-Nachricht ist dort unverschlüsselt) und danach als EINZIGER
// vertrauenswürdiger Aussteller verwendet. Damit akzeptiert die Verbindung nur genau dieses Zertifikat (Pinning).
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

// HTTP/1.1 über TLS (reines JavaScript). Die eingebaute Zertifikatsprüfung ist aus, weil das AkuWin-Zertifikat
// keinen gültigen Namen enthält. Stattdessen wird das empfangene Zertifikat Byte für Byte mit dem gepinnten
// verglichen; erst danach werden Daten (und ggf. Zugangsdaten) gesendet.
const b64only = (pem: string) => pem.replace(/-----[^-]+-----|\s/g, "");
function parseHttp(all: Uint8Array): Raw {
  let sep = -1;
  for (let i = 0; i < all.length - 3; i++) if (all[i] === 13 && all[i + 1] === 10 && all[i + 2] === 13 && all[i + 3] === 10) { sep = i; break; }
  if (sep < 0) throw new Error("Ungültige Antwort von AkuWin (" + all.length + " Bytes)");
  const head = new TextDecoder().decode(all.slice(0, sep)).split("\r\n");
  const status = Number(head[0].split(" ")[1]);
  const hs: Record<string, string> = {};
  for (const l of head.slice(1)) { const i = l.indexOf(":"); if (i > 0) hs[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); }
  let b = all.slice(sep + 4);
  if ((hs["transfer-encoding"] || "").includes("chunked")) b = dechunk(b);
  else if (hs["content-length"]) b = b.slice(0, Number(hs["content-length"]));
  return { status, headers: hs, body: b };
}
function responseComplete(all: Uint8Array): boolean {
  let sep = -1;
  for (let i = 0; i < all.length - 3; i++) if (all[i] === 13 && all[i + 1] === 10 && all[i + 2] === 13 && all[i + 3] === 10) { sep = i; break; }
  if (sep < 0) return false;
  const head = new TextDecoder().decode(all.slice(0, sep)).toLowerCase();
  const cl = head.match(/content-length:\s*(\d+)/);
  if (cl) return all.length - sep - 4 >= Number(cl[1]);
  if (head.includes("chunked")) { const tail = new TextDecoder().decode(all.slice(Math.max(sep, all.length - 7))); return tail.endsWith("0\r\n\r\n"); }
  return false;
}
async function raw(method: string, path: string, headers: Record<string, string> = {}, body?: string, needPin = true): Promise<Raw> {
  const u = new URL(BASE + path);
  if (needPin && !PIN) throw new Error("Kein Zertifikat-Fingerabdruck hinterlegt");
  const want = b64only(await certPem());
  const tcp = await Deno.connect({ hostname: u.hostname, port: Number(u.port) || 443 });
  const bodyBuf = body != null ? new TextEncoder().encode(body) : null;
  const h: Record<string, string> = { Host: u.host, Connection: "close", Accept: "application/json", "User-Agent": "hd-portal/1", ...headers };
  if (bodyBuf) h["Content-Length"] = String(bodyBuf.length);
  const reqBytes = cat(new TextEncoder().encode(`${method} ${u.pathname}${u.search} HTTP/1.1\r\n` + Object.entries(h).map(([k, v]) => `${k}: ${v}`).join("\r\n") + "\r\n\r\n"), bodyBuf || new Uint8Array(0));
  return await new Promise<Raw>((resolve, reject) => {
    let resp = new Uint8Array(0), certOk = false, done = false;
    const finish = (err?: unknown) => {
      if (done) return; done = true; clearTimeout(timer);
      try { tcp.close(); } catch { /* */ }
      if (!resp.length) { reject(err instanceof Error ? err : new Error(String(err || "Keine Antwort von AkuWin"))); return; }
      try { resolve(parseHttp(resp)); } catch (e) { reject(e); }
    };
    const timer = setTimeout(() => finish(new Error("Zeitüberschreitung bei AkuWin")), 25000);
    const tls = makeTLSClient({
      host: u.hostname,
      verifyServerCertificate: false,
      supportedProtocolVersions: ["TLS1_3", "TLS1_2"],
      async write({ header, content }) { await tcp.write(cat(header, content)); },
      onRecvCertificates({ certificates }) {
        certOk = !!certificates[0] && b64only(certificates[0].serialiseToPem()) === want;
        if (!certOk) { tls.end(new Error("Zertifikat passt nicht – Verbindung abgebrochen")).catch(() => {}); finish(new Error("Zertifikat passt nicht zum gepinnten AkuWin-Zertifikat")); }
      },
      onHandshake() {
        if (!certOk) { finish(new Error("Zertifikat wurde nicht geprüft")); return; }
        tls.write(reqBytes).catch((e) => finish(e));
      },
      onApplicationData(d) { resp = cat(resp, d); if (responseComplete(resp)) finish(); },
      onTlsEnd(err) { finish(err); },
    });
    (async () => {
      const buf = new Uint8Array(32768);
      try { while (!done) { const n = await tcp.read(buf); if (!n) break; await tls.handleReceivedBytes(buf.slice(0, n)); } } catch (e) { finish(e); return; }
      finish();
    })();
    tls.startHandshake().catch((e) => finish(e));
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

async function requireUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
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
      const out: Record<string, unknown> = { base: BASE, pinned: !!PIN, hasUser: !!USER, hasPassword: !!PASS, certFromSecret: !!(Deno.env.get("AKUWIN_CERT_PEM")) };
      try {
        const pem = await certPem(); const fp = await sha256(pemDer(pem));
        out.fingerprint256 = fp; out.pinMatches = PIN ? fp.replace(/:/g, "").toLowerCase() === PIN : null; out.pem = pem;
      } catch (e) { out.certError = String(e); }
      try { const r = await raw("GET", "/akuwin-api/v6/appointments/types", {}, undefined, false); out.reach = r.status === 401 ? "erreichbar (Anmeldung erforderlich)" : r.status; } catch (e) { out.reach = String(e); }
      return json(out);
    }
    if (p.action === "clients") {
      // Kundensuche: "Müller", "Mül", "Anna Müller" → nur die Felder, die die Beratung braucht
      const q = String((p as { q?: unknown }).q || "").trim().replace(/[%*]/g, "");
      if (q.length < 2) return json({ clients: [] });
      const w = q.split(/\s+/).filter(Boolean);
      const get = async (qs: string) => { const r = await raw("GET", "/akuwin-api/v6/clients?Take=25&" + qs, await authHeaders()); if (r.status !== 200) throw new Error("AkuWin-Kundensuche: " + r.status); return (JSON.parse(text(r)).Clients || []) as Record<string, unknown>[]; };
      const e = encodeURIComponent;
      let list: Record<string, unknown>[] = [];
      if (w.length >= 2) {
        list = await get(`FirstName=${e(w[0] + "%")}&LastName=${e(w.slice(1).join(" ") + "%")}`);
        if (!list.length) list = await get(`FirstName=${e(w[w.length - 1] + "%")}&LastName=${e(w.slice(0, -1).join(" ") + "%")}`);
      }
      if (!list.length) list = await get(`LastName=${e(q + "%")}`);
      if (!list.length && w.length === 1) list = await get(`FirstName=${e(q + "%")}`);
      // deno-lint-ignore no-explicit-any
      const clients = list.map((c: any) => ({ id: c.Id, first: c.FirstName || "", last: c.LastName || "", salutation: c.Salutation || "", birthday: (c.Birthday || "").slice(0, 10),
        street: c.Address?.StreetAndNo || "", zip: c.Address?.ZIP || "", city: c.Address?.City || "",
        phone: c.Communication?.HomeTelephone || c.Communication?.Mobile || c.Communication?.WorkTelephone || "", mobile: c.Communication?.Mobile || "", email: c.Communication?.Email || "",
        insured: !!c.InsuranceId, lastVisit: (c.LastVisitDate || "").slice(0, 10) }))
        .sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first, "de"));
      console.log(`[akuwin] ${user.email} Kundensuche (${clients.length} Treffer)`);
      return json({ clients });
    }
    if (p.action === "audiograms") {
      // Audiogramme eines Kunden, neueste zuerst; Luft- (ac) und Knochenleitung (bc) je Seite, nur beantwortete Punkte
      const id = Number((p as { clientId?: unknown }).clientId);
      if (!Number.isInteger(id) || id <= 0) return json({ error: "Ungültige Kunden-ID" }, 400);
      const r = await raw("GET", `/akuwin-api/v6/clients/audiograms?Take=100&ClientId=${id}`, await authHeaders());
      if (r.status !== 200) return json({ error: "AkuWin-Audiogramme: " + r.status }, 502);
      // deno-lint-ignore no-explicit-any
      const list = (JSON.parse(text(r)).Audiograms || []).filter((a: any) => a.ClientId === id).map((a: any) => {
        const out: { guid: string; date: string; ac: Record<string, Record<string, number>>; bc: Record<string, Record<string, number>>; masked: Record<string, string[]> } = { guid: a.Guid, date: (a.DateOfMeasurement || "").slice(0, 10), ac: { R: {}, L: {} }, bc: { R: {}, L: {} }, masked: { R: [], L: [] } };
        for (const t of a.ToneAudiograms || []) {
          const side = t.Side === "Right" ? "R" : t.Side === "Left" ? "L" : null; if (!side) continue;
          const tgt = t.MeasurementType === "BoneConduction" ? out.bc : t.MeasurementType === "AirConduction" ? out.ac : null; if (!tgt) continue;
          for (const [k, v] of Object.entries(t)) {
            if (!k.startsWith("Hz") || !v) continue;
            // deno-lint-ignore no-explicit-any
            const pt = (v as any).PointType, db = (v as any).dB;
            if ((pt === "Answered" || pt === "Masked") && typeof db === "number") { tgt[side][k.slice(2)] = db; if (pt === "Masked") out.masked[side].push((tgt === out.bc ? "KL " : "LL ") + k.slice(2)); }
          }
        }
        return out;
      }).sort((x: { date: string }, y: { date: string }) => y.date.localeCompare(x.date));
      console.log(`[akuwin] ${user.email} Audiogramme Kunde ${id} (${list.length})`);
      return json({ audiograms: list });
    }
    if (p.action === "appointments") {
      // Termine im Zeitraum (nur lesen) + Ressourcen und Termintypen für Farben/Filter
      const from = String((p as { from?: unknown }).from || ""), to = String((p as { to?: unknown }).to || "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return json({ error: "Zeitraum fehlt (from/to als JJJJ-MM-TT)" }, 400);
      const ah = await authHeaders();
      const [ra, rr2, rt] = await Promise.all([
        raw("GET", `/akuwin-api/v6/appointments?FromDate=${from}&ToDate=${to}`, ah),
        raw("GET", "/akuwin-api/v6/appointments/resources", ah),
        raw("GET", "/akuwin-api/v6/appointments/types", ah),
      ]);
      if (ra.status !== 200) return json({ error: "AkuWin-Termine: " + ra.status + " " + text(ra).slice(0, 200) }, 502);
      // deno-lint-ignore no-explicit-any
      const types = rt.status === 200 ? (JSON.parse(text(rt)).Types || []).map((t: any) => ({ id: t.Id, name: t.Description, color: t.Color ? "#" + t.Color : null, minutes: t.DefaultDurationInMinutes })) : [];
      // deno-lint-ignore no-explicit-any
      const resources = rr2.status === 200 ? (JSON.parse(text(rr2)).Resources || []).map((r: any) => ({ id: r.Id, name: r.Description, type: r.Type, employeeId: r.EmployeeId ?? null, color: r.Color ? "#" + r.Color : null })) : [];
      // deno-lint-ignore no-explicit-any
      const appointments = (JSON.parse(text(ra)).Appointments || []).map((x: any) => {
        let res: string[] = [];
        try { res = Array.isArray(x.RessourceIds) ? x.RessourceIds : JSON.parse(x.RessourceIds || "[]"); } catch { /* */ }
        return { id: x.Id, start: x.Start, end: x.DisplayFinish || x.Finish, allDay: !!x.IsAllDay, recurring: !!x.IsRecurringAppointment, typeId: x.TypeId, type: x.TypeName || "",
          note: x.Note || "", clientId: x.ClientId || null, client: x.ClientFullName || "", resources: res, state: x.State || "", locked: !!x.IsLocked, by: x.CreatorEmployeeCode || "" };
      }).sort((a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start));
      console.log(`[akuwin] ${user.email} Termine ${from}–${to} (${appointments.length})`);
      return json({ appointments, resources, types });
    }
    if (p.action === "apptMeta" || p.action === "clientAppointments" || p.action === "createAppointment") {
      const ah = await authHeaders();
      const meta = async () => {
        const [rt, rr2] = await Promise.all([raw("GET", "/akuwin-api/v6/appointments/types", ah), raw("GET", "/akuwin-api/v6/appointments/resources", ah)]);
        // deno-lint-ignore no-explicit-any
        const types = rt.status === 200 ? (JSON.parse(text(rt)).Types || []).map((t: any) => ({ id: t.Id, name: t.Description, color: t.Color ? "#" + t.Color : null, minutes: t.DefaultDurationInMinutes || 30, conflict: !!t.DefaultIsConflictChecking })) : [];
        // deno-lint-ignore no-explicit-any
        const resources = rr2.status === 200 ? (JSON.parse(text(rr2)).Resources || []).map((r: any) => ({ id: r.Id, name: r.Description, type: r.Type, mandatorId: r.MandatorId })) : [];
        return { types, resources };
      };
      const ymd = (d: Date) => d.toISOString().slice(0, 10);
      if (p.action === "apptMeta") return json(await meta());
      if (p.action === "clientAppointments") {
        // kommende Termine eines Kunden (heute bis +12 Monate)
        const id = Number((p as { clientId?: unknown }).clientId);
        if (!Number.isInteger(id) || id <= 0) return json({ error: "Ungültige Kunden-ID" }, 400);
        const from = new Date(), to = new Date(Date.now() + 365 * 864e5);
        const r = await raw("GET", `/akuwin-api/v6/appointments?FromDate=${ymd(from)}&ToDate=${ymd(to)}&ClientId=${id}`, ah);
        if (r.status !== 200) return json({ error: "AkuWin-Termine: " + r.status }, 502);
        // deno-lint-ignore no-explicit-any
        const list = (JSON.parse(text(r)).Appointments || []).filter((x: any) => x.ClientId === id && x.State !== "Cancelled")
          // deno-lint-ignore no-explicit-any
          .map((x: any) => ({ id: x.Id, start: x.Start, end: x.DisplayFinish || x.Finish, type: x.TypeName || "", typeId: x.TypeId, note: x.Note || "", resources: Array.isArray(x.RessourceIds) ? x.RessourceIds : [] }))
          .sort((a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start));
        return json({ appointments: list });
      }
      // createAppointment – nur mit vollständigen, geprüften Angaben
      const q = p as { clientId?: unknown; typeId?: unknown; start?: unknown; minutes?: unknown; resourceIds?: unknown; note?: unknown };
      const id = Number(q.clientId), minutes = Number(q.minutes), start = String(q.start || "");
      const resIds = Array.isArray(q.resourceIds) ? q.resourceIds.map(String) : [];
      if (!Number.isInteger(id) || id <= 0) return json({ error: "Kein AkuWin-Kunde verknüpft" }, 400);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?([+-]\d{2}:\d{2}|Z)$/.test(start)) return json({ error: "Ungültiger Beginn" }, 400);
      if (!Number.isFinite(minutes) || minutes < 5 || minutes > 600) return json({ error: "Ungültige Dauer" }, 400);
      const startMs = Date.parse(start);
      if (!(startMs > Date.now() - 864e5)) return json({ error: "Termin liegt in der Vergangenheit" }, 400);
      const m = await meta();
      const type = m.types.find((t) => t.id === q.typeId);
      if (!type) return json({ error: "Unbekannter Termintyp" }, 400);
      if (!resIds.length || resIds.some((r) => !m.resources.find((x) => x.id === r))) return json({ error: "Bitte eine gültige Ressource wählen" }, 400);
      // Ende mit gleichem Zeitzonen-Versatz wie der Beginn
      const off = start.match(/([+-]\d{2}:\d{2}|Z)$/)![1];
      const offMin = off === "Z" ? 0 : (off[0] === "-" ? -1 : 1) * (Number(off.slice(1, 3)) * 60 + Number(off.slice(4, 6)));
      const endLocal = new Date(startMs + minutes * 60000 + offMin * 60000).toISOString().slice(0, 19) + (off === "Z" ? "Z" : off);
      const startNorm = new Date(startMs + offMin * 60000).toISOString().slice(0, 19) + (off === "Z" ? "Z" : off);
      const mandatorId = m.resources.find((x) => x.id === resIds[0])?.mandatorId ?? null;
      // Kürzel des Anlegenden: aus der App (creator), sonst aus dem Ressourcennamen "Name (GD)", sonst Standard (Secret AKUWIN_CREATOR_CODE, Vorgabe GD)
      const codeFromRes = (m.resources.find((x) => x.id === resIds[0])?.name || "").match(/\(([A-ZÄÖÜ]{1,4})\)/)?.[1];
      const creatorIn = String((q as { creator?: unknown }).creator || "").toUpperCase().replace(/[^A-ZÄÖÜ]/g, "").slice(0, 4);
      const creator = creatorIn || codeFromRes || Deno.env.get("AKUWIN_CREATOR_CODE") || "GD";
      const body: Record<string, unknown> = { Start: startNorm, Finish: endLocal, IsAllDay: false, TypeId: type.id, Note: String(q.note || "").slice(0, 500), ClientId: id, RessourceIds: resIds, IsConflictChecking: type.conflict, State: "Approved", CreatorEmployeeCode: creator };
      if (mandatorId != null) body.MandatorId = mandatorId;
      const r = await raw("POST", "/akuwin-api/v6/appointments/nonrecurrent", { ...ah, "Content-Type": "application/json" }, JSON.stringify(body));
      const t = text(r);
      let data: unknown = t; try { data = JSON.parse(t); } catch { /* */ }
      console.log(`[akuwin] ${user.email} Termin anlegen Kunde ${id} ${startNorm} ${type.name} → ${r.status}`);
      if (r.status >= 300) {
        // deno-lint-ignore no-explicit-any
        const d: any = data; const msg = d?.ResponseStatus?.Message || d?.title || (typeof d === "string" ? d.slice(0, 200) : "");
        return json({ error: "AkuWin hat den Termin nicht angelegt (" + r.status + "): " + msg, details: d?.errors || d?.ResponseStatus?.Errors || null }, 502);
      }
      // deno-lint-ignore no-explicit-any
      const created: any = data;
      return json({ ok: true, id: created?.Id || created?.Appointment?.Id || null, start: startNorm, end: endLocal, type: type.name, typeId: type.id, resourceIds: resIds, raw: typeof created === "object" ? Object.keys(created || {}) : null });
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
