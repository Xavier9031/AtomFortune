# AtomFortune Desktop App — Design Spec

**Date:** 2026-03-24
**Status:** Approved
**Scope:** Package the existing AtomFortune web app as a native macOS desktop app using Electron, with auto-update support and a CI/CD release pipeline.

---

## Goals

- Let non-technical users (e.g. family members) install and run AtomFortune by double-clicking a `.dmg`, with no Docker, no Terminal, no setup.
- Keep a single TypeScript codebase shared between the web (Docker) and desktop (Electron) modes.
- Automate versioning and distribution via GitHub Releases and `release-please`.

## Non-Goals

- Mobile (iOS/Android) support — deferred.
- Windows/Linux builds — deferred; Mac-only for now.
- Multi-user or cloud sync — out of scope.
- Apple Developer ID code signing / notarization — deferred (see Signing section).

---

## Architecture

### One process, one port

Electron runs a single Node.js main process that:

1. Reads `DATABASE_PATH` from `app.getPath('userData')/atomfortune.db` (e.g. `~/Library/Application Support/AtomFortune/atomfortune.db`).
2. Imports the Hono `app` instance and calls a `startServer(port)` function (see API changes below).
3. Serves the static Next.js build on the same Hono server at `/*`.
4. Opens a `BrowserWindow` pointing to `http://localhost:8000` (fixed port; see Port section).
5. Checks GitHub Releases for updates in the background (electron-updater).

```
Electron App
└── Main Process (Node.js)
    ├── Hono server on localhost:8000
    │   ├── /api/v1/*  → existing API handlers (unchanged)
    │   └── /*         → serve extraResources/web-static/ (Next.js static export)
    └── BrowserWindow → http://localhost:8000
```

No sidecar, no second process, no CORS issues — everything on one port.

### Fixed port (8000)

`NEXT_PUBLIC_API_BASE_URL` is baked into the Next.js static build at compile time and cannot be dynamic. Since Electron's BrowserWindow and Hono both use the same port, we fix the Electron server port to **8000** (the same default as the Docker API). If port 8000 is already in use when the app launches, it shows a native dialog and exits cleanly rather than binding to a random port that the frontend cannot reach.

### Database

`DATABASE_PATH` must be set on `process.env` **before any API module is imported**, because `api/src/db/client.ts` opens the SQLite connection unconditionally at module evaluation time:

```ts
// db/client.ts (existing, unchanged)
const dbPath = process.env.DATABASE_PATH ?? './atomfortune.db'
const sqlite = new Database(dbPath)
```

If `DATABASE_PATH` is not set first, the database opens against `./atomfortune.db` relative to the working directory — wrong. To guarantee ordering, `main.ts` uses a **dynamic `import()`** for the API after setting the env var:

```ts
// main.ts — correct ordering
process.env.DATABASE_PATH = path.join(app.getPath('userData'), 'atomfortune.db')
process.env.ELECTRON = 'true'

// Dynamic import ensures db/client.ts evaluates AFTER env vars are set
const { startServer } = await import('./api-bundle/index.js')
await startServer(8000, migrationsFolder)
```

No changes are needed to `api/src/db/client.ts`.

### Migrations path inside asar

The `drizzle/` migrations folder is packaged as `extraResources` (outside the asar archive) so it is accessible via a regular filesystem path at runtime. The main process resolves it with:

```ts
const migrationsFolder = path.join(process.resourcesPath, 'drizzle')
```

### Web mode (Docker) — unchanged

Docker Compose continues to work exactly as before. The `web` container runs `next start` (standalone server mode, `output: 'standalone'`); the `api` container runs Hono with `serve()`. The `ELECTRON` environment variable is never set in Docker, so all existing behaviour is preserved.

---

## Code Changes to Existing Files

### `api/src/index.ts` — refactor startup

The current file auto-executes `serve()`, migrations, cron, and FX refresh when `NODE_ENV !== 'test'`. Importing it in Electron would trigger all of this on the hardcoded `config.port`, bypassing the dynamic port and DATABASE_PATH we set.

