// Oscarly Design Export — Figma plugin (main thread, runs in the Figma sandbox).
//
// Two modes, one plugin:
//   • Tokens     — all local variables (colors/numbers/strings), color styles, text styles.
//   • Components — master components (or the current selection): size, auto-layout,
//                  fills, strokes, corner radius, shadows, text styling, and the bound
//                  token name where a fill/stroke is linked to a variable.
//
// Uses the Plugin API (not the Dev Mode MCP server), so it is NOT subject to the
// MCP tool-call rate limit.

figma.showUI(__html__, { width: 560, height: 720, themeColors: true });

const MIXED = figma.mixed;

// --- shared helpers --------------------------------------------------------

function r(n) {
  return typeof n === "number" ? Math.round(n * 100) / 100 : n;
}

function ch(v) {
  return Math.round(v * 255).toString(16).padStart(2, "0").toUpperCase();
}

function rgbaToHex(c) {
  const a = c.a === undefined ? 1 : c.a;
  const hex = "#" + ch(c.r) + ch(c.g) + ch(c.b);
  return a < 1 ? hex + ch(a) : hex;
}

// Resolve a bound-variable id to its token name (cached).
const varNameCache = {};
async function varName(id) {
  if (varNameCache[id] !== undefined) return varNameCache[id];
  try {
    const v = await figma.variables.getVariableByIdAsync(id);
    varNameCache[id] = v ? v.name : null;
  } catch (e) {
    varNameCache[id] = null;
  }
  return varNameCache[id];
}

// ===========================================================================
// MODE 1: TOKENS
// ===========================================================================

function lhToString(lh) {
  if (!lh || lh.unit === "AUTO") return "auto";
  if (lh.unit === "PERCENT") return lh.value + "%";
  return lh.value;
}

function lsToString(ls) {
  if (!ls) return 0;
  if (ls.unit === "PERCENT") return ls.value + "%";
  return ls.value;
}

async function exportTokens() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const allVars = await figma.variables.getLocalVariablesAsync();

  const varById = {};
  for (const v of allVars) varById[v.id] = v;

  function resolve(value, modeId, depth) {
    if (depth > 12) return value;
    if (value && value.type === "VARIABLE_ALIAS") {
      const target = varById[value.id];
      if (!target) return null;
      const keys = Object.keys(target.valuesByMode);
      const next =
        target.valuesByMode[modeId] !== undefined
          ? target.valuesByMode[modeId]
          : target.valuesByMode[keys[0]];
      return resolve(next, modeId, depth + 1);
    }
    return value;
  }

  const out = { collections: [], colorStyles: [], textStyles: [] };

  for (const col of collections) {
    const modeName = {};
    col.modes.forEach((m) => (modeName[m.modeId] = m.name));

    const colObj = { name: col.name, modes: col.modes.map((m) => m.name), variables: [] };
    for (const v of allVars.filter((x) => x.variableCollectionId === col.id)) {
      const entry = { name: v.name, type: v.resolvedType, values: {} };
      for (const modeId of Object.keys(v.valuesByMode)) {
        let val = resolve(v.valuesByMode[modeId], modeId, 0);
        if (v.resolvedType === "COLOR" && val && typeof val === "object" && "r" in val) {
          val = rgbaToHex(val);
        }
        entry.values[modeName[modeId] || modeId] = val;
      }
      colObj.variables.push(entry);
    }
    out.collections.push(colObj);
  }

  const paintStyles = await figma.getLocalPaintStylesAsync();
  for (const s of paintStyles) {
    const p = s.paints[0];
    let value = null;
    let stops;
    if (p && p.type === "SOLID") {
      value = rgbaToHex({
        r: p.color.r,
        g: p.color.g,
        b: p.color.b,
        a: p.opacity === undefined ? 1 : p.opacity,
      });
    } else if (p && p.type.indexOf("GRADIENT_") === 0) {
      stops = (p.gradientStops || []).map((g) => ({
        color: rgbaToHex(g.color),
        position: Math.round(g.position * 100) / 100,
      }));
    }
    out.colorStyles.push({ name: s.name, value: value, paintType: p ? p.type : null, stops: stops });
  }

  const textStyles = await figma.getLocalTextStylesAsync();
  for (const s of textStyles) {
    out.textStyles.push({
      name: s.name,
      family: s.fontName.family,
      style: s.fontName.style,
      size: s.fontSize,
      lineHeight: lhToString(s.lineHeight),
      letterSpacing: lsToString(s.letterSpacing),
      textCase: s.textCase,
      textDecoration: s.textDecoration,
    });
  }

  const summary = {
    collections: out.collections.length,
    variables: out.collections.reduce((n, c) => n + c.variables.length, 0),
    colorStyles: out.colorStyles.length,
    textStyles: out.textStyles.length,
  };
  return { summaryText: tokenSummary(summary), data: out };
}

