import { describe, expect, it, vi } from "vitest";
import { act } from "@testing-library/react";
import { authState, renderUI, screen } from "@/test/render";
import * as staffProfiles from "@/features/people/staffProfiles";
import { TeacherPhone } from "./TeacherPhone";

describe("Teacher phone", () => {
  it("uses the protected profile for managed staff and uses legacy summary contacts without a request", async () => {
    const load = vi.spyOn(staffProfiles, "loadStaffProfile").mockResolvedValue({ profile: { phone: "9000000001" }, photo: null });
    const view = renderUI(<TeacherPhone teacher={{ id: "managed", name: "Managed teacher", profileVersion: 1, phone: "Old phone" }} />);
    expect(await screen.findByRole("link", { name: "9000000001" })).toHaveAttribute("href", "tel:9000000001");
    expect(screen.queryByText("Old phone")).not.toBeInTheDocument();
    view.rerender(<TeacherPhone teacher={{ id: "legacy", name: "Legacy teacher", phone: "9000000002" }} />);
    expect(screen.getByRole("link", { name: "9000000002" })).toHaveAttribute("href", "tel:9000000002");
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("shows a retry for a failed request and shows missing only after a successful empty response", async () => {
    vi.spyOn(staffProfiles, "loadStaffProfile").mockRejectedValueOnce(new Error("unavailable")).mockResolvedValueOnce({ profile: { phone: "" }, photo: null });
    const { user } = renderUI(<TeacherPhone teacher={{ id: "teacher", name: "Teacher", profileVersion: 1 }} />);
    await user.click(await screen.findByRole("button", { name: "Retry phone" }));
    expect(await screen.findByText("Phone not recorded")).toBeInTheDocument();
    expect(screen.queryByText("Phone unavailable")).not.toBeInTheDocument();
  });
  it("ignores late contact responses when the assigned teacher changes", async () => {
    let finishFirst!: (value: Awaited<ReturnType<typeof staffProfiles.loadStaffProfile>>) => void;
    vi.spyOn(staffProfiles, "loadStaffProfile")
      .mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce({ profile: { phone: "9000000002" }, photo: null });
    const view = renderUI(<TeacherPhone teacher={{ id: "first", name: "First teacher", profileVersion: 1 }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading phone");
    view.rerender(<TeacherPhone teacher={{ id: "second", name: "Second teacher", profileVersion: 1 }} />);
    expect(await screen.findByRole("link", { name: "9000000002" })).toBeInTheDocument();
    await act(async () => finishFirst({ profile: { phone: "9000000001" }, photo: null }));
    expect(screen.queryByRole("link", { name: "9000000001" })).not.toBeInTheDocument();
  });
  it("does not request protected profiles for a non-admin session", () => {
    const load = vi.spyOn(staffProfiles, "loadStaffProfile");
    authState.user = { ...authState.user!, role: "owner" };
    renderUI(<TeacherPhone teacher={{ id: "teacher", name: "Teacher", profileVersion: 1 }} />);
    expect(load).not.toHaveBeenCalled();
  });
});