**Fix:** Export a `startServer(port, migrationsFolder)` function that contains the startup logic, and call it from both `index.ts` (Docker mode) and the Electron main process.

```ts
// api/src/index.ts (new shape)
export { app }                                      // Hono app — unchanged
export async function startServer(port: number, migrationsFolder: string) {
  migrate(db, { migrationsFolder })
  serve({ fetch: app.fetch, port })
  // FX refresh, cron, ticker seed …
}

// Auto-start for Docker / direct node execution:
if (!process.env.ELECTRON) {
  startServer(config.port, path.join(__dirname, '..', 'drizzle'))
}
```

### `web/next.config.ts` — conditional output mode

**Current line (must be changed):** `output: 'standalone'`
**New line:**
```ts
const nextConfig: NextConfig = {
  output: (process.env.NEXT_OUTPUT as any) ?? 'standalone',
  // …
}
```

- Docker build: `next build` (no `NEXT_OUTPUT` set) → `output: 'standalone'`, same as today
- Electron build: `NEXT_OUTPUT=export next build` → generates `web/out/` static files

**Constraint:** `output: 'export'` disables all server-side Next.js features. The app is confirmed to be entirely client-side (all data fetching is done client-side via the Hono API; `next-intl` is used in client mode only). If server components with data fetching are added in the future, the Electron build mode must be tested separately.

### `api/src/index.ts` — add static file serving (Electron only)

When `ELECTRON=true`, Hono serves the static Next.js files from `extraResources/web-static/`. `@hono/node-server/serve-static` accepts an absolute path for `root`:

```ts
import { serveStatic } from '@hono/node-server/serve-static'
if (process.env.ELECTRON) {
  const staticRoot = path.join(process.resourcesPath, 'web-static')
  // serveStatic with an absolute `root` path works correctly inside asar bundles;
  // it does NOT resolve relative to process.cwd().
  app.use('/*', serveStatic({ root: staticRoot }))
}
```

This middleware is registered only in Electron; the Docker API remains unaffected.

---

## Native Module: `better-sqlite3`

`better-sqlite3` contains a native C++ addon compiled against a specific Node.js ABI. Electron ships its own Node.js version, so the addon must be recompiled against Electron's ABI before packaging.

electron-builder handles this automatically when `npmRebuild: true` is set in `electron-builder.yml` (the default). No manual `electron-rebuild` step is needed.

---

## Folder Structure

```
AtomFortune/
├── api/                    ← minimal changes (startServer export, static middleware)
│   └── drizzle/            ← packaged as extraResources
├── web/                    ← add NEXT_OUTPUT support to next.config.ts
├── shared/                 ← unchanged
└── desktop/                ← NEW
    ├── package.json        (electron, electron-builder, electron-updater)
    ├── electron-builder.yml
    ├── src/
    │   └── main.ts         (Electron main process)
    └── tsconfig.json       ("module": "ESNext", "target": "ES2022")
```

