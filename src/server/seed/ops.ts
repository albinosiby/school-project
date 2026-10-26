import type { Seed } from "./index";
import { classSize, teacherFor } from "./demo";

// Homework rows use the contract shape: classId + teacherId (+ denormalized teacher/grade/section/counts).
const hw = (id: string, title: string, grade: string, section: string, subject: string, due: string, assigned: string, description: string, submitted: number, fixedTeacher?: [string, string]) => {
  const classId = `cls_${grade}${section}`;
  const t = fixedTeacher ? { teacherId: fixedTeacher[0], teacher: fixedTeacher[1] } : teacherFor(classId, subject);
  const total = classSize(classId);
  return { id, title, classId, grade, section, subject, due, assigned, description, status: "Published", ...t, submitted: Math.min(submitted, total), total };
};


export const ops: Seed = {
  ops_homework: [
    hw("hw_1", "Quadratic Equations Worksheet 4", "10", "A", "Mathematics", "2026-10-24", "2026-10-20", "Solve questions 1-15 from the worksheet.", 38),
    hw("hw_2", "Essay: My Favourite Season", "8", "A", "English", "2026-10-25", "2026-10-19", "250-word essay with a title and conclusion.", 22),
    hw("hw_3", "Chapter 6: Light - Diagrams", "8", "B", "Science", "2026-10-23", "2026-10-18", "Draw and label ray diagrams.", 31),
    hw("hw_4", "Map Work: Rivers of India", "6", "A", "Social Science", "2026-10-27", "2026-10-21", "Mark 10 major rivers on the outline map.", 5, ["stf_010", "Dr. Isha Joshi"]),
    hw("hw_5", "Hindi Vyakaran Abhyas", "7", "B", "Hindi", "2026-10-18", "2026-10-14", "Exercise 3 and 4.", 34, ["stf_002", "Mr. Meera Rao"]),
    hw("hw_6", "Coordinate Geometry: Distance Formula", "10", "B", "Mathematics", "2026-10-28", "2026-10-24", "Exercise 7.1, questions 1-12.", 31),
    hw("hw_7", "Force & Motion: Numericals", "9", "A", "Science", "2026-10-29", "2026-10-25", "Solve the 10 numericals on Newton's laws.", 12),
  ],
  ops_attendance: [],
  live_classes: [],
  staff_leaves: [],
  student_leaves: [],
};
