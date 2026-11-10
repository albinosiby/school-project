export type AdmissionNumbering = { id: "numbering"; mode: "automatic" | "manual"; template: string; start: number; next?: number };
export const defaultNumbering: AdmissionNumbering = { id: "numbering", mode: "automatic", template: "FC{YEAR}{SEQ:4}", start: 1 };

export function validNumberTemplate(template: string) {
  const sequences = template.match(/\{SEQ(?::[1-9])?\}/g);
  const literals = template.replace(/\{(?:YEAR|SEQ(?::[1-9])?)\}/g, "0");
  return template.length <= 64 && sequences?.length === 1 && /^[a-z\d_-]+$/i.test(literals);
}

export function formatAdmissionNumber(template: string, date: string, sequence: number) {
  return template.replaceAll("{YEAR}", date.slice(0, 4))
    .replace(/\{SEQ(?::([1-9]))?\}/, (_, width) => String(sequence).padStart(Number(width) || 1, "0"));
}

export const validAdmissionNumber = (value: string) => /^[a-z\d_-]{1,64}$/i.test(value);
