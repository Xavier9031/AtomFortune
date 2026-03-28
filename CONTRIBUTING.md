# Contributing to AtomFortune

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Ways to Contribute

- **Bug reports** — Open an issue using the bug report template
- **Feature requests** — Open an issue using the feature request template
- **Code contributions** — Fork the repo and submit a pull request
- **Documentation** — Fix typos, clarify instructions, add translations

## Development Setup

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
git clone https://github.com/Xavier9031/AtomFortune.git
cd AtomFortune

npm install
cd api && npm install && cd ..
cd web && npm install && cd ..
cd desktop && npm install && cd ..
```

### Run locally

```bash
# Terminal 1: API (port 8000)
cd api && npm run dev

# Terminal 2: Web frontend (port 3000)
cd web && npm run dev
```

### Run tests

```bash
cd api && npm test
```

## Pull Request Guidelines

1. **Fork** the repository and create a branch from `main`
2. **Name your branch** descriptively: `feat/add-something` or `fix/broken-thing`
3. **Write tests** for new functionality where applicable
4. **Follow the existing code style** — TypeScript, no `any` unless unavoidable
5. **Use Conventional Commits** for commit messages:
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation only
   - `refactor:` code change that doesn't add a feature or fix a bug
   - `test:` adding or updating tests

6. **Keep PRs focused** — one feature or fix per PR
7. **Update documentation** if your change affects user-facing behavior

## Commit Message Format

```
type(scope): short description

Optional longer explanation.
```

Examples:
```
feat(holdings): add batch import from CSV
fix(snapshot): handle missing fx rate gracefully
docs(readme): add Docker setup screenshot
```

## Project Structure

```
AtomFortune/
├── api/          # Hono REST API + SQLite
├── web/          # Next.js frontend
├── desktop/      # Electron shell
└── shared/       # Shared TypeScript types
```

## Questions?

Open a [GitHub Discussion](https://github.com/Xavier9031/AtomFortune/discussions) or an issue — we're happy to help.
