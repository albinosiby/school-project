import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** Responsive list controls. Width overrides stay local to filters, leaving form fields full width. */
export function ListToolbar({ search, filters, actions, children, className }: {
  search?: ReactNode; filters?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string;
}) {
  return <div className={cn("flex min-w-0 flex-wrap items-end gap-3", className)}>
    {search && <div className="w-full min-w-0 sm:w-64 sm:min-w-64 sm:max-w-sm sm:flex-1 [&>div]:w-full [&>div]:min-w-0 [&>div]:max-w-none">{search}</div>}
    {filters && <div className="grid w-full min-w-0 grid-cols-2 items-end gap-3 sm:flex sm:w-auto sm:flex-wrap [&>:only-child]:col-span-2 [&>select]:min-w-0 sm:[&>select]:w-44 [&>input]:min-w-0 sm:[&>input]:w-44 [&>label]:min-w-0 sm:[&>label]:w-44 [&>label>input]:w-full [&>label>select]:w-full [&>button]:h-10">{filters}</div>}
    {children && <div className="min-w-0 max-w-full">{children}</div>}
    {actions && <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto [&>button]:h-10 [&>button]:flex-1 sm:[&>button]:flex-none">{actions}</div>}
  </div>;
}
