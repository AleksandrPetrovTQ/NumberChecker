import { logger } from "../lib/logger.ts";
import { findTargetNumber, readPublicConfig } from "../lib/vodafone.ts";

const plain = `"MW_API_URL":"https://mw-api.example","MW_BASIC_AUTH_USERNAME":"user","MW_BASIC_AUTH_PASSWORD":"secret"`;
const escaped = String.raw`\"MW_API_URL\":\"https://mw-api.example\",\"MW_BASIC_AUTH_USERNAME\":\"user\",\"MW_BASIC_AUTH_PASSWORD\":\"secret\"`;
for (const sample of [plain, escaped]) {
  const config = readPublicConfig(sample);
  if (config.apiUrl !== "https://mw-api.example" || config.username !== "user" || config.password !== "secret") {
    throw new Error("config parser did not read the public page values");
  }
}

const listed = await findTargetNumber();
logger.info("verify_search", {
  status: listed ? "found" : "missing",
  price: listed?.priceUah ?? null,
});