function tokenSummary(s) {
  return (
    s.collections + " collections · " + s.variables + " variables · " +
    s.colorStyles + " color styles · " + s.textStyles + " text styles"
  );
}

// ===========================================================================
// MODE 2: COMPONENTS
// ===========================================================================

function corner(node) {
  if (!("cornerRadius" in node) || node.cornerRadius === undefined) return undefined;
  if (node.cornerRadius !== MIXED) return r(node.cornerRadius);
  return {
    tl: node.topLeftRadius,
    tr: node.topRightRadius,
    br: node.bottomRightRadius,
    bl: node.bottomLeftRadius,
  };
}

function effects(node) {
  if (!("effects" in node) || !node.effects || !node.effects.length) return undefined;
  const out = node.effects
    .filter((e) => e.visible !== false)
    .map((e) => {
      const o = { type: e.type };
      if (e.color) o.color = rgbaToHex(e.color);
      if (e.offset) o.offset = { x: r(e.offset.x), y: r(e.offset.y) };
      if (e.radius !== undefined) o.blur = r(e.radius);
      if (e.spread !== undefined) o.spread = r(e.spread);
      return o;
    });
  return out.length ? out : undefined;
}

async function paintInfo(paint) {
  if (paint.type === "SOLID") {
    const o = paint.opacity === undefined ? 1 : paint.opacity;
    const res = { hex: rgbaToHex({ r: paint.color.r, g: paint.color.g, b: paint.color.b, a: o }) };
    if (paint.boundVariables && paint.boundVariables.color) {
      res.token = await varName(paint.boundVariables.color.id);
    }
    return res;
  }
  if (paint.type.indexOf("GRADIENT_") === 0) {
    return {
      type: paint.type,
      stops: (paint.gradientStops || []).map((g) => ({
        color: rgbaToHex(g.color),
        position: Math.round(g.position * 100) / 100,
      })),
    };
  }
  return { type: paint.type };
}

async function firstFill(node) {
  if (!("fills" in node) || !node.fills || node.fills === MIXED) return undefined;
  const f = node.fills.find((p) => p.visible !== false);
  return f ? await paintInfo(f) : undefined;
}

async function firstStroke(node) {
  if (!("strokes" in node) || !node.strokes || !node.strokes.length) return undefined;
  const s = node.strokes.find((p) => p.visible !== false);
  if (!s) return undefined;
  const info = await paintInfo(s);
  if (node.strokeWeight !== undefined && node.strokeWeight !== MIXED) info.weight = node.strokeWeight;
  return info;
}

function lh(node) {
  if (node.lineHeight === MIXED || !node.lineHeight) return undefined;
  if (node.lineHeight.unit === "AUTO") return "auto";
  return node.lineHeight.unit === "PERCENT" ? node.lineHeight.value + "%" : node.lineHeight.value;
}

function ls(node) {
  if (node.letterSpacing === MIXED || !node.letterSpacing) return undefined;
  return node.letterSpacing.unit === "PERCENT" ? node.letterSpacing.value + "%" : node.letterSpacing.value;
}

async function textInfo(node) {
  const t = { characters: node.characters };
  t.fontSize = node.fontSize === MIXED ? "mixed" : node.fontSize;
  if (node.fontName !== MIXED) {
    t.fontFamily = node.fontName.family;
    t.fontStyle = node.fontName.style;
  }
  const l = lh(node);
  if (l !== undefined) t.lineHeight = l;
  const sp = ls(node);
  if (sp !== undefined) t.letterSpacing = sp;
  if (node.textCase && node.textCase !== "ORIGINAL") t.textCase = node.textCase;
  const fill = await firstFill(node);
  if (fill) t.color = fill;
  return t;
}

