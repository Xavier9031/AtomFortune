# Changelog

## [0.0.8](https://github.com/Xavier9031/AtomFortune/releases/tag/v0.0.8) (2026-03-28)

### Security

* restrict browser CORS to trusted localhost origins only
* add optional `API_TOKEN` protection for `/api/v1/*`
* remove sensitive backup query-string inputs and move them to headers
* require a pinned `CLOUDFLARED_SHA256` for managed `cloudflared` downloads

### Fixes

* remove misleading `BASE_CURRENCY` configuration surface
* align settings/runtime docs with actual API behavior
* restore passing API and web test suites before release

## [0.0.2](https://github.com/Xavier9031/AtomFortune/compare/desktop-v0.0.1...desktop-v0.0.2) (2026-03-24)


### Features

* **desktop:** add Electron main process and electron-builder config ([d81f2c0](https://github.com/Xavier9031/AtomFortune/commit/d81f2c0bb914d42285bb283fb76bffcb5fc611d4))
* **desktop:** Electron macOS app with CI/CD release pipeline ([2423995](https://github.com/Xavier9031/AtomFortune/commit/242399555c226b3fe0d8c2ec99038a672d31bb91))


### Bug Fixes

* **desktop:** align package name, fix release tag, add API shutdown handle ([7ee0f14](https://github.com/Xavier9031/AtomFortune/commit/7ee0f14aac2a8b3f8307a3451dd4cd11d70ac77d))
* **desktop:** exclude @img/sharp from universal build, rebuild api after dist ([187c3f1](https://github.com/Xavier9031/AtomFortune/commit/187c3f1809d77b54e7fac0f61afcaa7bdd99f403))
* **desktop:** update standalone path to web/ subdir (monorepo detection) ([5c867a9](https://github.com/Xavier9031/AtomFortune/commit/5c867a9f9e15d46f737f0eb9553a43777b506d99))
* **desktop:** use arm64 target; always rebuild api native modules after dist ([5f09cfc](https://github.com/Xavier9031/AtomFortune/commit/5f09cfc1e3a6ffaf9ec52ffb0ef62634df039989))
* keep builder-util-runtime in bundle (required by electron-updater at runtime) ([1814f4c](https://github.com/Xavier9031/AtomFortune/commit/1814f4ce4575e80f4a701e5aae8256b17ad81e17))
* resolve transaction/size/icon issues for desktop build ([aa1fe5b](https://github.com/Xavier9031/AtomFortune/commit/aa1fe5bc12c5a6395034a4e82673a83687fd3031))
