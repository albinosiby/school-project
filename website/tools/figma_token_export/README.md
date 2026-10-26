# Oscarly Design Export (Figma plugin)

One local Figma plugin with **two modes**:

- **Tokens** — exports all local **variables** (colors / numbers / strings), **color
  styles**, and **text styles** as JSON.
- **Components** — exports the **structure of your components** (buttons, text fields,
  chips, cards…): size, auto-layout (padding / gap / alignment), corner radius, fills,
  strokes, shadows, and text styling — plus the **bound token name** wherever a
  fill/stroke is linked to a variable (so components map back to `brand_tokens.dart`).

It uses the Figma **Plugin API**, which is separate from the Dev Mode **MCP** quota —
so it bypasses the "Starter plan tool-call limit" that blocks the MCP connector.

## Install (one time)

1. Open the **Figma desktop app** (plugins don't run in the browser).
2. Open the `perfume-APP-flow` file.
3. Menu → **Plugins → Development → Import plugin from manifest…**
4. Select `tools/figma_token_export/manifest.json` from this repo.

> If you imported the older "Oscarly Token Export", no need to re-import — the manifest
> path is unchanged; it now shows as **Oscarly Design Export** with both modes.

## Run

Menu → **Plugins → Development → Oscarly Design Export**, then pick a tab:

### Tokens
Click **Export tokens** → **Copy JSON** (or Download) → paste back into the chat.

### Components
- **Scan components** — walks every master component in the file. Optionally filter by
  name, e.g. `button, field, input, chip, card`, to keep the output focused.
- **Export selection** — select one or more nodes on the canvas first, then click this
  to export just those.
- **Depth** controls how deep the child tree is captured (default 4 is plenty).

Then **Copy JSON** / **Download .json** and paste it back.

## Notes

- Nothing is sent over the network (`networkAccess: none`).
- Color values resolve to hex; variable aliases are followed to their concrete value.
- In component output, `fill.token` / `stroke.token` is the design-system variable name —
  those translate directly to `BrandColors` / theme roles in Flutter.
- Gradients / images are reported by `type` (not flattened to a hex).
