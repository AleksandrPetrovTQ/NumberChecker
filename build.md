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

Vercel deploys the GitHub repo. `npm run build` bundles `src/check.ts` and `lib/` into one file, `api/check.js`, which is the function Vercel runs. That file is committed so the deploy does not depend on Vercel finding the `lib` TypeScript files. Set the environment variables from `.env.example` in the Vercel project before the first deploy. Leave the dashboard build command empty so `vercel.json` can run that bundle step again on deploy.

The schedule is `.github/workflows/check.yml`. It needs the `CHECK_URL` and `CRON_SECRET` Actions secrets.

Install steps, including the Telegram bot, are in [README.md](README.md).