**Wiring the API into Electron:** `desktop/package.json` declares the API as a local workspace dependency:
```json
{ "dependencies": { "atomfortune-api": "file:../api" } }
```
After running `npm install` in `desktop/`, the dynamic import in `main.ts` resolves via:
```ts
const { startServer } = await import('atomfortune-api')
```
electron-builder picks up `node_modules/atomfortune-api` automatically through its default `files` glob. The compiled API (including `better-sqlite3` rebuilt for Electron's ABI) is bundled inside the `.app`.

**electron-builder.yml extraResources:**
```yaml
extraResources:
  - from: "../api/drizzle"
    to: "drizzle"
  - from: "../web/out"
    to: "web-static"
```

---

## Build Pipeline

### Electron build steps

```
1. NEXT_OUTPUT=export next build          # web/out/ (static files)
2. tsc -p api/tsconfig.json               # api/dist/
3. ELECTRON=true electron-builder --mac   # bundles → desktop/dist/AtomFortune.dmg
```

electron-builder bundles:
- `desktop/src/main.ts` (compiled)
- `api/dist/` (Hono server, with `better-sqlite3` rebuilt for Electron ABI)
- `web/out/` → `extraResources/web-static/`
- `api/drizzle/` → `extraResources/drizzle/`

### Auto-update

electron-updater checks `https://github.com/{owner}/AtomFortune/releases/latest` on startup. If a newer version exists, it downloads in the background and shows a system notification. The user clicks to restart and install.

---

## Code Signing & Gatekeeper

macOS Gatekeeper blocks unsigned apps by default. For non-technical users, this is a blocker.

**Phase 1 (personal/family use):** Distribute as an ad-hoc signed or unsigned `.dmg`. Recipients must right-click → Open the first time to bypass Gatekeeper. Document this in a short "Getting Started" note.

**Phase 2 (public open-source release):** Obtain an Apple Developer ID ($99/year). Configure `electron-builder` with `CSC_LINK` / `CSC_KEY_PASSWORD` and enable notarization via `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD`. Notarized apps install without any Gatekeeper prompt.

Auto-update (`electron-updater`) also requires a signed build to work on end-user machines. In Phase 1, users update manually by downloading the new `.dmg` from GitHub Releases.

---

## CI/CD Pipeline

### Workflows

| Workflow | Trigger | Actions |
|---|---|---|
| `ci.yml` | Every PR and push to `dev` | Run `vitest` test suite |
| `release.yml` | Tag created by release-please (e.g. `v0.0.2`) | Build `.dmg` on macOS runner, upload to GitHub Releases |

### Required GitHub Actions secrets

| Secret | Purpose |
|---|---|
| `GH_TOKEN` | release-please PR creation + electron-updater GitHub Releases upload |
| `CSC_LINK` | (Phase 2) Base64-encoded Apple Developer ID certificate |
| `CSC_KEY_PASSWORD` | (Phase 2) Certificate password |
| `APPLE_ID` | (Phase 2) Apple ID for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | (Phase 2) App-specific password for notarization |

Phase 1 only requires `GH_TOKEN`.

### Versioning with release-please

- Commit messages follow Conventional Commits (`fix:`, `feat:`, `feat!:`, etc.).
- `release-please-config.json` lives at the repo root, targets `desktop/package.json` as the versioned package (this is the app's canonical version).
- On every merge to `main`, `release-please` opens or updates a Release PR containing a `CHANGELOG.md` update and version bump.
- When the developer merges the Release PR, `release-please` creates a git tag (e.g. `v0.0.2`).
- The `release.yml` workflow triggers on that tag, builds the `.dmg`, and uploads to GitHub Releases.
- Starting version: `v0.0.1`.

### Pre-commit (local)

A `husky` pre-commit hook runs `cd api && vitest --run` locally before each commit, so test failures are caught immediately without waiting for CI.

---

## App Lifecycle

- `app.on('ready')` → set `DATABASE_PATH` → call `startServer(8000, migrationsFolder)` → open BrowserWindow → check for updates
- `app.on('window-all-closed')` → `app.quit()` (terminates the process; cron scheduler and Hono server stop automatically)
- If port 8000 is already in use: show native dialog "Port 8000 is in use. Please close other applications and try again." then `app.quit()`.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Port 8000 already in use | Native dialog + quit |
| Hono server fails to start | Native dialog: "AtomFortune failed to start. Please report this issue." + quit |
| Migration fails | Error logged + native dialog + quit (data integrity must be assured) |
| Update check fails (no network) | Silent — skip update, app opens normally |
| Static files missing from extraResources | Native dialog + quit (indicates broken build; should not occur in release) |

---

## Testing

- Existing `vitest` test suite covers the API layer — no changes needed.
- Manual smoke test after each release build: install `.dmg`, verify app opens, verify data persists across restarts, verify `startServer` guard works when `ELECTRON=true`.
- (Future) Playwright + `electron-playwright-helpers` for automated E2E.
