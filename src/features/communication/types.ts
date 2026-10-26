export type Notice = {
  id: string; title: string; category: string; audience: string; recipients: number; sentAt: string;
  status: "Published" | "Scheduled" | "Draft"; pinned: boolean; urgent: boolean; author: string; channels: string[];
  delivered: number; acked: number; read: number; attachment?: string; attachmentSize?: string; grades?: string[]; extra?: string; body: string;
};
export type Template = { id: string; name: string; body: string };
export type Report = {
  id: string; kind: string; title: string; category: string; tag: string; desc: string; format: string; formats: string[];
  lastGenerated: string; meta: string;
};
export type Schedule = { id: string; title: string; to: string; when: string; active: boolean };
export type Exported = { id: string; code: string; title: string; size: string; format: string; ago: string };
export type LogRec = { id: string; noticeId?: string; action: string; audience: string; channels: string[]; recipients: number; at: string };

export const CHANNELS = ["WhatsApp", "Mobile App", "SMS Gateway"];
export const AUDIENCES: { label: string; count: number }[] = [
  { label: "All School", count: 1420 },
  { label: "Parents by Grade", count: 118 },
  { label: "Staff & Teachers", count: 68 },
  { label: "Transport Routes", count: 46 },
];
export const fmtWhen = (iso: string) => !iso || isNaN(+new Date(iso)) ? "—" :
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(" at ", ", ") + " IST";
