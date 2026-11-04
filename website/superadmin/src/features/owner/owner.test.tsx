import { describe, expect, it } from "vitest";
import { authAccounts, authState, callableCalls, dialog, field, fieldError, getRow, renderUI, router, screen, seed, userEvent, within, writesTo } from "@/test/render";
import { NewSchoolForm } from "./NewSchoolForm";
import { LeadsView } from "./LeadsView";
import { SchoolDetail } from "./SchoolDetail";

const owner = () => { authState.user = { id: "own1", email: "owner@edvio.test", organizationName: "Edvio", schoolId: "", role: "owner" }; };

describe("Add school", () => {
  it("shows what is missing and creates nothing", async () => {
    owner();
    renderUI(<NewSchoolForm />);
    await userEvent.click(screen.getByRole("button", { name: "Create school" }));
    expect(fieldError("School name")).toBe("Enter the school's name.");
    expect(fieldError("Admin email (sign-in id)")).toContain("Enter a valid email.");
    expect(fieldError("Password")).toBe("Use at least 8 characters.");
    expect(authAccounts.size).toBe(0);
  });

  it("creates the admin login with the chosen password, the starter school and its platform record", async () => {
    owner();
    renderUI(<NewSchoolForm />);
    await userEvent.type(field("School name"), "Sunrise Public School");
    await userEvent.type(field("City"), "Thrissur");
    await userEvent.type(field("Admin name"), "Meera Nair");
    await userEvent.type(field("Admin email (sign-in id)"), "Meera@Sunrise.test");
    await userEvent.type(field("Password"), "first-pass-1");
    await userEvent.click(screen.getByRole("button", { name: "Create school" }));
    expect(await screen.findByText("Sunrise Public School is ready")).toBeInTheDocument();
    const uid = authAccounts.get("meera@sunrise.test")!;
    expect(uid).toBeTruthy();
    expect(getRow("users", uid)).toMatchObject({ schoolId: uid, role: "admin", email: "meera@sunrise.test", name: "Meera Nair" });
    expect(getRow("school", "school")).toMatchObject({ name: "Sunrise Public School", city: "Thrissur" });
    expect(getRow("platform_schools", uid)).toMatchObject({ name: "Sunrise Public School", status: "active", plan: "Trial", adminEmail: "meera@sunrise.test", city: "Thrissur", updatedBy: "admin_uid" });
    expect(screen.getByText("first-pass-1")).toBeInTheDocument();
  });

  it("says when the email already has a login", async () => {
    owner();
    authAccounts.set("taken@x.test", "u1");
    renderUI(<NewSchoolForm />);
    await userEvent.type(field("School name"), "Taken School");
    await userEvent.type(field("Admin name"), "Someone");
    await userEvent.type(field("Admin email (sign-in id)"), "taken@x.test");
    await userEvent.type(field("Password"), "first-pass-1");
    await userEvent.click(screen.getByRole("button", { name: "Create school" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already has a login");
    expect(writesTo("platform_schools")).toHaveLength(0);
  });

  it("prefills from a demo request and marks it converted", async () => {
    owner();
    seed({ leads: [{ id: "l1", name: "Ravi", school: "Hill View School", email: "ravi@hill.test", phone: "+91 90000 00000", message: "", status: "contacted" }] });
    renderUI(<NewSchoolForm leadId="l1" />);
    expect(await screen.findByDisplayValue("Hill View School")).toBeInTheDocument();
    expect(field("Admin email (sign-in id)")).toHaveValue("ravi@hill.test");
    await userEvent.type(field("Password"), "first-pass-1");
    await userEvent.click(screen.getByRole("button", { name: "Create school" }));
    await screen.findByText("Hill View School is ready");
    const uid = authAccounts.get("ravi@hill.test")!;
    expect(getRow("leads", "l1")).toMatchObject({ status: "converted", schoolId: uid });
    expect(getRow("platform_schools", uid)).toMatchObject({ leadId: "l1" });
  });
});

describe("Demo requests", () => {
  it("lists open requests and moves one through the pipeline", async () => {
    owner();
    seed({ leads: [
      { id: "l1", name: "Ravi", school: "Hill View School", email: "ravi@hill.test", phone: "", message: "500 students, 4 buses", status: "new" },
      { id: "l2", name: "Old", school: "Closed One", email: "o@x.test", status: "closed" },
    ] });
    renderUI(<LeadsView />);
    expect(await screen.findByText("Hill View School")).toBeInTheDocument();
    expect(screen.queryByText("Closed One")).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Status of Hill View School"), "contacted");
    expect(getRow("leads", "l1")).toMatchObject({ status: "contacted", updatedBy: "admin_uid" });
  });
});

describe("School page", () => {
  const school = () => seed({
    users: [{ id: "s1", schoolId: "s1", role: "admin", email: "head@one.test", name: "Head" }, { id: "t1", schoolId: "s1", role: "teacher", email: "t@one.test" }],
    school: [{ id: "school", name: "One Public School", city: "Kochi" }],
    onboarding: [{ id: "state", complete: true }],
    students: [{ id: "st1", name: "Aarav", grn: "G-1", grade: "5", section: "A" }],
    staff: [{ id: "sf1", name: "Lakshmi", designation: "Teacher" }],
    platform_schools: [{ id: "s1", name: "One Public School", status: "active", plan: "Basic" }],
  });

  it("opens the school's console as its admin", async () => {
    owner(); school();
    renderUI(<SchoolDetail sid="s1" />);
    expect(await screen.findByRole("link", { name: /Open school console/ })).toHaveAttribute("href", "http://localhost:3000/dashboard?school=s1");
    expect(authState.actAs).not.toHaveBeenCalled();
  });

  it("shows the full student and staff lists", async () => {
    owner(); school();
    renderUI(<SchoolDetail sid="s1" />);
    await userEvent.click(await screen.findByRole("tab", { name: /Students/ }));
    expect(screen.getByText("Aarav")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Staff/ }));
    expect(screen.getByText("Lakshmi")).toBeInTheDocument();
  });

  it("sets a new password for the admin through the server", async () => {
    owner(); school();
    renderUI(<SchoolDetail sid="s1" />);
    await userEvent.click((await screen.findAllByRole("button", { name: /Set password/ }))[0]!);
    await userEvent.type(field("New password", dialog()), "brand-new-1");
    await userEvent.click(within(dialog()).getByRole("button", { name: "Set password" }));
    expect(callableCalls).toContainEqual(["ownerSetPassword", { uid: "s1", password: "brand-new-1" }]);
  });

  it("suspends with a reason, and deletes only after the name is typed", async () => {
    owner(); school();
    renderUI(<SchoolDetail sid="s1" />);
    await userEvent.click(await screen.findByRole("button", { name: /Suspend/ }));
    await userEvent.type(field("Reason"), "Unpaid");
    await userEvent.click(screen.getByRole("button", { name: "Suspend school" }));
    expect(getRow("platform_schools", "s1")).toMatchObject({ status: "suspended", reason: "Unpaid", plan: "Basic" });

    await userEvent.click(screen.getByRole("button", { name: /^Delete$/ }));
    const del = screen.getByRole("button", { name: "Delete school for good" });
    expect(del).toBeDisabled();
    await userEvent.type(field(/Type the school name/), "One Public School");
    await userEvent.click(del);
    expect(callableCalls).toContainEqual(["ownerDeleteSchool", { schoolId: "s1", confirm: "s1" }]);
    expect(router.push).toHaveBeenCalledWith("/owner/schools");
  });
});
