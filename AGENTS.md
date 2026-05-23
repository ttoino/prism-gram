# prism-gram

Email-processing Cloudflare Worker. Handles inbound emails: forwards them or re-sends them via the `EMAIL` binding depending on the recipient domain.

## What this worker actually does

- **Entry point**: `src/index.ts` — exports an `email` handler, **not** `fetch`.
- Two code paths based on `message.to`:
    - `*.@send.toino.pt` → parses the raw MIME email with `letterparser`, validates a password against `SENDING_PASSWORD`, and re-sends via `env.EMAIL.send()`.
    - `*@toino.pt` → forwards to hard-coded addresses in `src/constants.ts` with a `Reply-To` header.

## Toolchain

- **Package manager**: `pnpm` (required version in `packageManager` field).
- **Runtime**: Cloudflare Workers, `compatibility_date: 2026-05-20`, `nodejs_compat` flag.
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
    - Required secret: `SENDING_PASSWORD`
    - CPU limit: `300000` ms
    - `workers_dev: false` (custom domain deployment only)
- The worker only handles `email` events — no `fetch` handler.
