// Render the current Figma selection (or a nodeId) to a PNG via the plugin,
// save it under .runtime/, and print the file path.
//
//   node tools/figma_bridge/render.js            # renders current selection
//   node tools/figma_bridge/render.js 24:43976   # renders a specific node

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, ".runtime");
const INBOX = path.join(ROOT, "inbox");
const OUTBOX = path.join(ROOT, "outbox");
for (const d of [INBOX, OUTBOX]) fs.mkdirSync(d, { recursive: true });

const nodeId = process.argv[2];
const scale = process.argv[3] ? Number(process.argv[3]) : 2;
const stamp = Date.now();
const cmdId = "render-" + stamp;
const cmd = { type: "render", cmdId: cmdId, payload: nodeId ? { nodeId: nodeId, scale: scale } : { scale: scale } };
fs.writeFileSync(path.join(OUTBOX, "cmd-" + stamp + ".json"), JSON.stringify(cmd));

const seen = new Set(fs.readdirSync(INBOX));
const deadline = Date.now() + 30000;
const timer = setInterval(() => {
  for (const f of fs.readdirSync(INBOX)) {
    if (seen.has(f)) continue;
    seen.add(f);
    try {
      const m = JSON.parse(fs.readFileSync(path.join(INBOX, f), "utf8"));
      if (m && m.id === cmdId) {
        clearInterval(timer);
        if (m.error) { console.error("error: " + m.error); process.exit(2); }
        const b64 = (m.data || {}).png_base64;
        if (!b64) { console.error("no image in reply"); process.exit(3); }
        const out = path.join(ROOT, "render-" + stamp + ".png");
        fs.writeFileSync(out, Buffer.from(b64, "base64"));
        console.log(out);
        process.exit(0);
      }
    } catch (e) {}
  }
  if (Date.now() > deadline) {
    clearInterval(timer);
    console.error("timeout (is the plugin Connected and something selected?)");
    process.exit(2);
  }
}, 400);
