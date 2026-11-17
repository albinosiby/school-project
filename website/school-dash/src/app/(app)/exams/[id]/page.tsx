import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { ExamDetailPage } from "@/features/exams/ExamDetailPage";

export default function Page() {
  return <Suspense fallback={<LoadingSkeleton variant="details" label="Loading examination…" />}><ExamDetailPage /></Suspense>;
}
