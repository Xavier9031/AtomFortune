# AtomFortune v0.0.8

This release is primarily a security and release-readiness update.

## Security

- Restricted browser CORS access to trusted localhost origins instead of `*`
- Added optional `API_TOKEN` protection for `/api/v1/*`
- Removed backup export/import sensitive query-string usage and moved secrets to headers
- Hardened phone sharing: managed `cloudflared` downloads now require `CLOUDFLARED_SHA256`, otherwise AtomFortune uses a system-installed `cloudflared`

## Behavior changes

- Removed the misleading `BASE_CURRENCY` setting; snapshot values remain stored in TWD and display currency remains configurable in the UI
- Settings now read the actual runtime snapshot schedule from the API

## Quality

- Synchronized README, SECURITY, and technical reference with the real code paths and external dependencies
- Restored passing API and web test suites
- Removed internal planning/spec material from the public repository

## Upgrade notes

- Self-hosted deployments that expose the web stack beyond localhost should set the same `API_TOKEN` value in both the `api` and `web` services
- Phone sharing without a system-installed `cloudflared` now requires `CLOUDFLARED_SHA256`

## Affected older releases

Releases up to and including `v0.0.7` should be considered outdated and should be upgraded.
