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

---

## Architecture

### One process, one port

Electron runs a single Node.js main process that:

1. Finds an available localhost port.
2. Sets `DATABASE_PATH` to `app.getPath('userData')/atomfortune.db` (e.g. `~/Library/Application Support/AtomFortune/atomfortune.db`).
3. Imports and starts the existing Hono server, extended to also serve the static Next.js build.
4. Opens a `BrowserWindow` pointing to `localhost:{port}`.
5. Checks GitHub Releases for updates in the background (electron-updater).

```
Electron App
└── Main Process (Node.js)
    ├── Hono server on localhost:{port}
    │   ├── /api/v1/*  → existing API handlers (unchanged)
    │   └── /*         → serve web/out/ (Next.js static export)
    └── BrowserWindow → localhost:{port}
```

No sidecar, no second process, no CORS issues — everything on one port.

### Database

The existing `DATABASE_PATH` environment variable already controls the SQLite file location. In Electron, the main process sets it to the platform userData directory before starting Hono. No changes to `api/src/db/client.ts`.

### Web mode (Docker) — unchanged

Docker Compose continues to work exactly as before. The `web` container runs `next start` (server mode); the `api` container runs Hono. No shared code is modified.

---

## Folder Structure

```
AtomFortune/
├── api/        ← unchanged
├── web/        ← add NEXT_OUTPUT env var support to next.config.ts
├── shared/     ← unchanged
└── desktop/    ← NEW
    ├── package.json          (electron, electron-builder, electron-updater)
    ├── electron-builder.yml  (mac target: dmg, appId, etc.)
    ├── src/
    │   └── main.ts           (Electron main process)
    └── tsconfig.json
```

---

## Code Changes to Existing Files

| File | Change |
|---|---|
| `web/next.config.ts` | `output: process.env.NEXT_OUTPUT as any \|\| undefined` — allows `NEXT_OUTPUT=export` for Electron builds without affecting Docker |
| `api/src/index.ts` | Export the Hono `app` instance separately from the `serve()` call, so Electron's main process can import and start it |

All other API code, Docker Compose files, and tests are untouched.

---

## Build Pipeline

### Electron build (local or CI)

```
1. NEXT_OUTPUT=export next build     # web/out/ (static files)
2. tsc -p api/tsconfig.json          # api/dist/
3. electron-builder --mac            # bundles everything → desktop/dist/AtomFortune.dmg
```

electron-builder bundles:
- `desktop/src/main.ts` (compiled)
- `api/dist/` (Hono server)
- `web/out/` (static Next.js)
- All required `node_modules`

### Auto-update

electron-updater checks `https://github.com/{owner}/AtomFortune/releases/latest` on startup. If a newer version exists, it downloads in the background and shows a system notification. The user clicks to restart and install.

---

## CI/CD Pipeline

### Workflows

| Workflow | Trigger | Actions |
|---|---|---|
| `ci.yml` | Every PR and push to `dev` | Run `vitest` test suite |
| `release.yml` | Merge to `main` + version tag created by release-please | Build `.dmg`, upload to GitHub Releases |

### Versioning with release-please

- Commit messages follow Conventional Commits (`fix:`, `feat:`, `feat!:`, etc.).
- On every merge to `main`, `release-please` opens or updates a Release PR containing a `CHANGELOG.md` update and version bump.
- When the developer merges the Release PR, `release-please` creates a git tag (e.g. `v0.0.2`).
- The `release.yml` workflow triggers on that tag, builds the `.dmg` on a macOS GitHub Actions runner, and uploads it to GitHub Releases.
- Starting version: `v0.0.1`.

### Pre-commit (local)

A `husky` pre-commit hook runs `vitest --run` locally before each commit, so failures are caught immediately without waiting for CI.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Hono server fails to start | Show native dialog: "AtomFortune failed to start. Please report this issue." |
| Port conflict | Retry with next available port (up to 10 attempts) |
| Update check fails (no network) | Silent — skip update, app opens normally |
| Static files missing | Indicates broken build — should not occur in release builds |

---

## App Lifecycle

- `app.on('ready')` → start server → open window → check for updates
- `app.on('window-all-closed')` → stop Hono server → `app.quit()`
- No orphan processes left after quit.

---

## Testing

- Existing `vitest` test suite covers the API layer — no changes needed.
- Manual smoke test after each release build: install `.dmg`, verify app opens, verify data persists across restarts, verify auto-update flow.
- (Future) Playwright + `electron-playwright-helpers` for automated E2E if needed.
