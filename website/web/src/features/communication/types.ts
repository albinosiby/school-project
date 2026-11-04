export type Notice = {
  id: string; title: string; category: string; audience: string; recipients: number; sentAt: string;
  status: "Published" | "Scheduled" | "Draft"; pinned: boolean; urgent: boolean; author: string; channels: string[];
  delivered: number; acked: number; read: number; attachment?: string; attachmentSize?: string; grades?: string[]; extra?: string; body: string;
  /** written only by the onNoticeForParents function (contract 13.6) — the admin web never sends it */
  parentVisible?: boolean;
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
/** audience strings stored on com_notices; the functions and apps match on them (see logic.ts audienceReach). Recipient
 *  counts come from the live roster (logic.ts audienceCount), never from fixed numbers. */
export const AUDIENCES: { label: string }[] = [
  { label: "All School" },
  { label: "Parents by Grade" },
  { label: "Staff & Teachers" },
  { label: "Transport Routes" },
];
export const fmtWhen = (iso: string) => !iso || isNaN(+new Date(iso)) ? "—" :
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(" at ", ", ") + " IST";
