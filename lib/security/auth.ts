import { createHash, timingSafeEqual } from "node:crypto";

export type CheckStatus = "found" | "missing";

export function readCronSecret(): string | null {
  const secret = process.env.CRON_SECRET?.trim();
  return secret ? secret : null;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return null;
  }
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export function secretsMatch(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function readPreviousStatus(request: Request): CheckStatus | null {
  const raw = request.headers.get("x-previous-status")?.trim().toLowerCase();
  if (raw === undefined || raw === "") {
    return "missing";
  }
  if (raw === "found" || raw === "missing") {
    return raw;
  }
  return null;
}

export function wantsTestNotification(request: Request): boolean {
  return request.headers.get("x-test-notification") === "1";
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) {
    return first;
  }
  return "unknown";
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 12);
}
