"use client";
import { useRouter } from "next/navigation";

import { Tabs } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import type { Notice, Report } from "./types";

export function CommHeader({ active }: { active: "notices" | "reports" | "messages" }) {
  const router = useRouter();
  const nc = useCollection<Notice>("com_notices");
  const notices = nc.rows;
  const reports = useCollection<Report>("com_reports").rows;
  const threads = useCollection<{ id: string }>("msg_threads").rows;
  const href: Record<string, string> = { notices: "/communication", reports: "/communication/reports", messages: "/communication/messages" };
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-headline-lg">Communication &amp; Reports Hub</h1>
      </div>
      <p className="mt-1 max-w-3xl text-on-surface-variant">
        Broadcast administrative circulars, track parent &amp; staff notice engagement, manage conversations, and generate statutory compliance reports.
      </p>
      <div className="mt-4 flex items-center justify-between border-b border-outline-variant">
        <Tabs variant="underline" value={active} onChange={(id) => router.push(href[id] ?? "/communication")}
          items={[
            { id: "notices", label: "Notices", count: notices.length },
            { id: "reports", label: "Standard Reports", count: reports.length },
            { id: "messages", label: "Parent messages", count: threads.length },
          ]} className="!border-b-0" />
        {/* real state of the Firestore listener, not a fake timestamp */}
        <span className="hidden items-center gap-1.5 pb-2 text-on-surface-variant sm:flex"><span className={`size-2 rounded-full ${nc.ready ? "bg-success" : "bg-outline"}`} />{nc.ready ? "Live sync" : "Connecting…"}</span>
      </div>
    </div>
  );
}
