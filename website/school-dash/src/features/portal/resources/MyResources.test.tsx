import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { uploadBytesResumable } from "firebase/storage";
import { ADMIN_UID, SCHOOL_ID, authState, dialog, field, getRow, renderUI, rowsOf, screen, seed, within, writes } from "@/test/render";
import { MyResources } from "./MyResources";

const teacher = () => { authState.user = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher", staffId: "stf_1", staffRole: "teacher", name: "Anita" }; };
const r = (id: string, extra: Record<string, unknown> = {}) => ({
  id, classId: "cls_10B", title: `Res ${id}`, description: "", subject: "Mathematics", kind: "file", url: `https://files.test/${id}.pdf`, fileName: `${id}.pdf`, mime: "application/pdf",
  sizeBytes: 2048, path: "", visibility: "private", pinned: false, teacher: "Anita", createdAt: "2026-11-20T08:00:00.000Z", teacherId: "stf_1", ...extra,
});
const base = {
  staff: [{ id: "stf_1", name: "Anita" }], classes: [{ id: "cls_10B", grade: "10", section: "B" }, { id: "cls_9A", grade: "9", section: "A" }], students: [],
  assignments: [{ id: "asg_1", classId: "cls_10B", subject: "Mathematics", teacherId: "stf_1" }, { id: "asg_2", classId: "cls_9A", subject: "Science", teacherId: "stf_1" }],
  ops_periods: [{ id: "per_10B_Mon_1", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 1, subject: "Physics", teacher: "Anita", teacherId: "stf_1", room: "" }],
  cl_resources: [
    r("pdf1"),
    r("vid1", { kind: "youtube", url: "https://youtu.be/dQw4w9WgXcQ", fileName: "", mime: "", sizeBytes: 0, visibility: "parents", createdAt: "2026-11-22T08:00:00.000Z" }),
    r("drv1", { kind: "link", url: "https://drive.google.com/file/d/1", fileName: "", classId: "cls_9A", subject: "Science", pinned: true, createdAt: "2026-11-01T08:00:00.000Z" }),
    r("other", { teacherId: "stf_2" }),
  ],
};
const titles = () => within(screen.getByRole("list", { name: "Resources" })).getAllByRole("listitem").map((li) => li.querySelector("p")!.textContent);
const card = (title: string) => screen.getByRole("listitem", { name: `Resource ${title}` });

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 12, 0)); });
afterEach(() => vi.useRealTimers());

