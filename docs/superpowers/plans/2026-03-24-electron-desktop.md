# Electron Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package AtomFortune as a native macOS `.dmg` desktop app using Electron, with CI/CD auto-release via GitHub Actions + release-please.

**Architecture:** Electron's main process runs two servers: (1) Next.js standalone server on port 3000 via `utilityProcess.fork()`, and (2) Hono API on port 8000 via a dynamically imported `startServer()`. The BrowserWindow loads `http://localhost:3000`. Docker Compose is completely untouched. No changes to web code.

> **Architecture note:** The spec described a single-process/single-port approach using Next.js static export. That approach was found to be incompatible with the current web code (`app/layout.tsx` uses `cookies()` and `next-intl/server` which require a running server). The standalone-sidecar approach achieves the same user-facing goal with zero web code changes.

**Tech Stack:** Electron 31, electron-builder 24, electron-updater 6, `utilityProcess` (Electron built-in), GitHub Actions, release-please v4, husky 9.

**Spec:** `docs/superpowers/specs/2026-03-24-electron-desktop-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `api/package.json` | Modify | Add `"main": "dist/index.js"` and `"version": "0.0.1"` so desktop can resolve `atomfortune-api` |
| `api/src/index.ts` | Modify | Export `startServer(port, migrationsFolder)`, fix error handling, change auto-exec guard |
| `desktop/package.json` | Create | Electron + electron-builder + `atomfortune-api: file:../api` |
| `desktop/tsconfig.json` | Create | CommonJS TypeScript config for Electron main process |
| `desktop/electron-builder.yml` | Create | macOS build config, extraResources for drizzle + web-standalone |
| `desktop/src/main.ts` | Create | Electron main process: env setup → API server → Next.js sidecar → BrowserWindow |
| `.github/workflows/ci.yml` | Create | Run vitest on PR and dev pushes |
| `.github/workflows/release-please.yml` | Create | Auto-open Release PR on merge to main |
| `.github/workflows/release.yml` | Create | Build .dmg on tag push, upload to GitHub Releases |
| `.github/release-please-config.json` | Create | Tell release-please which package to version |
| `.github/.release-please-manifest.json` | Create | Starting version 0.0.1 |
| `package.json` (root) | Create | Minimal root package.json for husky |
| `.gitignore` (root) | Modify | Add `/node_modules` to exclude root-level husky node_modules |
| `.husky/pre-commit` | Create | Run API tests before every commit |

---

## Task 1: Add `main` field to `api/package.json`

**Files:**
- Modify: `api/package.json`

- [ ] **Step 1: Add `"main"` field**

Open `api/package.json`. Add `"version"` and `"main"` next to `"name"`. `"version"` is required so `npm install` in `desktop/` resolves the `file:../api` dependency without warnings:

```json
{
  "name": "atom-fortune-api",
  "version": "0.0.1",
  "main": "dist/index.js",
  "scripts": { ... }
}
```

- [ ] **Step 2: Verify**

```bash
node -e "console.log(require('./api/package.json').main)"
```

Expected: `dist/index.js`

- [ ] **Step 3: Commit**

```bash
git add api/package.json
git commit -m "feat(api): add main field for Electron local dependency"
```

---

## Task 2: Refactor `api/src/index.ts` — export `startServer`

**Files:**
- Modify: `api/src/index.ts`

We need to:
1. Export `startServer(port, migrationsFolder)` containing all startup logic
2. Wrap `serve()` in a Promise so port errors are catchable (they are emitted as `'error'` events, not thrown)
3. Change auto-exec guard so Electron can import without auto-starting

- [ ] **Step 1: Verify baseline tests pass**

```bash
cd api && npm test
```

Expected: all tests pass

- [ ] **Step 2: Replace the bottom of `api/src/index.ts`**

Replace everything from line 55 (`if (process.env.NODE_ENV !== 'test') {`) to end of file with:

```ts
export async function startServer(port: number, migrationsFolder: string): Promise<void> {
  migrate(db, { migrationsFolder })
  console.log('DB migrations applied')

  // Wrap serve() in a Promise so 'error' events (e.g. EADDRINUSE) are catchable.
  // serve() returns the http.Server immediately after calling listen(); it does NOT
  // reject on bind failure — errors come via the 'error' event.
  await new Promise<void>((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port })
    server.on('listening', () => resolve())
    server.on('error', (err) => reject(err))
  })
  console.log(`API listening on port ${port}`)

  ;(async () => {
    try {
      await refreshFxRates(db)
      console.log('FX rates refreshed')
    } catch (err) {
      console.warn('FX rate refresh failed (continuing without rates):', err)
    }
    tickersService.seedTaiwanStocks().catch(err =>
      console.warn('TW ticker seed failed:', err)
    )
  })()

  cron.schedule(config.snapshotSchedule, () => {
    dailySnapshotJob(db).catch(err => console.error('Snapshot job failed:', err))
  })
}

