"use client";
import { Button } from "@/components/ui";

export type StepProps = {
  initial?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  busy: boolean;
  /** `persist` runs the step's own writes inside the page's busy/error handling */
  onSubmit: (values: Record<string, unknown>, persist?: () => Promise<unknown>) => void | Promise<void>;
  back?: () => void;
};

export function StepFooter({ busy, back, last, disabled }: { busy: boolean; back?: () => void; last?: boolean; disabled?: boolean }) {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-outline-variant/60 pt-5">
      {back ? <Button type="button" variant="outline" onClick={back}>Back</Button> : <span />}
      <Button type="submit" disabled={busy || disabled}>{busy ? "Saving…" : last ? "Finish setup" : "Save & continue"}</Button>
    </div>
  );
}
export const Grid = ({ children }: { children: React.ReactNode }) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
