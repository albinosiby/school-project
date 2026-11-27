import { describe, expect, it } from "vitest";
import {
  MAX_FILE_BYTES, badgeOf, editPatch, emptyForm, fileError, fileType, filterCounts, inFilter, isDriveLink, newResource, newResourceId, normalize, sortResources,
  storagePath, thumbnailOf, titleFromFile, uploadType, validateResource, visibleResources, youtubeId, type Resource,
} from "./logic";

const res = (id: string, extra: Partial<Resource> = {}): Resource => normalize({ id, classId: "cls_10B", title: `R ${id}`, teacherId: "stf_1", createdAt: "2026-11-20T08:00:00.000Z", ...extra });

describe("youtubeId", () => {
  it("reads the id from every YouTube link shape the app accepts", () => {
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId(" https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10 ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/shorts/abcDEF_12-x")).toBe("abcDEF_12-x");
    expect(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("rejects other links and malformed ids", () => {
    expect(youtubeId("youtu.be/dQw4w9WgXcQ")).toBeNull();
    expect(youtubeId("https://vimeo.com/12345678")).toBeNull();
    expect(youtubeId("https://www.youtube.com/channel/UC123456")).toBeNull();
    expect(youtubeId("https://youtu.be/abc")).toBeNull();
    expect(youtubeId("https://www.youtube.com/watch?v=bad$id!!")).toBeNull();
    expect(youtubeId("")).toBeNull();
  });
  it("gives the hqdefault thumbnail only for videos", () => {
    expect(thumbnailOf({ kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" })).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(thumbnailOf({ kind: "link", url: "https://youtu.be/dQw4w9WgXcQ" })).toBe("");
  });
});

describe("drive links and file types", () => {
  it("detects Google Drive / Docs links", () => {
    expect(isDriveLink("https://drive.google.com/file/d/1/view")).toBe(true);
    expect(isDriveLink("https://docs.google.com/presentation/d/1")).toBe(true);
    expect(isDriveLink("http://docs.google.com/x")).toBe(true);
    expect(isDriveLink("https://google.com/drive")).toBe(false);
    expect(isDriveLink("https://example.com")).toBe(false);
  });
  it("labels resources like the app's resourceBadge", () => {
    const b = (x: Partial<Resource>) => badgeOf({ kind: "file", url: "", fileName: "", mime: "", ...x }).label;
    expect(b({ kind: "youtube" })).toBe("YouTube");
    expect(b({ kind: "link", url: "https://drive.google.com/x" })).toBe("Drive");
    expect(b({ kind: "link", url: "https://example.com" })).toBe("Link");
    expect(b({ fileName: "notes.PDF" })).toBe("PDF");
    expect(b({ fileName: "a.docx" })).toBe("Word");
    expect(b({ fileName: "deck.pptx" })).toBe("Slides");
    expect(b({ fileName: "marks.xlsx" })).toBe("Excel");
    expect(b({ mime: "image/png", fileName: "x" })).toBe("Image");
    expect(b({ fileName: "readme.txt" })).toBe("TXT");
    expect(fileType({ fileName: "", url: "", mime: "" })).toBe("file");
  });
  it("reads legacy rows (title + ext + sizeKb) as private files", () => {
    expect(normalize({ id: "rs1", title: "Formula Handbook", ext: "pdf", sizeKb: 2, category: "Notes", subtitle: "Guide", uploadedAt: "2026-01-01" })).toMatchObject({
      kind: "file", fileName: "Formula Handbook.pdf", sizeBytes: 2048, subject: "Notes", description: "Guide", createdAt: "2026-01-01", visibility: "private", pinned: false,
    });
  });
});

describe("file validation", () => {
  it("accepts images, PDF, Word, PowerPoint and Excel up to 25 MB", () => {
    expect(fileError({ name: "a.pdf", size: 10 })).toBe("");
    expect(fileError({ name: "deck.PPTX", size: MAX_FILE_BYTES })).toBe("");
    expect(fileError({ name: "photo.jpeg", size: 1 })).toBe("");
    expect(fileError({ name: "big.pdf", size: MAX_FILE_BYTES + 1 })).toBe("Files can be up to 25 MB");
    expect(fileError({ name: "song.mp3", size: 10 })).toBe("Choose an image, PDF, Word, PowerPoint or Excel file");
    expect(fileError({ name: "noext", size: 10 })).toBe("Choose an image, PDF, Word, PowerPoint or Excel file");
    expect(fileError({ name: "empty.pdf", size: 0 })).toBe("This file is empty");
  });
  it("uploads with a content type the storage rules allow", () => {
    expect(uploadType({ name: "a.pdf", type: "application/pdf" })).toBe("application/pdf");
    expect(uploadType({ name: "deck.pptx", type: "" })).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");
    expect(uploadType({ name: "notes.txt", type: "text/plain" })).toBe("text/plain");
    expect(uploadType({ name: "x.doc", type: "video/odd" })).toBe("application/msword");
  });
  it("titles a file from its name and builds the app's ids and storage path", () => {
    expect(titleFromFile("chapter_4--notes.pdf")).toBe("chapter 4 notes");
    expect(newResourceId(1_700_000_000_000, 0.5)).toBe(`cl__${(1_700_000_000_000).toString(36)}${(1 << 19).toString(36)}`);
    expect(storagePath("sch_1", "uid_t", 1_700_000_000_000, 0)).toBe(`schools/sch_1/class-resources/uid_t/mat_${(1_700_000_000_000).toString(36)}0`);
  });
});

describe("validateResource", () => {
  const f = { ...emptyForm("cls_10B", "Maths"), title: "Formula sheet" };
  it("needs a file for a new file, a YouTube link for a video and a full link for a link", () => {
    expect(validateResource(f, { editing: false })).toEqual({ file: "Choose a file to upload" });
    expect(validateResource(f, { editing: false, file: { name: "a.pdf", size: 5 } })).toEqual({});
    expect(validateResource(f, { editing: true })).toEqual({});
    expect(validateResource(f, { editing: false, file: { name: "a.exe", size: 5 } })).toEqual({ file: "Choose an image, PDF, Word, PowerPoint or Excel file" });
    expect(validateResource({ ...f, kind: "youtube", url: "https://vimeo.com/1" }, { editing: false })).toEqual({ url: "Paste a YouTube video link (youtube.com or youtu.be)" });
    expect(validateResource({ ...f, kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ" }, { editing: false })).toEqual({});
    expect(validateResource({ ...f, kind: "link", url: "drive.google.com/x" }, { editing: false })).toEqual({ url: "Paste a full link starting with https://" });
    expect(validateResource({ ...f, kind: "link", url: "https://drive.google.com/x" }, { editing: false })).toEqual({});
  });
  it("needs a class and a title of 2 to 120 characters", () => {
    expect(validateResource({ ...f, classId: "", title: " a ", kind: "link", url: "https://x.org" }, { editing: false })).toEqual({ classId: "Pick a class", title: "Give it a title" });
    expect(validateResource({ ...f, title: "x".repeat(121), kind: "link", url: "https://x.org" }, { editing: false })).toEqual({ title: "Title is at most 120 characters" });
  });
});

describe("documents", () => {
  it("writes SharedResource.toJson + teacherId and ord", () => {
    const form = { kind: "file" as const, classId: "cls_10B", subject: "Maths", title: " Sheet ", description: " p1 ", url: "ignored", visibility: "parents" as const };
    expect(newResource(form, { staffId: "stf_1", teacherName: "Anita", now: "2026-11-23T06:30:00.000Z", nowMs: 1000, file: { url: "https://f/x", path: "schools/s/class-resources/u/mat_1", fileName: "s.pdf", mime: "application/pdf", sizeBytes: 9 } })).toEqual({
      classId: "cls_10B", title: "Sheet", description: "p1", subject: "Maths", kind: "file", url: "https://f/x", fileName: "s.pdf", mime: "application/pdf", sizeBytes: 9,
      path: "schools/s/class-resources/u/mat_1", visibility: "parents", pinned: false, teacher: "Anita", createdAt: "2026-11-23T06:30:00.000Z", ord: 1_000_000, teacherId: "stf_1",
    });
    expect(newResource({ ...form, kind: "link", url: " https://x.org " }, { staffId: "stf_1", teacherName: "Anita", now: "n", nowMs: 1 })).toMatchObject({ kind: "link", url: "https://x.org", fileName: "", mime: "", sizeBytes: 0, path: "" });
  });
  it("edits title, note, subject, visibility and the URL of videos and links only", () => {
    const form = { kind: "file" as const, classId: "cls_10B", subject: "Maths", title: "T", description: "", url: "https://x", visibility: "private" as const };
    expect(editPatch(form, "file")).toEqual({ title: "T", description: "", subject: "Maths", visibility: "private" });
    expect(editPatch(form, "link")).toEqual({ title: "T", description: "", subject: "Maths", visibility: "private", url: "https://x" });
  });
});

describe("filters", () => {
  const rows = [
    res("f1", { kind: "file", visibility: "parents" }), res("v1", { kind: "youtube", visibility: "private", createdAt: "2026-11-22T08:00:00.000Z" }),
    res("l1", { kind: "link", visibility: "parents", pinned: true, createdAt: "2026-11-01T08:00:00.000Z" }), res("l2", { kind: "link", visibility: "private", createdAt: "2026-11-21T08:00:00.000Z" }),
  ];
  it("counts each filter", () => {
    expect(filterCounts(rows)).toEqual({ all: 4, files: 1, videos: 1, links: 2, shared: 2, mine: 2 });
    expect(rows.filter((r) => inFilter(r, "mine")).map((r) => r.id)).toEqual(["v1", "l2"]);
  });
  it("sorts pinned first, then newest", () => {
    expect(sortResources(rows).map((r) => r.id)).toEqual(["l1", "v1", "l2", "f1"]);
  });
  it("shows only own rows of the picked class, filtered and searched", () => {
    const docs = [
      { id: "a", classId: "cls_10B", title: "Algebra", teacherId: "stf_1", kind: "link", createdAt: "1" },
      { id: "b", classId: "cls_9A", title: "Biology", teacherId: "stf_1", kind: "file", createdAt: "2" },
      { id: "c", classId: "cls_10B", title: "Other's", teacherId: "stf_2", createdAt: "3" },
      { id: "d", title: "No class", teacherId: "stf_1" },
    ];
    expect(visibleResources(docs, { staffId: "stf_1", classId: "", filter: "all", q: "" }).list.map((r) => r.id)).toEqual(["b", "a"]);
    expect(visibleResources(docs, { staffId: "stf_1", classId: "cls_10B", filter: "all", q: "" }).list.map((r) => r.id)).toEqual(["a"]);
    expect(visibleResources(docs, { staffId: "stf_1", classId: "", filter: "files", q: "" }).list.map((r) => r.id)).toEqual(["b"]);
    expect(visibleResources(docs, { staffId: "stf_1", classId: "", filter: "all", q: "ALG" }).list.map((r) => r.id)).toEqual(["a"]);
  });
});
