# prism-gram

Email-processing Cloudflare Worker. Handles inbound emails: forwards them or re-sends them via the `EMAIL` binding depending on the recipient domain.

## What this worker actually does

- **Entry point**: `src/index.ts` — exports an `email` handler, **not** `fetch`. It just runs `forward` and `send` (from `src/email.ts`) concurrently.
- Two code paths based on `message.to`:
    - `*@send.toino.pt` → `send`: parses the raw MIME email with `letterparser`, validates a password against `SENDING_PASSWORD`, and re-sends via `env.EMAIL.send()`.
    - `*@toino.pt` → `forward`: adds a `Reply-To` header and forwards to the recipients resolved by `getRule()` in `src/rules.ts` — the per-`to` Email Routing forward rules, falling back to **all verified destination addresses**.

## Module map

- `src/index.ts` — `email` handler; delegates to `forward` + `send`.
- `src/email.ts` — `forward` / `send` logic.
- `src/rules.ts` — `getRule()`; lazily fetches Email Routing addresses + rules via the `cloudflare` SDK and caches them per isolate (network I/O happens on first call, not at import).
- `src/mime.ts` — MIME parsing/decoding and header filtering.
- `src/constants.ts` — config read from `cloudflare:workers` `env` (domains, account/zone IDs, secrets) + the routing regexes.

## Toolchain

- **Package manager**: `pnpm` (required version in `packageManager` field).
- **Runtime**: Cloudflare Workers, `compatibility_date: 2026-05-20`, `nodejs_compat` flag.
- **Key dependencies**: `letterparser` (MIME parsing), `cloudflare` (Email Routing API SDK).
- **Test runner**: `@cloudflare/vitest-pool-workers` (not plain vitest).

## Common commands

| Command             | Purpose                                                      |
| ------------------- | ------------------------------------------------------------ |
| `pnpm install`      | Install dependencies                                         |
| `pnpm dev`          | `wrangler dev` — local dev                                   |
| `pnpm deploy`       | `wrangler deploy` — deploy to Cloudflare                     |
| `pnpm gen:cf-types` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `pnpm check`        | `tsc --noEmit` — typecheck                                   |
| `pnpm lint`         | ESLint                                                       |
| `pnpm lint:fix`     | ESLint --fix                                                 |
| `pnpm format`       | Prettier check                                               |
| `pnpm format:fix`   | Prettier write                                               |
| `pnpm test`         | Run vitest tests                                             |

## Verification order

The CI runs format, lint, typecheck, and test in parallel, **except** typecheck depends on generated types:

```
pnpm install
pnpm gen:cf-types   # must run before check
pnpm check
pnpm test
pnpm lint
pnpm format
```

## Code style

- ESLint uses `typescript-eslint` **strict** + `perfectionist/recommended-alphabetical`.
- Perfectionist sorts imports, exports, objects, etc. alphabetically.
- Use `// @sort` comments to create partitions that sort independently.
- Prettier: 4-space indent, double quotes, trailing commas everywhere.

## Important files / gotchas

- `worker-configuration.d.ts` is **gitignored** and auto-generated. Do not hand-edit it.
- `wrangler.jsonc` defines:
    - `send_email` binding named `EMAIL`
    - Required secrets: `CLOUDFLARE_API_TOKEN` and `SENDING_PASSWORD`
    - `vars` block: `ACCOUNT_ID`, `ZONE_ID`, `FORWARDING_DOMAIN`, `SENDING_DOMAIN`
    - CPU limit: `300000` ms
    - `workers_dev: false` (custom domain deployment only)
- `src/constants.ts` reads all config from `cloudflare:workers` `env` — nothing (domains, addresses) is hard-coded anymore.
- `src/rules.ts` calls the Cloudflare API on the **first** `getRule()` and caches the result per isolate; importing the module does no network I/O.
- **Test gotcha**: in `vitest.config.mts`, env overrides go under miniflare `bindings`, **not** `vars`. `vars` is a wrangler-only key and is silently ignored by miniflare, so secrets set there never reach `env`.
- Tests mock the `cloudflare` SDK with an async-iterable (see `test/rules.spec.ts` / `test/email.spec.ts`).
- The worker only handles `email` events — no `fetch` handler.
