# Shared web infrastructure

Private source package compiled into each frontend. Owns UI primitives, branding, Firebase initialization,
site URL helpers, friendly auth errors, and canonical school bootstrap/seed configuration.
Keep this package free of application imports; authentication, routes, and feature code belong to individual apps.

`testing/` contains Firebase/navigation fakes used by each app's Vitest config. Run `npm run typecheck` here to check
shared runtime source. The consuming apps typecheck and exercise the test helpers using their own aliases.
