// lib/security/auth.ts
import { createHash, timingSafeEqual } from "node:crypto";
function readCronSecret() {
  const secret = process.env.CRON_SECRET?.trim();
  return secret ? secret : null;
}
function bearerToken(request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}
function secretsMatch(provided, expected) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}
function readPreviousStatus(request) {
  const raw = request.headers.get("x-previous-status")?.trim().toLowerCase();
  if (raw === void 0 || raw === "") {
    return "missing";
  }
  if (raw === "found" || raw === "missing") {
    return raw;
  }
  return null;
}
function wantsTestNotification(request) {
  return request.headers.get("x-test-notification") === "1";
}
function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) {
    return first;
  }
  return "unknown";
}
function hashIp(ip) {
  return createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

// lib/security/rateLimit.ts
var WINDOW_MS = 60 * 60 * 1e3;
var DEFAULT_LIMIT = 10;
var buckets = /* @__PURE__ */ new Map();
function consumeCheckRateLimit(key, now = Date.now()) {
  const limit = readHourlyLimit();
  if (limit === null) {
    return { allowed: false, retryAfterSeconds: 60 };
  }
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }
  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1e3));
    return { allowed: false, retryAfterSeconds };
  }
  bucket.count += 1;
  return { allowed: true };
}
function readHourlyLimit() {
  const raw = process.env.RATE_LIMIT_CHECK_PER_HOUR;
  if (raw === void 0 || raw.trim() === "") {
    return DEFAULT_LIMIT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1e3) {
    return null;
  }
  return parsed;
}

// lib/logger.ts
var LEVEL_RANK = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};
function minimumLevel() {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (configured === "debug" || configured === "info" || configured === "warn" || configured === "error") {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}
function write(level, event, fields) {
  if (LEVEL_RANK[level] < LEVEL_RANK[minimumLevel()]) {
    return;
  }
  const line = JSON.stringify({
    time: (/* @__PURE__ */ new Date()).toISOString(),
    level,
    event,
    ...fields
  });
  const stream = level === "warn" || level === "error" ? process.stderr : process.stdout;
  stream.write(`${line}
`);
}
var logger = {
  debug(event, fields) {
    write("debug", event, fields);
  },
  info(event, fields) {
    write("info", event, fields);
  },
  warn(event, fields) {
    write("warn", event, fields);
  },
  error(event, fields) {
    write("error", event, fields);
  }
};

// lib/vodafone.ts
var TARGET_NUMBER_ID = "380668747770";
var OPERATOR_CODE = "38066";
var SEARCH_QUERY = "8747770";
var DISPLAY_NUMBER = "+380 66 874 77 70";
var NUMBER_PAGE = "https://www.vodafone.ua/services/all/golden-numbers";
var PAGE_URL = NUMBER_PAGE;
var REQUEST_TIMEOUT_MS = 15e3;
var UpstreamError = class extends Error {
  status;
  constructor(status) {
    super("upstream request failed");
    this.name = "UpstreamError";
    this.status = status;
  }
};
function readPublicConfig(html) {
  const apiUrl = readConfigValue(html, "MW_API_URL");
  const username = readConfigValue(html, "MW_BASIC_AUTH_USERNAME");
  const password = readConfigValue(html, "MW_BASIC_AUTH_PASSWORD");
  if (!apiUrl?.startsWith("https://") || !username || !password) {
    throw new UpstreamError(502);
  }
  return { apiUrl, username, password };
}
async function findTargetNumber() {
  const pageResponse = await fetch(PAGE_URL, {
    headers: { accept: "text/html", "user-agent": "number-checker" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!pageResponse.ok) {
    logger.warn("vodafone_page_failed", { status: pageResponse.status });
    throw new UpstreamError(pageResponse.status);
  }
  const html = await pageResponse.text();
  const config = readPublicConfig(html);
  const accessToken = await fetchAccessToken(config);
  return searchExactNumber(config.apiUrl, accessToken);
}
function formatPrice(amount) {
  const rounded = Math.round(amount);
  const grouped = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} \u0433\u0440\u043D`;
}
function readConfigValue(html, key) {
  const normalized = html.replaceAll('\\"', '"');
  const match = normalized.match(new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"([^"]*)"`));
  const value = match?.[1];
  return value ? value : null;
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
async function fetchAccessToken(config) {
  const tokenUrl = new URL("/uaa/oauth/token", config.apiUrl);
  tokenUrl.searchParams.set("grant_type", "client_credentials");
  const basic = Buffer.from(`${config.username}:${config.password}`).toString("base64");
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json; charset=UTF-8",
      authorization: `Basic ${basic}`,
      profile: "WEB"
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    logger.warn("vodafone_token_failed", { status: response.status });
    throw new UpstreamError(response.status);
  }
  const body = await response.json();
  if (!isTokenResponse(body)) {
    logger.warn("vodafone_token_unreadable", { status: response.status });
    throw new UpstreamError(502);
  }
  return body.access_token;
}
async function searchExactNumber(apiUrl, accessToken) {
  const url = new URL("/resource/api/resourceInventoryManagement/v2/logicalResource", apiUrl);
  url.searchParams.set("searchQuery", SEARCH_QUERY);
  url.searchParams.set("operatorCode", OPERATOR_CODE);
  url.searchParams.set("searchType", "mask");
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      Profile: "AVAILABLE-MSISDNS",
      Channel: "WEB"
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    logger.warn("vodafone_search_failed", { status: response.status });
    throw new UpstreamError(response.status);
  }
  const body = await response.json();
  if (!Array.isArray(body)) {
    logger.warn("vodafone_search_unreadable", { status: response.status });
    throw new UpstreamError(502);
  }
  const match = body.find((item) => isRecord(item) && item.id === TARGET_NUMBER_ID);
  if (!match) {
    return null;
  }
  const price = match.price?.prp;
  return { priceUah: typeof price === "number" ? price : null };
}
function isTokenResponse(value) {
  return isRecord(value) && typeof value.access_token === "string" && value.access_token.length > 0;
}
function isRecord(value) {
  return typeof value === "object" && value !== null;
}

