// Pure helpers of the teacher's class resources (`cl_resources`), shaped exactly like the teacher app's `SharedResource`
// (mobile app/teacher/lib/modules/classes/models/classes_models.dart) and written like its PrivateAdapter
// (`teacherId` = staffId; the store adds `updatedAt` / `updatedBy`). Parents are notified server-side by
// functions/parent.js `onResourceShared` when `visibility` becomes "parents".

export type ResourceKind = "file" | "youtube" | "link";
export type Visibility = "parents" | "private";

/** a `cl_resources` document as stored (legacy rows may carry `ext`, `sizeKb`, `subtitle`, `category`, `uploadedAt`) */
export type ResourceDoc = {
  id: string; classId?: string; title?: string; description?: string; subject?: string; kind?: string; url?: string; fileName?: string; mime?: string;
  sizeBytes?: number; path?: string; visibility?: string; pinned?: boolean; teacher?: string; createdAt?: string; teacherId?: string; ord?: number;
  ext?: string; sizeKb?: number; subtitle?: string; category?: string; uploadedAt?: string;
};

/** the app's `SharedResource.fromJson` */
export type Resource = {
  id: string; classId: string; title: string; description: string; subject: string; kind: ResourceKind; url: string; fileName: string; mime: string;
  sizeBytes: number; path: string; visibility: Visibility; pinned: boolean; teacher: string; createdAt: string; teacherId: string;
};

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** what the app's document picker offers (pickDocuments + pickPhotos) */
export const FILE_EXTENSIONS = ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "jpg", "jpeg", "png", "webp", "gif", "heic"] as const;
export const FILE_ACCEPT = FILE_EXTENSIONS.map((e) => `.${e}`).join(",");

export function normalize(j: ResourceDoc): Resource {
  const legacyExt = String(j.ext ?? "");
  const title = String(j.title ?? "");
  const kind = j.kind === "youtube" || j.kind === "link" || j.kind === "file" ? j.kind : "file";
  return {
    id: String(j.id ?? ""), classId: String(j.classId ?? ""), title, description: String(j.description ?? j.subtitle ?? ""),
    subject: String(j.subject ?? j.category ?? ""), kind, url: String(j.url ?? ""),
    fileName: String(j.fileName ?? (!legacyExt || title.toLowerCase().endsWith(`.${legacyExt}`) ? title : `${title}.${legacyExt}`)),
    mime: String(j.mime ?? ""),
    sizeBytes: typeof j.sizeBytes === "number" ? Math.trunc(j.sizeBytes) : Math.round((Number(j.sizeKb) || 0) * 1024),
    path: String(j.path ?? ""), visibility: j.visibility === "parents" ? "parents" : "private", pinned: j.pinned === true,
    teacher: String(j.teacher ?? ""), createdAt: String(j.createdAt ?? j.uploadedAt ?? ""), teacherId: String(j.teacherId ?? ""),
  };
}

/** YouTube video id from youtu.be/ID, youtube.com/watch?v=ID, /shorts/ID, /embed/ID, /live/ID (null otherwise) — the app's `youtubeId` */
export function youtubeId(url: string): string | null {
  let u: URL;
  try { u = new URL(url.trim()); } catch { return null; }
  const host = u.hostname.replace("www.", "").replace("m.", "");
  const segs = u.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = segs[0] ?? null;
  else if (host === "youtube.com" || host === "music.youtube.com") {
    id = u.searchParams.get("v");
    if (id === null && segs.length >= 2 && ["shorts", "embed", "live", "v"].includes(segs[0]!)) id = segs[1]!;
  }
  return id !== null && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : null;
}

/** a Google Drive / Docs / Slides / Sheets link — the app's `isDriveLink` */
export const isDriveLink = (url: string) => /^https?:\/\/(drive|docs)\.google\.com\//.test(url.trim());

export const thumbnailOf = (r: Pick<Resource, "kind" | "url">) => {
  const id = r.kind === "youtube" ? youtubeId(r.url) : null;
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : "";
};

