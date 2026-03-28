# Security Advisory Draft

## Summary

AtomFortune releases up to and including `v0.0.7` contained security and release-quality issues that are fixed in `v0.0.8`.

## Affected versions

- Affected: `<= v0.0.7`
- Fixed: `v0.0.8`

## Issues addressed in v0.0.8

1. Browser-facing API exposure was too permissive because CORS allowed any origin while several local API routes had no additional protection.
2. Backup export accepted sensitive inputs through query parameters, which could leak through browser history or logs.
3. Phone sharing could download and execute `cloudflared` without a pinned checksum.
4. Public documentation overstated configuration support and understated some external network dependencies.

## Impact

In affected versions, a user running the local API in a browser-accessible environment could be exposed to unwanted cross-origin requests against the local service. Self-hosted users who exposed the stack more broadly also lacked an easy first-layer API token. Phone-sharing setup additionally carried unnecessary supply-chain risk when using managed `cloudflared` downloads.

## Remediation

- Upgrade to `v0.0.8`
- If self-hosting, set `API_TOKEN` for both the `api` and `web` services
- If using managed phone sharing downloads, set `CLOUDFLARED_SHA256`, or install `cloudflared` separately on the host

## Suggested warning text for older releases

> Security notice: This release is outdated and may contain known security and configuration issues. Please upgrade to `v0.0.8` or later.
