import { describe, expect, it } from "vitest";
import { qrMatrix, qrSvg } from "./qr";

// An independent reader: rebuilds the function-pattern map from the spec (versions 1-6), reads the codewords back in the
// zig-zag order, removes mask 0 and checks the Reed-Solomon syndromes. If the generator drifts, these fail.
const VER = [[26, 7, 1, null], [44, 10, 1, 18], [70, 15, 1, 22], [100, 20, 1, 26], [134, 26, 1, 30], [172, 18, 2, 34]] as const;
const EXP: number[] = [], LOG: number[] = [];
{ let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x = (x << 1) ^ (x & 0x80 ? 0x11d : 0); x &= 0xff; } }
const gmul = (a: number, b: number) => (a && b ? EXP[(LOG[a]! + LOG[b]!) % 255]! : 0);

function isFunction(size: number, align: number | null, x: number, y: number) {
  if (x <= 8 && y <= 8) return true;
  if (x >= size - 8 && y <= 8) return true;
  if (x <= 8 && y >= size - 8) return true;
  if (x === 6 || y === 6) return true;
  return align !== null && Math.abs(x - align) <= 2 && Math.abs(y - align) <= 2;
}
function readCodewords(m: boolean[][]) {
  const size = m.length, v = (size - 21) / 4, [total, , , align] = VER[v]!;
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (!isFunction(size, align, x, y)) bits.push((m[y]![x]! !== ((x + y) % 2 === 0)) ? 1 : 0);
    }
  }
  const cw: number[] = [];
  for (let i = 0; i < total; i++) cw.push(parseInt(bits.slice(i * 8, i * 8 + 8).join(""), 2));
  return cw;
}
function blocksOf(m: boolean[][]) {
  const v = (m.length - 21) / 4, [total, ecc, blocks] = VER[v]!, per = (total - ecc * blocks) / blocks, cw = readCodewords(m);
  return Array.from({ length: blocks }, (_, b) => ({
    data: Array.from({ length: per }, (_, i) => cw[i * blocks + b]!),
    ecc: Array.from({ length: ecc }, (_, i) => cw[per * blocks + i * blocks + b]!),
  }));
}
/** all Reed-Solomon syndromes S_i = C(α^i), i < ecc, are zero for a valid block */
const syndromesZero = (block: number[], ecc: number) => Array.from({ length: ecc }, (_, i) => block.reduce((acc, c) => gmul(acc, EXP[i]!) ^ c, 0)).every((s) => s === 0);
function payload(m: boolean[][]) {
  const data = blocksOf(m).flatMap((b) => b.data);
  const bits = data.flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1));
  const num = (from: number, n: number) => parseInt(bits.slice(from, from + n).join(""), 2);
  const mode = num(0, 4), len = num(4, 8);
  const bytes = Array.from({ length: len }, (_, i) => num(12 + i * 8, 8));
  return { mode, text: new TextDecoder().decode(new Uint8Array(bytes)) };
}
/** the 15 format bits read from around the top-left finder, MSB first */
function formatBits(m: boolean[][]) {
  const at = (x: number, y: number) => (m[y]![x] ? 1 : 0);
  const b: number[] = [];
  for (let i = 0; i <= 5; i++) b[i] = at(8, i);
  b[6] = at(8, 7); b[7] = at(8, 8); b[8] = at(7, 8);
  for (let i = 9; i < 15; i++) b[i] = at(14 - i, 8);
  return b.reverse().join("");
}

describe("qrMatrix", () => {
  it("is deterministic", () => {
    expect(qrMatrix("https://school.test/admissions/public-form?apply=1")).toEqual(qrMatrix("https://school.test/admissions/public-form?apply=1"));
  });
  it("picks the smallest version 1–6 for the payload and refuses longer text", () => {
    expect(qrMatrix("").length).toBe(21);
    expect(qrMatrix("x".repeat(17)).length).toBe(21); // v1-L byte capacity 17
    expect(qrMatrix("x".repeat(18)).length).toBe(25);
    expect(qrMatrix("x".repeat(134)).length).toBe(41); // v6-L byte capacity 134
    expect(() => qrMatrix("x".repeat(135))).toThrow("QR payload too long");
  });
  it("draws the three finder patterns with their separators and the timing patterns", () => {
    const m = qrMatrix("HELLO"), n = m.length;
    const finder = (cx: number, cy: number) => { for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); expect(m[cy + dy]![cx + dx]).toBe(d !== 2); } };
    finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
    for (let i = 0; i < 8; i++) { expect(m[7]![i]).toBe(false); expect(m[i]![7]).toBe(false); }
    for (let i = 8; i < n - 8; i++) { expect(m[6]![i]).toBe(i % 2 === 0); expect(m[i]![6]).toBe(i % 2 === 0); }
    expect(m[n - 8]![8]).toBe(true); // dark module
  });
  it("writes the ECC-level L / mask 0 format string from the spec table", () => {
    expect(formatBits(qrMatrix("HELLO"))).toBe("111011111000100");
    expect(formatBits(qrMatrix("x".repeat(100)))).toBe("111011111000100");
  });
  it.each([
    ["HELLO", 1],
    ["https://school.test/admissions/public-form?apply=1", 3],
    ["école ✓ नमस्ते", 2],
    ["https://admissions.example.org/admissions/public-form?apply=1&ref=reception_standee&embed=1&utm=qr-standee-gate-1-2026", 6],
  ])("encodes %j as byte mode with valid Reed-Solomon blocks", (text, version) => {
    const m = qrMatrix(text);
    expect(m.length).toBe(17 + 4 * version);
    const v = (m.length - 21) / 4, ecc = VER[v]![1];
    for (const b of blocksOf(m)) expect(syndromesZero([...b.data, ...b.ecc], ecc)).toBe(true);
    expect(payload(m)).toEqual({ mode: 4, text });
  });
});

describe("qrSvg", () => {
  it("renders one 1×1 path cell per dark module inside the margin", () => {
    const m = qrMatrix("HELLO"), dark = m.flat().filter(Boolean).length;
    const svg = qrSvg("HELLO", { margin: 2, dark: "#123", light: "#fff" });
    expect(svg).toContain('viewBox="0 0 25 25"');
    expect(svg).toContain('fill="#123"');
    expect(svg.match(/h1v1h-1z/g)).toHaveLength(dark);
    expect(svg).toContain("M2 2h1v1h-1z"); // top-left finder corner, offset by the margin
  });
});
