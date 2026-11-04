"use client";
import { useParams } from "next/navigation";
import { SchoolDetail } from "@/features/owner/SchoolDetail";

// Reads the id on the client (see exams/[id]/edit/page.tsx)
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <SchoolDetail key={id} sid={id} />;
}
