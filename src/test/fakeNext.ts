// Fake `next/navigation`: a stable router spy and a settable URL (path + search params).
import { vi } from "vitest";

let path = "/";
let search = new URLSearchParams();
let params: Record<string, string> = {};

export const router = { push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() };

/** e.g. setUrl("/staff?tab=leaves") */
export function setUrl(url: string, routeParams: Record<string, string> = {}) {
  const [p, q = ""] = url.split("?");
  path = p || "/"; search = new URLSearchParams(q); params = routeParams;
}
export function resetNav() {
  setUrl("/");
  Object.values(router).forEach((f) => f.mockReset());
  // replace/push update the fake URL so tab switches re-render with the new query
  router.replace.mockImplementation((u: string) => setUrl(u, params));
  router.push.mockImplementation((u: string) => setUrl(u, params));
}

export const navigationModule = {
  useRouter: () => router,
  usePathname: () => path,
  useSearchParams: () => search,
  useParams: () => params,
  redirect: vi.fn(),
  notFound: vi.fn(),
  useSelectedLayoutSegment: () => null,
  useSelectedLayoutSegments: () => [],
};
