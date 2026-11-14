import { expect, it } from "vitest";
import { SubjectSettings } from "./SubjectSettings";
import type { SchoolSubject } from "@/lib/schoolSubjects";
import { dialog, field, getRow, renderUI, screen, seed, within } from "@/test/render";

it("starts with school subjects and saves additions, renames and deletions", async () => {
  seed({ classes: [{ id: "1A", subjects: ["Mathematics"] }],
    assignments: [{ id: "science", subject: "Science" }, { id: "math", subject: " mathematics " }] });
  const { user } = renderUI(<SubjectSettings />);
  expect(screen.getByRole("button", { name: "Edit Mathematics" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit Science" })).toBeInTheDocument();

  await user.type(field("Subject name"), " science ");
  await user.click(screen.getByRole("button", { name: "Add subject" }));
  expect(await screen.findByText("A subject with this name already exists.")).toBeInTheDocument();
  await user.clear(field("Subject name"));
  await user.type(field("Subject name"), "  computer   science  ");
  await user.click(screen.getByRole("button", { name: "Add subject" }));
  await user.click(await screen.findByRole("button", { name: "Edit Computer Science" }));
  await user.clear(field("Subject name"));
  await user.type(field("Subject name"), "ICT fundamentals");
  await user.click(screen.getByRole("button", { name: "Save subject" }));
  const deleteScience = () => screen.getByRole("button", { name: "Delete Science" });
  await user.click(deleteScience());
  await user.click(within(dialog("Delete subject?")).getByRole("button", { name: "Cancel" }));
  expect(deleteScience()).toBeInTheDocument();
  await user.click(deleteScience());
  await user.click(within(dialog("Delete subject?")).getByRole("button", { name: "Delete subject" }));
  expect(getRow("set_config", "subjects")).toMatchObject({ subjects: [
    { name: "Mathematics", active: true }, { name: "ICT Fundamentals", active: true },
  ] });
  expect(getRow("assignments", "science")).toMatchObject({ subject: "Science" });
  expect(screen.queryByRole("button", { name: "Delete Science" })).not.toBeInTheDocument();
});

it("assigns a subject to an existing department and removes it again", async () => {
  seed({ set_config: [{ id: "subjects", subjects: [{ name: "Science", active: true }, { name: "English", active: true }], departments: [{ id: "dep_1", name: "Science And Technology" }] }] });
  const { user } = renderUI(<SubjectSettings />);
  expect(screen.queryByRole("button", { name: "Add department" })).not.toBeInTheDocument();
  expect(screen.getAllByText("Science And Technology").length).toBeGreaterThan(0);
  await user.click(screen.getByRole("button", { name: "Edit Science" }));
  await user.click(screen.getByRole("checkbox", { name: "Science And Technology" }));
  await user.click(screen.getByRole("button", { name: "Save subject" }));
  expect(getRow("set_config", "subjects")).toMatchObject({ subjects: [{ name: "Science", active: true, departmentIds: ["dep_1"] }, { name: "English", active: true }] });
  await user.click(screen.getByRole("button", { name: "Edit Science" }));
  expect(screen.getByRole("checkbox", { name: "Science And Technology" })).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Science And Technology" }));
  await user.click(screen.getByRole("button", { name: "Save subject" }));
  expect(getRow("set_config", "subjects")?.subjects).toEqual([
    { id: expect.any(String), name: "Science", active: true, departmentIds: [], aliasIds: [] },
    { name: "English", active: true, departmentIds: [], aliasIds: [] },
  ]);
});


it("maps one subject to several departments and blocks a duplicate name", async () => {
  seed({ set_config: [{ id: "subjects",
    departments: [{ id: "science", name: "Science" }, { id: "home", name: "Home Science" }], subjects: [],
  }] });
  const { user } = renderUI(<SubjectSettings />);
  await user.type(field("Subject name"), "chemistry");
  await user.click(screen.getByRole("checkbox", { name: "Science" }));
  await user.click(screen.getByRole("checkbox", { name: "Home Science" }));
  await user.click(screen.getByRole("button", { name: "Add subject" }));
  const subjects = getRow("set_config", "subjects")?.subjects as SchoolSubject[];
  expect(subjects).toEqual([{ id: expect.any(String), name: "Chemistry", active: true,
    departmentIds: ["science", "home"], aliasIds: [] }]);

  await user.type(field("Subject name"), "Chemistry");
  await user.click(screen.getByRole("button", { name: "Add subject" }));
  expect(screen.getByRole("alert")).toHaveTextContent("A subject with this name already exists.");
  await user.click(screen.getByRole("button", { name: "Edit Chemistry" }));
  expect(screen.getByRole("checkbox", { name: "Science" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Home Science" })).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "Home Science" }));
  await user.click(screen.getByRole("button", { name: "Save subject" }));
  expect(getRow("set_config", "subjects")?.subjects).toEqual([{ ...subjects[0], departmentIds: ["science"] }]);
});

it("combines older department subjects and keeps their identifiers when mapping is saved", async () => {
  seed({ set_config: [{ id: "subjects",
    departments: [{ id: "science", name: "Science" }, { id: "home", name: "Home Science" }],
    subjects: [
      { id: "chemistry", name: "Chemistry", active: true },
      { id: "chem_science", name: "Chemistry", active: true, departmentId: "science" },
      { id: "chem_home", name: "Chemistry", active: true, departmentId: "home" },
    ],
  }] });
  const { user } = renderUI(<SubjectSettings />);
  expect(screen.getAllByRole("button", { name: "Edit Chemistry" })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Edit Chemistry" }));
  expect(screen.getByRole("checkbox", { name: "Science" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Home Science" })).toBeChecked();
  await user.click(screen.getByRole("button", { name: "Save subject" }));
  expect(getRow("set_config", "subjects")?.subjects).toEqual([{ id: "chemistry", name: "Chemistry", active: true,
    departmentIds: ["science", "home"], aliasIds: ["chem_science", "chem_home"] }]);
});

it("keeps the catalog empty when deleting the last imported subject", async () => {
  seed({ classes: [{ id: "1A", subjects: ["Science"] }] });
  const { user } = renderUI(<SubjectSettings />);
  await user.click(screen.getByRole("button", { name: "Delete Science" }));
  await user.click(within(dialog("Delete subject?")).getByRole("button", { name: "Delete subject" }));
  expect(getRow("set_config", "subjects")).toMatchObject({ subjects: [] });
  expect(screen.getByText("Add a subject to make it available in the teacher form.")).toBeInTheDocument();
  expect(getRow("classes", "1A")).toMatchObject({ subjects: ["Science"] });
});
