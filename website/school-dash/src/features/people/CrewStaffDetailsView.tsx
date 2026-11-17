"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoadingSkeleton, Badge, Card, EmptyState } from "@/components/ui";
import { ROLE_LABEL } from "@/features/transport/shared";
import type { Crew } from "@/features/transport/types";
import { useAuth } from "@/lib/authContext";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { StaffActivityCards } from "./StaffActivityCards";
import { StaffDetailsView } from "./StaffDetailsView";
import { StaffPortrait } from "./StaffPortrait";
import type { Staff } from "./StaffView";
import { localDate } from "./checkins";
import { staffForCrew } from "./crewStaffProfile";

export function CrewStaffDetailsView({ crewId }: { crewId: string }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <LoadingSkeleton variant="details" label="Loading staff details…" />;
  if (user?.role !== "admin") return <Card><EmptyState title="Staff record unavailable"
    hint="The record may have been removed or may not be available to your account." /></Card>;
  return <CrewStaffDetails key={JSON.stringify([user.id, user.schoolId, crewId])} crewId={crewId} />;
}

function CrewStaffDetails({ crewId }: { crewId: string }) {
  const crewRecords = useCollection<Crew>("tr_crew");
  const staff = useCollection<Staff>("staff");
  if (!crewRecords.ready || !staff.ready) return <LoadingSkeleton variant="details" label="Loading staff details…" />;
  const crew = crewRecords.rows.find((member) => member.id === crewId);
  if (!crew) return <Card><EmptyState title="Staff record unavailable"
    hint="The record may have been removed or may not be available to your account." /></Card>;
  const member = staffForCrew(crew, staff.rows);
  if (member) return <StaffDetailsView key={member.id} staffId={member.id} />;
  return <TransportStaffDetails crew={crew} />;
}

function SavedDetails({ title, fields }: { title: string; fields: [string, string | undefined][] }) {
  return <Card className="min-w-0 p-5"><h2 className="t-label-caps mb-3 text-on-surface-variant">{title}</h2>
    <dl className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-5 gap-y-2 text-sm">
      {fields.map(([label, value]) => <div key={label} className="contents"><dt className="text-outline">{label}</dt>
        <dd className="whitespace-pre-line break-words">{value?.trim() || "—"}</dd></div>)}
    </dl>
  </Card>;
}

/** Older Transport-only records have no private HR profile. Show their saved data without creating one. */
function TransportStaffDetails({ crew }: { crew: Crew }) {
  const label = ROLE_LABEL[crew.role];
  return <div className="space-y-4">
    <Link href={`/transport?tab=${crew.role === "driver" ? "drivers" : "staff"}`} className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline">
      <ArrowLeft size={16} />Back to {crew.role === "driver" ? "drivers" : "bus staff"}
    </Link>
    <Card className="flex flex-wrap items-center gap-4 p-5"><StaffPortrait name={crew.name} photo={crew.photoUrl} />
      <div className="min-w-0"><h1 className="t-headline-lg break-words">{crew.name}</h1>
        <p className="mt-1 text-sm text-on-surface-variant">{crew.empId} · {label}</p></div>
      <Badge tone={crew.status === "Active" ? "success" : crew.status === "On leave" ? "warning" : "neutral"}>{crew.status}</Badge>
    </Card>
    <p className="text-sm text-on-surface-variant">Showing the details saved in Transport. A Staff &amp; HR profile has not been linked.</p>
    <div className="grid items-start gap-4 xl:grid-cols-2">
      <div className="grid min-w-0 gap-4">
        <SavedDetails title="Contact details" fields={[["Full name", crew.name], ["Mobile number", crew.phone], ["Email", crew.email], ["Address", crew.address]]} />
        <SavedDetails title="Emergency contact" fields={[["Contact name", crew.emergencyName], ["Mobile number", crew.emergencyPhone]]} />
        <StaffActivityCards member={{ id: crew.id, role: label }} designation={label} today={localDate(new Date())}
          crewId={crew.id} busId={crew.busId} crewReady />
      </div>
      <div className="grid min-w-0 gap-4">
        <SavedDetails title="Employment" fields={[["Employee ID", crew.empId], ["Designation", label], ["Department", "Transport"],
          ["Joining date", crew.joined ? fmtDate(crew.joined) : undefined], ["Status", crew.status],
          ["On leave from", crew.leaveFrom ? fmtDate(crew.leaveFrom) : undefined], ["On leave until", crew.leaveTo ? fmtDate(crew.leaveTo) : undefined], ["Leave reason", crew.leaveReason]]} />
        {crew.role === "driver" && <SavedDetails title="Driver details" fields={[["Driving licence number", crew.licenseNo],
          ["Licence expiry date", crew.licenseExpiry ? fmtDate(crew.licenseExpiry) : undefined]]} />}
        <SavedDetails title="App login" fields={[["Login email", crew.email], ["Account status", crew.authUid ? "Login active" : "No login yet"]]} />
      </div>
    </div>
  </div>;
}
