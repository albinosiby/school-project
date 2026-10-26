// Oscarly Figma Bridge — local two-way relay between the Figma plugin and Claude.
//
// Zero dependencies (Node http + fs). Bound to 127.0.0.1 only.
//
//   plugin  --POST /from-plugin-->  .runtime/inbox/   (Claude reads)
//   plugin  --GET  /to-plugin  -->  .runtime/outbox/  (Claude writes commands)
//
// Run:    node tools/figma_bridge/server.js
// Queue:  node tools/figma_bridge/server.js send '{"type":"ping","cmdId":"c1"}'

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3897;
const ROOT = path.join(__dirname, ".runtime");
const INBOX = path.join(ROOT, "inbox");
const OUTBOX = path.join(ROOT, "outbox");
const LOG = path.join(ROOT, "log.txt");
const LAST = path.join(ROOT, "last.json");

for (const d of [ROOT, INBOX, OUTBOX]) fs.mkdirSync(d, { recursive: true });

let seq = 0;
function stamp() {
  seq += 1;
  return Date.now() + "-" + String(seq).padStart(4, "0");
}

function log(line) {
  const s = "[" + new Date().toISOString() + "] " + line + "\n";
  process.stdout.write(s);
  try { fs.appendFileSync(LOG, s); } catch (e) {}
}

// CLI: queue a command for the plugin, then exit.
if (process.argv[2] === "send") {
  const raw = process.argv[3] || "{}";
  JSON.parse(raw); // validate
  const file = path.join(OUTBOX, "cmd-" + stamp() + ".json");
  fs.writeFileSync(file, raw);
  console.log("queued " + path.basename(file));
  process.exit(0);
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
function json(res, code, obj) {
  cors(res);
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}
function readBody(req) {
  return new Promise((resolve) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => resolve(b));
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");

  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && u.pathname === "/health") {
    const pending = fs.readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).length;
    return json(res, 200, { ok: true, pending: pending });
  }

  if (req.method === "POST" && u.pathname === "/from-plugin") {
    const body = await readBody(req);
    let msg;
    try { msg = JSON.parse(body); } catch (e) { return json(res, 400, { ok: false, error: "bad json" }); }
    const type = (msg && msg.type) || "message";
    const safe = type.replace(/[^a-z0-9._-]/gi, "_");
    const file = path.join(INBOX, stamp() + "-" + safe + ".json");
    fs.writeFileSync(file, JSON.stringify(msg, null, 2));
    fs.writeFileSync(LAST, JSON.stringify(msg, null, 2));
    log("◀ from-plugin: " + type + " (" + body.length + " bytes) → " + path.basename(file));
    return json(res, 200, { ok: true });
  }

  if (req.method === "GET" && u.pathname === "/to-plugin") {
    const files = fs.readdirSync(OUTBOX).filter((f) => f.endsWith(".json")).sort();
    const commands = [];
    for (const f of files) {
      const p = path.join(OUTBOX, f);
      try { commands.push(JSON.parse(fs.readFileSync(p, "utf8"))); } catch (e) {}
      try { fs.unlinkSync(p); } catch (e) {}
    }
    if (commands.length) log("▶ to-plugin: dispatched " + commands.length + " command(s)");
    return json(res, 200, { commands: commands });
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(PORT, "127.0.0.1", () =>
  log("Oscarly Figma bridge listening on http://localhost:" + PORT)
);
