import { useSyncExternalStore } from "react";
// One Next.js app, two Firebase Hosting sites (DATA_CONTRACT section 16):
//   admin site  school-admin-tatos-2610.web.app   school consoles, landing page, sign-up
//   owner site  OWNER_SITE.web.app                 the owner console (product owners only)
// The host name decides which one a page is. Locally, http://owner.localhost:<port> is the owner site and
// http://localhost:<port> the admin site (browsers resolve *.localhost to this machine).
// NEXT_PUBLIC_OWNER_HOSTS / NEXT_PUBLIC_OWNER_URL / NEXT_PUBLIC_ADMIN_URL override the defaults (e.g. custom domains).

export const OWNER_SITE = "edvio-owner";
export const ADMIN_SITE = "school-admin-tatos-2610";

const list = (s: string | undefined) => (s ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
const OWNER_HOSTS = [`${OWNER_SITE}.web.app`, `${OWNER_SITE}.firebaseapp.com`, "owner.localhost", ...list(process.env.NEXT_PUBLIC_OWNER_HOSTS)];

/** Is this host name (no port) the owner site? */
export const isOwnerHost = (hostname: string) => OWNER_HOSTS.includes(hostname.toLowerCase());

const local = (hostname: string) => hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1";

/** Base URLs of both sites as seen from `loc` (keeps the port locally). */
export function siteUrls(loc: Pick<Location, "protocol" | "hostname" | "port">) {
  if (local(loc.hostname)) {
    const port = loc.port ? `:${loc.port}` : "";
    return { owner: `${loc.protocol}//owner.localhost${port}`, admin: `${loc.protocol}//localhost${port}` };
  }
  return {
    owner: process.env.NEXT_PUBLIC_OWNER_URL || `https://${OWNER_SITE}.web.app`,
    admin: process.env.NEXT_PUBLIC_ADMIN_URL || `https://${ADMIN_SITE}.web.app`,
  };
}

/** Where this path belongs: "owner" (only on the owner site), "admin" (only on the admin site) or "both". */
export function pathSite(path: string): "owner" | "admin" | "both" {
  if (path === "/owner" || path.startsWith("/owner/")) return "owner";
  // public pages and self sign-up are the admin site's; the owner site has no marketing page
  if (path === "/landing" || path.startsWith("/landing/") || path === "/signup" || path.startsWith("/signup/")) return "admin";
  // the login page, and the school console (an owner works inside a school on the owner site)
  return "both";
}

/** React: true on the owner site (false while rendering on the server and before hydration). */
export function useOwnerSite() {
  return useSyncExternalStore(() => () => {}, () => isOwnerHost(window.location.hostname), () => false);
}
