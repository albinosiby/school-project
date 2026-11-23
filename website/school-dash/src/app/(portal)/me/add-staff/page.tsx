"use client";
import { Card, CardHeader } from "@/components/ui";
import { AddStaffFields } from "@/features/people/AddStaffFields";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";

export default function Page() {
  const { canAddStaff } = useStaffProfile();
  return <div className="mx-auto max-w-xl">
    <Card className="p-6">
      <CardHeader className="p-0 pb-4" title="Add staff" subtitle="Create a login for a colleague your designation may add." />
      {canAddStaff ? <AddStaffFields /> : <p className="text-on-surface-variant">Your designation cannot add staff. Contact your school administrator.</p>}
    </Card>
  </div>;
}
