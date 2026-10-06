# Security

The checker has one protected action: search Vodafone and, when the exact number first appears, message Telegram.

## Authorization

There are no user accounts and no stored records. The caller proves it may run the check by sending `Authorization: Bearer <CRON_SECRET>`. The secret is compared on the server before any Vodafone or Telegram call. A client-supplied phone number is never accepted; the target number is fixed in code.

Missing `CRON_SECRET`, missing Telegram settings, or a failed secret check stops the request. Responses are generic (`Unauthorized` or `Service unavailable`).

## Rate limit

| Surface | Preset | Limit | Key | Rationale |
| --- | --- | --- | --- | --- |
| `POST /api/check` | `RATE_LIMIT_CHECK_PER_HOUR` | 10 / hour (default) | IP address | The GitHub Action calls about 2 times an hour. The cap allows a manual test and a retry, and it runs before the Vodafone token request and the Telegram send. |

Set `RATE_LIMIT_CHECK_PER_HOUR` to override. A non-integer, a value below 1, or a value above 1000 fails closed: the request is rejected and Vodafone is not called.

The limiter keeps its counters in memory on each function instance. That stops a hot loop on one instance. It does not add counts across instances. The bearer secret is what keeps the public URL from being an open search proxy.

A limited request returns `429` and `Retry-After`.

## Secrets

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `CRON_SECRET` belong in the Vercel project environment and in GitHub Actions secrets. `.env` is gitignored. The Vodafone page's public client credentials are read from the page at request time and are not stored in this repo.

## Logs

Production log level is `info`. See [logging.md](logging.md).
