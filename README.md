<p align="center">
  <img src="web/public/icon-192.png" width="80" alt="AtomFortune" />
</p>

<h1 align="center">AtomFortune</h1>

<p align="center">
  <strong>Open-source, privacy-first personal asset dashboard.</strong><br/>
  Your financial records stay on your device. No cloud accounts. No subscriptions. Fully open-source.
</p>

<p align="center">
  <a href="https://github.com/Xavier9031/AtomFortune/releases/latest">
    <img src="https://img.shields.io/github/v/release/Xavier9031/AtomFortune?style=flat-square&label=latest" alt="Latest Release" />
  </a>
  <a href="https://github.com/Xavier9031/AtomFortune/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/Xavier9031/AtomFortune/ci.yml?branch=main&style=flat-square&label=CI" alt="CI" />
  </a>
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux%20%7C%20Docker-blue?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/github/license/Xavier9031/AtomFortune?style=flat-square" alt="License" />
</p>

<p align="center">
  <a href="docs/README.zh-TW.md">繁體中文</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/Xavier9031/AtomFortune/releases">Download</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/Xavier9031/AtomFortune/issues">Report Bug</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/Xavier9031/AtomFortune/issues">Request Feature</a>
</p>

---

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Dashboard – Dark Mode" width="780" />
</p>

<p align="center">
  <img src="docs/screenshots/dashboard-light.png" alt="Dashboard – Light Mode" width="380" />
  &nbsp;
  <img src="docs/screenshots/holdings.png" alt="Holdings" width="380" />
</p>

<p align="center">
  <img src="docs/screenshots/assets.png" alt="Assets" width="380" />
  &nbsp;
  <img src="docs/screenshots/accounts.png" alt="Accounts" width="380" />
</p>

---

## Why AtomFortune?

Most people have assets scattered across bank accounts, brokerages, crypto exchanges, real estate, and more — but no single view of the full picture. Traditional bookkeeping apps focus on tracking every daily expense, which is tedious and often abandoned.

AtomFortune takes a different approach: **periodic asset snapshots**. Instead of logging every transaction, you simply review and update your holdings once a month (or every few months). Market-priced assets update automatically. View everything in any of 17 supported currencies — the system converts across different pricing modes and exchange rates in real time. The result is a clear, long-term view of where you stand financially — without the daily overhead.

## What is AtomFortune?

A single interface to track everything you own and owe:

- **Cash & deposits** — bank accounts, physical cash, e-wallets
- **Investments** — stocks, ETFs, crypto, funds, precious metals
- **Fixed assets** — real estate, vehicles
- **Liabilities** — mortgages, credit cards, personal loans

Market prices and FX rates can be fetched automatically every day, giving you a real-time net worth and long-term trend view.

## Features

- **Dashboard** — Live net worth, asset allocation donut, 30d / 1y / all history widgets, plus 30d / 6m / 1y change badges
- **Holdings** — Grouped by account, quick add/edit/delete
- **Assets** — Full asset list with holding distribution and value history
- **Accounts** — Bank, broker, crypto exchange, e-wallet management
- **Multi-currency** — Snapshot values are stored in TWD, with display in 17 currencies (USD, JPY, EUR, GBP, CNY, etc.)
- **Backup & restore** — One-click encrypted export/import
- **Multi-profile** — Multiple user profiles with independent data
- **Dark mode** — Full dark theme with smooth transitions
- **Mobile-friendly** — Responsive layout with bottom nav, card-based lists, full-screen panels
- **Share to Phone** — One-click Cloudflare Tunnel + QR code to access from any network
- **Auto-update** — Desktop app checks for updates on launch

## Download

