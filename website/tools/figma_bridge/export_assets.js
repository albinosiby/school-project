// Pull assets from Figma via the plugin, in batches, and write them to the repo.
//
//   node tools/figma_bridge/export_assets.js svg "icon,remix,graph"   # icon SVGs -> assets/icons
//   node tools/figma_bridge/export_assets.js png "hero,banner"        # PNGs       -> assets/images
//   node tools/figma_bridge/export_assets.js svg selection            # current selection as SVG
//
// Requires the server running and the plugin's Bridge tab Connected.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, ".runtime");
const INBOX = path.join(ROOT, "inbox");
const OUTBOX = path.join(ROOT, "outbox");
for (const d of [INBOX, OUTBOX]) fs.mkdirSync(d, { recursive: true });

const format = (process.argv[2] || "svg").toLowerCase();
const arg = process.argv[3] || "icon,remix,graph";
const useSelection = arg.toLowerCase() === "selection";
const OUTDIR = path.join(__dirname, "..", "..", "assets", format === "svg" ? "icons" : "images");
fs.mkdirSync(OUTDIR, { recursive: true });

let counter = 0;
function sanitize(n) {
  return n.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "asset";
}

function sendAndWait(cmd) {
  return new Promise((resolve, reject) => {
    fs.writeFileSync(path.join(OUTBOX, "cmd-" + Date.now() + "-" + counter++ + ".json"), JSON.stringify(cmd));
    const seen = new Set(fs.readdirSync(INBOX));
    const deadline = Date.now() + 90000;
    const t = setInterval(() => {
      for (const f of fs.readdirSync(INBOX)) {
        if (seen.has(f)) continue;
        seen.add(f);
        try {
          const m = JSON.parse(fs.readFileSync(path.join(INBOX, f), "utf8"));
          if (m && m.id === cmd.cmdId) {
            clearInterval(t);
            return resolve(m);
          }
        } catch (e) {}
      }
      if (Date.now() > deadline) {
        clearInterval(t);
        reject(new Error("timeout (plugin connected? something selected?)"));
      }
    }, 400);
  });
}

(async () => {
  let offset = 0, total = null, written = 0, batch = 0;
  const names = new Set();
  do {
    const cmd = {
      type: "export_assets",
      cmdId: "exp-" + Date.now() + "-" + offset,
      payload: {
        format: format.toUpperCase(),
        offset: offset,
        limit: 40,
        selection: useSelection,
        keywords: useSelection ? "" : arg,
      },
    };
    const m = await sendAndWait(cmd);
    if (m.error) { console.error("error:", m.error); process.exit(2); }
    const d = m.data;
    total = d.total;
    for (const a of d.assets) {
      if (a.error || !a.data_base64) continue;
      let base = sanitize(a.name);
      let fn = base + (format === "svg" ? ".svg" : ".png");
      let k = 2;
      while (names.has(fn)) { fn = base + "_" + k++ + (format === "svg" ? ".svg" : ".png"); }
      names.add(fn);
      fs.writeFileSync(path.join(OUTDIR, fn), Buffer.from(a.data_base64, "base64"));
      written++;
    }
    offset += d.count;
    batch++;
    console.log("batch " + batch + ": +" + d.count + "  (" + offset + "/" + total + ")");
    if (d.count === 0) break;
  } while (offset < total && batch < 60);

  console.log("done: " + written + " files -> " + OUTDIR);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
