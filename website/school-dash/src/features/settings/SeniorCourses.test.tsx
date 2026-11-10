import { describe, expect, it } from "vitest";
import { dialog, field, getRow, renderUI, rowsOf, screen, seed, writes } from "@/test/render";
import { EnquirySlideOver } from "@/features/admissions/EnquirySlideOver";
import { computeSeatRows, enrolmentStudent, type ClassRef } from "@/features/admissions/logic";
import type { Offer, Seat } from "@/features/admissions/types";
import { StudentsView } from "@/features/people/StudentsView";
import { ClassesView } from "@/features/ops/ClassesView";
import { SeniorCourses } from "./SeniorCourses";

describe("Senior course setup after onboarding", () => {
  it("publishes each grade's classes, subjects and capacity together for other dashboard workflows", async () => {
    const commerce = { id: "cls_11_commerce_A", grade: "11", section: "A", streamId: "commerce", stream: "Commerce" };
    seed({ classes: [commerce] });
    const editor = renderUI(<SeniorCourses />);
    const user = editor.user;
    await user.click(screen.getByRole("button", { name: "Add course" }));
    await user.type(field("Course name"), "Home Science");
    await user.click(screen.getByRole("checkbox", { name: "Grade 11" }));
    await user.click(screen.getByRole("checkbox", { name: "Grade 12" }));
    await user.type(field("Grade 11 subjects"), "Food and Nutrition, English");
    await user.type(field("Grade 12 subjects"), "Human Development");
    await user.clear(field("Grade 12 section A seats"));
    await user.type(field("Grade 12 section A seats"), "25");
    await user.click(screen.getByRole("button", { name: "Save course" }));
    expect(await screen.findByText("Course saved")).toBeInTheDocument();
    expect(getRow("classes", commerce.id)).toEqual(commerce);
    expect(getRow("classes", "cls_11_course_home_science_A")).toMatchObject({ capacity: 30, subjects: ["Food and Nutrition", "English"] });
    expect(getRow("classes", "cls_12_course_home_science_A")).toMatchObject({ capacity: 25, subjects: ["Human Development"] });
    expect(computeSeatRows(rowsOf("adm_seats") as Seat[], [], [])).toEqual([
      expect.objectContaining({ grade: "11-course_home_science", free: 30 }),
      expect.objectContaining({ grade: "12-course_home_science", free: 25 }),
    ]);

    const offer = { id: "off_1", name: "Riya", grade: "12-course_home_science" } as Offer;
    const student = enrolmentStudent(offer, undefined, undefined, [], rowsOf("classes") as ClassRef[], "2026-11-06");
    expect(student).toMatchObject({ classId: "cls_12_course_home_science_A", stream: "Home Science" });
    expect(computeSeatRows(rowsOf("adm_seats") as Seat[], [], [{ ...offer, status: "accepted" }], [student])).toEqual([
      expect.objectContaining({ grade: "11-course_home_science", free: 30 }),
      expect.objectContaining({ grade: "12-course_home_science", enrolled: 1, held: 1, free: 24 }),
    ]);

    editor.unmount();
    const admissions = renderUI(<EnquirySlideOver open onClose={() => {}} />);
    expect(screen.getByRole("option", { name: /Grade 11 \(Home Science\)/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Grade 12 \(Home Science\)/ })).toBeInTheDocument();
    admissions.unmount();

    const directory = renderUI(<StudentsView />);
    await directory.user.click(screen.getByRole("button", { name: "Add Student" }));
    await directory.user.selectOptions(field("Grade", dialog("Add Student")), "11");
    expect(screen.getByRole("option", { name: "Home Science" })).toBeInTheDocument();
    directory.unmount();

    const classes = renderUI(<ClassesView />);
    await classes.user.click(screen.getByText("Grade 11 · Home Science · A"));
    expect(screen.getByRole("option", { name: "Food and Nutrition" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Human Development" })).not.toBeInTheDocument();
  });

  it("keeps the records unchanged if a course save cannot commit", async () => {
    seed({});
    const { user } = renderUI(<SeniorCourses />);
    await user.click(screen.getByRole("button", { name: "Add course" }));
    await user.type(field("Course name"), "Home Science");
    await user.click(screen.getByRole("checkbox", { name: "Grade 11" }));
    await user.type(field("Grade 11 subjects"), "Food and Nutrition");
    const { failNextWrite } = await import("@/test/render");
    failNextWrite();
    await user.click(screen.getByRole("button", { name: "Save course" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
});
