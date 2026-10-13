// Backend: plain Node.js HTTP server (no npm packages, no database).
// All data lives in the data structures from src/.
const http = require("http"), fs = require("fs"), path = require("path");
const { V, trie, bst, hot, demoNos } = require("./src/data");
const { MinHeap, Queue, mergeSort } = require("./src/dataStructures");
const auth = require("./src/auth");

const PORT = process.env.PORT || 3000, PUB = path.join(__dirname, "public");
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
const COLS = ["t", "st", "dur", "peak", "kw", "soc", "soh"];
const EMAIL = /^\S+@\S+\.\S+$/;

const json = (res, code, obj, h = {}) => { res.writeHead(code, { "Content-Type": "application/json", ...h }); res.end(JSON.stringify(obj)); };
const readBody = req => new Promise(ok => { let d = ""; req.on("data", c => { d += c; if (d.length > 1e4) req.destroy(); }); req.on("end", () => { try { ok(JSON.parse(d || "{}")); } catch { ok({}); } }); });
const cookie = (req, n) => (req.headers.cookie || "").split(";").map(c => c.trim().split("=")).find(c => c[0] === n)?.[1];
const setSession = (res, v, age) => ({ "Set-Cookie": `cs_ds=${v}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}` });

function vehicleJson(v, key, dir) {
  const rows = [...v.ses];                                   // linked list -> array
  const alerts = new Queue(), list = [];                      // queue of heat alerts
  rows.forEach(s => { if (s.peak > 45 || s.peak < 15) alerts.enqueue(s); });
  for (let a; (a = alerts.dequeue());) list.push(a);
  const sorted = mergeSort(rows, (a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (dir === "desc" ? -1 : 1));
  return { no: v.no, model: v.model, kwh: v.kwh, note: v.note, soh: v.soh, pred: v.pred, alerts: list.length,
           trend: { soh: rows.map(s => s.soh), peak: rows.map(s => s.peak) }, sessions: sorted };
}

async function api(req, res, url, user) {
  const p = url.pathname, m = req.method, ip = req.socket.remoteAddress;
  if (p === "/api/login" && m === "POST") {
    const b = await readBody(req), u = auth.login(String(b.email || "").trim().toLowerCase(), String(b.password || ""), ip);
    return u ? json(res, 200, { ok: true }, setSession(res, auth.makeToken(u.email), 28800)) : json(res, 401, { error: "Incorrect email or password." });
  }
  if (p === "/api/register" && m === "POST") {
    const b = await readBody(req), e = String(b.email || "").trim().toLowerCase(), pw = String(b.password || "");
    if (!EMAIL.test(e) || pw.length < 8) return json(res, 400, { error: "Valid email and 8+ character password needed." });
    const u = auth.register(e, pw, ip);
    return u ? json(res, 200, { ok: true }, setSession(res, auth.makeToken(u.email), 28800)) : json(res, 409, { error: "Account already exists." });
  }
  if (p === "/api/logout" && m === "POST") return json(res, 200, { ok: true }, setSession(res, "", 0));
  if (!user) return json(res, 401, { error: "Please log in." });

  if (p === "/api/me") return json(res, 200, { email: user.email, role: user.role });
  if (p === "/api/demo") return json(res, 200, demoNos);
  if (p === "/api/suggest") return json(res, 200, trie.find(String(url.searchParams.get("prefix") || "").toUpperCase().trim()));   // Trie
  if (p.startsWith("/api/vehicles/")) {
    const v = V.get(decodeURIComponent(p.slice(14)).toUpperCase().replace(/\s/g, ""));                                                  // Hash table
    if (!v) return json(res, 404, { error: "Vehicle not found." });
    const k = url.searchParams.get("sort");
    return json(res, 200, vehicleJson(v, COLS.includes(k) ? k : "t", url.searchParams.get("dir")));
  }
  if (p === "/api/fleet") {
    if (user.role !== "admin") return json(res, 403, { error: "Admin only." });
    const h = new MinHeap(hot.f); h.a = [...hot.a];                                                                                      // copy heap, then pop
    const top = []; while (h.size) top.push(h.pop()); top.reverse();
    const all = bst.inorder(), pick = v => ({ no: v.no, model: v.model, soh: v.soh });                                                 // BST in-order
    return json(res, 200, { vehicles: all.length, buckets: V.b.length, hottest: top, lowest: all.slice(0, 5).map(pick),
      highest: all.slice(-5).reverse().map(pick), logins: [...auth.logs].slice(0, 15) });
  }
  json(res, 404, { error: "Not found." });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x"), user = auth.userFromToken(cookie(req, "cs_ds"));
    if (url.pathname.startsWith("/api/")) return await api(req, res, url, user);
    let f = url.pathname === "/" ? "/index.html" : url.pathname;
    if (f === "/index.html" && !user) { res.writeHead(302, { Location: "/login.html" }); return res.end(); }
    const file = path.normalize(path.join(PUB, f));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); fs.createReadStream(file).pipe(res);
  } catch (e) { console.error(e); json(res, 500, { error: "Server error" }); }
}).listen(PORT, () => console.log(`CellScope (Data Structures) on http://localhost:${PORT}`));
