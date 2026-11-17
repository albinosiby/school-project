import { expect, it } from "vitest";
import { StudentsView, type Student } from "./StudentsView";
import { StaffView } from "./StaffView";
import { GuardiansDirectory } from "./GuardiansDirectory";
import { dialog, field, renderUI, screen, seed, setUrl, within, writes } from "@/test/render";

const student = (id: string, grade = "LKG", extra: Partial<Student> = {}): Student => ({
  id, name: `Student ${id}`, grn: `GRN-${id}`, grade, section: "A", guardian: `Parent ${id}`,
  phone: "9000012345", status: "Active", attendance: 0, ...extra,
});

it("keeps student search visible, searches email, and offers configured early and senior classes", async () => {
  seed({ students: [student("early", "LKG", { email: "parent@school.test" }), student("senior", "11", { streamId: "science", section: "C" })],
    classes: [{ id: "ukg", grade: "UKG", section: "D" }, { id: "science", grade: "11", section: "C", streamId: "science" },
      { id: "commerce", grade: "11", section: "B", streamId: "commerce" }],
  });
  const { user } = renderUI(<StudentsView />);
  const search = screen.getByRole("searchbox", { name: "Search students" });
  await user.type(search, "parent@school.test");
  expect(screen.getByRole("link", { name: "Student early" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Student senior" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Filter" }));
  const filters = dialog("Filter students");
  expect(within(field("Grade", filters)).getByRole("option", { name: "Grade LKG" })).toBeInTheDocument();
  expect(within(field("Grade", filters)).getByRole("option", { name: "Grade UKG" })).toBeInTheDocument();
  await user.selectOptions(field("Grade", filters), "11");
  await user.selectOptions(field("Stream", filters), "science");
  expect(within(field("Section", filters)).getByRole("option", { name: "C" })).toBeInTheDocument();
  expect(within(field("Section", filters)).queryByRole("option", { name: "B" })).not.toBeInTheDocument();
  await user.click(within(filters).getByRole("button", { name: "Done" }));
  expect(search).toHaveValue("parent@school.test");
  expect(screen.getByRole("button", { name: "Remove Science filter" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear all" }));
  expect(search).toHaveValue("");
  expect(screen.getByRole("link", { name: "Student early" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Student senior" })).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("returns to the first page after external search without losing the table sort", async () => {
  seed({ students: Array.from({ length: 22 }, (_, index) => student(String(index), "1", {
    name: `${index < 12 ? "Alpha" : "Beta"} ${String(index).padStart(2, "0")}`,
  })) });
  const { user } = renderUI(<StudentsView />);
  await user.click(screen.getByRole("button", { name: "Student" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.queryByRole("link", { name: "Alpha 00" })).not.toBeInTheDocument();
  await user.type(screen.getByRole("searchbox", { name: "Search students" }), "Alpha");
  expect(screen.getByRole("link", { name: "Alpha 00" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
});

it("searches staff by email and phone and deduplicates category-specific assignment filters", async () => {
  setUrl("/staff");
  seed({ staff: [
    { id: "teacher", name: "Teacher One", empId: "T1", category: "Teaching", designation: "Teacher", role: "Teacher", department: "Academics", subjectNames: ["Science"], phone: "+91 90000 12345", email: "teacher@school.test", status: "Active" },
    { id: "teacher2", name: "Teacher Two", empId: "T2", category: "Teaching", designation: "Teacher", role: "Teacher", department: "Academics", subjectNames: ["science"], phone: "80000", status: "Active" },
    { id: "driver", name: "Driver One", empId: "D1", category: "Non-Teaching", designation: "Driver", role: "Driver", department: "Transport", phone: "70000", status: "Active" },
  ] });
  const { user } = renderUI(<StaffView />);
  const search = screen.getByRole("searchbox", { name: "Search staff" });
  await user.type(search, "teacher@school.test");
  expect(screen.getByRole("link", { name: "Teacher One" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Teacher Two" })).not.toBeInTheDocument();
  await user.clear(search); await user.type(search, "919000012345");
  expect(screen.getByRole("link", { name: "Teacher One" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear all" }));
  await user.click(screen.getByRole("button", { name: /^Teaching/ }));
  await user.click(screen.getByRole("button", { name: /^Filter/ }));
  const filters = dialog("Filter staff");
  const assignments = within(field("Subject or department", filters));
  expect(assignments.getAllByRole("option", { name: /science/i })).toHaveLength(1);
  expect(assignments.queryByRole("option", { name: "Transport" })).not.toBeInTheDocument();
  await user.selectOptions(field("Subject or department", filters), "science");
  await user.click(within(filters).getByRole("button", { name: "Done" }));
  await user.click(screen.getByRole("button", { name: /^Non-Teaching/ }));
  expect(screen.getByRole("link", { name: "Driver One" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Remove Science filter" })).not.toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("searches guardian student names and filters families without exposing student lists", async () => {
  const students = [student("a", "LKG", { name: "Child A", guardian: "Shared parent", email: "shared@school.test" }),
    student("b", "UKG", { guardian: "Shared parent", email: "shared@school.test" }), student("c")];
  const { user } = renderUI(<GuardiansDirectory students={students} users={[]} missing={new Map([["a", 0], ["b", 0], ["c", 2]])} />);
  await user.type(screen.getByRole("searchbox", { name: "Search guardians" }), "Child A");
  expect(screen.getByRole("row", { name: /Shared parent/ })).toHaveTextContent("2 students");
  expect(screen.queryByText("Child A")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear all" }));
  await user.click(screen.getByRole("button", { name: "Filter" }));
  const filters = dialog("Filter guardians");
  await user.selectOptions(field("Linked students", filters), "multiple");
  await user.selectOptions(field("Documents", filters), "complete");
  await user.click(within(filters).getByRole("button", { name: "Done" }));
  expect(screen.getByRole("row", { name: /Shared parent/ })).toBeInTheDocument();
  expect(screen.queryByRole("row", { name: /Parent c/ })).not.toBeInTheDocument();
});
