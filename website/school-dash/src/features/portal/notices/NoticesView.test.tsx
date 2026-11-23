import { beforeEach, describe, expect, it } from "vitest";
import { NoticesView, circularRef, staffNotices } from "./NoticesView";
import { authState, getRow, renderUI, screen, seed, writes } from "@/test/render";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const teacher = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher" as const, staffId: "stf_1", staffRole: "teacher", name: "Anita" };
const clerk = { ...teacher, id: "uid_c", email: "c@s.in", role: "staff" as const, staffId: "stf_9", staffRole: "accountant", name: "Ravi" };
const staff = [{ id: "stf_1", name: "Anita Sharma" }, { id: "stf_9", name: "Ravi Menon" }];
const notices = [
  { id: "ntc_a1b2c3", title: "Staff meeting on Friday", category: "Staff", audience: "All Staff", status: "Published", sentAt: "2026-11-22T08:00:00.000Z", body: "3 pm in the library.", author: "Principal", pinned: false, urgent: true, attachment: "agenda.pdf", attachmentSize: "120 KB" },
  { id: "ntc_old", title: "Diwali holidays", category: "Holiday", audience: "All School", status: "Published", sentAt: "2026-10-20T08:00:00.000Z", body: "School closed.", author: "Office", pinned: true, urgent: false },
  { id: "ntc_teach", title: "Exam duty roster", category: "Academic", audience: "Teachers", status: "Published", sentAt: "2026-11-01T08:00:00.000Z", body: "", author: "Office", pinned: false, urgent: false },
  { id: "ntc_parents", title: "PTM slots", category: "Academic", audience: "Parents", status: "Published", sentAt: "2026-11-23T08:00:00.000Z", body: "", author: "Office", pinned: false, urgent: false },
  { id: "ntc_draft", title: "Draft circular", category: "Staff", audience: "All Staff", status: "Draft", sentAt: "2026-11-23T08:00:00.000Z", body: "", author: "Office", pinned: false, urgent: false },
];

beforeEach(() => { authState.user = teacher; });

describe("staffNotices", () => {
  it("keeps published staff notices, pinned first then newest, with the private state joined", () => {
    const rows = staffNotices(notices as never, [{ id: "ntc_teach", teacherId: "stf_1", read: true, ack: true }]);
    expect(rows.map((n) => n.id)).toEqual(["ntc_old", "ntc_a1b2c3", "ntc_teach"]);
    expect(rows[2]!.state).toMatchObject({ ack: true });
  });
  it("labels a notice like the app (CIR-{year}-{last 4 of the id})", () => {
    expect(circularRef("ntc_a1b2c3", "2026-11-22T08:00:00.000Z")).toBe("CIR-2026-B2C3");
  });
});

describe("NoticesView", () => {
  it("lists staff notices newest first with unread badges and my read state only", () => {
    seed({ staff, com_notices: notices, att_circulars: [{ id: "ntc_old", teacherId: "stf_1", read: true, ack: true, ackAt: "2026-10-21T08:00:00.000Z" }, { id: "ntc_a1b2c3", teacherId: "stf_2", read: true }] });
    renderUI(<NoticesView />);
    const titles = screen.getAllByRole("button", { expanded: false }).map((b) => b.textContent ?? "");
    expect(titles).toHaveLength(3);
    expect(titles[0]).toContain("Diwali holidays");
    expect(titles[0]).toContain("Acknowledged");
    expect(titles[1]).toContain("Staff meeting on Friday");
    expect(titles[1]).toContain("New");
    expect(titles[1]).toContain("Urgent");
    expect(titles[1]).toContain("CIR-2026-B2C3 · Admin · 2026-11-22 · Principal");
    expect(titles[2]).toContain("Exam duty roster");
    expect(screen.queryByText("PTM slots")).not.toBeInTheDocument();
    expect(screen.queryByText("Draft circular")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Unread/ })).toHaveTextContent("(2)");
  });

  it("opening a notice marks it read in att_circulars and Acknowledge records ack + ackAt", async () => {
    seed({ staff, com_notices: notices });
    const { user } = renderUI(<NoticesView />);
    await user.click(screen.getByRole("button", { name: /Staff meeting on Friday/ }));
    expect(screen.getByText("3 pm in the library.")).toBeInTheDocument();
    expect(screen.getByText("agenda.pdf (120 KB)")).toBeInTheDocument();
    expect(getRow("att_circulars", "ntc_a1b2c3")).toEqual({ id: "ntc_a1b2c3", read: true, teacherId: "stf_1", updatedAt: expect.stringMatching(ISO), updatedBy: "uid_t" });
    expect(writes[0]).toMatchObject({ op: "set", coll: "att_circulars", merge: true });
    await user.click(screen.getByRole("button", { name: "Acknowledge" }));
    expect(await screen.findByText("Notice acknowledged")).toBeInTheDocument();
    expect(getRow("att_circulars", "ntc_a1b2c3")).toEqual({ id: "ntc_a1b2c3", read: true, ack: true, ackAt: expect.stringMatching(ISO), teacherId: "stf_1", updatedAt: expect.stringMatching(ISO), updatedBy: "uid_t" });
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
    // collapsing and reopening an already-read notice writes nothing more
    await user.click(screen.getByRole("button", { name: /Staff meeting on Friday/ }));
    await user.click(screen.getByRole("button", { name: /Staff meeting on Friday/ }));
    expect(writes).toHaveLength(2);
  });

  it("works for non-teaching staff with their own staffId and shows the empty state", async () => {
    authState.user = clerk;
    seed({ staff, com_notices: notices });
    const { user } = renderUI(<NoticesView />);
    await user.click(screen.getByRole("button", { name: /Diwali holidays/ }));
    expect(getRow("att_circulars", "ntc_old")).toMatchObject({ read: true, teacherId: "stf_9", updatedBy: "uid_c" });
    await user.click(screen.getByRole("tab", { name: /Acknowledged/ }));
    expect(screen.getByText("No notices yet")).toBeInTheDocument();
  });
});
