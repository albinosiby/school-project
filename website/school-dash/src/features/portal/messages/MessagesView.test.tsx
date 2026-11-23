import { beforeEach, describe, expect, it } from "vitest";
import { MessagesView } from "./MessagesView";
import { authState, dialog, field, getRow, renderUI, rowsOf, screen, seed, within, writes } from "@/test/render";

const teacher = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher" as const, staffId: "stf_1", staffRole: "teacher", name: "Anita" };
const base = () => seed({
  staff: [{ id: "stf_1", name: "Anita Rao", subjects: "Mathematics" }],
  classes: [{ id: "cls_10B", grade: "10", section: "B", classTeacherId: "stf_1" }, { id: "cls_9A", grade: "9", section: "A" }],
  assignments: [{ id: "a1", teacherId: "stf_1", classId: "cls_9A", subject: "Mathematics" }],
  students: [
    { id: "s1", name: "Aarav Sharma", classId: "cls_10B", grade: "10", section: "B", roll: 1, guardian: "Rahul Sharma", guardianUids: ["uid_p1"], status: "Active" },
    { id: "s2", name: "Bina Das", classId: "cls_10B", grade: "10", section: "B", roll: 2, guardian: "Mala Das", guardianUids: [], status: "Active" },
    { id: "s3", name: "Chitra Roy", classId: "cls_9A", grade: "9", section: "A", roll: 3, guardian: "Dev Roy", guardianUids: ["uid_p3", "uid_p4"], status: "Active" },
    { id: "s4", name: "Not mine", classId: "cls_7C", grade: "7", section: "C", roll: 1, guardianUids: ["uid_p9"], status: "Active" },
  ],
  msg_threads: [
    { id: "thr_s1_stf_1", studentId: "s1", classId: "cls_10B", studentName: "Aarav Sharma", parentUids: ["uid_p1"], guardian: "Rahul Sharma", teacherId: "stf_1", teacher: "Anita Rao", role: "Class Teacher", unreadTeacher: 2, createdAt: "2026-11-20T08:00:00.000Z", updatedAt: "2026-11-20T09:00:00.000Z" },
    { id: "thr_s1_stf_2", studentId: "s1", classId: "cls_10B", studentName: "Aarav Sharma", parentUids: ["uid_p1"], teacherId: "stf_2", unreadTeacher: 5 },
  ],
  msg_messages: [
    { id: "m1", threadId: "thr_s1_stf_1", studentId: "s1", teacherId: "stf_1", parentUids: ["uid_p1"], from: "parent", uid: "uid_p1", name: "Rahul Sharma", text: "Hello teacher", at: "2026-11-20T09:00:00.000Z" },
    { id: "m0", threadId: "thr_s1_stf_1", studentId: "s1", teacherId: "stf_1", parentUids: ["uid_p1"], from: "teacher", uid: "uid_t", name: "Anita Rao", text: "Welcome", at: "2026-11-20T08:30:00.000Z" },
    { id: "m9", threadId: "thr_s1_stf_2", studentId: "s1", teacherId: "stf_2", parentUids: ["uid_p1"], from: "parent", uid: "uid_p1", text: "For the other teacher", at: "2026-11-20T09:30:00.000Z" },
  ],
});

