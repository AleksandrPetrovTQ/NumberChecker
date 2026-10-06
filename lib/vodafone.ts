import { logger } from "./logger.ts";

export const TARGET_NUMBER_ID = "380668747770";
export const OPERATOR_CODE = "38066";
export const SEARCH_QUERY = "8747770";
export const DISPLAY_NUMBER = "+380 66 874 77 70";
export const NUMBER_PAGE = "https://www.vodafone.ua/services/all/golden-numbers";

const PAGE_URL = NUMBER_PAGE;
const REQUEST_TIMEOUT_MS = 15_000;

export type ListedNumber = {
  priceUah: number | null;
};

type PublicClientConfig = {
  apiUrl: string;
  username: string;
  password: string;
};

type MsisdnRecord = {
  id?: string;
  price?: {
    prp?: number;
  };
};

export class UpstreamError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("upstream request failed");
    this.name = "UpstreamError";
    this.status = status;
  }
}

export function readPublicConfig(html: string): PublicClientConfig {
  const apiUrl = readConfigValue(html, "MW_API_URL");
  const username = readConfigValue(html, "MW_BASIC_AUTH_USERNAME");
  const password = readConfigValue(html, "MW_BASIC_AUTH_PASSWORD");

  if (!apiUrl?.startsWith("https://") || !username || !password) {
    throw new UpstreamError(502);
  }

  return { apiUrl, username, password };
}

export async function findTargetNumber(): Promise<ListedNumber | null> {
  const pageResponse = await fetch(PAGE_URL, {
    headers: { accept: "text/html", "user-agent": "number-checker" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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

export function formatPrice(amount: number): string {
  const rounded = Math.round(amount);
  const grouped = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} грн`;
}

function readConfigValue(html: string, key: string): string | null {
  const normalized = html.replaceAll('\\"', '"');
  const match = normalized.match(new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"([^"]*)"`));
  const value = match?.[1];
  return value ? value : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchAccessToken(config: PublicClientConfig): Promise<string> {
  const tokenUrl = new URL("/uaa/oauth/token", config.apiUrl);
  tokenUrl.searchParams.set("grant_type", "client_credentials");
  const basic = Buffer.from(`${config.username}:${config.password}`).toString("base64");

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json; charset=UTF-8",
      authorization: `Basic ${basic}`,
      profile: "WEB",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    logger.warn("vodafone_token_failed", { status: response.status });
    throw new UpstreamError(response.status);
  }

  const body: unknown = await response.json();
  if (!isTokenResponse(body)) {
    logger.warn("vodafone_token_unreadable", { status: response.status });
    throw new UpstreamError(502);
  }
  return body.access_token;
}

async function searchExactNumber(apiUrl: string, accessToken: string): Promise<ListedNumber | null> {
  const url = new URL("/resource/api/resourceInventoryManagement/v2/logicalResource", apiUrl);
  url.searchParams.set("searchQuery", SEARCH_QUERY);
  url.searchParams.set("operatorCode", OPERATOR_CODE);
  url.searchParams.set("searchType", "mask");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${accessToken}`,
      Profile: "AVAILABLE-MSISDNS",
      Channel: "WEB",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    logger.warn("vodafone_search_failed", { status: response.status });
    throw new UpstreamError(response.status);
  }

  const body: unknown = await response.json();
  if (!Array.isArray(body)) {
    logger.warn("vodafone_search_unreadable", { status: response.status });
    throw new UpstreamError(502);
  }

  const match = body.find((item): item is MsisdnRecord => isRecord(item) && item.id === TARGET_NUMBER_ID);
  if (!match) {
    return null;
  }

  const price = match.price?.prp;
  return { priceUah: typeof price === "number" ? price : null };
}

function isTokenResponse(value: unknown): value is { access_token: string } {
  return isRecord(value) && typeof value.access_token === "string" && value.access_token.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> & MsisdnRecord {
  return typeof value === "object" && value !== null;
}
