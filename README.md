# Vodafone number checker

This project watches one number, **+380 66 874 77 70**, on [Vodafone Ukraine's number selection page](https://www.vodafone.ua/services/all/golden-numbers). When that exact number shows up for sale, it sends you a Telegram message with the price.

The search runs on [Vercel](https://vercel.com) (free Hobby plan). [GitHub Actions](https://github.com) calls it every 30 minutes. Vercel's own free cron can run only once a day, which is too slow for a number that can be reserved the same day.

You only get a message when the number **appears**. Repeat checks stay quiet. If it disappears and later comes back, you get another message.

## What you need

- A Telegram account
- A GitHub account
- A Vercel account (sign up with GitHub; the Hobby plan is free for personal projects)
- [Git](https://git-scm.com/downloads) and [Node.js 20+](https://nodejs.org) on your computer

No credit card.

## 1. Create the Telegram bot

1. Open Telegram and search for **@BotFather** (the verified account with a blue check).
2. Send `/newbot`.
3. BotFather asks for a display name. Example: `Vodafone number checker`.
4. It then asks for a username. It must end in `bot` and be unique. Example: `oleksandr_vf_number_bot`.
5. BotFather replies with a token that looks like `123456789:AAH...`. That is `TELEGRAM_BOT_TOKEN`. Leave this chat open. Do not send the token to anyone or put it in the GitHub repo.

## 2. Get your chat id

The bot will not message you until you message it first.

1. In Telegram, open the bot you just created (search for the username you chose) and press **Start**, or send `hi`.
2. In a browser, open this address, replacing the token with yours:

   `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`

   Example shape: `https://api.telegram.org/bot123456789:AAHxxx/getUpdates`
3. Find `"chat":{"id":123456789`. The number after `"id":` is `TELEGRAM_CHAT_ID`.
4. If the page says `"result":[]`, send another message to the bot and reload the page.

## 3. Put the project on GitHub

On GitHub, create a new repository. You can make it private. Do not add a README, `.gitignore`, or license in the GitHub form, because those files are already in this folder.

In this project folder:

```bash
git init
git add .
git commit -m "Add Vodafone number checker"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
git push -u origin main
```

## 4. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up or log in with GitHub. Approve access to the repository.
2. Click **Add New…** → **Project**.
3. Import the repository.
4. Leave the framework preset as **Other**. Leave the build command and output directory empty. Do not set the output directory to `public`. The repo already contains `api/check.js`, which is the function Vercel runs.
5. Open **Environment Variables** and add these three before you deploy:

   | Name | Value |
   | --- | --- |
   | `TELEGRAM_BOT_TOKEN` | The token from BotFather |
   | `TELEGRAM_CHAT_ID` | The numeric id from `getUpdates` |
   | `CRON_SECRET` | A long random password you invent (at least 32 characters) |

   Use the same `CRON_SECRET` in GitHub in the next step. A password manager or a random sentence you will not reuse elsewhere is enough.

6. Click **Deploy** and wait until it finishes.
7. Copy the site URL. It looks like `https://number-checker-xxxx.vercel.app`. The checker address is that URL plus `/api/check`:

   `https://number-checker-xxxx.vercel.app/api/check`

The site root may show a 404. That is expected. Only `/api/check` is used, and opening it in a browser shows `Method not allowed`. The check itself is a POST, from the test command below or from GitHub Actions.

## 5. Let GitHub call Vercel every 30 minutes

1. On GitHub, open the repository → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** twice:

   | Secret | Value |
   | --- | --- |
   | `CHECK_URL` | The full `https://….vercel.app/api/check` address |
   | `CRON_SECRET` | The same value you saved in Vercel |

3. Open the **Actions** tab. If GitHub asks you to enable Actions, enable them.
4. Select **Check number** on the left, then **Run workflow** → **Run workflow**.

A successful run ends with a line like:

```text
Number status: missing. Telegram sent: false.
```

`missing` means Vodafone is not selling `+380 66 874 77 70` right now. The workflow still ran. After this, GitHub runs it every 30 minutes on its own.

## 6. Send yourself a test message

This proves the bot token and chat id work. It does not mean the phone number is for sale.

In PowerShell, paste your real URL and secret:

```powershell
curl.exe -X POST `
  -H "Authorization: Bearer YOUR_CRON_SECRET" `
  -H "x-test-notification: 1" `
  "https://YOUR-PROJECT.vercel.app/api/check"
```

Telegram should show:

```text
Number checker is working.
Watching +380 66 874 77 70.
+380 66 874 77 70 is not listed for sale right now.
```

The command's JSON reply should contain `"status":"missing"`. If the number is actually listed, `status` is `found` and you also get the availability message.

## The alert you will get later

```text
+380 66 874 77 70 is available
Price: 500 грн
https://www.vodafone.ua/services/all/golden-numbers
```

The price is whatever Vodafone lists at that moment. Open the link, choose operator code `66`, and search `8747770` to reserve it. Vodafone holds a reservation for 72 hours.

## Cost

This stays inside free limits for a personal project: Vercel Hobby, GitHub Free, and Telegram. A check every 30 minutes is about 1,440 runs a month. A private GitHub repo includes 2,000 Action minutes, and each short run counts as at least one minute. A public repo does not use that quota.

## If something fails

| What you see | What to fix |
| --- | --- |
| A white page that says **This page is unavailable** and `FUNCTION_INVOCATION_FAILED` | The function crashed before it could answer. Redeploy from the latest `main`. Opening the site or `/api/check` in a browser is not the test. After a good deploy, `/api/check` in a browser shows `Method not allowed`, and the PowerShell command below is the test. |
| `No Output Directory named "public"` | The project has no static site. In Vercel, open **Settings → Build and Deployment** and clear **Build Command** and **Output Directory**, then redeploy. |
| Telegram never gets the test message, and the command prints `Unauthorized` | `CRON_SECRET` in the command does not match Vercel. Update it in the Vercel project (**Settings → Environment Variables**) and redeploy. |
| The command prints `Service unavailable` | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, or `CRON_SECRET` is missing in Vercel. Add it and redeploy. |
| The command prints `Too many requests` | Wait for the time in the `Retry-After` header. The limit is 10 checks per hour from one network. |
| GitHub Actions fails on the first line about secrets | Add `CHECK_URL` and `CRON_SECRET` under **Settings → Secrets and variables → Actions**. |
| Actions prints `HTTP 401` | The GitHub `CRON_SECRET` is not the same value as Vercel. |
| `getUpdates` is empty | Send a new message to the bot, then reload the page. |
| The workflow stops running after a long time | GitHub pauses schedules after about 60 days without a commit or a manual run. Open Actions and run the workflow once. |

## Change the number

The watched number is fixed in [lib/vodafone.ts](lib/vodafone.ts):

- `TARGET_NUMBER_ID` is the full id Vodafone returns, such as `380668747770`
- `OPERATOR_CODE` is `380` plus the two-digit code, such as `38066`
- `SEARCH_QUERY` is the 7 digits after the operator code, such as `8747770`
- `DISPLAY_NUMBER` is only the text in the Telegram message

Deploy again after changing them.
