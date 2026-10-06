# Logging

Application code writes JSON lines through `lib/logger.ts`. Production level is `info`. Override with `LOG_LEVEL` (`debug`, `info`, `warn`, or `error`).

Each line has `time`, `level`, and `event`, plus a few non-secret fields such as an HTTP status or `found` / `missing`.

Never logged:

- `CRON_SECRET`, the Telegram bot token, or the chat id
- Vodafone client credentials or access tokens
- Raw Vodafone or Telegram response bodies
- The caller's IP address (a short hash is used only as the in-memory rate-limit key, not written at `info`)

`debug` is for local troubleshooting. Do not turn production logs down to `debug` if a log drain might keep them.
