import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import https from 'https'
import { createHash } from 'crypto'
import { spawn, execSync, execFileSync, ChildProcess } from 'child_process'

const BIN_DIR = path.join(app.getPath('userData'), 'bin')
const CLOUDFLARED_VERSION = '2026.3.0'

const MANAGED_DOWNLOADS: Record<string, { filename: string }> = {
  'darwin-amd64': { filename: 'cloudflared-darwin-amd64.tgz' },
  'darwin-arm64': { filename: 'cloudflared-darwin-arm64.tgz' },
  'linux-amd64': { filename: 'cloudflared-linux-amd64' },
  'linux-arm64': { filename: 'cloudflared-linux-arm64' },
  'win32-amd64': { filename: 'cloudflared-windows-amd64.exe' },
}

let checksumCache: Map<string, string> | null = null

async function fetchReleaseChecksums(): Promise<Map<string, string>> {
  if (checksumCache) return checksumCache

  const url = `https://api.github.com/repos/cloudflare/cloudflared/releases/tags/${CLOUDFLARED_VERSION}`
  const body: string = await new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'AtomFortune' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch release info: HTTP ${res.statusCode}`))
        return
      }
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => resolve(data))
    }).on('error', reject)
  })

  const release = JSON.parse(body)
  const checksums = new Map<string, string>()
  const match = (release.body as string)?.match(/```\n([\s\S]*?)```/)
  if (!match) throw new Error('Could not parse checksums from release notes')

  for (const line of match[1].trim().split('\n')) {
    const parts = line.split(':')
    if (parts.length === 2) {
      checksums.set(parts[0].trim(), parts[1].trim())
    }
  }

  checksumCache = checksums
  return checksums
}

function cloudflaredPath(): string {
  const name = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
  return path.join(BIN_DIR, name)
}

async function managedDownloadSpec(): Promise<{ url: string; sha256: string; isTgz: boolean }> {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  const key = `${process.platform}-${arch}`
  const spec = MANAGED_DOWNLOADS[key]
  if (!spec) {
    throw new Error(`Managed cloudflared download is not available for ${process.platform}/${process.arch}. Install cloudflared manually.`)
  }
  const overrideSha = process.env.CLOUDFLARED_SHA256?.trim().toLowerCase()
  let sha256 = overrideSha
  if (!sha256) {
    const checksums = await fetchReleaseChecksums()
    sha256 = checksums.get(spec.filename)
    if (!sha256) {
      throw new Error(`No checksum found for ${spec.filename} in release ${CLOUDFLARED_VERSION}`)
    }
  }
  return {
    url: `https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/${spec.filename}`,
    sha256,
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
  const spec = await managedDownloadSpec()
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
