# prism-gram

Email-processing Cloudflare Worker for the `toino.pt` domain.

## What it does

- **Forward**: Emails sent to `*@toino.pt` are forwarded to a set of addresses with a `Reply-To` header.
- **Send**: Emails sent to `*@send.toino.pt` are parsed, validated against a password, and re-sent via the `EMAIL` binding.

## Setup

Requires a [Cloudflare](https://cloudflare.com) account and [pnpm](https://pnpm.io).

```sh
pnpm install
```

Set the required secret:

```sh
wrangler secret put SENDING_PASSWORD
```

## Deploy

```sh
pnpm run deploy
```

## Development

See [`AGENTS.md`](AGENTS.md) for the full developer guide -- commands, testing, code style, and architecture notes.
