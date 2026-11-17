import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { StaffDetailsView } from "@/features/people/StaffDetailsView";

export const instant = false;

type Props = { params: Promise<{ staffId: string }> };

async function StaffDetails({ params }: Props) {
  const { staffId } = await params;
  return <StaffDetailsView key={staffId} staffId={staffId} />;
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<LoadingSkeleton variant="details" label="Loading staff details…" />}>
    <StaffDetails params={params} />
  </Suspense>;
}
