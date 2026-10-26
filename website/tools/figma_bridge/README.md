# Oscarly Figma Bridge

A tiny **localhost** relay that lets the Figma plugin and Claude talk **both ways**
without MCP and without copy/paste:

```
Figma plugin (Bridge tab) ⇄ http://localhost:3897 (this server) ⇄ files ⇄ Claude
```

- **Plugin → Claude:** the plugin POSTs export results to `/from-plugin`; the server
  writes them to `.runtime/inbox/` (and `.runtime/last.json`). Claude reads those.
- **Claude → Plugin:** Claude drops command files in `.runtime/outbox/`; the plugin
  polls `/to-plugin`, runs them, and posts the result back.

Bound to `127.0.0.1` only. No external network, no dependencies (Node http + fs).
`.runtime/` is gitignored.

## Start the server

```bash
node tools/figma_bridge/server.js
```

Leave it running. (Claude runs it in the background.)

## Connect the plugin

1. Run **Plugins → Development → Oscarly Design Export** in the Figma desktop app.
2. Open the **Bridge** tab → **Connect to Claude** (URL `http://localhost:3897`).
3. The status dot turns green. Now:
   - Any export you click is also sent to Claude automatically.
   - Claude can request exports and push edits on its own.

## How Claude drives it

Request + wait for the reply in one call:

```bash
node tools/figma_bridge/request.js ping
node tools/figma_bridge/request.js tokens
node tools/figma_bridge/request.js components '{"keywords":"button","depth":4}'
node tools/figma_bridge/request.js selection '{"depth":5}'
```

Write back into Figma:

```bash
node tools/figma_bridge/request.js apply.rename  '{"payload":{"nodeId":"1:23","name":"Button/Primary"}}'
node tools/figma_bridge/request.js apply.setFill '{"payload":{"nodeId":"1:23","hex":"#169DA6"}}'
```

Or fire-and-forget (no wait): `node tools/figma_bridge/server.js send '{"type":"ping","cmdId":"c1"}'`
and read `.runtime/last.json` / `.runtime/inbox/`.

## Command reference

| type | payload | direction |
|------|---------|-----------|
| `ping` | — | health check, returns current page |
| `tokens` | — | export variables + styles |
| `components` | `{keywords, depth}` | scan master components |
| `selection` | `{depth}` | export current canvas selection |
| `apply.rename` | `{payload:{nodeId, name}}` | rename a node in Figma |
| `apply.setFill` | `{payload:{nodeId, hex}}` | set a node's solid fill |

`apply.*` ops are intentionally small/safe; extend `applyOp()` in
`tools/figma_token_export/code.js` for more write-back operations.
