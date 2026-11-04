// Rebuild the bundled address reference data from a downloaded GeoNames dump.
// Usage: node tools/locations/build.mjs /path/to/dump
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const input = process.argv[2];
if (!input) throw new Error("Pass a directory containing countryInfo.txt, admin1CodesASCII.txt and admin2Codes.txt.");
const root = fileURLToPath(new URL("../../", import.meta.url));
const sourceDir = path.join(root, "school-dash/src/features/onboarding/data");
const publicDir = path.join(root, "school-dash/public/data/locations");
const rows = async (name) => (await readFile(path.join(input, name), "utf8")).split(/\r?\n/)
  .filter((line) => line && !line.startsWith("#")).map((line) => line.split("\t"));
const [countries, states, districts] = await Promise.all([
  rows("countryInfo.txt"), rows("admin1CodesASCII.txt"), rows("admin2Codes.txt"),
]);
const sort = (a, b) => a.name.localeCompare(b.name, "en");
// GeoNames retains these withdrawn country codes for historical records.
const withdrawn = new Set(["AN", "CS"]);
const countryList = countries.filter((r) => !withdrawn.has(r[0])).map((r) => ({ code: r[0], name: r[4].trim(), region: r[8] || "AN", postalCodeRequired: !!r[13] })).sort(sort);
const byCountry = Object.fromEntries(countryList.map((c) => [c.code, []]));
const byState = new Map();
for (const [code, name] of states) {
  const country = code.split(".")[0];
  if (!byCountry[country]) continue;
  const state = { code, name, districts: [] };
  byState.set(code, state);
  byCountry[country].push(state);
}
// Current names verified against Maharashtra's government district directory:
// https://mahavillages.mahabhumi.gov.in/all_list.php
const indiaNames = { "IN.16.522": "Ahilyanagar", "IN.16.515": "Chhatrapati Sambhajinagar", "IN.16.525": "Dharashiv" };
for (const [code, name, asciiName] of districts) {
  const state = byState.get(code.split(".").slice(0, 2).join("."));
  const label = code.startsWith("IN.") ? indiaNames[code] ?? (asciiName || name).replace(/\s+(district|division)$/i, "") : name;
  if (state) state.districts.push({ code, name: label });
}
for (const list of Object.values(byCountry)) {
  list.sort(sort);
  for (const state of list) state.districts.sort(sort);
}
await Promise.all([mkdir(sourceDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
const json = (file, value) => writeFile(file, `${JSON.stringify(value)}\n`);
await json(path.join(sourceDir, "countries.json"), countryList);
await json(path.join(sourceDir, "india.json"), byCountry.IN);
// India is available immediately. Other regions are fetched only when selected.
for (const region of [...new Set(countryList.map((c) => c.region))].sort()) {
  const data = Object.fromEntries(countryList.filter((c) => c.region === region && c.code !== "IN").map((c) => [c.code, byCountry[c.code]]));
  await json(path.join(publicDir, `${region}.json`), data);
}
console.log(`Generated ${countryList.length} countries, ${byState.size} states and their districts.`);
