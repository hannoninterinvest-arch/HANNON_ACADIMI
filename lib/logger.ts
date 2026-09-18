export type LogMeta = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", message: string, meta?: LogMeta): void {
  const payload = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(meta ?? {}),
  };
  if (level === "error") {
    console.error(payload);
    return;
  }
  if (level === "warn") {
    console.warn(payload);
    return;
  }
  console.info(payload);
}

export const logger = {
  info: (message: string, meta?: LogMeta) => emit("info", message, meta),
  warn: (message: string, meta?: LogMeta) => emit("warn", message, meta),
  error: (message: string, meta?: LogMeta) => emit("error", message, meta),
};
