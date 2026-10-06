type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minimumLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (
    configured === "debug" ||
    configured === "info" ||
    configured === "warn" ||
    configured === "error"
  ) {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function write(level: LogLevel, event: string, fields?: Record<string, unknown>): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minimumLevel()]) {
    return;
  }

  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  const stream = level === "warn" || level === "error" ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
}

export const logger = {
  debug(event: string, fields?: Record<string, unknown>): void {
    write("debug", event, fields);
  },
  info(event: string, fields?: Record<string, unknown>): void {
    write("info", event, fields);
  },
  warn(event: string, fields?: Record<string, unknown>): void {
    write("warn", event, fields);
  },
  error(event: string, fields?: Record<string, unknown>): void {
    write("error", event, fields);
  },
};
