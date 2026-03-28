# AtomFortune Web

Next.js frontend for AtomFortune.

## Development

Run the web app from the `web/` directory:

```bash
npm run dev
```

The app runs on `http://localhost:3000`.

By default the browser talks to the local Next.js proxy at `/api/v1`, and the proxy forwards to `API_ORIGIN` (default: `http://localhost:8000`).

## Scripts

- `npm run dev` — start the Next.js dev server
- `npm run build` — production build
- `npm run start` — run the production server
- `npm test` — Jest test suite

## Notes

- `NEXT_PUBLIC_API_BASE_URL` is set to `/api/v1` in [next.config.ts](./next.config.ts)
- When `API_TOKEN` is configured, the Next.js route handler adds it server-side before proxying to the API
- `X-User-Id` selects the active local profile; it is not a standalone auth system

## Related Files

- [`app/api/v1/[...path]/route.ts`](./app/api/v1/[...path]/route.ts) — API proxy
- [`lib/api.ts`](./lib/api.ts) — SWR hooks and base fetch helpers
- [`lib/user.ts`](./lib/user.ts) — active profile helpers and `X-User-Id` injection