// lib/telegram.ts
function availabilityMessage(listed) {
  const lines = [`${DISPLAY_NUMBER} is available`];
  if (listed.priceUah !== null) {
    lines.push(`Price: ${formatPrice(listed.priceUah)}`);
  }
  lines.push(NUMBER_PAGE);
  return lines.join("\n");
}
function testMessage(status) {
  const listedLine = status === "found" ? `${DISPLAY_NUMBER} is listed right now. You should also get the availability alert when it first appears.` : `${DISPLAY_NUMBER} is not listed for sale right now.`;
  return ["Number checker is working.", `Watching ${DISPLAY_NUMBER}.`, listedLine].join("\n");
}
function shouldNotify(previousStatus, currentStatus) {
  return currentStatus === "found" && previousStatus !== "found";
}
async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    throw new Error("telegram is not configured");
  }
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true
    }),
    signal: AbortSignal.timeout(15e3)
  });
  if (!response.ok) {
    logger.warn("telegram_send_failed", { status: response.status });
    throw new Error("telegram send failed");
  }
}

// src/check.ts
var maxDuration = 30;
function GET() {
  return json(405, { error: "Method not allowed" }, { allow: "POST" });
}
async function POST(request) {
  const decision = consumeCheckRateLimit(hashIp(clientIp(request)));
  if (!decision.allowed) {
    logger.info("rate_limited", { retryAfterSeconds: decision.retryAfterSeconds });
    return json(429, { error: "Too many requests" }, { "retry-after": String(decision.retryAfterSeconds) });
  }
  const expectedSecret = readCronSecret();
  if (!expectedSecret) {
    logger.error("cron_secret_missing");
    return json(503, { error: "Service unavailable" });
  }
  const providedSecret = bearerToken(request);
  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    logger.info("check_unauthorized");
    return json(401, { error: "Unauthorized" });
  }
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim() || !process.env.TELEGRAM_CHAT_ID?.trim()) {
    logger.error("telegram_not_configured");
    return json(503, { error: "Service unavailable" });
  }
  const previousStatus = readPreviousStatus(request);
  if (!previousStatus) {
    return json(400, { error: "Bad request" });
  }
  try {
    const listed = await findTargetNumber();
    const status = listed ? "found" : "missing";
    const notified = shouldNotify(previousStatus, status);
    if (notified && listed) {
      await sendTelegram(availabilityMessage(listed));
    }
    if (wantsTestNotification(request)) {
      await sendTelegram(testMessage(status));
    }
    const testSent = wantsTestNotification(request);
    logger.info("check_completed", { status, notified, testSent });
    const body = {
      status,
      notified
    };
    if (listed?.priceUah != null) {
      body.price = listed.priceUah;
    }
    return json(200, body);
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : void 0;
    logger.error("check_failed", status === void 0 ? {} : { status });
    return json(502, { error: "Upstream unavailable" });
  }
}
function json(status, body, headers) {
  return Response.json(body, { status, headers });
}
export {
  GET,
  POST,
  maxDuration
};
