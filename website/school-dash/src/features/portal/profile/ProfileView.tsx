"use client";
// My profile (contract §2 /me/profile): the own `staff` record (read-only; the office keeps it) and the login details.
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";

const ROLE_LABEL: Record<string, string> = { teacher: "Teaching staff", staff: "Staff", driver: "Bus driver", attendant: "Bus attendant" };

export function ProfileView() {
  const { user, logout } = useAuth();
  const { staffId, record, name, designation, ready } = useStaffProfile();
  const [busy, setBusy] = useState(false);
  const signOut = async () => { setBusy(true); try { await logout(); } finally { setBusy(false); } };

  if (!ready) return <p className="text-on-surface-variant">Loading…</p>;
  const rows: [string, string | undefined][] = [
    ["Employee ID", record?.empId], ["Designation", designation], ["Department", record?.department], ["Phone", record?.phone], ["Email", record?.email],
    ["Subjects", record?.subjectNames?.length ? record.subjectNames.join(", ") : record?.subjects], ["Status", record?.status],
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div><h1 className="t-headline-lg">My profile</h1><p className="text-sm text-on-surface-variant">Your staff record as the office keeps it. Ask the office to change anything here.</p></div>
      <Card className="p-6">
        {!record ? <EmptyState title="No staff record" hint={staffId ? "Your staff record could not be found. Contact your school administrator." : "Your login is not linked to a staff record."} /> : (
          <>
            <div className="flex items-center gap-4">
              {record.photoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={record.photoUrl} alt={name} className="size-16 rounded-full object-cover" />
                : <Avatar name={name} size={64} />}
              <div className="min-w-0">
                <p className="t-headline-md truncate">{name}</p>
                <p className="text-sm text-on-surface-variant">{designation || "Staff"}{record.department ? ` · ${record.department}` : ""}</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {rows.filter(([, v]) => !!v).map(([k, v]) => <div key={k}><dt className="text-xs font-semibold text-on-surface-variant">{k}</dt><dd className="text-sm">{v}</dd></div>)}
            </dl>
          </>
        )}
      </Card>
      <Card className="p-6">
        <CardHeader className="p-0 pb-3" title="Login" subtitle="The same account signs in to the mobile app." />
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div><dt className="text-xs font-semibold text-on-surface-variant">Login email</dt><dd className="text-sm">{user?.email || "—"}</dd></div>
          <div><dt className="text-xs font-semibold text-on-surface-variant">Access</dt><dd className="text-sm"><Badge tone="info">{ROLE_LABEL[user?.role ?? ""] ?? user?.role ?? "—"}</Badge>{user?.staffRole && user.staffRole !== user.role ? <span className="ml-2 text-on-surface-variant">{user.staffRole}</span> : null}</dd></div>
          {staffId && <div><dt className="text-xs font-semibold text-on-surface-variant">Staff ID</dt><dd className="font-mono text-sm">{staffId}</dd></div>}
        </dl>
        <div className="mt-5 flex justify-end"><Button variant="outline" onClick={signOut} disabled={busy}><LogOut size={16} />Sign out</Button></div>
      </Card>
    </div>
  );
}
