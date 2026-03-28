import { app, BrowserWindow, dialog, Menu, Notification, utilityProcess } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import http from 'http'
import crypto from 'crypto'
import QRCode from 'qrcode'
import { startTunnel, stopTunnel } from './tunnel'

let mainWindow: BrowserWindow | null = null
let nextServerProcess: Electron.UtilityProcess | null = null
let apiServer: any = null
let qrWindow: BrowserWindow | null = null

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

// ─── Share to Phone: Tunnel + QR Code ─────────────────────────────────────────

async function handleShareToPhone(): Promise<void> {
  if (qrWindow && !qrWindow.isDestroyed()) {
    qrWindow.focus()
    return
  }

  qrWindow = new BrowserWindow({
    width: 400,
    height: 480,
    resizable: false,
    title: 'AtomFortune',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })

  // Show loading state
  qrWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1916;color:#f8f5f2;font-family:system-ui;margin:0;">
  <div style="text-align:center">
    <p style="font-size:18px;">正在建立連線...</p>
  </div>
</body></html>`)}`)

  try {
    const url = await startTunnel(3100)
    if (!qrWindow || qrWindow.isDestroyed()) { stopTunnel(); return }

    const qrDataUrl = await QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#f8f5f2', light: '#1a1916' },
    })

    qrWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<!DOCTYPE html>
<html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#1a1916;color:#f8f5f2;font-family:system-ui;margin:0;user-select:none;">
  <h2 style="margin:0 0 20px;">手機掃描連線</h2>
  <img src="${qrDataUrl}" width="256" height="256" style="border-radius:12px;" />
  <p style="color:#0a9e9e;margin:16px 24px 0;font-size:13px;word-break:break-all;text-align:center;">${url}</p>
  <p style="color:#555;font-size:12px;margin-top:12px;">關閉此視窗會停止連線</p>
</body></html>`)}`)
  } catch (err: any) {
    if (qrWindow && !qrWindow.isDestroyed()) qrWindow.close()
    dialog.showErrorBox('連線失敗', err?.message ?? String(err))
  }

  qrWindow.on('closed', () => {
    qrWindow = null
    stopTunnel()
  })
}

// ─── Application Menu ─────────────────────────────────────────────────────────

function buildMenu(): void {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Share to Phone',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: handleShareToPhone,
        },
      ],
    },
    {
      label: 'Window',
      submenu: isMac
        ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
        : [{ role: 'minimize' }, { role: 'close' }],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap(): Promise<void> {
  // ─── CRITICAL: set env vars BEFORE any API module import ──────────────────
  // api/src/db/client.ts reads DATABASE_PATH at module evaluation time.
  // Dynamic import() below defers the require() call until after these are set.
  process.env.DATABASE_PATH = path.join(app.getPath('userData'), 'atomfortune.db')
  process.env.API_TOKEN = process.env.API_TOKEN ?? crypto.randomBytes(24).toString('hex')
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
        API_ORIGIN: 'http://localhost:8000',
        API_TOKEN: process.env.API_TOKEN,
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

  // ─── Menu ────────────────────────────────────────────────────────────────
  buildMenu()

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

// Disable HTTP cache for the locally-served web app — caching localhost
// responses causes stale JS/CSS to persist across app updates.
app.commandLine.appendSwitch('disable-http-cache')

app.on('ready', bootstrap)

app.on('window-all-closed', () => {
  stopTunnel()
  nextServerProcess?.kill()
  apiServer?.close()
  app.quit()
})
