# School Admin Web — build guide (read fully before coding)

Next.js 16 App Router + TypeScript + Tailwind v4 in `web`. A dev server is ALREADY running on
http://localhost:3000 (hot reload) — do not start another. Typecheck with `cd web && npx tsc --noEmit`.

## Design source
- Screenshots: `design/png/<frameId>_<name>.png` (1440px wide desktop frames). Look at yours with the Read tool.
  The renders use fallback fonts and clip some text; treat them as layout/content truth, not pixel truth.
- Specs: `design/spec/<frameId>_<name>.json` → `data.spec` tree: `{id,name,type,w,h,radius,fill{hex,token},children[],text{...}}`.
  Huge — never `cat` them. Use a small python script to print only TEXT nodes (labels, sample data) and key sizes.
- Tokens: `design/tokens.json`. Already in `src/app/globals.css` as Tailwind theme (see below).
- The sidebar + top bar are in the shared shell (`src/components/shell`) — frames' sidebar/topbar are NOT per-page work.
  Build only the main content area of each frame (starts below the 70px top bar, right of the 288px sidebar).

## Design system (use it everywhere; no hard-coded hex values, no one-off styling for things the kit covers)
- Colors via Tailwind tokens: `bg-surface`, `bg-surface-container-low`, `bg-surface-container-lowest`(white cards), `text-on-surface`,
  `text-on-surface-variant`, `text-outline`, `border-outline-variant`, `bg-secondary`/`text-secondary` (brand blue),
  `bg-info-container`, `bg-error-container`, `text-error`, `bg-success-container text-success`, `bg-warning-container text-warning`,
  `bg-primary-container` (navy). Radii: `rounded` 8, `rounded-lg` 16 (cards), `rounded-xl` 24 (modals), `rounded-full`.
- Type utilities: `t-display`, `t-headline-lg`, `t-headline-md`, `t-body-lg`, `t-body-md`, `t-label-caps`, `t-caption`; mono numerals: `font-mono`.
- Components in `@/components/ui` (barrel): Button(variant primary|secondary|outline|ghost|danger, size sm|md|lg), Badge(tone), Card/CardHeader,
  Field/Input/Select/Textarea/Checkbox/Switch, Tabs(pill|underline), Modal, SlideOver, ProgressBar, Avatar, Stat, PageHeader, EmptyState,
  DataTable (search, sort, pagination, row select), SearchBox, ToastProvider/useToast (already mounted in the (app) layout).
  Icons: `lucide-react`. Helpers: `@/lib/cn`, `@/lib/format` (inr, fmtDate, initials).
- If you need a NEW reusable primitive (e.g. Stepper, DatePicker, Kanban column, Chart), add it as its own file in `src/components/ui/`
  (+ export line in `index.ts` — append only) so other modules can reuse it. Do not restyle existing primitives; if one lacks a
  prop you need, add an optional prop without changing existing behaviour. Charts: hand-rolled SVG/CSS, no chart dependency.
- Accessibility: real buttons/links, labels on inputs, aria on tabs/dialogs (kit does this), visible focus.

## Data / "fully functional"
- Generic JSON-file API: `GET/POST /api/<collection>`, `GET/PATCH/DELETE /api/<collection>/<id>`.
  Client: `const { rows, ready, create, update, remove } = useCollection<T>("name")` from `@/lib/useCollection` (shared cache, optimistic).
- Add collections by exporting rows from YOUR seed file only (`src/server/seed/<module>.ts`, typed `Seed`). Every row needs a string `id`.
  Prefix collection names with your module (e.g. `adm_applications`) to avoid clashes. Seed data should be realistic and consistent with the
  numbers shown in the design (e.g. dashboard says 420 enquiries → seed enough rows or compute from a stats row). Existing shared
  collections: `school`, `me`, `students`, `staff`, `notifications`(owned by dashboard module).
- Seed changes: the persisted DB (`web/.data/db.json`) only merges in NEW collection names. After editing existing seed rows,
  delete `web/.data/db.json` (all data resets to seed) and reload the page.
- Every button/form/filter/tab/toggle in your frames must work: create/edit/delete flows through Modal/SlideOver with validation,
  status transitions, derived counts/totals computed from the data (not hard-coded), search/filter/sort, toasts on success.
  Things that need real external services (WhatsApp send, payment gateway, SMS, file upload, PDF export) are simulated: write a record
  (e.g. a message log / receipt) and toast; CSV export may be real (Blob download).
- Keep pages as Server Component shells where trivial, client components where interactive. Put module UI in
  `src/features/<module>/…`, route files stay thin in `src/app/(app)/<route>/page.tsx`.

## Ownership (don't edit files outside your module except append-only barrel exports)
- Foundation (done, owned by lead): globals.css, components/ui/*, components/shell/*, lib/*, server/db.ts, api routes, seed/core.ts, seed/index.ts.
  If you find a bug there, make the minimal fix and mention it in your final report.
- Route → frame map and owners are in your task brief.

## Definition of done (per screen)
1. Visually matches the PNG layout/hierarchy/content (compare side by side; use the browser tools to screenshot localhost:3000/<route> if available).
2. All interactions work against the API; reload keeps changes.
3. `npx tsc --noEmit` clean and `npx next lint` has no errors in your files; no console errors on the page.
4. Responsive enough: no horizontal page scroll at 1280px; sidebar collapses below lg (shell already does).
Final report: routes built, collections added, anything simulated, anything not matching the design and why. Be brief.
