import { shouldNotify } from "../lib/telegram.ts";

if (!shouldNotify("missing", "found") || shouldNotify("found", "found") || shouldNotify("missing", "missing")) {
  throw new Error("notification rule failed");
}

process.env.CRON_SECRET = "test-secret";
process.env.TELEGRAM_BOT_TOKEN = "000:test";
process.env.TELEGRAM_CHAT_ID = "1";

const { GET, POST } = await import("../src/check.ts");

const browser = await GET();
if (browser.status !== 405) {
  throw new Error(`expected 405 for a browser GET, got ${browser.status}`);
}

const missingSecret = await POST(new Request("https://checker.local/api/check", { method: "POST" }));
if (missingSecret.status !== 401) {
  throw new Error(`expected 401 for a missing bearer, got ${missingSecret.status}`);
}

const wrongSecret = await POST(
  new Request("https://checker.local/api/check", {
    method: "POST",
    headers: { authorization: "Bearer wrong" },
  }),
);
if (wrongSecret.status !== 401) {
  throw new Error(`expected 401 for a wrong bearer, got ${wrongSecret.status}`);
}

const badStatus = await POST(
  new Request("https://checker.local/api/check", {
    method: "POST",
    headers: { authorization: "Bearer test-secret", "x-previous-status": "yes" },
  }),
);
if (badStatus.status !== 400) {
  throw new Error(`expected 400 for a bad previous status, got ${badStatus.status}`);
}

const live = await POST(
  new Request("https://checker.local/api/check", {
    method: "POST",
    headers: { authorization: "Bearer test-secret", "x-previous-status": "missing" },
  }),
);
const body: unknown = await live.json();
if (live.status !== 200 || !isMissing(body)) {
  throw new Error(`expected a quiet missing result, got ${live.status}`);
}

function isMissing(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "missing" &&
    "notified" in value &&
    value.notified === false
  );
}
