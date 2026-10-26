"use client";
import { notFound, useParams } from "next/navigation";
import { StepPage } from "@/features/onboarding/StepPage";

export default function Page() {
  const no = Number(useParams<{ step: string }>().step);
  if (!Number.isInteger(no) || no < 1 || no > 8) notFound();
  return <StepPage no={no} />;
}
