# Deployment and repo structure

## Web app (Vercel)

- **Deployment root**: repository root. Vercel builds from the root; the Next.js app lives at the root (`app/`, `components/`, `lib/`, etc.).
- **Build**: `npm run build` runs `tsc && next build`. The same command is used in CI and by Vercel when not overridden by `vercel.json` (Vercel may use `vercel.json` `buildCommand` if set).

## Figma plugin

- **Package boundary**: `packages/figma-plugin/`. The plugin is built and developed there; it does not affect the web app or Vercel.
- **Build from root**: `npm run build:plugin` (or `npm run watch:plugin` for watch mode). These delegate to the `heimdall-figma-plugin` workspace.

## TypeScript and imports

- **Root typecheck**: The root `tsconfig.json` uses `moduleResolution: "NodeNext"` and includes `src/**/*.ts` and `lib/**/*.ts`. Relative ESM imports in those trees must use explicit `.js` extensions (e.g. `from './supabase.js'`).
- **Path aliases**: `@/` resolves to the repo root; when used for files under `lib/` or `src/`, use the `.js` extension in the import path where NodeNext resolution applies (e.g. `from '@/lib/evidenceClient.js'`).