// Auto-start for Docker and direct `node dist/index.js`.
// NOT run when ELECTRON=true (main.ts calls startServer after setting DATABASE_PATH)
// or when NODE_ENV=test (vitest).
if (!process.env.ELECTRON && process.env.NODE_ENV !== 'test') {
  startServer(config.port, path.join(__dirname, '..', 'drizzle')).catch(err => {
    console.error('Failed to start server:', err)
    process.exit(1)
  })
}

export { app }
export default app
```

- [ ] **Step 3: Run tests to confirm no regressions**

```bash
cd api && npm test
```

Expected: all tests still pass

- [ ] **Step 4: Quick Docker sanity check**

```bash
docker compose up -d api && sleep 3 && curl http://localhost:8000/health && docker compose down
```

Expected: `{"status":"ok"}`

- [ ] **Step 5: Commit**

```bash
git add api/src/index.ts
git commit -m "feat(api): export startServer() for Electron, fix EADDRINUSE handling"
```

---

## Task 3: Create `desktop/` package

**Files:**
- Create: `desktop/package.json`
- Create: `desktop/tsconfig.json`
- Create: `desktop/electron-builder.yml`
- Create: `desktop/src/main.ts`

### 3a: `desktop/package.json`

- [ ] **Step 1: Create `desktop/package.json`**

```json
{
  "name": "atomfortune",
  "version": "0.0.1",
  "private": true,
  "description": "AtomFortune — Personal Asset Manager",
  "main": "dist/main.js",
  "scripts": {
    "build": "tsc",
    "start": "electron .",
    "predist": "cd ../web && npm run build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public && cd ../api && npm run build",
    "dist": "npm run build && electron-builder --mac"
  },
  "dependencies": {
    "electron-updater": "^6.1.0",
    "atomfortune-api": "file:../api"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "electron": "^31.0.0",
    "electron-builder": "^24.0.0",
    "typescript": "^5.4.0"
  }
}
```

### 3b: `desktop/tsconfig.json`

- [ ] **Step 2: Create `desktop/tsconfig.json`**

Using CommonJS to match the rest of the codebase. TypeScript compiles `await import(...)` to `Promise.resolve().then(() => require(...))` in CommonJS mode, which correctly defers the `require()` call after env vars are set.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

### 3c: `desktop/electron-builder.yml`

- [ ] **Step 3: Create `desktop/electron-builder.yml`**

The Next.js standalone build goes into `extraResources/web-standalone/`. Before packaging, the build pipeline must copy `.next/static/` and `public/` into the standalone dir (Next.js standalone does not include them automatically — see release.yml Task 5 for where this copy step happens).

```yaml
appId: com.atomfortune.app
productName: AtomFortune
copyright: Copyright © 2026 AtomFortune

directories:
  output: dist
  buildResources: resources

files:
  - dist/**
  - node_modules/**
  - "!node_modules/*/{CHANGELOG.md,README.md,readme.md}"
  - "!node_modules/**/{test,__tests__,tests,example,examples}"

extraResources:
  - from: "../api/drizzle"
    to: "drizzle"
  - from: "../web/.next/standalone"
    to: "web-standalone"

mac:
  category: public.app-category.finance
  target:
    - target: dmg
      arch:
        - universal

