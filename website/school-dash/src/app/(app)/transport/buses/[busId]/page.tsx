import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { BusDetailsView } from "@/features/transport/BusDetailsView";

export const instant = false;

type Props = { params: Promise<{ busId: string }> };

async function BusDetails({ params }: Props) {
  const { busId } = await params;
  return <BusDetailsView key={busId} busId={busId} />;
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<LoadingSkeleton variant="details" label="Loading bus details…" />}>
    <BusDetails params={params} />
  </Suspense>;
}
