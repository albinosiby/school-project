# Edvio school dashboard

Independent Next.js app for school administrators. All school routes and features are in this folder's `src/`;
static assets are in `public/`. Firebase configuration belongs in this app's `.env.local`.

Install dependencies once with `npm ci` in `website/`. From this folder:

- `npm run dev`: school dashboard on port 3000.
- `npm run build` and `npm start`: production build and server.
- `npm test`, `npm run typecheck`, `npm run lint`: app-specific checks.

Deploy with Firebase Hosting target `admin`. Shared source is in `../shared`, and the other frontends are siblings at
`../landing` and `../superadmin`. See [the workspace guide](../README.md) for setup and deployment commands.
