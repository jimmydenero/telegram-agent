# telegram-agent

A personal Telegram bot (@yunghadesbot) with an OpenRouter model behind it,
plus a tiny HTTP relay so Claude Code sessions on your Mac can talk to the
same chat.

## Architecture

1. One Render Web Service runs a single Node 22 process.
2. grammY long-polls Telegram, so no public webhook is needed.
3. Hono serves the relay API on `$PORT`: `/relay`, `/inbox`, `/healthz`.
4. Plain messages go to OpenRouter's chat completions API (plain `fetch`) with per-chat history capped at 40 messages.
5. History, the Claude Code inbox and runtime state live in SQLite on a 1 GB persistent disk at `/data`.
6. `tools/tg-relay.sh` on the Mac wraps the relay API for Claude Code.

## Bot commands

| Command | Effect |
|---|---|
| `/start`, `/help` | Show commands and your chat id |
| `/new` | Reset this chat's history |
| `/cc <text>` or a message starting with `cc:` | Queue text in the Claude Code inbox |
| `/inbox` | List inbox items Claude Code has not acked |
| anything else | Answered by the OpenRouter model with history |

Only users listed in `ALLOWED_TELEGRAM_USER_ID` get past the gate; everyone else sees one line.

## Relay API

All routes except `/healthz` need `Authorization: Bearer $RELAY_SECRET`.

| Route | Body / result |
|---|---|
| `POST /relay` | `{ "text": "...", "chat_id"?: 123 }` sends to `chat_id`, else `OWNER_CHAT_ID`, else the last chat that messaged the bot |
| `GET /inbox` | `{ "items": [{ "id", "text", "created_at" }] }` unacked items, oldest first |
| `POST /inbox/:id/ack` | marks an item done; 404 if unknown or already acked |
| `GET /healthz` | `{ "ok": true, "bot": true|false }` |

## Setup

1. **Bot token.** In Telegram open @BotFather, send `/newbot`, follow the prompts, copy the token.
2. **Your user id.** Message @userinfobot; it replies with your numeric id. That is `ALLOWED_TELEGRAM_USER_ID` and, for a direct chat, also `OWNER_CHAT_ID`.
3. **Relay secret.** Generate one locally: `openssl rand -hex 32`.
4. **OpenRouter key.** Create one at https://openrouter.ai/keys and add a few dollars of credit.
5. **Render.** Push this repo to GitHub. In the Render dashboard: New, Blueprint, pick the repo. Render reads `render.yaml`, then asks for the `sync: false` values: `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_USER_ID`, `OPENROUTER_API_KEY`, `RELAY_SECRET`. Optionally add `OWNER_CHAT_ID` under Environment afterwards.
6. **Check it.** After deploy, `curl https://<service>.onrender.com/healthz` should return `{"ok":true,"bot":true}`. Send `/start` to @yunghadesbot.
7. **Mac side.** Run `tools/tg-relay.sh` once; it creates `~/.config/tg-relay/env`. Fill in `RELAY_URL=https://<service>.onrender.com` and `RELAY_SECRET=<same secret>`.

## How Claude Code uses it

```bash
tg-relay.sh send "Build finished, 3 tests failed in split.test.ts"   # push a note to your phone
echo "long summary" | tg-relay.sh send                                # or pipe it
tg-relay.sh inbox                                                     # JSON list of things you queued with /cc
tg-relay.sh ack 12                                                    # mark #12 handled
```

A Claude Code session can poll `tg-relay.sh inbox` at the start of a task or on a loop, act on each item, then ack it.

## Local run

```bash
cp .env.example .env   # fill it in
npm install
set -a; source .env; set +a
npm run dev
```

Without `TELEGRAM_BOT_TOKEN` the process logs `TELEGRAM_BOT_TOKEN missing, bot disabled` and keeps the HTTP API up, which is handy for testing the relay. Without `OPENROUTER_API_KEY` the bot still runs `/cc`, `/inbox` and the relay, and answers free text with "brain offline".

`npm test` builds and runs the node:test suite (inbox store, history cap, message splitting).

## Model

The brain is OpenRouter's OpenAI-compatible endpoint (`https://openrouter.ai/api/v1/chat/completions`), called with `Authorization: Bearer $OPENROUTER_API_KEY` plus `HTTP-Referer` (`APP_URL`) and `X-Title` headers. Default model is `google/gemini-3.8-flash`. Set `OPENROUTER_MODEL` to any id from https://openrouter.ai/models to switch; no code change needed.

## Cost

- Render Starter web service: about $7/month (unverified; check render.com/pricing). The Starter plan does not spin down; Free instances stop after 15 minutes idle, which would kill long polling.
- Render disk: 1 GB, priced per GB per month (unverified).
- OpenRouter usage at `google/gemini-3.8-flash`: $0.75 per million input tokens, $3.75 per million output tokens (from the OpenRouter models API on 2026-09-22). A typical phone chat turn is a few thousand tokens, so well under a cent.

Note: a service with a disk attached does not get zero-downtime deploys; Render stops the old instance before starting the new one. That is also what you want here, since two instances long-polling the same bot token conflict.
