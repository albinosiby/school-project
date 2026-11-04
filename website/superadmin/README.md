# Edvio superadmin

Independent Next.js app for platform owners. Routes live in `src/app/owner`, console code and tests in
`src/features/owner`, and owner-only authentication in `src/lib/authContext.tsx`.

Install once with `npm ci` in `website`. Copy `.env.example` to `.env.local`, fill Firebase settings, and set the
frontend URLs before building. From this folder:

- `npm run dev`: development on port 3002.
- `npm run build` and `npm start`: production build and server.
- `npm test`, `npm run typecheck`, `npm run lint`: app-specific checks.

Only provisioned `platform_admins/{uid}` members may sign in. Opening a school's console goes to the separately
authenticated school-admin app. Deploy with target `owner`.
See [the workspace guide](../README.md) for environment and deployment details.
