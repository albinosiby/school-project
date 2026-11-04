"use client";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { isOwnerHost, pathSite, siteUrls } from "@/lib/sites";

const noop = () => () => {};

/**
 * Keeps the two hosting sites apart (lib/sites.ts): the owner console only on the owner site, the landing page and
 * sign-up only on the admin site, and school admins away from the owner site. Navigation only: the Firestore rules are
 * what protect the data. The page renders as usual; the guard sits beside it in its own Suspense boundary (it reads the
 * URL, which is only known at runtime) and covers the page when it has to.
 */
export function SiteGate({ children }: { children: React.ReactNode }) {
  return <>{children}<Suspense fallback={null}><SiteGuard /></Suspense></>;
}

function SiteGuard() {
  const path = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  // null while rendering on the server: the host is known only in the browser
  const ownerHost = useSyncExternalStore(noop, () => isOwnerHost(window.location.hostname), () => null);
  const where = pathSite(path);
  const away = ownerHost === false && where === "owner";

  useEffect(() => {
    if (ownerHost === null) return;
    if (ownerHost && where === "admin") router.replace("/login");
    else if (away) window.location.replace(`${siteUrls(window.location).owner}${path}`);
  }, [ownerHost, where, away, path, router]);

  const cover = "fixed inset-0 z-[100] grid place-items-center bg-surface p-6";
  if (away || (ownerHost && where === "admin")) return <div className={cover} aria-busy="true" />;
  // a school admin signed in on the owner site: send them to their own site
  if (ownerHost && !isLoading && user?.role === "admin" && path !== "/login") {
    return (
      <div className={cover} role="alertdialog" aria-label="Wrong site">
        <div className="max-w-md rounded-xl bg-surface-container-lowest p-6 text-center shadow-card">
          <ShieldAlert className="mx-auto mb-3 text-warning" size={32} />
          <h1 className="t-headline-md">This site is for Edvio platform owners</h1>
          <p className="mt-2 text-on-surface-variant">School admins sign in on the school console.</p>
          <div className="mt-5 flex justify-center gap-2">
            <a href={`${siteUrls(window.location).admin}/login`} className="rounded bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary">Go to the school console</a>
            <button onClick={() => void logout()} className="cursor-pointer rounded border border-outline-variant px-4 py-2 text-sm">Sign out</button>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
