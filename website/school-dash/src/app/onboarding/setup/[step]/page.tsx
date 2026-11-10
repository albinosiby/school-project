"use client";
import { notFound, useParams } from "next/navigation";
import { StepPage } from "@/features/onboarding/StepPage";
import { LAST_STORED_SETUP_STEP } from "@/features/onboarding/logic";

export default function Page() {
  const no = Number(useParams<{ step: string }>().step);
  if (!Number.isInteger(no) || no < 1 || no > LAST_STORED_SETUP_STEP) notFound();
  return <StepPage no={no} />;
}
