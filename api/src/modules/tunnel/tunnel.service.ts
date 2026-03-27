import os from 'os'
import path from 'path'
import fs from 'fs'
import https from 'https'
import { spawn, execSync, ChildProcess } from 'child_process'

const BIN_DIR = path.join(os.tmpdir(), 'cloudflared-bin')

function cloudflaredPath(): string {
  const name = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared'
  return path.join(BIN_DIR, name)
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

async function ensureCloudflared(): Promise<string> {
  const cfPath = cloudflaredPath()
  if (fs.existsSync(cfPath)) return cfPath

  fs.mkdirSync(BIN_DIR, { recursive: true })

  const url = downloadUrl()
  const isTgz = url.endsWith('.tgz')
  const tmpDest = isTgz ? path.join(BIN_DIR, 'cloudflared.tgz') : cfPath

  console.log(`Downloading cloudflared from ${url}...`)
  await downloadFile(url, tmpDest)

  if (isTgz) {
    execSync(`tar xzf "${tmpDest}" -C "${BIN_DIR}"`, { stdio: 'ignore' })
    fs.unlinkSync(tmpDest)
  }

  if (process.platform !== 'win32') {
    fs.chmodSync(cfPath, 0o755)
  }

  console.log('cloudflared downloaded')
  return cfPath
}

let tunnelProcess: ChildProcess | null = null
let tunnelUrl: string | null = null

export async function startTunnel(targetUrl: string): Promise<string> {
  if (tunnelProcess) stopTunnel()

  const cfPath = await ensureCloudflared()

  return new Promise((resolve, reject) => {
    const proc = spawn(cfPath, ['tunnel', '--url', targetUrl], {
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
        tunnelUrl = match[1]
        console.log(`Tunnel started: ${tunnelUrl}`)
        resolve(tunnelUrl)
      }
    }

    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', onData)

    proc.on('error', (err) => {
      clearTimeout(timeout)
      tunnelUrl = null
      reject(err)
    })

    proc.on('exit', (code) => {
      tunnelUrl = null
      tunnelProcess = null
      if (code !== null && code !== 0) {
        clearTimeout(timeout)
        reject(new Error(`cloudflared exited with code ${code}`))
      }
    })
  })
}

export function stopTunnel(): void {
  if (tunnelProcess) {
    tunnelProcess.kill()
    tunnelProcess = null
    tunnelUrl = null
    console.log('Tunnel stopped')
  }
}

export function getTunnelStatus(): { active: boolean; url: string | null } {
  return { active: tunnelProcess !== null, url: tunnelUrl }
}