async function spec(node, depth, maxDepth) {
  const s = { id: node.id, name: node.name, type: node.type, w: r(node.width), h: r(node.height) };

  if ("opacity" in node && node.opacity !== undefined && node.opacity < 1) s.opacity = r(node.opacity);

  if ("layoutMode" in node && node.layoutMode && node.layoutMode !== "NONE") {
    s.layout = node.layoutMode;
    s.padding = { l: node.paddingLeft, r: node.paddingRight, t: node.paddingTop, b: node.paddingBottom };
    s.gap = node.itemSpacing;
    s.primaryAxis = node.primaryAxisAlignItems;
    s.counterAxis = node.counterAxisAlignItems;
  }

  const c = corner(node);
  if (c !== undefined) s.radius = c;

  const fill = await firstFill(node);
  if (fill) s.fill = fill;

  const stroke = await firstStroke(node);
  if (stroke) s.stroke = stroke;

  const ef = effects(node);
  if (ef) s.effects = ef;

  if (node.type === "TEXT") s.text = await textInfo(node);

  if ("children" in node && depth < maxDepth) {
    const kids = [];
    for (const child of node.children.slice(0, 24)) {
      if (child.visible === false) continue;
      kids.push(await spec(child, depth + 1, maxDepth));
    }
    if (kids.length) s.children = kids;
  }
  return s;
}

function propDefs(node) {
  if (!node.componentPropertyDefinitions) return undefined;
  const defs = node.componentPropertyDefinitions;
  const keys = Object.keys(defs);
  if (!keys.length) return undefined;
  return keys.map((k) => {
    const d = defs[k];
    const o = { name: k, type: d.type };
    if (d.variantOptions) o.options = d.variantOptions;
    if (d.defaultValue !== undefined) o.default = d.defaultValue;
    return o;
  });
}

async function exportComponents(keywords, maxDepth) {
  await figma.loadAllPagesAsync();

  let nodes = [];
  for (const page of figma.root.children) {
    nodes = nodes.concat(page.findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] }));
  }
  nodes = nodes.filter((n) => !(n.type === "COMPONENT" && n.parent && n.parent.type === "COMPONENT_SET"));
  if (keywords.length) {
    nodes = nodes.filter((n) => keywords.some((k) => n.name.toLowerCase().includes(k)));
  }

  const components = [];
  for (const n of nodes) {
    const entry = { name: n.name, kind: n.type };
    const props = propDefs(n);
    if (props) entry.properties = props;
    let target = n;
    if (n.type === "COMPONENT_SET") {
      entry.variants = n.children.map((c) => c.name);
      // Per-variant top-level fill/stroke — so accent colors of selected/active
      // states are visible without exporting each full tree.
      entry.variantFills = [];
      for (const v of n.children.slice(0, 80)) {
        entry.variantFills.push({
          name: v.name,
          fill: await firstFill(v),
          stroke: await firstStroke(v),
        });
      }
      target = n.children[0] || n;
    }
    entry.spec = await spec(target, 0, maxDepth);
    components.push(entry);
  }
  return components;
}

async function exportSelection(maxDepth) {
  const out = [];
  for (const n of figma.currentPage.selection) {
    const entry = { name: n.name, kind: n.type };
    const props = propDefs(n);
    if (props) entry.properties = props;
    if (n.type === "COMPONENT_SET") entry.variants = n.children.map((c) => c.name);
    entry.spec = await spec(n, 0, maxDepth);
    out.push(entry);
  }
  return out;
}

// ===========================================================================
// WRITE-BACK OPS (Claude → Figma)
// ===========================================================================

function hexToRgb(hex) {
  const h = String(hex).replace("#", "");
  return {
    r: parseInt(h.substr(0, 2), 16) / 255,
    g: parseInt(h.substr(2, 2), 16) / 255,
    b: parseInt(h.substr(4, 2), 16) / 255,
    a: h.length >= 8 ? parseInt(h.substr(6, 2), 16) / 255 : 1,
  };
}

async function applyOp(type, payload) {
  payload = payload || {};
  const node = await figma.getNodeByIdAsync(payload.nodeId);
  if (!node) throw new Error("node not found: " + payload.nodeId);

  if (type === "apply.rename") {
    node.name = String(payload.name);
    return { ok: true, nodeId: node.id, name: node.name };
  }
  if (type === "apply.setFill") {
    if (!("fills" in node)) throw new Error(node.type + " has no fills");
    const c = hexToRgb(payload.hex);
    node.fills = [{ type: "SOLID", color: { r: c.r, g: c.g, b: c.b }, opacity: c.a }];
    return { ok: true, nodeId: node.id, hex: payload.hex };
  }
  throw new Error("unknown op: " + type);
}