npmRebuild: true

publish:
  provider: github
  owner: Xavier9031
  repo: AtomFortune
```

### 3d: `desktop/src/main.ts`

- [ ] **Step 4: Create `desktop/src/main.ts`**

```ts
import { app, BrowserWindow, dialog, Notification, utilityProcess } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import http from 'http'

let mainWindow: BrowserWindow | null = null
let nextServerProcess: Electron.UtilityProcess | null = null

// Poll until the given port accepts a connection, then resolve.
function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ hostname: '127.0.0.1', port, path: '/' }, () => {
        req.destroy()
        resolve()
      })
      req.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`Port ${port} not ready after ${timeoutMs}ms`))
        } else {
          setTimeout(attempt, 150)
        }
      })
      req.setTimeout(500, () => {
        req.destroy()
        setTimeout(attempt, 150)
      })
    }
    attempt()
  })
}

async function bootstrap(): Promise<void> {
  // ─── CRITICAL: set env vars BEFORE any API module import ──────────────────
  // api/src/db/client.ts reads DATABASE_PATH at module evaluation time.
  // Dynamic import() below defers the require() call until after these are set.
  process.env.DATABASE_PATH = path.join(app.getPath('userData'), 'atomfortune.db')
  process.env.ELECTRON = 'true'
  process.env.NODE_ENV = 'production'

  const migrationsFolder = path.join(process.resourcesPath, 'drizzle')
  const webStandalonePath = path.join(process.resourcesPath, 'web-standalone')

  // ─── Start Next.js standalone server via utilityProcess ───────────────────
  // utilityProcess.fork() runs server.js in a separate Node.js process using
  // Electron's built-in Node.js runtime — no external Node binary required.
  nextServerProcess = utilityProcess.fork(
    path.join(webStandalonePath, 'server.js'),
    [],
    {
      env: {
        ...process.env,
        PORT: '3000',
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000/api/v1',
      },
      cwd: webStandalonePath,
    }
  )

  // ─── Start Hono API ────────────────────────────────────────────────────────
  // Dynamic import() ensures db/client.ts evaluates AFTER DATABASE_PATH is set above.
  let startServer: (port: number, migrationsFolder: string) => Promise<void>
  try {
    ;({ startServer } = await import('atomfortune-api'))
  } catch (err) {
    dialog.showErrorBox('Startup Error', `Failed to load API module:\n${err}`)
    app.quit()
    return
  }

  try {
    await startServer(8000, migrationsFolder)
  } catch (err: any) {
    if (err?.code === 'EADDRINUSE') {
      dialog.showErrorBox(
        'Port In Use',
        'Port 8000 is already in use.\nPlease close the conflicting application and try again.'
      )
    } else {
      dialog.showErrorBox(
        'Startup Error',
        `AtomFortune API failed to start:\n${err?.message ?? String(err)}`
      )
    }
    app.quit()
    return
  }

  // ─── Wait for Next.js to be ready ─────────────────────────────────────────
  try {
    await waitForPort(3000)
  } catch (err) {
    dialog.showErrorBox(
      'Startup Error',
      'The web server took too long to start. Please try again.'
    )
    app.quit()
    return
  }

  // ─── Open window ──────────────────────────────────────────────────────────
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'AtomFortune',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL('http://localhost:3000')
  mainWindow.on('closed', () => { mainWindow = null })

  // ─── Auto-updater (production builds only) ────────────────────────────────
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify()

    autoUpdater.on('update-downloaded', () => {
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: 'AtomFortune Update Ready',
          body: 'A new version has been downloaded. Click to restart and install.',
        })
        notif.on('click', () => autoUpdater.quitAndInstall())
        notif.show()
      }
    })
  }
}

app.on('ready', bootstrap)

