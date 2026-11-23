import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui";
import { StudentFeeDetailsView } from "@/features/fees/StudentFeeDetailsView";

export const instant = false;
type Props = { params: Promise<{ studentId: string }> };
async function StudentFees({ params }: Props) {
  const { studentId } = await params;
  return <StudentFeeDetailsView key={studentId} studentId={studentId} />;
}
export default function Page({ params }: Props) {
  return <Suspense fallback={<LoadingSkeleton variant="details" label="Loading student fee details…" />}><StudentFees params={params} /></Suspense>;
}
