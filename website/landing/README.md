# Edvio landing

Independent public Next.js app. Page sections, lead submission, and tests live in `src/features/landing`;
routes and marketing styles live in `src/app`. There is no school authentication provider.

Install once with `npm ci` in `website`. Copy `.env.example` to `.env.local`, fill Firebase settings, and set the
frontend URLs before building. From this folder:

- `npm run dev`: development on port 3001.
- `npm run build`: static production export in `out/`.
- `npm test`, `npm run typecheck`, `npm run lint`: app-specific checks.

Deploy with Firebase Hosting target `landing`. Shared source lives in `../shared`.
See [the workspace guide](../README.md) for setup, cross-app links, and deployment instructions.