app.on('window-all-closed', () => {
  nextServerProcess?.kill()
  app.quit()
})
```

### 3e: Install, build, smoke test

- [ ] **Step 5: Build the API first (required before desktop `npm install`)**

```bash
cd api && npm run build
```

Expected: `api/dist/index.js` created

- [ ] **Step 6: Install desktop dependencies**

```bash
cd desktop && npm install
```

Expected: `desktop/node_modules/` created. `atomfortune-api` is installed from `../api`.

- [ ] **Step 7: Build desktop TypeScript**

```bash
cd desktop && npm run build
```

Expected: `desktop/dist/main.js` created

- [ ] **Step 8: Build Next.js standalone and copy static files**

```bash
cd web && npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

Expected: `web/.next/standalone/server.js` exists; `web/.next/standalone/.next/static/` exists

- [ ] **Step 9: Smoke test — run Electron locally**

```bash
cd desktop && npm start
```

Expected:
- AtomFortune window opens showing the dashboard at `http://localhost:3000`
- No error dialogs
- Data loads (FX rates, dashboard chart)
- Check `~/Library/Application Support/AtomFortune/atomfortune.db` was created

- [ ] **Step 10: Test data persistence**

1. Add a test transaction or holding in the app
2. Quit (`Cmd+Q`)
3. Run `npm start` again
4. Confirm the data is still there

- [ ] **Step 11: Commit**

```bash
git add desktop/
git commit -m "feat(desktop): add Electron main process and electron-builder config"
```

---

## Task 4: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [dev, main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: API Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: api/package-lock.json

      - name: Install API dependencies
        run: cd api && npm ci

      - name: Run tests
        run: cd api && npm test
```

- [ ] **Step 2: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add API test workflow"
git push
```

- [ ] **Step 3: Verify CI passes on GitHub**

Open `https://github.com/Xavier9031/AtomFortune/actions` and confirm the CI workflow passes.

---

## Task 5: Release pipeline

**Files:**
- Create: `.github/release-please-config.json`
- Create: `.github/.release-please-manifest.json`
- Create: `.github/workflows/release-please.yml`
- Create: `.github/workflows/release.yml`

### 5a: release-please config

Note: Both config files live in `.github/` (not repo root). The workflow explicitly references them with `config-file` and `manifest-file` parameters, so the location is consistent.

- [ ] **Step 1: Create `.github/release-please-config.json`**

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "packages": {
    "desktop": {
      "release-type": "node",
      "package-name": "atomfortune",
      "changelog-path": "CHANGELOG.md",
      "bump-minor-pre-major": true,
      "bump-patch-for-minor-pre-major": true
    }
  }
}
```

- [ ] **Step 2: Create `.github/.release-please-manifest.json`**

```json
{
  "desktop": "0.0.1"
}
```

This sets the starting version. The first Release PR will bump to `0.0.2` (patch) or higher depending on commit prefixes.

### 5b: release-please workflow

- [ ] **Step 3: Create `.github/workflows/release-please.yml`**

```yaml
name: Release Please

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v4
        with:
          config-file: .github/release-please-config.json
          manifest-file: .github/.release-please-manifest.json
```

### 5c: Build and release workflow

The build pipeline:
1. Builds the API (`tsc`)
2. Builds Next.js standalone, then copies `.next/static/` and `public/` into the standalone dir (Next.js does not include them automatically)
3. Installs desktop deps, runs electron-builder
4. Uploads `.dmg` to the GitHub Release created by release-please

- [ ] **Step 4: Create `.github/workflows/release.yml`**

release-please creates tags in the format `desktop-v0.0.1` for the `desktop` package. This workflow triggers on those tags.

```yaml
name: Release

on:
  push:
    tags:
      - 'desktop-v*'

permissions:
  contents: write

