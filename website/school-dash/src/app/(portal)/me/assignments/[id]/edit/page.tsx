import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { AssignmentForm } from "@/features/portal/assignments/AssignmentForm";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

async function EditAssignment({ params }: Props) {
  const { id } = await params;
  return <AssignmentForm key={id} editId={id} />;
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<LoadingSkeleton variant="form" label="Loading…" />}>
    <EditAssignment params={params} />
  </Suspense>;
}
