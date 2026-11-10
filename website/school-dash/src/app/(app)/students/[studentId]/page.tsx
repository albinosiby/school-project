import { Suspense } from "react";
import { StudentDetailsView } from "@/features/people/StudentDetailsView";

// The dashboard auth gate renders the page only after the client session is ready.
export const instant = false;

type Props = { params: Promise<{ studentId: string }> };

async function StudentDetails({ params }: Props) {
  const { studentId } = await params;
  return <StudentDetailsView key={studentId} studentId={studentId} />;
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<p role="status">Loading student details…</p>}>
    <StudentDetails params={params} />
  </Suspense>;
}