/** pdf, doc, ppt, xls, image, or the file extension — the app's `fileType` */
export function fileType(r: Pick<Resource, "fileName" | "url" | "mime">) {
  const n = (r.fileName || r.url).toLowerCase();
  const mime = r.mime;
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|heic)$/.test(n)) return "image";
  if (mime === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (/\.(docx?|odt|rtf)$/.test(n) || mime.includes("word")) return "doc";
  if (/\.(pptx?|odp|key)$/.test(n) || mime.includes("presentation") || mime.includes("powerpoint")) return "ppt";
  if (/\.(xlsx?|ods|csv)$/.test(n) || mime.includes("sheet") || mime.includes("excel")) return "xls";
  const dot = n.lastIndexOf(".");
  return dot < 0 ? "file" : n.slice(dot + 1);
}

export type BadgeKey = "youtube" | "drive" | "link" | "pdf" | "doc" | "ppt" | "xls" | "image" | "file";
/** short type label and the icon/colour key of a resource (the app's `resourceBadge`) */
export function badgeOf(r: Pick<Resource, "kind" | "url" | "fileName" | "mime">): { key: BadgeKey; label: string } {
  if (r.kind === "youtube") return { key: "youtube", label: "YouTube" };
  if (r.kind === "link") return isDriveLink(r.url) ? { key: "drive", label: "Drive" } : { key: "link", label: "Link" };
  const t = fileType(r);
  const known: Record<string, { key: BadgeKey; label: string }> = {
    pdf: { key: "pdf", label: "PDF" }, doc: { key: "doc", label: "Word" }, ppt: { key: "ppt", label: "Slides" }, xls: { key: "xls", label: "Excel" }, image: { key: "image", label: "Image" },
  };
  return known[t] ?? { key: "file", label: t.toUpperCase() };
}

/** the app's `contentTypeOf` (browsers sometimes give no type for Office files) */
export function contentTypeOf(name: string, fallback = "application/octet-stream") {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", pdf: "application/pdf",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", txt: "text/plain",
  };
  return map[ext] ?? fallback;
}

export const sizeLabel = (bytes: number) => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Why a picked file cannot be uploaded ("" when it can): a supported type (storage.rules: image/*, application/*, text/plain) up to 25 MB. */
export function fileError(f: { name: string; size: number; type?: string }) {
  const ext = f.name.includes(".") ? f.name.split(".").pop()!.toLowerCase() : "";
  if (!(FILE_EXTENSIONS as readonly string[]).includes(ext)) return "Choose an image, PDF, Word, PowerPoint or Excel file";
  if (f.size <= 0) return "This file is empty";
  if (f.size > MAX_FILE_BYTES) return "Files can be up to 25 MB";
  return "";
}

/** the content type stored with the upload and in `mime` (the browser's when it fits the rules, else by extension) */
export const uploadType = (f: { name: string; type?: string }) => {
  const t = f.type ?? "";
  return /^(image\/|application\/)/.test(t) || t === "text/plain" ? t : contentTypeOf(f.name);
};

/** a title from a file name: no extension, `_` / `-` runs as spaces (the app's picker) */
export const titleFromFile = (name: string) => { const dot = name.lastIndexOf("."); return (dot > 0 ? name.slice(0, dot) : name).replace(/[_-]+/g, " "); };

// ---- filters ------------------------------------------------------------------------------------------------
export type Filter = "all" | "files" | "videos" | "links" | "shared" | "mine";
export const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" }, { id: "files", label: "Files" }, { id: "videos", label: "Videos" }, { id: "links", label: "Links" },
  { id: "shared", label: "Shared with parents" }, { id: "mine", label: "Only me" },
];
export function inFilter(r: Pick<Resource, "kind" | "visibility">, f: Filter) {
  switch (f) {
    case "files": return r.kind === "file";
    case "videos": return r.kind === "youtube";
    case "links": return r.kind === "link";
    case "shared": return r.visibility === "parents";
    case "mine": return r.visibility !== "parents";
    default: return true;
  }
}
export const filterCounts = (rows: Resource[]) =>
  Object.fromEntries(FILTERS.map(({ id }) => [id, rows.filter((r) => inFilter(r, id)).length])) as Record<Filter, number>;

export const matchesQuery = (r: Resource, q: string) =>
  !q.trim() || `${r.title} ${r.subject} ${r.description} ${r.fileName}`.toLowerCase().includes(q.trim().toLowerCase());

/** pinned first, then newest (the app's `ResourcesState.of`) */
export const sortResources = (rows: Resource[]) =>
  [...rows].sort((a, b) => (a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.createdAt.localeCompare(a.createdAt)));

