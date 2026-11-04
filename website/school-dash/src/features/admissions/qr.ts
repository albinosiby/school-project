// Minimal QR code generator (byte mode, ECC level L, versions 1-6, fixed mask 0). Returns a boolean module matrix.
const EXP: number[] = [], LOG: number[] = new Array(256).fill(0);
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!; }
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a]! + LOG[b]!]! : 0);
function rsGen(deg: number) { let g = [1]; for (let i = 0; i < deg; i++) { const n = new Array(g.length + 1).fill(0); g.forEach((c, j) => { n[j] ^= c; n[j + 1] ^= mul(c, EXP[i]!); }); g = n; } return g; }
function rsRem(data: number[], deg: number) {
  const g = rsGen(deg), r = new Array(deg).fill(0);
  for (const b of data) { const f = b ^ r.shift()!; r.push(0); for (let i = 0; i < deg; i++) r[i] ^= mul(g[i + 1]!, f); }
  return r as number[];
}
// [total codewords, ecc per block, blocks, alignment centre]
const VER: [number, number, number, number | null][] = [[26, 7, 1, null], [44, 10, 1, 18], [70, 15, 1, 22], [100, 20, 1, 26], [134, 26, 1, 30], [172, 18, 2, 34]];

export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text));
  let v = 0;
  while (v < VER.length) { const [t, e, b] = VER[v]!; if (bytes.length + 2 <= t - e * b) break; v++; }
  if (v >= VER.length) throw new Error("QR payload too long");
  const [total, eccLen, blocks, align] = VER[v]!;
  const dataCw = total - eccLen * blocks, size = 21 + 4 * v;
  const bits: number[] = [];
  const push = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(4, 4); push(bytes.length, 8); bytes.forEach((b) => push(b, 8));
  push(0, Math.min(4, dataCw * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const cw: number[] = [];
  for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let p = 0xec; cw.length < dataCw; p ^= 0xec ^ 0x11) cw.push(p);
  const per = dataCw / blocks, dBlocks: number[][] = [], eBlocks: number[][] = [];
  for (let b = 0; b < blocks; b++) { const d = cw.slice(b * per, (b + 1) * per); dBlocks.push(d); eBlocks.push(rsRem(d, eccLen)); }
  const final: number[] = [];
  for (let i = 0; i < per; i++) dBlocks.forEach((d) => final.push(d[i]!));
  for (let i = 0; i < eccLen; i++) eBlocks.forEach((e) => final.push(e[i]!));

  const m: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x: number, y: number, d: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y]![x] = d; fn[y]![x] = true; } };
  const finder = (cx: number, cy: number) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 4 && d !== 2); } };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  if (align) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(align + dx, align + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  // format bits (ECC L = 01, mask 0)
  const data = (1 << 3) | 0; let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const fmt = ((data << 10) | rem) ^ 0x5412, bit = (i: number) => ((fmt >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
  // data
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y]![x] && k < final.length * 8) { m[y]![x] = ((final[k >> 3]! >>> (7 - (k & 7))) & 1) !== 0; k++; }
    }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y]![x] && (x + y) % 2 === 0) m[y]![x] = !m[y]![x];
  return m;
}

export function qrSvg(text: string, opts: { margin?: number; dark?: string; light?: string } = {}) {
  const m = qrMatrix(text), n = m.length, mg = opts.margin ?? 2, dark = opts.dark ?? "#000", light = opts.light ?? "#fff";
  let d = "";
  m.forEach((row, y) => row.forEach((c, x) => { if (c) d += `M${x + mg} ${y + mg}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + mg * 2} ${n + mg * 2}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
