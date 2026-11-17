import { LoadingSkeleton } from "@/components/ui";

export default function Loading() {
  return <main className="min-h-screen bg-surface p-4 sm:p-6"><LoadingSkeleton variant="page" className="mx-auto max-w-6xl" /></main>;
}