Pre-built binaries are available on the [Releases](https://github.com/Xavier9031/AtomFortune/releases) page:

| Platform | Format | Architecture |
|----------|--------|-------------|
| macOS | `.dmg` | Apple Silicon (arm64) |
| Windows | `.exe` (NSIS installer) | x64 |
| Linux | `.AppImage` | x64 |

> No setup required — the desktop app bundles the API server and web frontend.

### macOS: "App is damaged" warning

Because AtomFortune is not signed with an Apple Developer certificate, macOS Gatekeeper will block it on first launch. To fix this, run the following command in Terminal after moving the app to your Applications folder:

```bash
xattr -cr /Applications/AtomFortune.app
```

Then double-click to open normally. This is a one-time step.

## Self-host with Docker

For those who prefer a web-based setup:

```bash
git clone https://github.com/Xavier9031/AtomFortune.git
cd AtomFortune
export API_TOKEN=change-this-before-exposing-the-stack
docker compose up -d
```

Open **http://localhost:3001** in your browser.

### Access from your phone

Go to **Settings → Phone Access**, click **Start Connection**, and scan the QR code. Works on any network (4G/5G/different WiFi) via Cloudflare Tunnel.

If `cloudflared` is not already installed on the machine, AtomFortune can download a pinned managed copy automatically for Phone Access.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | [Electron](https://www.electronjs.org/) 31 |
| Backend | [Hono](https://hono.dev/) (TypeScript) |
| Database | SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) + [Drizzle ORM](https://orm.drizzle.team/) |
| Frontend | [Next.js](https://nextjs.org/) 16 + [Tailwind CSS](https://tailwindcss.com/) v4 + [Recharts](https://recharts.org/) |
| Market Data | [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) (stocks, ETFs, crypto, FX rates) |
| i18n | [next-intl](https://next-intl-docs.vercel.app/) (zh-TW, en) |
| Testing | [Vitest](https://vitest.dev/) (API) + [Jest](https://jestjs.io/) (Web) |
| CI/CD | GitHub Actions (3-platform build on tag) |

## Project Structure

```
AtomFortune/
├── api/               # Hono REST API + SQLite
│   ├── src/modules/   # assets, accounts, holdings, prices, snapshots, ...
│   ├── src/jobs/      # daily snapshot cron, pricing service
│   └── drizzle/       # database migrations
├── web/               # Next.js frontend
│   ├── app/           # pages (dashboard, holdings, assets, accounts, settings, ...)
│   └── components/    # React components
├── desktop/           # Electron shell
│   └── src/main.ts    # main process, tunnel, menu
└── docker-compose.yml
```

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install monorepo tooling
npm install

# Install each package
cd api && npm install && cd ..
cd web && npm install && cd ..
cd desktop && npm install && cd ..
```

### Run locally

```bash
# Terminal 1: API server (port 8000)
cd api && npm run dev

# Terminal 2: Web frontend (port 3000)
cd web && npm run dev

# Terminal 3 (optional): Desktop app
cd desktop && npm start
```

### Run tests

```bash
cd api && npm test
cd web && npm test
```

### Build desktop app

```bash
cd desktop && npm run dist
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `./atomfortune.db` | SQLite database file path |
| `API_TOKEN` | unset | Optional shared token for the API and Next.js proxy |
| `CLOUDFLARED_SHA256` | unset | Optional SHA256 override for managed `cloudflared` downloads when using phone sharing |
| `SNAPSHOT_SCHEDULE` | `0 22 * * *` | Daily snapshot cron expression |
| `PORT` | `8000` | API server port |
| `API_ORIGIN` | `http://localhost:8000` | API origin for Next.js proxy |
| `WEB_ORIGIN` | `http://localhost:3000` | Web origin for tunnel target |

## How It Works

1. **Add accounts** (bank, broker, wallet) and **assets** (stocks, cash, property)
2. **Create holdings** linking assets to accounts with quantities
3. Every day at 22:00, the **snapshot job** automatically:
   - Fetches latest prices from Yahoo Finance
   - Fetches FX rates from Yahoo Finance (`USDT` mirrors `USD`)
   - Calculates `value = quantity × price × fxRate` for each holding
   - Saves a point-in-time snapshot
4. The **dashboard** shows your net worth trend over time

## Documentation

- [Technical Reference](docs/technical-reference.md) — API endpoints, schema, snapshot mechanism
- [繁體中文 README](docs/README.zh-TW.md)

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

## Security

AtomFortune is designed for local/self-hosted use. Browser CORS access is limited to localhost origins by default, and you can optionally protect `/api/v1/*` with `API_TOKEN`. The desktop app generates a per-launch token automatically. Multi-profile support is a local data-organization feature inside one instance, not a full account/permission system. Manual snapshot rebuild/backfill endpoints operate on the profile selected by `X-User-Id`; scheduled jobs still process all local profiles. Phone sharing prefers a system-installed `cloudflared`; otherwise AtomFortune downloads a pinned managed copy automatically. Optional network features contact Yahoo Finance, TWSE, CoinGecko, GitHub Releases, and Cloudflare Tunnel. See [SECURITY.md](SECURITY.md) for details and the vulnerability reporting process.

## License

MIT
