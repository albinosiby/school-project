import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderUI, screen } from "@/test/render";
import { StudentSearchSelect } from "./StudentSearchSelect";

const students = Array.from({ length: 75 }, (_, index) => ({
  id: `student-${index}`, name: `Student ${String(index).padStart(2, "0")}`, grn: `GRN-${index}`, grade: "5", section: "A",
}));

function Picker({ empty = false }: { empty?: boolean }) {
  const [value, setValue] = useState("");
  return <StudentSearchSelect students={empty ? [] : students} value={value} onChange={setValue} />;
}

describe("student search dropdown", () => {
  it("bounds the initial list while finding and selecting students beyond it", async () => {
    const { user } = renderUI(<Picker />);
    const input = screen.getByRole("combobox", { name: "Student" });
    await user.click(input);
    expect(screen.getAllByRole("option")).toHaveLength(50);
    expect(screen.getByText(/Showing 50 of 75 students/)).toBeInTheDocument();
    await user.type(input, "grn-74");
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.keyboard("{ArrowUp}");
    const option = screen.getByRole("option");
    expect(input).toHaveAttribute("aria-activedescendant", option.id);
    await user.keyboard("{Enter}");
    expect(input).toHaveValue("Student 74 · GRN-74 · Grade 5-A");
    await user.click(input);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.tab();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(input).toHaveValue("Student 74 · GRN-74 · Grade 5-A");
  });

  it("shows an empty state when no students are available", async () => {
    const { user } = renderUI(<Picker empty />);
    await user.click(screen.getByRole("combobox", { name: "Student" }));
    expect(screen.getByRole("status")).toHaveTextContent("No students available.");
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });
});
