import { redirect } from "next/navigation";
import { Suspense } from "react";
import { siteUrls } from "@edvio/shared/sites";

/** Bookmarks on the former combined app now open the independently deployed superadmin app. */
type Props = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function OwnerRedirect({ params, searchParams }: Props) {
  const [{ path = [] }, search] = await Promise.all([params, searchParams]);
  const url = new URL(`/owner${path.length ? "/" + path.map(encodeURIComponent).join("/") : ""}`, siteUrls().owner);
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach((item) => url.searchParams.append(key, item));
    else if (value !== undefined) url.searchParams.set(key, value);
  }
  redirect(url.toString());
  return null;
}

export default function Page(props: Props) {
  return <Suspense fallback={null}><OwnerRedirect {...props} /></Suspense>;
}
