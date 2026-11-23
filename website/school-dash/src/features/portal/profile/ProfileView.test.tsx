import { beforeEach, describe, expect, it } from "vitest";
import { ProfileView } from "./ProfileView";
import { authState, renderUI, screen, seed, writes } from "@/test/render";

const teacher = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher" as const, staffId: "stf_1", staffRole: "teacher", name: "Anita" };
const clerk = { ...teacher, id: "uid_c", email: "c@s.in", role: "staff" as const, staffId: "stf_9", staffRole: "accountant", name: "Ravi" };
const staff = [
  { id: "stf_1", name: "Anita Sharma", empId: "EMP-0042", designation: "Senior Teacher", department: "Mathematics", phone: "98765 43210", email: "anita@school.in", subjectNames: ["Mathematics", "Physics"], status: "Active", photoUrl: "https://files.test/anita.jpg" },
  { id: "stf_9", name: "Ravi Menon", empId: "EMP-0101", designation: "Accountant", department: "Accounts", phone: "", email: "" },
];

beforeEach(() => { authState.user = teacher; });

describe("ProfileView", () => {
  it("shows the own staff record, the login email and signs out", async () => {
    seed({ staff });
    const { user } = renderUI(<ProfileView />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My profile");
    expect(screen.getByText("Anita Sharma")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Anita Sharma" })).toHaveAttribute("src", "https://files.test/anita.jpg");
    expect(screen.getByText("Senior Teacher · Mathematics")).toBeInTheDocument();
    expect(screen.getByText("EMP-0042")).toBeInTheDocument();
    expect(screen.getByText("98765 43210")).toBeInTheDocument();
    expect(screen.getByText("anita@school.in")).toBeInTheDocument();
    expect(screen.getByText("Mathematics, Physics")).toBeInTheDocument();
    expect(screen.getByText("t@s.in")).toBeInTheDocument();
    expect(screen.getByText("Teaching staff")).toBeInTheDocument();
    expect(screen.getByText("stf_1")).toBeInTheDocument();
    expect(screen.queryByText("Ravi Menon")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(authState.logout).toHaveBeenCalledTimes(1);
    expect(writes).toHaveLength(0);
  });

  it("non-teaching staff see their record with the designation from users/{uid}", () => {
    authState.user = clerk;
    seed({ staff });
    renderUI(<ProfileView />);
    expect(screen.getByText("Ravi Menon")).toBeInTheDocument();
    expect(screen.getByText("Accountant · Accounts")).toBeInTheDocument();
    expect(screen.getByText("EMP-0101")).toBeInTheDocument();
    expect(screen.queryByText("Phone")).not.toBeInTheDocument();
    expect(screen.getByText("c@s.in")).toBeInTheDocument();
    expect(screen.getByText("Staff")).toBeInTheDocument();
    expect(screen.getByText("accountant")).toBeInTheDocument();
  });

  it("explains a login without a matching staff record", () => {
    seed({ staff: [] });
    renderUI(<ProfileView />);
    expect(screen.getByText("No staff record")).toBeInTheDocument();
    expect(screen.getByText("t@s.in")).toBeInTheDocument();
  });
});
