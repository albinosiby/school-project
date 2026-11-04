/** Each frontend is an independent app. Override these URLs when using custom domains or ports. */
type LocationLike = Pick<Location, "protocol" | "hostname" | "port">;

const trim = (url: string) => url.replace(/\/+$/, "");
const isLocal = (hostname: string) => hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1";

export function siteUrls(loc?: LocationLike) {
  // Keep defaults identical during server rendering and hydration, including local production previews.
  const local = loc ? isLocal(loc.hostname) : process.env.NODE_ENV !== "production";
  return {
    admin: trim(process.env.NEXT_PUBLIC_ADMIN_URL || (local ? "http://localhost:3000" : "https://school-admin-tatos-2610.web.app")),
    owner: trim(process.env.NEXT_PUBLIC_OWNER_URL || (local ? "http://localhost:3002" : "https://edvio-owner.web.app")),
    landing: trim(process.env.NEXT_PUBLIC_LANDING_URL || (local ? "http://localhost:3001" : "https://edvio-landing.web.app")),
  };
}

/** A school id is navigation intent only. The admin app independently authenticates and authorizes the owner. */
export function schoolConsoleUrl(schoolId: string, loc?: LocationLike) {
  const url = new URL("/dashboard", siteUrls(loc).admin);
  url.searchParams.set("school", schoolId);
  return url.toString();
}

export function selectedSchool(search: string): string {
  const school = new URLSearchParams(search).get("school") ?? "";
  return /^[A-Za-z0-9_-]{1,128}$/.test(school) ? school : "";
}
