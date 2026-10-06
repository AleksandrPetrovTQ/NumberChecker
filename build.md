# Build

Personal watcher for one Vodafone Ukraine number. A Vercel function does the search. GitHub Actions calls it every 30 minutes. Telegram is notified only when `+380 66 874 77 70` becomes listed.

## Requirements

- Node.js 20 or newer
- A free GitHub account, a free Vercel Hobby account, and a Telegram account

## Check types

```bash
npm install
npm run typecheck
```

## Optional live search

This calls Vodafone and prints `found` or `missing`. It does not send Telegram and does not print secrets.

```bash
npm run verify:search
npm run verify:handler
```

`verify:handler` also checks that a missing or wrong secret is rejected before Vodafone is searched.

## Deploy

Vercel deploys the GitHub repo with no build command and no output directory. `npm run bundle` writes `src/check.ts` and `lib/` into `api/check.js`. Commit that file after changing the checker. Vercel runs `api/check.js` as the function. There is no `build` script, because Vercel would run it and then look for a `public` folder. Set the environment variables from `.env.example` in the Vercel project before the first deploy. Leave every Override switch off.

The schedule is `.github/workflows/check.yml`. It needs the `CHECK_URL` and `CRON_SECRET` Actions secrets.

Install steps, including the Telegram bot, are in [README.md](README.md).
