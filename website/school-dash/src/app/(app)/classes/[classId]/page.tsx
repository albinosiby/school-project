import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { ClassDetailsView } from "@/features/ops/ClassDetailsView";

export const instant = false;
type Props = { params: Promise<{ classId: string }> };
async function ClassDetails({ params }: Props) {
  const { classId } = await params;
  return <ClassDetailsView key={classId} classId={classId} />;
}
export default function Page({ params }: Props) {
  return <Suspense fallback={<LoadingSkeleton variant="details" label="Loading class details…" />}><ClassDetails params={params} /></Suspense>;
}