describe("Resources", () => {
  it("lists own resources pinned first, with counts, filters, class and search", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MyResources />);
    expect(titles()).toEqual(["Res drv1", "Res vid1", "Res pdf1"]);
    expect(card("Res drv1")).toHaveTextContent("Pinned");
    expect(card("Res drv1")).toHaveTextContent("Drive");
    expect(card("Res vid1").querySelector("img")).toHaveAttribute("src", "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(card("Res pdf1")).toHaveTextContent("PDF · Mathematics · 2 KB");
    expect(within(card("Res pdf1")).getByRole("link", { name: "Open Res pdf1" })).toHaveAttribute("href", "https://files.test/pdf1.pdf");
    expect(screen.getByRole("tab", { name: /^All\s*\(3\)$/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /^Shared with parents\s*\(1\)$/ })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /^Videos\s*\(1\)$/ }));
    expect(titles()).toEqual(["Res vid1"]);
    await user.click(screen.getByRole("tab", { name: /^Only me\s*\(2\)$/ }));
    expect(titles()).toEqual(["Res drv1", "Res pdf1"]);
    await user.click(screen.getByRole("tab", { name: /^All\s*\(3\)$/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Class" }), "cls_10B");
    expect(titles()).toEqual(["Res vid1", "Res pdf1"]);
    await user.type(screen.getByRole("textbox", { name: "Search resources" }), "pdf1");
    expect(titles()).toEqual(["Res pdf1"]);
    expect(writes).toHaveLength(0);
  });

  it("toggles visibility and pin, and deletes", async () => {
    teacher(); seed(base);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = renderUI(<MyResources />);
    await user.click(within(card("Res pdf1")).getByRole("button", { name: /^Visibility of Res pdf1/ }));
    expect(writes[0]).toMatchObject({ op: "update", coll: "cl_resources", id: "pdf1", data: { visibility: "parents" } });
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["updatedAt", "updatedBy", "visibility"]);
    expect(await screen.findByText("Shared with parents", { selector: "[aria-live] div" })).toBeInTheDocument();
    await user.click(within(card("Res pdf1")).getByRole("button", { name: "Pin Res pdf1" }));
    expect(getRow("cl_resources", "pdf1")).toMatchObject({ pinned: true, visibility: "parents", teacherId: "stf_1" });
    expect(titles()[0]).toBe("Res pdf1");
    await user.click(within(card("Res vid1")).getByRole("button", { name: "Delete Res vid1" }));
    expect(writes.at(-1)).toMatchObject({ op: "delete", coll: "cl_resources", id: "vid1" });
    expect(screen.queryByText("Res vid1")).not.toBeInTheDocument();
  });

  it("adds a YouTube video with a preview, shared with parents by default", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MyResources />);
    await user.click(screen.getByRole("button", { name: "Add resource" }));
    const d = dialog("Add a resource");
    await user.click(within(d).getByRole("tab", { name: "YouTube" }));
    expect(field("Class", d)).toHaveValue("cls_10B");
    expect(field("Subject", d)).toHaveValue("Mathematics");
    await user.type(field("YouTube link", d), "https://vimeo.com/1");
    await user.type(field("Title", d), "Quadratics explained");
    await user.click(within(d).getByRole("button", { name: "Add resource" }));
    expect(within(d).getByText("Paste a YouTube video link (youtube.com or youtu.be)")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await user.clear(field("YouTube link", d));
    await user.type(field("YouTube link", d), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(within(d).getByRole("img", { name: "Video preview" })).toHaveAttribute("src", "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(within(d).getByRole("radio", { name: "Parents of 10-B" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(d).getByRole("button", { name: "Add resource" }));
    expect(writes).toHaveLength(1);
    const created = rowsOf<Record<string, unknown>>("cl_resources").find((x) => x.title === "Quadratics explained")!;
    expect(created).toEqual({
      id: expect.stringMatching(/^cl__/), classId: "cls_10B", title: "Quadratics explained", description: "", subject: "Mathematics", kind: "youtube",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", fileName: "", mime: "", sizeBytes: 0, path: "", visibility: "parents", pinned: false, teacher: "Anita",
      createdAt: new Date(2026, 10, 23, 12, 0).toISOString(), ord: new Date(2026, 10, 23, 12, 0).getTime() * 1000, teacherId: "stf_1", updatedAt: expect.any(String), updatedBy: ADMIN_UID,
    });
    expect(await screen.findByText("Shared with the class's parents")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("uploads a file to the teacher's class-resources folder with progress, after checking type and size", async () => {
    teacher(); seed(base);
    let finish: () => void = () => {};
    vi.mocked(uploadBytesResumable).mockImplementation(((_ref: unknown, file: Blob) => ({
      on: (_e: string, next: (s: { bytesTransferred: number; totalBytes: number }) => void, _err: unknown, done: () => void) => {
        next({ bytesTransferred: file.size / 2, totalBytes: file.size });
        finish = done;
      },
    })) as never);
    const { user } = renderUI(<MyResources />);
    await user.click(screen.getByRole("button", { name: "Add resource" }));
    const d = dialog("Add a resource");
    const input = within(d).getByLabelText("File") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "song.mp3", { type: "audio/mpeg" })] } });
    expect(within(d).getByRole("alert")).toHaveTextContent("Choose an image, PDF, Word, PowerPoint or Excel file");
    const big = new File(["x"], "big.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 25 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(within(d).getByRole("alert")).toHaveTextContent("Files can be up to 25 MB");
    fireEvent.change(input, { target: { files: [new File(["abcd"], "chapter_4-notes.pptx", { type: "" })] } });
    expect(within(d).queryByRole("alert")).not.toBeInTheDocument();
    expect(field("Title", d)).toHaveValue("chapter 4 notes");
    await user.click(within(d).getByRole("radio", { name: "Only me" }));
    await user.click(within(d).getByRole("button", { name: "Add resource" }));
    expect(await within(d).findByRole("button", { name: "Uploading… 50%" })).toBeDisabled();
    expect(within(d).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
    const [storageRef, , meta] = vi.mocked(uploadBytesResumable).mock.calls[0]!;
    const path = (storageRef as { fullPath: string }).fullPath;
    expect(path).toMatch(new RegExp(`^schools/${SCHOOL_ID}/class-resources/${ADMIN_UID}/mat_[a-z0-9]+$`));
    expect(meta).toEqual({ contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
    finish();
    expect(await screen.findByText("Added — visible only to you")).toBeInTheDocument();
    expect(rowsOf<Record<string, unknown>>("cl_resources").find((x) => x.title === "chapter 4 notes")).toMatchObject({
      kind: "file", url: `https://files.test/${path}`, path, fileName: "chapter_4-notes.pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      sizeBytes: 4, visibility: "private", teacherId: "stf_1", classId: "cls_10B",
    });
  });

  it("edits a link: title, note, URL and visibility; the class stays", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MyResources />);
    await user.click(within(card("Res drv1")).getByRole("button", { name: "Edit Res drv1" }));
    const d = dialog("Edit resource");
    expect(within(d).queryByRole("tab")).not.toBeInTheDocument();
    expect(field("Class", d)).toBeDisabled();
    expect(within(d).getByText(/Anyone with the link can view/)).toBeInTheDocument();
    await user.clear(field("Title", d)); await user.type(field("Title", d), "Lab manual");
    await user.clear(field("Link", d)); await user.type(field("Link", d), "https://example.org/lab");
    await user.click(within(d).getByRole("radio", { name: "Parents of 9-A" }));
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(writes[0]).toMatchObject({ op: "update", coll: "cl_resources", id: "drv1", data: { title: "Lab manual", url: "https://example.org/lab", visibility: "parents", subject: "Science", description: "" } });
    expect(getRow("cl_resources", "drv1")).toMatchObject({ classId: "cls_9A", kind: "link", pinned: true, teacherId: "stf_1" });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("tells a non-teaching staff member the page is for teachers", () => {
    authState.user = { ...authState.user!, role: "staff", staffId: "stf_7" };
    renderUI(<MyResources />);
    expect(screen.getByText("Only teachers have class resources")).toBeInTheDocument();
  });
});