/** own resources (teacherId = staffId), in the given classes when a class is picked, pinned first then newest */
export function visibleResources(rows: ResourceDoc[], v: { staffId: string; classId: string; filter: Filter; q: string }) {
  const own = rows.map(normalize).filter((r) => r.teacherId === v.staffId && !!r.classId && (!v.classId || r.classId === v.classId));
  return { all: own, list: sortResources(own.filter((r) => inFilter(r, v.filter) && matchesQuery(r, v.q))), counts: filterCounts(own) };
}

// ---- form ---------------------------------------------------------------------------------------------------
export type ResourceForm = { kind: ResourceKind; classId: string; subject: string; title: string; description: string; url: string; visibility: Visibility };
export const emptyForm = (classId = "", subject = ""): ResourceForm => ({ kind: "file", classId, subject, title: "", description: "", url: "", visibility: "parents" });
export const formOf = (r: Resource): ResourceForm => ({
  kind: r.kind, classId: r.classId, subject: r.subject, title: r.title, description: r.description, url: r.kind === "file" ? "" : r.url, visibility: r.visibility,
});

/** the app's form checks (+ the 120-character title the app's field allows) */
export function validateResource(f: ResourceForm, ctx: { editing: boolean; file?: { name: string; size: number; type?: string } | null }) {
  const e: Partial<Record<keyof ResourceForm | "file", string>> = {};
  if (!f.classId) e.classId = "Pick a class";
  if (f.kind === "file" && !ctx.editing) {
    if (!ctx.file) e.file = "Choose a file to upload";
    else { const err = fileError(ctx.file); if (err) e.file = err; }
  }
  const url = f.url.trim();
  if (f.kind === "youtube" && youtubeId(url) === null) e.url = "Paste a YouTube video link (youtube.com or youtu.be)";
  if (f.kind === "link") {
    let ok = false;
    try { ok = /^https?:\/\//.test(url) && !!new URL(url).host; } catch { ok = false; }
    if (!ok) e.url = "Paste a full link starting with https://";
  }
  const title = f.title.trim();
  if (title.length < 2) e.title = "Give it a title";
  else if (title.length > 120) e.title = "Title is at most 120 characters";
  if (f.description.length > 2000) e.description = "Note is at most 2000 characters";
  return e;
}

export type UploadedFile = { url: string; path: string; fileName: string; mime: string; sizeBytes: number };

/** the new document (SharedResource.toJson + the PrivateAdapter's teacherId and the store's `ord`) */
export function newResource(f: ResourceForm, ctx: { staffId: string; teacherName: string; now: string; nowMs: number; file?: UploadedFile }) {
  const file = f.kind === "file" ? ctx.file : undefined;
  return {
    classId: f.classId, title: f.title.trim(), description: f.description.trim(), subject: f.subject, kind: f.kind,
    url: file ? file.url : f.kind === "file" ? "" : f.url.trim(), fileName: file?.fileName ?? "", mime: file?.mime ?? "", sizeBytes: file?.sizeBytes ?? 0,
    path: file?.path ?? "", visibility: f.visibility, pinned: false, teacher: ctx.teacherName, createdAt: ctx.now, ord: ctx.nowMs * 1000, teacherId: ctx.staffId,
  };
}

/** an edit (the app's ResourceUpdated: title, note, subject, visibility and, for videos and links, the URL) */
export function editPatch(f: ResourceForm, kind: ResourceKind) {
  return {
    title: f.title.trim(), description: f.description.trim(), subject: f.subject, visibility: f.visibility,
    ...(kind === "file" ? {} : { url: f.url.trim() }),
  };
}

/** a doc id like the app's store (`uid('cl_')` → cl__<ms36><rand36>) */
export const newResourceId = (nowMs: number, rand = Math.random()) => `cl__${nowMs.toString(36)}${Math.floor(rand * (1 << 20)).toString(36)}`;

/** Storage path of an upload (storage.rules `schools/{sid}/class-resources/{uid}/{file}`, the app's `uploadMaterial`) */
export const storagePath = (schoolId: string, authUid: string, nowMs: number, rand = Math.random()) =>
  `schools/${schoolId}/class-resources/${authUid}/mat_${nowMs.toString(36)}${Math.floor(rand * (1 << 20)).toString(36)}`;
