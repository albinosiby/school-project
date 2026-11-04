import { describe, expect, it } from "vitest";
import { NotificationsView } from "./NotificationsView";
import { addDays, TODAY } from "./data";
import { getRow, renderUI, router, rowsOf, screen, seed, within, writesTo } from "@/test/render";

// rows as the Cloud Functions write them (functions/index.js notifyAdmin, functions/transport.js onCrewLeaveRequested)
const fn = (id: string, o: Record<string, unknown>) => ({ id, read: false, source: "teacher", createdAt: `${TODAY}T09:00:00`, ...o });
const rows = [
  fn("n_leave", { category: "approvals", title: "Leave request", body: "Mrs. Anita Sharma applied for Casual Leave", href: "/approvals" }),
  fn("n_reg", { category: "approvals", title: "Attendance regularization", body: "Mr. Verma asked to regularize Check-in", href: "/staff?tab=checkins", createdAt: `${TODAY}T10:00:00` }),
  fn("n_crew", { category: "approvals", title: "Transport leave request", body: "Ramesh Kumar (driver) applied for Sick", href: "/transport?tab=leaves", createdAt: `${addDays(TODAY, -1)}T18:00:00` }),
  fn("n_live", { category: "ops", title: "Live class scheduled", body: "Science revision", href: "/live-classes", read: true, createdAt: `${addDays(TODAY, -9)}T08:00:00` }),
];

describe("Notifications feed", () => {
  it("groups function rows by day and counts unread", () => {
    seed({ notifications: rows });
    renderUI(<NotificationsView />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["TODAY", "YESTERDAY", "EARLIER"]);
    expect(screen.getByRole("button", { name: "Mark all as read (3)" })).toBeEnabled();
    const today = screen.getByText("TODAY").closest("section") as HTMLElement;
    expect(within(today).getAllByText(/:$/).map((b) => b.textContent)).toEqual(["Attendance regularization:", "Leave request:"]);
  });

  it("opening a row marks it read and follows its href (regularization and crew-leave links)", async () => {
    seed({ notifications: rows });
    const { user } = renderUI(<NotificationsView />);
    await user.click(screen.getByText("Attendance regularization:"));
    expect(getRow("notifications", "n_reg")).toMatchObject({ read: true });
    expect(router.push).toHaveBeenLastCalledWith("/staff?tab=checkins");
    await user.click(screen.getByText("Transport leave request:"));
    expect(router.push).toHaveBeenLastCalledWith("/transport?tab=leaves");
  });

  it("filters by category, and Mark all as read touches only unread rows", async () => {
    seed({ notifications: rows });
    const { user } = renderUI(<NotificationsView />);
    await user.click(screen.getByRole("tab", { name: /Operations/ }));
    expect(screen.getByText("Live class scheduled:")).toBeInTheDocument();
    expect(screen.queryByText("Leave request:")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mark all as read (3)" }));
    expect(await screen.findByText("All notifications marked as read")).toBeInTheDocument();
    expect(writesTo("notifications").map((w) => w.id).sort()).toEqual(["n_crew", "n_leave", "n_reg"]);
    expect(rowsOf<{ read: boolean }>("notifications").every((r) => r.read)).toBe(true);
  });

  it("delete removes the row", async () => {
    seed({ notifications: rows.slice(0, 1) });
    const { user } = renderUI(<NotificationsView />);
    await user.click(screen.getByRole("button", { name: "Delete notification" }));
    expect(await screen.findByText("Notification deleted")).toBeInTheDocument();
    expect(writesTo("notifications")).toEqual([expect.objectContaining({ op: "delete", id: "n_leave" })]);
    expect(screen.getByText("No notifications")).toBeInTheDocument();
  });
});
