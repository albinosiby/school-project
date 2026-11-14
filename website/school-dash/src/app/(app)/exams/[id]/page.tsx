import { Suspense } from "react";
import { ExamDetailPage } from "@/features/exams/ExamDetailPage";

export default function Page() {
  return <Suspense fallback={<p>Loading examination…</p>}><ExamDetailPage /></Suspense>;
}
