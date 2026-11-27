import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui";
import { StudentProfile } from "@/features/portal/classes/StudentProfile";

export const instant = false;

type Props = { params: Promise<{ classId: string; studentId: string }> };

async function Content({ params }: Props) {
  const { classId, studentId } = await params;
  return <StudentProfile key={`${classId}/${studentId}`} classId={decodeURIComponent(classId)} studentId={decodeURIComponent(studentId)} />;
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<LoadingSkeleton variant="details" label="Loading the student…" />}><Content params={params} /></Suspense>;
}
