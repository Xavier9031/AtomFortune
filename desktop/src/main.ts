import { app, BrowserWindow, dialog, Notification, utilityProcess } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import http from 'http'

let mainWindow: BrowserWindow | null = null
let nextServerProcess: Electron.UtilityProcess | null = null
let apiServer: any = null

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
        PORT: '3100',
        HOSTNAME: '127.0.0.1',
        NODE_ENV: 'production',
        NEXT_PUBLIC_API_BASE_URL: 'http://localhost:8000/api/v1',
      },
      cwd: webStandalonePath,
    }
  )

  // ─── Start Hono API ────────────────────────────────────────────────────────
  // Dynamic import() ensures db/client.ts evaluates AFTER DATABASE_PATH is set above.
  let startServer: (port: number, migrationsFolder: string) => Promise<any>
  try {
    ;({ startServer } = await import('atomfortune-api'))
  } catch (err) {
    dialog.showErrorBox('Startup Error', `Failed to load API module:\n${err}`)
    app.quit()
    return
  }

  try {
    apiServer = await startServer(8000, migrationsFolder)
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
    await waitForPort(3100)
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

  mainWindow.loadURL('http://localhost:3100')
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
  apiServer?.close()
  app.quit()
})
