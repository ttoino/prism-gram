# prism-gram

Email-processing Cloudflare Worker for the `toino.pt` domain.

## What it does

- **Forward**: Emails sent to `*@toino.pt` are forwarded with a `Reply-To` header to the recipients configured in Cloudflare Email Routing — the per-address forward rules, falling back to all verified destination addresses.
- **Send**: Emails sent to `*@send.toino.pt` are parsed, validated against a password, and re-sent via the `EMAIL` binding.

## Setup

Requires a [Cloudflare](https://cloudflare.com) account and [pnpm](https://pnpm.io).

```sh
pnpm install
```

Set the required secrets:

```sh
# Password that authorizes the *@send.toino.pt re-send path
wrangler secret put SENDING_PASSWORD
# Token with read access to Email Routing addresses and rules
wrangler secret put CLOUDFLARE_API_TOKEN
```

The account/zone IDs and domains (`ACCOUNT_ID`, `ZONE_ID`, `FORWARDING_DOMAIN`, `SENDING_DOMAIN`) are configured as `vars` in [`wrangler.jsonc`](wrangler.jsonc).

## Deploy

```sh
pnpm run deploy
```

## Development

See [`AGENTS.md`](AGENTS.md) for the full developer guide -- commands, testing, code style, and architecture notes.
