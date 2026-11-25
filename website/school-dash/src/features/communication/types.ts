export type Notice = {
  id: string; title: string; category: string; audience: string; recipients: number; sentAt: string;
  status: "Published" | "Scheduled" | "Draft"; pinned: boolean; urgent: boolean; author: string; channels: string[];
  delivered: number; acked: number; read: number; attachment?: string; attachmentSize?: string; grades?: string[]; extra?: string; body: string;
  /** written only by the onNoticeForParents function (contract 13.6) — the admin web never sends it */
  parentVisible?: boolean;
  /** "Selected classes or people" (targets.ts): what was picked, and who it resolves to when saved */
  targets?: { type: "class" | "student" | "staff"; id: string; label: string; sub: string }[];
  targetClassIds?: string[]; targetStudentIds?: string[]; targetStaffIds?: string[]; targetSummary?: string;
};
export type Template = { id: string; name: string; body: string };
export type LogRec = { id: string; noticeId?: string; action: string; audience: string; channels: string[]; recipients: number; at: string };

export const CHANNELS = ["Mobile App"];
/** audience strings stored on com_notices; the functions and apps match on them (see logic.ts audienceReach). Recipient
 *  counts come from the live roster (logic.ts audienceCount), never from fixed numbers. */
export const AUDIENCES: { label: string }[] = [
  { label: "All School" },
  { label: "Parents by Grade" },
  { label: "Staff & Teachers" },
  { label: "Transport Routes" },
  { label: "Selected classes or people" },
];
export const fmtWhen = (iso: string) => !iso || isNaN(+new Date(iso)) ? "—" :
  new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).replace(" at ", ", ") + " IST";
