# Edvio website workspace

Each frontend is an independent Next.js app directly inside `website/`:

```text
website/
  school-dash/   # School administration app (port 3000)
    src/
    public/
    package.json
  landing/       # Public marketing app (port 3001)
    src/
    public/
    package.json
  superadmin/    # Platform owner app (port 3002)
    src/
    public/
    package.json
  shared/        # Reusable UI, Firebase setup, school bootstrap, test helpers
  functions/     # Existing Firebase backend
  package.json   # Workspace commands
  package-lock.json
  firebase.json
```

## Setup

From `website/`, run `npm ci`. This installs and links every workspace using the single root lockfile.
Each app owns its `.env.local`: copy its `.env.example` and fill in Firebase settings for the same backend.
Keep `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_LANDING_URL`, and `NEXT_PUBLIC_OWNER_URL` consistent across all three apps.
Use localhost ports for development and the deployed HTTPS URLs before production builds; these are public build-time settings.

## Run each app

From `website/`, use a separate terminal for each app:

```sh
npm run dev:school-dash
npm run dev:landing
npm run dev:superadmin
```

`npm run dev` also starts the school dashboard. After the workspace install, each app runs independently from its own folder:

```sh
cd superadmin  # or landing, or school-dash
npm run dev
npm run build
```

School dashboard and superadmin support `npm start` after building. Landing exports static files to `landing/out`.
Landing serves `/` and compatibility `/landing`; superadmin serves `/owner/**` and its own `/login` without self-registration.
School dashboard's public `/` opens the landing site. `/login` and `/signup` open their respective forms directly;
authenticated school users enter the console at `/dashboard`. Legacy `/landing` and `/owner/**` links redirect to the independent apps.

## Checks and builds

From `website/`:

```sh
npm run test:all
npm run typecheck:all
npm run lint:all
npm run build:school-dash
npm run build:landing
npm run build:superadmin
```

`npm run build` builds all apps. Per-app `npm test`, `npm run typecheck`, and `npm run lint` are also available.
All apps use Tailwind PostCSS. If a restricted environment blocks Turbopack's worker, use `npm run build -- --webpack`
from an app folder. The existing Google Fonts need network access at build time.

## Shared code and owner school access

`shared/` is a private source package compiled into each frontend. It owns reusable UI, branding, Firebase setup,
friendly auth errors, canonical school bootstrap/seed configuration, and isolated test helpers. App authentication,
features, routes, and styles stay with the individual apps.

“Open school console” links from superadmin to school dashboard with `?school=<schoolId>`. The dashboard independently
verifies the owner's identity before applying that selection. Ordinary school admins cannot select another school.
Sessions are scoped to browser origins; owners may need to sign in once on each app. No credentials travel in the URL.

## Deploy independently

Existing Firebase site identities are unchanged. `firebase.json` maps:

- `admin` → source `school-dash`
- `owner` → source `superadmin`
- `landing` → static output `landing/out`

With production environment settings, run from `website/`:

```sh
npm run build:landing
firebase deploy --only hosting:landing --project school-admin-tatos-2610
firebase deploy --only hosting:owner --project school-admin-tatos-2610
firebase deploy --only hosting:admin --project school-admin-tatos-2610
```

The landing Hosting site `edvio-landing` must exist before its first deployment; create it once if absent or map the
`landing` target to another available site ID and update the frontend URL settings. Admin and owner retain the existing
framework-aware Hosting integration. Moving folders does not deploy anything or alter backend rules or Cloud Functions.
Backend setup and emulator instructions remain in `docs/`.
