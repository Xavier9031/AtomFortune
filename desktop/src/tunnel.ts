import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import { createHash } from 'crypto'
import { spawn, execSync, execFileSync, ChildProcess } from 'child_process'

const BIN_DIR = path.join(app.getPath('userData'), 'bin')

function cloudflaredPath(): string {
  const name = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
  return path.join(BIN_DIR, name)
}

function expectedSha256(): string | null {
  const value = process.env.CLOUDFLARED_SHA256?.trim().toLowerCase()
  return value || null
}

function downloadUrl(): string {
  const p = process.platform
  const a = process.arch
  const base = 'https://github.com/cloudflare/cloudflared/releases/latest/download'
  if (p === 'darwin') {
    const arch = a === 'arm64' ? 'arm64' : 'amd64'
    return `${base}/cloudflared-darwin-${arch}.tgz`
  }
  if (p === 'win32') {
    return `${base}/cloudflared-windows-amd64.exe`
  }
  const arch = a === 'arm64' ? 'arm64' : 'amd64'
  return `${base}/cloudflared-linux-${arch}`
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          follow(res.headers.location!)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`))
          return
        }
        const file = fs.createWriteStream(dest)
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
        file.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

function sha256File(filePath: string): string {
  const hash = createHash('sha256')
  hash.update(fs.readFileSync(filePath))
  return hash.digest('hex')
}

function verifyCloudflaredBinary(filePath: string): void {
  const expected = expectedSha256()
  if (!expected) {
    throw new Error(
      'Managed cloudflared download is disabled until CLOUDFLARED_SHA256 is set. Install cloudflared on PATH or pin a SHA256 first.'
    )
  }

  const actual = sha256File(filePath)
  if (actual !== expected) {
    throw new Error(`cloudflared SHA256 mismatch: expected ${expected}, got ${actual}`)
  }
}

function systemCloudflaredPath(): string | null {
  try {
    execFileSync('cloudflared', ['--version'], { stdio: 'ignore' })
    return 'cloudflared'
  } catch {
    return null
  }
}

async function ensureCloudflared(): Promise<string> {
  const systemPath = systemCloudflaredPath()
  if (systemPath) return systemPath

  const cfPath = cloudflaredPath()
  if (fs.existsSync(cfPath)) {
    verifyCloudflaredBinary(cfPath)
    return cfPath
  }

  fs.mkdirSync(BIN_DIR, { recursive: true })

  const url = downloadUrl()
  const isTgz = url.endsWith('.tgz')
  const tmpDest = isTgz ? path.join(BIN_DIR, 'cloudflared.tgz') : cfPath

  await downloadFile(url, tmpDest)

  if (isTgz) {
    execSync(`tar xzf "${tmpDest}" -C "${BIN_DIR}"`, { stdio: 'ignore' })
    fs.unlinkSync(tmpDest)
  }

  if (process.platform !== 'win32') {
    fs.chmodSync(cfPath, 0o755)
  }

  verifyCloudflaredBinary(cfPath)
  return cfPath
}

let tunnelProcess: ChildProcess | null = null

export async function startTunnel(port: number): Promise<string> {
  if (tunnelProcess) stopTunnel()

  const cfPath = await ensureCloudflared()

  return new Promise((resolve, reject) => {
    const proc = spawn(cfPath, ['tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    tunnelProcess = proc

    const timeout = setTimeout(() => {
      proc.kill()
      reject(new Error('Tunnel failed to start within 30 seconds'))
    }, 30_000)

    const onData = (data: Buffer) => {
      const line = data.toString()
      const match = line.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/)
      if (match) {
        clearTimeout(timeout)
        resolve(match[1])
      }
    }

    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)

    proc.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })

    proc.on('exit', (code) => {
      clearTimeout(timeout)
      if (code !== null && code !== 0) {
        reject(new Error(`cloudflared exited with code ${code}`))
      }
    })
  })
}

export function stopTunnel(): void {
  if (tunnelProcess) {
    tunnelProcess.kill()
    tunnelProcess = null
  }
}
