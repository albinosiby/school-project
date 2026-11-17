import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { GradeDetailsView } from "@/features/settings/GradeDetailsView";

export const instant = false;
type Props = { params: Promise<{ gradeId: string }> };
async function GradeDetails({ params }: Props) {
  const { gradeId } = await params;
  return <GradeDetailsView key={gradeId} gradeId={gradeId} />;
}
export default function Page({ params }: Props) {
  return <Suspense fallback={<LoadingSkeleton variant="details" label="Loading grade…" />}><GradeDetails params={params} /></Suspense>;
}
