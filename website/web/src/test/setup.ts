// Global test setup: every Firebase / Next module the admin web touches is replaced by an in-memory fake, so tests never
// reach a Firebase project or emulator. Reset between tests.
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("firebase/firestore", () => import("./fakeFirestore"));
vi.mock("firebase/auth", async () => (await import("./fakeAuth")).authModule);
vi.mock("firebase/app", async () => (await import("./fakeAuth")).appModule);
vi.mock("firebase/storage", async () => (await import("./fakeAuth")).storageModule);
vi.mock("@/lib/firebase", async () => (await import("./fakeAuth")).libFirebaseModule);
vi.mock("@/lib/authContext", async () => (await import("./fakeAuth")).authContextModule);
vi.mock("@/lib/useCollection", () => import("./fakeCollection"));
vi.mock("next/navigation", async () => (await import("./fakeNext")).navigationModule);
vi.mock("next/link", async () => {
  const React = await import("react");
  const Link = ({ href, children, ...p }: { href: string | { pathname?: string }; children?: React.ReactNode } & Record<string, unknown>) =>
    React.createElement("a", { href: typeof href === "string" ? href : href.pathname, ...p }, children);
  return { default: Link };
});
vi.mock("next/image", async () => {
  const React = await import("react");
  return { default: ({ src, alt, ...p }: { src: string | { src: string }; alt: string } & Record<string, unknown>) => {
    const rest = { ...p }; delete rest.priority; delete rest.fill;
    return React.createElement("img", { src: typeof src === "string" ? src : src.src, alt, ...rest });
  } };
});

// jsdom gaps
if (!("createObjectURL" in URL)) Object.assign(URL, { createObjectURL: () => "blob:test", revokeObjectURL: () => {} });
else { URL.createObjectURL = () => "blob:test"; URL.revokeObjectURL = () => {}; }
if (!window.matchMedia) window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false })) as typeof window.matchMedia;
if (!("ResizeObserver" in window)) (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!("IntersectionObserver" in window)) (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = class { root = null; rootMargin = ""; thresholds = []; observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }; // motion/react whileInView
Element.prototype.scrollIntoView ??= function () {};
HTMLAnchorElement.prototype.click = function () {}; // CSV downloads: no jsdom navigation
window.print = () => {};

beforeEach(async () => {
  const [{ resetDb }, { resetAuth, resetAuthState }, { resetNav }, { __setScope }] = await Promise.all([
    import("./fakeDb"), import("./fakeAuth"), import("./fakeNext"), import("./fakeCollection"),
  ]);
  resetDb(); resetAuth(); resetAuthState(); resetNav(); __setScope("sch_test");
});
afterEach(() => { cleanup(); });
