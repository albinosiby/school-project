import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { CrewStaffDetailsView } from "@/features/people/CrewStaffDetailsView";

export const instant = false;
type Props = { params: Promise<{ crewId: string }> };

async function CrewDetails({ params }: Props) {
  const { crewId } = await params;
  return <CrewStaffDetailsView key={crewId} crewId={crewId} />;
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<LoadingSkeleton variant="details" label="Loading staff details…" />}><CrewDetails params={params} /></Suspense>;
}
