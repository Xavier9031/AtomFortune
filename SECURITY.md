# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |

## Security Design

AtomFortune is designed as a **self-hosted, local-first** application. Your financial records stay on your own machine or server — no cloud accounts and no mandatory third-party backend.

- All data is stored locally in a SQLite file you control
- The API server is intended to run on `localhost` or within your trusted local network
- Browser CORS access is restricted to localhost origins by default
- `/api/v1/*` can be protected with an optional `API_TOKEN`
- Local profiles are convenience partitions inside one instance, not separate security principals
- Phone sharing prefers a system-installed `cloudflared`; otherwise AtomFortune downloads a pinned managed copy automatically. `CLOUDFLARED_SHA256` remains available as an advanced override.
- Backup exports can be encrypted with AES-256-GCM using a password you choose
- Optional network features contact external services:
  - Yahoo Finance for prices and FX rates
  - TWSE and CoinGecko for ticker search
  - GitHub Releases for desktop auto-update checks
  - Cloudflare Tunnel when you explicitly enable phone sharing

**The API is still intended for local/private deployments.** If you expose it beyond localhost, set `API_TOKEN` for both the API and the web proxy. The desktop app generates a random per-launch token automatically. Even with a token, you should avoid exposing the API port (default: 8000) directly to the public internet. If you need hard separation between people, use separate OS accounts, separate database files, or separate deployments instead of relying on multi-profile mode inside one instance.

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public GitHub issue.

Instead, report it privately by emailing the maintainer or using [GitHub's private vulnerability reporting](https://github.com/Xavier9031/AtomFortune/security/advisories/new).

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

We aim to respond within 7 days and will credit reporters in the release notes (unless you prefer to remain anonymous).
