import { Suspense } from "react";
import { StaffDetailsView } from "@/features/people/StaffDetailsView";

export const instant = false;

type Props = { params: Promise<{ staffId: string }> };

async function StaffDetails({ params }: Props) {
  const { staffId } = await params;
  return <StaffDetailsView key={staffId} staffId={staffId} />;
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<p role="status">Loading staff details…</p>}>
    <StaffDetails params={params} />
  </Suspense>;
}
