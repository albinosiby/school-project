import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { AssignmentDetail } from "@/features/portal/assignments/AssignmentDetail";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

async function Assignment({ params }: Props) {
  const { id } = await params;
  return <AssignmentDetail key={id} id={id} />;
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<LoadingSkeleton variant="details" label="Loading the assignment…" />}>
    <Assignment params={params} />
  </Suspense>;
}
