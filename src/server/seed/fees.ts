import type { Seed } from "./index";

// Deterministic generator. Targets (shown on the dashboard):
//   fee collected today = Rs 1,84,00,000 (1.84 Cr); overdue = Rs 6,48,000 across 34 accounts.
const FIRST = ["Aarav", "Ananya", "Devansh", "Diya", "Rohan", "Kavya", "Arjun", "Meera", "Vivaan", "Saanvi", "Reyansh", "Aadhya", "Kabir", "Myra", "Advait", "Ira", "Dhruv", "Navya", "Krish", "Tara", "Yash", "Riya", "Neil", "Pooja", "Samar", "Zara", "Aryan", "Anika", "Rudra", "Ishaan"];
const LAST = ["Sharma", "Patel", "Verma", "Sundaram", "Mehra", "Iyer", "Reddy", "Nair", "Singh", "Gupta", "Bose", "Khanna", "Joshi", "Menon", "Kulkarni", "Mehta", "Rao", "Das"];
const MODES = ["UPI QR", "Card", "Net Banking", "Cash", "Cheque"];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const daysAgo = (n: number) => iso(new Date(today.getTime() - n * 864e5));
const t = iso(today);

const GRADE_SIZES = [104, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104, 104]; // 1248
const named: [string, string, string, string, string][] = [
  ["Aarav Sharma", "8", "A", "2021-014", "Mr. Sharma"], ["Ananya Patel", "8", "A", "2021-032", "Mrs. Patel"],
  ["Devansh Verma", "8", "A", "2021-089", "Mr. Verma"], ["Diya Sundaram", "8", "A", "2021-094", "Mr. Sundaram"],
  ["Rohan Mehra", "8", "A", "2021-112", "Mrs. Mehra"],
];

type Inv = Record<string, unknown> & { id: string; amount: number; status: string };
const invoices: Inv[] = [];
let seq = 841;
GRADE_SIZES.forEach((n, gi) => {
  const grade = String(gi + 1);
  for (let i = 0; i < n; i++) {
    const idx = invoices.length;
    const nm = grade === "8" && i < 5 ? named[i] : null;
    const f = FIRST[(idx * 7 + gi) % FIRST.length], l = LAST[(idx * 5 + i) % LAST.length];
    const name = nm ? nm[0] : `${f} ${l}`;
    const amount = 26000 + gi * 2500 + (idx % 4) * 500;
    invoices.push({
      id: `inv_${idx + 1}`, no: `INV-2026-${String(seq++).padStart(4, "0")}`, student: name, grade,
      section: nm ? nm[2] : "ABC"[idx % 3], grn: `GIS-${nm ? nm[3] : `${2020 + (gi % 5)}-${String(100 + idx).slice(-3)}`}`,
      guardian: nm ? nm[4] : `${idx % 2 ? "Mr." : "Mrs."} ${l}`, phone: `+91 9${String(100000000 + ((idx * 7919) % 899999999)).slice(0, 9)}`,
      term: "Term 1", issued: "2026-10-10", due: "2026-10-31", amount, paid: 0, balance: amount, status: "Pending",
    });
  }
});

// status assignment: 34 overdue, 26 pending, rest paid
const overdueIdx = new Set<number>(), pendingIdx = new Set<number>();
for (let k = 0; k < 34; k++) overdueIdx.add((k * 37 + 4) % 1248);
for (let k = 0; overdueIdx.size < 34; k++) overdueIdx.add((k * 11 + 1) % 1248);
// Devansh Verma is the design's counter customer; make him overdue.
overdueIdx.add(2 + 7 * 104); // grade 8, index 2
while (overdueIdx.size > 34) { for (const v of overdueIdx) { if (v !== 2 + 7 * 104) { overdueIdx.delete(v); break; } } }
for (let k = 0; pendingIdx.size < 26; k++) { const v = (k * 47 + 9) % 1248; if (!overdueIdx.has(v)) pendingIdx.add(v); }

// overdue balances sum to exactly 6,48,000
const od = [...overdueIdx];
const bal = od.map((_, k) => 12000 + Math.round(((k * 1900) % 14000) / 500) * 500);
let s = bal.reduce((a, b) => a + b, 0);
const target = 648000;
for (let k = 0; s !== target; k = (k + 1) % bal.length) {
  const step = s > target ? -500 : 500;
  const nb = bal[k] + step;
  if (nb >= 8000 && nb <= 30000) { bal[k] = nb; s += step; }
}
od.forEach((ix, k) => { invoices[ix].amount = bal[k]; invoices[ix].balance = bal[k]; invoices[ix].status = "Overdue"; });
pendingIdx.forEach((ix) => { invoices[ix].status = "Pending"; invoices[ix].due = "2026-11-15"; });