describe("MessagesView", () => {
  beforeEach(() => { authState.user = teacher; });

  it("shows an empty state for non-teaching staff", () => {
    authState.user = { ...teacher, role: "staff" };
    renderUI(<MessagesView />);
    expect(screen.getByText("Only teachers message parents")).toBeInTheDocument();
  });

  it("lists own threads with the student name and unread count, and opening one resets only the teacher's counter", async () => {
    base();
    const { user } = renderUI(<MessagesView />);
    expect(screen.getAllByRole("button", { name: /Open thread with/ })).toHaveLength(1);
    expect(screen.getByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.getByLabelText("2 unread from Aarav Sharma")).toHaveTextContent("2");
    expect(screen.getByText("Hello teacher")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open thread with Aarav Sharma" }));
    const last = writes[writes.length - 1]!;
    expect(last).toMatchObject({ op: "update", coll: "msg_threads", id: "thr_s1_stf_1" });
    expect(last.data).toEqual({ unreadTeacher: 0, updatedAt: expect.any(String), updatedBy: expect.any(String) });
    expect(getRow("msg_threads", "thr_s1_stf_2")).toMatchObject({ unreadTeacher: 5 });
    const list = within(screen.getByRole("list", { name: "Messages" })).getAllByRole("listitem");
    expect(list[0]).toHaveTextContent("Welcome");
    expect(list[1]).toHaveTextContent("Hello teacher");
    expect(list).toHaveLength(2);
    expect(screen.queryByText("For the other teacher")).not.toBeInTheDocument();
  });

  it("sends a message with the thread's ids and guardians, then bumps the thread", async () => {
    base();
    const { user } = renderUI(<MessagesView />);
    await user.click(screen.getByRole("button", { name: "Open thread with Aarav Sharma" }));
    await user.type(screen.getByLabelText("Message"), "Aarav did well today.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    const sent = rowsOf<{ id: string; text: string }>("msg_messages").find((m) => m.text === "Aarav did well today.")!;
    expect(sent).toEqual({
      id: expect.any(String), threadId: "thr_s1_stf_1", studentId: "s1", teacherId: "stf_1", parentUids: ["uid_p1"], from: "teacher", uid: "uid_t", name: "Anita Rao",
      text: "Aarav did well today.", at: expect.any(String), updatedAt: expect.any(String), updatedBy: expect.any(String),
    });
    const last = writes[writes.length - 1]!;
    expect(last).toMatchObject({ op: "update", coll: "msg_threads", id: "thr_s1_stf_1" });
    expect(last.data).toEqual({ unreadTeacher: 0, updatedAt: expect.any(String), updatedBy: expect.any(String) });
    expect(within(screen.getByRole("list", { name: "Messages" })).getAllByRole("listitem")[2]).toHaveTextContent("Aarav did well today.");
    expect((screen.getByLabelText("Message") as HTMLTextAreaElement).value).toBe("");
  });

  it("starts a thread with one of the teacher's students (guardians without a login are disabled)", async () => {
    base();
    const { user } = renderUI(<MessagesView />);
    await user.click(screen.getByRole("button", { name: "New thread" }));
    const d = dialog("New thread");
    const options = [...(field("Student", d) as unknown as HTMLSelectElement).options];
    expect(options.map((o) => o.textContent)).toEqual(["Select student", "Chitra Roy · 9-A", "Aarav Sharma · 10-B", "Bina Das · 10-B (No parent app login yet)"]);
    expect(options[3]!.disabled).toBe(true);
    await user.selectOptions(field("Student", d), "s3");
    await user.type(field("First message", d), "Hello from the Maths teacher");
    await user.click(within(d).getByRole("button", { name: "Start" }));
    expect(await screen.findByText("Message sent")).toBeInTheDocument();
    expect(getRow("msg_threads", "thr_s3_stf_1")).toEqual({
      id: "thr_s3_stf_1", studentId: "s3", classId: "cls_9A", studentName: "Chitra Roy", parentUids: ["uid_p3", "uid_p4"], guardian: "Dev Roy", teacherId: "stf_1", teacher: "Anita Rao",
      role: "Mathematics", createdAt: expect.any(String), updatedAt: expect.any(String), updatedBy: expect.any(String), unreadTeacher: 0,
    });
    const sent = rowsOf<{ id: string; threadId: string }>("msg_messages").find((m) => m.threadId === "thr_s3_stf_1")!;
    expect(sent).toMatchObject({ studentId: "s3", teacherId: "stf_1", parentUids: ["uid_p3", "uid_p4"], from: "teacher", uid: "uid_t", text: "Hello from the Maths teacher" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open thread with/ })).toHaveLength(2);
    expect(within(screen.getByRole("list", { name: "Messages" })).getAllByRole("listitem")[0]).toHaveTextContent("Hello from the Maths teacher");
  });
});
