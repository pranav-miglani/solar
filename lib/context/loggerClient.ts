/**
 * Client-safe logger for "use client" components.
 * Same API as @/lib/context/logger (info, warn, error, debug) but only uses console,
 * so it works in the browser. Use this in any client component instead of creating
 * ad-hoc log helpers. The main logger (logger.ts) uses Node fs/path and cannot run in client bundles.
 */

const LEVEL_PRIO: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 }

function getLogLevel(): string {
  try {
    if (typeof process !== "undefined" && process.env?.LOG_LEVEL) {
      return process.env.LOG_LEVEL.toLowerCase()
    }
  } catch {
    // ignore
  }
  return "info"
}

function shouldLog(level: string): boolean {
  const configPrio = LEVEL_PRIO[getLogLevel()] ?? 1
  return (LEVEL_PRIO[level] ?? 1) >= configPrio
}

function formatTimestamp(): string {
  if (typeof Intl !== "undefined" && Intl.DateTimeFormat) {
    return new Date().toISOString()
  }
  return new Date().toISOString()
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.debug(`[${formatTimestamp()}] [DEBUG] ${message}`, ...args)
    }
  },
  info(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(`[${formatTimestamp()}] [INFO] ${message}`, ...args)
    }
  },
  warn(message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.warn(`[${formatTimestamp()}] [WARN] ${message}`, ...args)
    }
  },
  error(message: string, error?: Error | unknown, ...args: unknown[]): void {
    console.error(`[${formatTimestamp()}] [ERROR] ${message}`, error ?? "", ...args)
  },
}

export default logger
