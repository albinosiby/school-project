import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { LeavePolicyEditor } from "./LeavePolicyEditor";
import { getRow, renderUI, screen, seed, writes } from "@/test/render";

const policy = { id: "policy", types: [{ id: "CL", name: "Casual (CL)", type: "Casual Leave", total: 12 }, { id: "ML", name: "Medical (ML)", type: "Medical Leave", total: 10 }], checkInBy: "08:15" };
const save = () => screen.getByRole("button", { name: /Save leave policy/ });
const alert = () => screen.getByRole("alert").textContent;

describe("Leave policy editor", () => {
  it("creates set_leave_policy/policy from the defaults on first save", async () => {
    const { user } = renderUI(<LeavePolicyEditor />);
    expect(screen.getByText("Not saved yet")).toBeInTheDocument();
    await user.click(save());
    expect(getRow("set_leave_policy", "policy")).toMatchObject({ checkInBy: "08:15", types: expect.arrayContaining([{ id: "CL", name: "Casual (CL)", type: "Casual Leave", total: 12 }]) });
    expect(await screen.findByText("Leave policy saved")).toBeInTheDocument();
  });

  it("refuses an empty label", async () => {
    seed({ set_leave_policy: [policy] });
    const { user } = renderUI(<LeavePolicyEditor />);
    await user.clear(screen.getAllByLabelText("Label")[1]!);
    await user.click(save());
    expect(alert()).toBe("Every leave type needs a code, a label and a leave type");
    expect(writes).toHaveLength(0);
  });

  it("refuses duplicate codes", async () => {
    seed({ set_leave_policy: [policy] });
    const { user } = renderUI(<LeavePolicyEditor />);
    const code = screen.getAllByLabelText("Leave code")[1]!;
    await user.clear(code); await user.type(code, "CL");
    await user.click(save());
    expect(alert()).toBe("Leave codes must be unique");
    expect(writes).toHaveLength(0);
  });

  it("refuses a fractional or out-of-range yearly total", async () => {
    seed({ set_leave_policy: [policy] });
    const { user } = renderUI(<LeavePolicyEditor />);
    fireEvent.change(screen.getAllByLabelText("Days per year")[0]!, { target: { value: "400" } });
    await user.click(save());
    expect(alert()).toBe("Yearly totals must be whole numbers between 0 and 365");
    fireEvent.change(screen.getAllByLabelText("Days per year")[0]!, { target: { value: "2.5" } });
    await user.click(save());
    expect(alert()).toBe("Yearly totals must be whole numbers between 0 and 365");
    expect(writes).toHaveLength(0);
  });

  it("refuses removing every type", async () => {
    seed({ set_leave_policy: [policy] });
    const { user } = renderUI(<LeavePolicyEditor />);
    await user.click(screen.getByRole("button", { name: "Remove CL" }));
    await user.click(screen.getByRole("button", { name: "Remove ML" }));
    await user.click(save());
    expect(alert()).toBe("Add at least one leave type");
    expect(writes).toHaveLength(0);
  });

  it("saves an edited total and check-in time on the existing doc", async () => {
    seed({ set_leave_policy: [policy] });
    const saved: string[] = [];
    const { user } = renderUI(<LeavePolicyEditor onSaved={(d) => saved.push(d)} />);
    fireEvent.change(screen.getAllByLabelText("Days per year")[0]!, { target: { value: "14" } });
    fireEvent.change(screen.getByLabelText(/Check in by/), { target: { value: "08:00" } });
    await user.click(save());
    expect(getRow("set_leave_policy", "policy")).toMatchObject({ checkInBy: "08:00", types: [{ id: "CL", name: "Casual (CL)", type: "Casual Leave", total: 14 }, policy.types[1]] });
    expect(saved).toEqual(["2 leave types · check-in by 08:00"]);
  });
});
