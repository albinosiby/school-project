import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui";
import { ClassPage } from "@/features/portal/classes/ClassPage";

export const instant = false;

type Props = { params: Promise<{ classId: string }> };

async function Content({ params }: Props) {
  const { classId } = await params;
  return <ClassPage key={classId} classId={decodeURIComponent(classId)} />;
}

export default function Page({ params }: Props) {
  return <Suspense fallback={<LoadingSkeleton variant="page" label="Loading the class…" />}><Content params={params} /></Suspense>;
}
