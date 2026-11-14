import { Suspense } from "react";
import { BusDetailsView } from "@/features/transport/BusDetailsView";

export const instant = false;

type Props = { params: Promise<{ busId: string }> };

async function BusDetails({ params }: Props) {
  const { busId } = await params;
  return <BusDetailsView key={busId} busId={busId} />;
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<p role="status">Loading bus details…</p>}>
    <BusDetails params={params} />
  </Suspense>;
}
