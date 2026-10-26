// Send one command to the plugin and wait (synchronously) for its reply.
// Prints the plugin's response JSON to stdout, or exits non-zero on timeout.
//
//   node tools/figma_bridge/request.js ping
//   node tools/figma_bridge/request.js components '{"keywords":"button","depth":4}'
//   node tools/figma_bridge/request.js apply.setFill '{"payload":{"nodeId":"1:2","hex":"#169DA6"}}'
//
// Requires the server to be running AND the plugin's Bridge tab to be Connected.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, ".runtime");
const INBOX = path.join(ROOT, "inbox");
const OUTBOX = path.join(ROOT, "outbox");
for (const d of [INBOX, OUTBOX]) fs.mkdirSync(d, { recursive: true });

const type = process.argv[2];
if (!type) {
  console.error("usage: node request.js <type> [jsonPayload]");
  process.exit(1);
}
const extra = process.argv[3] ? JSON.parse(process.argv[3]) : {};
const cmdId = "req-" + Date.now();
const cmd = Object.assign({ type: type, cmdId: cmdId }, extra);

fs.writeFileSync(path.join(OUTBOX, "cmd-" + Date.now() + ".json"), JSON.stringify(cmd));

const seen = new Set(fs.readdirSync(INBOX));
const deadline = Date.now() + 25000;
const timer = setInterval(() => {
  for (const f of fs.readdirSync(INBOX)) {
    if (seen.has(f)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(INBOX, f), "utf8"));
      if (m && (m.id === cmdId || m.cmdId === cmdId)) {
        clearInterval(timer);
        process.stdout.write(JSON.stringify(m));
        process.exit(0);
      }
    } catch (e) {}
    seen.add(f);
  }
  if (Date.now() > deadline) {
    clearInterval(timer);
    console.error("timeout: no reply for " + cmdId + " (is the server running and the plugin Connected?)");
    process.exit(2);
  }
}, 400);
