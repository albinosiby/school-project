"use client";
import { useRouter } from "next/navigation";

import { Tabs } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import type { Notice } from "./types";

export function CommHeader({ active }: { active: "notices" | "messages" }) {
  const router = useRouter();
  const nc = useCollection<Notice>("com_notices");
  const notices = nc.rows;
  const threads = useCollection<{ id: string }>("msg_threads").rows;
  const href: Record<string, string> = { notices: "/communication", messages: "/communication/messages" };
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="t-headline-lg">Communication</h1>
      </div>
      <p className="mt-1 max-w-3xl text-on-surface-variant">
        Send circulars to parents and staff, see who read them, and answer parent messages.
      </p>
      <div className="mt-4 flex items-center justify-between border-b border-outline-variant">
        <Tabs variant="underline" value={active} onChange={(id) => router.push(href[id] ?? "/communication")}
          items={[
            { id: "notices", label: "Circulars & Notices", count: notices.length },
            { id: "messages", label: "Parent messages", count: threads.length },
          ]} className="!border-b-0" />
        {/* real state of the Firestore listener, not a fake timestamp */}
        <span className="hidden items-center gap-1.5 pb-2 text-on-surface-variant sm:flex"><span className={`size-2 rounded-full ${nc.ready ? "bg-success" : "bg-outline"}`} />{nc.ready ? "Live sync" : "Connecting…"}</span>
      </div>
    </div>
  );
}
