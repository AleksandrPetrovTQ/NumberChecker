import { logger } from "./logger.ts";
import { DISPLAY_NUMBER, NUMBER_PAGE, formatPrice, type ListedNumber } from "./vodafone.ts";

export function availabilityMessage(listed: ListedNumber): string {
  const lines = [`${DISPLAY_NUMBER} is available`];
  if (listed.priceUah !== null) {
    lines.push(`Price: ${formatPrice(listed.priceUah)}`);
  }
  lines.push(NUMBER_PAGE);
  return lines.join("\n");
}

export function testMessage(status: "found" | "missing"): string {
  const listedLine =
    status === "found"
      ? `${DISPLAY_NUMBER} is listed right now. You should also get the availability alert when it first appears.`
      : `${DISPLAY_NUMBER} is not listed for sale right now.`;
  return ["Number checker is working.", `Watching ${DISPLAY_NUMBER}.`, listedLine].join("\n");
}

export function shouldNotify(previousStatus: "found" | "missing", currentStatus: "found" | "missing"): boolean {
  return currentStatus === "found" && previousStatus !== "found";
}

export async function sendTelegram(text: string): Promise<void> {
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
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    logger.warn("telegram_send_failed", { status: response.status });
    throw new Error("telegram send failed");
  }
}
