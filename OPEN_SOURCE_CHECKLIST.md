# Open Source Release Checklist

- Run `cd api && npm test`
- Run `cd web && npm test`
- Run `cd api && npm run build`
- Run `cd web && npm run build`
- Run `cd desktop && npm run build`
- Review `git status --short` and make sure no local databases, build outputs, or private notes are staged
- Confirm README, SECURITY, and technical docs match the current code paths and external dependencies
- Confirm internal planning/spec files under `docs/superpowers/` are not staged for the public repository
- If `API_TOKEN` is enabled for self-hosted deployments, set the same value in both `api` and `web`
- If phone sharing is enabled without a system-installed `cloudflared`, pin `CLOUDFLARED_SHA256`
- Verify no `.env`, API keys, or machine-specific files are tracked
- Recheck optional network features and document them clearly: Yahoo Finance, TWSE, CoinGecko, GitHub Releases, Cloudflare Tunnel
