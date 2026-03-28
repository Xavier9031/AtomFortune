import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import { createHash } from 'crypto'
import { spawn, execSync, execFileSync, ChildProcess } from 'child_process'

const BIN_DIR = path.join(app.getPath('userData'), 'bin')
const CLOUDFLARED_VERSION = '2026.3.0'

const MANAGED_DOWNLOADS: Record<string, { filename: string; sha256: string }> = {
  'darwin-amd64': {
    filename: 'cloudflared-darwin-amd64.tgz',
    sha256: '0f30140c4a5e213d22f951ef4c964cac5fb6a5f061ba6eba5ea932999f7c0394',
  },
  'darwin-arm64': {
    filename: 'cloudflared-darwin-arm64.tgz',
    sha256: '2aae4f69b0fc1c671b8353b4f594cbd902cd1e360c8eed2b8cad4602cb1546fb',
  },
  'linux-amd64': {
    filename: 'cloudflared-linux-amd64',
    sha256: '4a9e50e6d6d798e90fcd01933151a90bf7edd99a0a55c28ad18f2e16263a5c30',
  },
  'linux-arm64': {
    filename: 'cloudflared-linux-arm64',
    sha256: '0755ba4cbab59980e6148367fcf53a8f3ec85a97deefd63c2420cf7850769bee',
  },
  'win32-amd64': {
    filename: 'cloudflared-windows-amd64.exe',
    sha256: '59b12880b24af581cf5b1013db601c7d843b9b097e9c78aa5957c7f39f741885',
  },
}

function cloudflaredPath(): string {
  const name = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
  return path.join(BIN_DIR, name)
}

function managedDownloadSpec(): { url: string; sha256: string; isTgz: boolean } {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  const key = `${process.platform}-${arch}`
  const spec = MANAGED_DOWNLOADS[key]
  if (!spec) {
    throw new Error(`Managed cloudflared download is not available for ${process.platform}/${process.arch}. Install cloudflared manually.`)
  }
  const overrideSha = process.env.CLOUDFLARED_SHA256?.trim().toLowerCase()
  return {
    url: `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/${spec.filename}`,
    sha256: overrideSha || spec.sha256,
    isTgz: spec.filename.endsWith('.tgz'),
  }
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

function verifyCloudflaredBinary(filePath: string, expected: string): void {
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
  const spec = managedDownloadSpec()
  if (fs.existsSync(cfPath)) {
    try {
      verifyCloudflaredBinary(cfPath, spec.sha256)
      return cfPath
    } catch {
      fs.rmSync(cfPath, { force: true })
    }
  }

  fs.mkdirSync(BIN_DIR, { recursive: true })

  const tmpDest = spec.isTgz ? path.join(BIN_DIR, 'cloudflared.tgz') : cfPath

  await downloadFile(spec.url, tmpDest)

  if (spec.isTgz) {
    execSync(`tar xzf "${tmpDest}" -C "${BIN_DIR}"`, { stdio: 'ignore' })
    fs.unlinkSync(tmpDest)
  }

  if (process.platform !== 'win32') {
    fs.chmodSync(cfPath, 0o755)
  }

  verifyCloudflaredBinary(cfPath, spec.sha256)
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
