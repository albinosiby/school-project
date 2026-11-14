"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button, Card } from "@/components/ui";
import { retryCollection, useCollectionFailures, useCollectionPending } from "@/lib/useCollection";

/** Keep readers mounted for retries while preventing failed reads from looking like empty records. */
export function CollectionGuard({ children }: { children: React.ReactNode }) {
  const failures = useCollectionFailures();
  const pending = useCollectionPending();
  return <>
    {failures.length > 0 && <Card role="alert" className="mb-5 border-error/30 p-5">
      <h2 className="flex items-center gap-2 font-semibold text-error"><AlertTriangle size={18} />Some school data could not be loaded</h2>
      <p className="mt-2 text-sm text-on-surface-variant">{failures[0].message}</p>
      <Button variant="outline" className="mt-4" onClick={() => {
        failures.forEach((failure) => retryCollection(failure.collection));
      }}><RefreshCw size={16} />Retry loading</Button>
    </Card>}
    {!failures.length && pending.length > 0 && <Card className="mb-5 p-5"><p role="status">Loading school data…</p></Card>}
    <div hidden={failures.length > 0 || pending.length > 0}>{children}</div>
  </>;
}