jobs:
  build-mac:
    name: Build macOS App
    runs-on: macos-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Build API
        run: cd api && npm ci && npm run build

      - name: Build Next.js standalone
        # NEXT_PUBLIC_API_BASE_URL is already baked into the bundle by next.config.ts
        # (defaults to http://localhost:8000/api/v1). No need to set it here.
        # WARNING: if next.config.ts env block is ever removed, add it explicitly:
        #   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1 npm run build
        run: |
          cd web && npm ci && npm run build
          cp -r .next/static .next/standalone/.next/static
          cp -r public .next/standalone/public

      - name: Install desktop dependencies
        run: cd desktop && npm ci

      - name: Build and publish .dmg
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: cd desktop && npm run dist
```

- [ ] **Step 5: Commit all CI/CD files**

```bash
git add .github/
git commit -m "ci: add release-please and macOS release workflow"
git push
```

- [ ] **Step 6: Verify release-please runs on GitHub**

After the push lands on `main`, check GitHub Actions. release-please should open a PR titled `chore(main): release desktop 0.0.1` (or similar). This PR, when merged, will create tag `desktop-v0.0.1` and trigger the build.

---

## Task 6: Husky pre-commit hook

**Files:**
- Create: `package.json` (root)
- Modify: root `.gitignore`
- Create: `.husky/pre-commit`

- [ ] **Step 1: Check if root `.gitignore` excludes `/node_modules`**

```bash
grep "node_modules" .gitignore
```

If the output does NOT include a root-scoped entry (`/node_modules` or `node_modules/`), add it. The root `npm install` (for husky) will create `node_modules/` at the repo root which must not be committed.

- [ ] **Step 2: Add `/node_modules` and `desktop/dist/` to root `.gitignore` if missing**

Add the following lines to the root `.gitignore`:

```
/node_modules
desktop/dist/
```

`/node_modules` excludes the root-level husky installation. `desktop/dist/` excludes the built `.dmg` files (hundreds of MB) from being committed.

- [ ] **Step 3: Create root `package.json`**

This file exists only to install and run husky. It is not a monorepo workspace root.

```json
{
  "name": "atomfortune-monorepo",
  "private": true,
  "scripts": {
    "prepare": "husky"
  },
  "devDependencies": {
    "husky": "^9.0.0"
  }
}
```

- [ ] **Step 4: Install husky**

```bash
npm install
```

Expected: `node_modules/husky/` created at repo root, `.husky/` directory created.

- [ ] **Step 5: Create `.husky/pre-commit`**

```bash
#!/usr/bin/env sh
# If using nvm, add this line first so npm is on PATH:
# export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
cd api && npm test
```

- [ ] **Step 6: Make hook executable**

```bash
chmod +x .husky/pre-commit
```

- [ ] **Step 7: Test the hook fires**

Make a trivial staged change and commit it:

```bash
echo "" >> .gitignore
git add .gitignore
git commit -m "test: verify pre-commit hook"
```

Expected: vitest runs before the commit is created. Tests pass → commit succeeds.

- [ ] **Step 8: Commit hook setup**

```bash
git add package.json package-lock.json .husky/ .gitignore
git commit -m "chore: add husky pre-commit test hook"
```

---

## Task 7: Full local build and .dmg smoke test

- [ ] **Step 1: Build the full .dmg locally**

```bash
# Build API
cd api && npm run build

# Build Next.js standalone + copy static assets
cd ../web && npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

# Package desktop
cd ../desktop && npm run dist
```

Expected: `desktop/dist/AtomFortune-0.0.1-universal.dmg` created (may take 5–10 minutes)

- [ ] **Step 2: Install and test the .dmg**

1. Open `desktop/dist/AtomFortune-0.0.1-universal.dmg`
2. Drag AtomFortune to Applications
3. Right-click → Open (required the first time to bypass Gatekeeper for unsigned apps)
4. Verify the dashboard loads and shows existing data
5. Add a test entry, quit the app, reopen — verify data persists
6. Check `~/Library/Application Support/AtomFortune/atomfortune.db` exists

- [ ] **Step 3: Final commit**

```bash
git push
```

---

## Conventional Commit Reference

Use these prefixes going forward so release-please bumps versions correctly:

| Prefix | Effect | Example |
|---|---|---|
| `fix:` | patch bump (0.0.1 → 0.0.2) | `fix: correct currency rounding` |
| `feat:` | minor bump (0.0.1 → 0.1.0) | `feat: add CSV export` |
| `feat!:` | major bump (0.0.1 → 1.0.0) | `feat!: redesign data model` |
| `chore:`, `docs:`, `ci:`, `style:`, `ux:` | no version bump | `chore: update deps` |
