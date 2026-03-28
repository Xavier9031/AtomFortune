# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |

## Security Design

AtomFortune is designed as a **self-hosted, local-first** application. All data stays on your own machine or server — no cloud accounts, no external data collection.

- All data is stored locally in a SQLite file you control
- The API server is intended to run on `localhost` or within your trusted local network
- Backup exports can be encrypted with AES-256-GCM using a password you choose
- No external services receive your financial data (market prices are fetched anonymously)

**The API has no built-in authentication.** It is designed to be accessed only from your local machine or private network. **Do not expose the API port (default: 8000) to the public internet.**

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not** open a public GitHub issue.

Instead, report it privately by emailing the maintainer or using [GitHub's private vulnerability reporting](https://github.com/Xavier9031/AtomFortune/security/advisories/new).

Please include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional)

We aim to respond within 7 days and will credit reporters in the release notes (unless you prefer to remain anonymous).
