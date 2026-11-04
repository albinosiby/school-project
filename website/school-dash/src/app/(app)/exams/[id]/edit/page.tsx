"use client";
import { useParams } from "next/navigation";
import { CycleForm } from "@/features/exams/CycleForm";

// Reads the id on the client (see students/page.tsx)
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <CycleForm cycleId={id} />;
}
