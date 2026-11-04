import { describe, expect, it } from "vitest";
import { MessagesView } from "./MessagesView";
import { dialog, renderUI, screen, seed, within, writes } from "@/test/render";

// shapes from contract 13.3 (parent app firebase_message_repository.dart, teacher app MessagesAdapter)
const thread = (id: string, o: Record<string, unknown>) => ({ id, studentId: "stu_101", classId: "cls_10B", studentName: "Aarav Sharma", parentUids: ["uid_p"], guardian: "Mr. Rahul Sharma",
  teacherId: "stf_025", teacher: "Mrs. Anita Sharma", role: "Class Teacher", lastMessage: "", lastAt: "2026-11-02T08:00:00.000Z", lastFrom: "parent", unreadParent: 0, unreadTeacher: 0, ...o });
const msg = (id: string, o: Record<string, unknown>) => ({ id, threadId: "thr_stu_101_stf_025", studentId: "stu_101", teacherId: "stf_025", parentUids: ["uid_p"], uid: "u", text: "", ...o });

describe("Parent messages oversight (read only)", () => {
  it("lists threads newest first with unread counters and opens a thread's messages in time order", async () => {
    seed({
      msg_threads: [
        thread("thr_stu_102_stf_008", { studentId: "stu_102", studentName: "Diya Patel", classId: "cls_8A", guardian: "Mrs. Patel", lastMessage: "Thanks", lastAt: "2026-11-01T08:00:00.000Z", lastFrom: "teacher" }),
        thread("thr_stu_101_stf_025", { lastMessage: "Will he need a calculator?", unreadTeacher: 2 }),
      ],
      msg_messages: [
        msg("m2", { from: "teacher", name: "Mrs. Anita Sharma", text: "Yes, a scientific one.", at: "2026-11-02T09:00:00.000Z" }),
        msg("m1", { from: "parent", name: "Mr. Rahul Sharma", text: "Will he need a calculator?", at: "2026-11-02T08:00:00.000Z" }),
        msg("mx", { threadId: "thr_other", from: "parent", text: "Other thread", at: "2026-11-02T07:00:00.000Z" }),
      ],
    });
    const { user } = renderUI(<MessagesView />);
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]!).getByText("Aarav Sharma")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("2 unread by teacher")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Diya Patel")).toBeInTheDocument();
    await user.click(within(rows[0]!).getByText("Aarav Sharma"));
    const d = dialog("Aarav Sharma");
    expect(within(d).getByText("Mr. Rahul Sharma ↔ Mrs. Anita Sharma · Grade 10-B")).toBeInTheDocument();
    const texts = within(d).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent);
    expect(texts).toEqual(["Will he need a calculator?", "Yes, a scientific one."]);
    expect(within(d).queryByText("Other thread")).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("filters by class and search; shows the empty state", async () => {
    seed({ msg_threads: [thread("t1", {}), thread("t2", { studentName: "Diya Patel", classId: "cls_8A", guardian: "Mrs. Patel" })] });
    const { user } = renderUI(<MessagesView />);
    await user.selectOptions(screen.getByLabelText("Class"), "cls_8A");
    expect(screen.getByText("Diya Patel")).toBeInTheDocument();
    expect(screen.queryByText("Aarav Sharma")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Search student, guardian, teacher or text…"), "zzz");
    expect(screen.getByText("No conversations match")).toBeInTheDocument();
  });
});
