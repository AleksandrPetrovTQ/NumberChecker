import { hashIp, bearerToken, clientIp, readCronSecret, readPreviousStatus, secretsMatch, wantsTestNotification } from "../lib/security/auth.ts";
import { consumeCheckRateLimit } from "../lib/security/rateLimit.ts";
import { availabilityMessage, sendTelegram, shouldNotify, testMessage } from "../lib/telegram.ts";
import { logger } from "../lib/logger.ts";
import { findTargetNumber, UpstreamError } from "../lib/vodafone.ts";

export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
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

    const body: { status: "found" | "missing"; notified: boolean; price?: number } = {
      status,
      notified,
    };
    if (listed?.priceUah != null) {
      body.price = listed.priceUah;
    }
    return json(200, body);
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : undefined;
    logger.error("check_failed", status === undefined ? {} : { status });
    return json(502, { error: "Upstream unavailable" });
  }
}

function json(status: number, body: unknown, headers?: Record<string, string>): Response {
  return Response.json(body, { status, headers });
}