// ===========================================================================
// MESSAGE BRIDGE
// ===========================================================================
// `msg.cmdId` (optional) correlates a request from the Claude bridge with its
// reply, so the UI can route the result back to the local server.

figma.ui.onmessage = async (msg) => {
  const cmdId = msg.cmdId;
  const reply = (extra) =>
    figma.ui.postMessage(Object.assign({ type: "result", cmdId: cmdId }, extra));
  const fail = (m) => figma.ui.postMessage({ type: "error", cmdId: cmdId, message: m });

  try {
    if (msg.type === "close") return figma.closePlugin();
    if (msg.type === "notify") return figma.notify(msg.message);

    if (msg.type === "ping") {
      return reply({ summaryText: "pong", data: { pong: true, page: figma.currentPage.name } });
    }

    if (msg.type === "tokens") {
      const t = await exportTokens();
      return reply({ summaryText: t.summaryText, data: t.data });
    }

    if (msg.type === "render") {
      const p = msg.payload || {};
      const node = p.nodeId
        ? await figma.getNodeByIdAsync(p.nodeId)
        : figma.currentPage.selection[0];
      if (!node) return fail("Nothing to render — select a layer or pass a nodeId.");
      const scale = p.scale || 2;
      const bytes = await node.exportAsync({ format: "PNG", constraint: { type: "SCALE", value: scale } });
      return reply({
        summaryText: "rendered " + node.name,
        data: { nodeId: node.id, name: node.name, png_base64: figma.base64Encode(bytes) },
      });
    }

    if (msg.type === "inspect") {
      const p = msg.payload || {};
      const node = p.nodeId
        ? await figma.getNodeByIdAsync(p.nodeId)
        : figma.currentPage.selection[0];
      if (!node) return fail("Nothing to inspect — select a layer or pass a nodeId.");
      const depth = p.depth || 8;
      const s = await spec(node, 0, depth);
      return reply({ summaryText: "inspected " + node.name, data: { spec: s } });
    }

    if (msg.type === "export_assets") {
      const p = msg.payload || {};
      const fmt = (p.format || "SVG").toUpperCase();
      await figma.loadAllPagesAsync();

      let targets = [];
      if (p.selection) {
        targets = figma.currentPage.selection.slice();
      } else {
        const kws = (p.keywords || "")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        let sets = [];
        for (const page of figma.root.children) {
          sets = sets.concat(page.findAllWithCriteria({ types: ["COMPONENT_SET", "COMPONENT"] }));
        }
        sets = sets.filter((n) => !(n.type === "COMPONENT" && n.parent && n.parent.type === "COMPONENT_SET"));
        if (kws.length) sets = sets.filter((n) => kws.some((k) => n.name.toLowerCase().includes(k)));
        for (const s of sets) {
          if (s.type === "COMPONENT_SET") {
            for (const c of s.children) targets.push(c);
          } else {
            targets.push(s);
          }
        }
      }

      const offset = p.offset || 0;
      const limit = Math.min(p.limit || 40, 60);
      const slice = targets.slice(offset, offset + limit);
      const assets = [];
      for (const node of slice) {
        try {
          const opts = fmt === "PNG"
            ? { format: "PNG", constraint: { type: "SCALE", value: 3 } }
            : { format: "SVG" };
          const bytes = await node.exportAsync(opts);
          const nm = node.parent && node.parent.type === "COMPONENT_SET"
            ? node.parent.name + "-" + node.name
            : node.name;
          assets.push({ name: nm, data_base64: figma.base64Encode(bytes) });
        } catch (e) {
          assets.push({ name: node.name, error: String(e) });
        }
      }
      return reply({
        summaryText: "exported " + assets.length + "/" + targets.length + " " + fmt,
        data: { format: fmt, total: targets.length, offset: offset, count: slice.length, assets: assets },
      });
    }

    if (msg.type === "export_icons") {
      const p = msg.payload || {};
      const sel = !!p.selection;
      // Default: small INSTANCE nodes across the doc. Selection mode: any small
      // icon-sized node (frame/instance/group/vector) inside the selection — for
      // capturing icons baked into a component (e.g. the bottom nav).
      const cands = [];
      function isIcon(n) {
        const w = n.width || 0;
        const h = n.height || 0;
        if (w < 12 || w > 48 || h < 12 || h > 48) return false;
        if (sel) {
          return ["FRAME", "INSTANCE", "GROUP", "COMPONENT", "VECTOR", "BOOLEAN_OPERATION"].indexOf(n.type) >= 0;
        }
        return n.type === "INSTANCE";
      }
      function walk(n) {
        if (isIcon(n)) { cands.push(n); return; }
        if ("children" in n && n.children) {
          for (const c of n.children) {
            if (c.visible !== false) walk(c);
          }
        }
      }
      let roots = [];
      if (sel) {
        roots = figma.currentPage.selection.slice();
      } else {
        await figma.loadAllPagesAsync();
        for (const page of figma.root.children) roots = roots.concat(page.children);
      }
      for (const r of roots) walk(r);
      const offset = p.offset || 0;
      const limit = Math.min(p.limit || 30, 40);
      const slice = cands.slice(offset, offset + limit);
      const assets = [];
      for (const node of slice) {
        try {
          let name = node.name;
          try {
            const mc = await node.getMainComponentAsync();
            if (mc && mc.name) name = mc.name;
          } catch (e) {}
          const bytes = await node.exportAsync({ format: "SVG" });
          assets.push({ name: name, data_base64: figma.base64Encode(bytes) });
        } catch (e) {
          assets.push({ name: node.name, error: String(e) });
        }
      }
      return reply({
        summaryText: "icon-instances " + (offset + slice.length) + "/" + cands.length,
        data: { total: cands.length, offset: offset, count: slice.length, assets: assets },
      });
    }

    if (msg.type === "export_flow") {
      // Reads prototype "reactions" → which element on each screen navigates
      // where, so the app's routes can mirror the prototype.
      await figma.loadAllPagesAsync();
      const screens = [];
      const topName = {}; // top-level frame id -> name
      const edges = [];

      function walk(n, screenName) {
        if (n.reactions && n.reactions.length) {
          for (const r of n.reactions) {
            const acts = r.actions || (r.action ? [r.action] : []);
            for (const a of acts) {
              if (a && a.type === "NODE" && a.destinationId) {
                edges.push({
                  from: screenName,
                  element: n.name,
                  trigger: (r.trigger && r.trigger.type) || "ON_CLICK",
                  navigation: a.navigation || null,
                  toId: a.destinationId,
                });
              }
            }
          }
        }
        if ("children" in n && n.children) {
          for (const c of n.children) walk(c, screenName);
        }
      }

      for (const page of figma.root.children) {
        for (const frame of page.children) {
          screens.push({ id: frame.id, name: frame.name });
          topName[frame.id] = frame.name;
          walk(frame, frame.name);
        }
      }

      for (const e of edges) {
        e.to = topName[e.toId] || null;
        if (!e.to) {
          try {
            let t = await figma.getNodeByIdAsync(e.toId);
            while (t && t.parent && t.parent.type !== "PAGE") t = t.parent;
            if (t) e.to = t.name;
          } catch (err) {}
        }
      }

      return reply({
        summaryText: "flow: " + edges.length + " navigations / " + screens.length + " screens",
        data: { screens: screens, edges: edges },
      });
    }

    if (msg.type === "components" || msg.type === "selection") {
      const maxDepth = Math.max(1, Math.min(8, Number(msg.depth) || 4));
      let components;
      if (msg.type === "selection") {
        if (!figma.currentPage.selection.length) return fail("Nothing selected on the canvas.");
        components = await exportSelection(maxDepth);
      } else {
        const keywords = (msg.keywords || "")
          .split(",")
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean);
        components = await exportComponents(keywords, maxDepth);
      }
      const data = {
        source: "perfume-APP-flow",
        mode: msg.type,
        depth: maxDepth,
        count: components.length,
        components: components,
      };
      return reply({
        summaryText: components.length + " component(s) · mode: " + msg.type + " · depth: " + maxDepth,
        data: data,
      });
    }

    if (msg.type && msg.type.indexOf("apply.") === 0) {
      const result = await applyOp(msg.type, msg.payload);
      return reply({ summaryText: msg.type + " ok", data: result });
    }
  } catch (e) {
    fail(String((e && e.stack) || e));
  }
};