// payments: today's total = 1,84,00,000
const payments: Record<string, unknown>[] = [];
let todaySum = 0;
const TODAY_TARGET = 18_400_000;
const paidIdx = invoices.map((_, i) => i).filter((i) => !overdueIdx.has(i) && !pendingIdx.has(i));
let lastToday = -1;
for (const ix of paidIdx) {
  if (todaySum + invoices[ix].amount > TODAY_TARGET) continue;
  todaySum += invoices[ix].amount; lastToday = ix;
  invoices[ix].__today = true;
  if (todaySum === TODAY_TARGET) break;
}
if (todaySum < TODAY_TARGET) { invoices[lastToday].amount += TODAY_TARGET - todaySum; }
let rc = 20400;
paidIdx.forEach((ix, k) => {
  const inv = invoices[ix];
  const isToday = !!inv.__today; delete inv.__today;
  inv.paid = inv.amount; inv.balance = 0; inv.status = "Paid";
  payments.push({
    id: `rcp_${payments.length + 1}`, receiptNo: `RCP-${rc++}`, invoiceId: inv.id, invoiceNo: inv.no, student: inv.student, grade: inv.grade, grn: inv.grn,
    amount: inv.amount, mode: MODES[k % MODES.length], date: isToday ? t : daysAgo(1 + (k % 28)), by: "Accounts Desk",
  });
});
// lines
invoices.forEach((inv) => {
  const lab = inv.amount > 20000 ? 6500 : 0;
  inv.lines = [{ label: "Tuition Fee (Q2 Composite)", amount: inv.amount - lab }, ...(lab ? [{ label: "Science & Robotics Lab", amount: lab }] : [])];
});
// Design's counter customer: three-line breakdown
const dv = invoices[2 + 7 * 104];
dv.amount = dv.balance = 54000;
dv.lines = [{ label: "Tuition Fee (Q2 Composite)", amount: 32000 }, { label: "Science & Robotics Lab", amount: 6500 }, { label: "Term 1 Transport (Route #4)", amount: 15500 }];

// Keep the overdue total exact after the Devansh override.
{
  const others = od.filter((ix) => invoices[ix].id !== dv.id);
  const diff = 648000 - (others.reduce((a, ix) => a + (invoices[ix].amount as number), 0) + 54000);
  const first = invoices[others[0]];
  first.amount = (first.amount as number) + diff; first.balance = first.amount;
  first.lines = [{ label: "Tuition Fee (Q2 Composite)", amount: first.amount }];
}

const structure = Array.from({ length: 12 }, (_, g) => ({
  id: `fs_${g + 1}`, grade: String(g + 1), tuition: 20000 + g * 2000, lab: g >= 5 ? 6500 : 3500, activity: 2500, library: 1500, transport: 15500,
}));

const conc = [
  ["Sibling Discount", 45000], ["Merit Scholarship", 120000], ["Staff Ward", 180000], ["Need-based Waiver", 95000], ["Sibling Discount", 36000],
  ["Merit Scholarship", 150000], ["Sports Quota", 60000], ["Need-based Waiver", 84000], ["Staff Ward", 95000],
] as [string, number][];
const concessions = conc.map(([type, amount], i) => {
  const inv = invoices[100 + i * 97];
  return { id: `con_${i + 1}`, student: inv.student, grn: inv.grn, grade: inv.grade, type, amount, status: "Approved", requested: daysAgo(40 - i), approvedBy: "Dr. Rajiv Sharma" };
});
concessions.push(
  { id: "con_10", student: invoices[640].student as string, grn: invoices[640].grn as string, grade: invoices[640].grade as string, type: "Need-based Waiver", amount: 55000, status: "Pending", requested: daysAgo(2), approvedBy: "" },
  { id: "con_11", student: invoices[900].student as string, grn: invoices[900].grn as string, grade: invoices[900].grade as string, type: "Sibling Discount", amount: 30000, status: "Pending", requested: daysAgo(1), approvedBy: "" },
);

export const fees: Seed = {
  fee_invoices: invoices as never,
  fee_payments: payments as never,
  fee_structure: structure,
  fee_concessions: concessions,
  fee_reminders: [],
};
