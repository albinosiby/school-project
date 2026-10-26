// Deep-scan the Figma document for Iconify-style icon nodes (set:name) and
// export each unique one as SVG into assets/icons/.
//
//   node tools/figma_bridge/export_icons.js
//
// Requires the server running and the plugin's Bridge tab Connected.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, ".runtime");
const INBOX = path.join(ROOT, "inbox");
const OUTBOX = path.join(ROOT, "outbox");
for (const d of [INBOX, OUTBOX]) fs.mkdirSync(d, { recursive: true });
const OUTDIR = path.join(__dirname, "..", "..", "assets", "icons");
fs.mkdirSync(OUTDIR, { recursive: true });

let counter = 0;
function sanitize(n) {
  return n.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "icon";
}

function sendAndWait(cmd) {
  return new Promise((resolve, reject) => {
    fs.writeFileSync(path.join(OUTBOX, "cmd-" + Date.now() + "-" + counter++ + ".json"), JSON.stringify(cmd));
    const seen = new Set(fs.readdirSync(INBOX));
    const deadline = Date.now() + 120000;
    const t = setInterval(() => {
      for (const f of fs.readdirSync(INBOX)) {
        if (seen.has(f)) continue;
        seen.add(f);
        try {
          const m = JSON.parse(fs.readFileSync(path.join(INBOX, f), "utf8"));
          if (m && m.id === cmd.cmdId) { clearInterval(t); return resolve(m); }
        } catch (e) {}
      }
      if (Date.now() > deadline) { clearInterval(t); reject(new Error("timeout")); }
    }, 400);
  });
}

const selection = (process.argv[2] || "").toLowerCase() === "selection";

(async () => {
  let offset = 0, total = null, written = 0, batch = 0, dupes = 0;
  const used = new Set();
  const byHash = new Map(); // svg content hash -> filename (dedupe repeats across screens)
  do {
    const m = await sendAndWait({ type: "export_icons", cmdId: "ico-" + Date.now() + "-" + offset, payload: { offset, limit: 30, selection } });
    if (m.error) { console.error("error:", m.error); process.exit(2); }
    const d = m.data;
    total = d.total;
    for (const a of d.assets) {
      if (a.error || !a.data_base64) continue;
      const buf = Buffer.from(a.data_base64, "base64");
      const h = crypto.createHash("md5").update(buf).digest("hex");
      if (byHash.has(h)) { dupes++; continue; }
      let base = sanitize(a.name), fn = base + ".svg", k = 2;
      while (used.has(fn)) fn = base + "_" + k++ + ".svg";
      used.add(fn);
      byHash.set(h, fn);
      fs.writeFileSync(path.join(OUTDIR, fn), buf);
      written++;
    }
    offset += d.count;
    batch++;
    console.log("batch " + batch + ": scanned " + offset + "/" + total + "  (unique " + written + ", dupes " + dupes + ")");
    if (d.count === 0) break;
  } while (offset < total && batch < 120);
  console.log("done: " + written + " unique icons -> " + OUTDIR + " (skipped " + dupes + " duplicates)");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
