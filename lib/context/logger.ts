/**
 * Context-aware logger that automatically includes MDC context in logs
 */

import MDC from "./mdc"

type LogLevel = "debug" | "info" | "warn" | "error"

/**
 * Format timestamp in IST (Asia/Kolkata) timezone
 * Format: YYYY-MM-DD HH:mm:ss.SSS IST
 */
function formatISTTimestamp(): string {
  const now = new Date()
  
  // Get IST time components
  const istTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now)

  const year = istTime.find((part) => part.type === "year")?.value || "0000"
  const month = istTime.find((part) => part.type === "month")?.value || "00"
  const day = istTime.find((part) => part.type === "day")?.value || "00"
  const hour = istTime.find((part) => part.type === "hour")?.value || "00"
  const minute = istTime.find((part) => part.type === "minute")?.value || "00"
  const second = istTime.find((part) => part.type === "second")?.value || "00"
  
  // Get milliseconds separately (always in UTC, but we'll use it for precision)
  const milliseconds = now.getMilliseconds().toString().padStart(3, "0")

  return `${year}-${month}-${day} ${hour}:${minute}:${second}.${milliseconds} IST`
}

class ContextLogger {
  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const prefix = MDC.getLogPrefix()
    const timestamp = formatISTTimestamp()
    return `[${timestamp}] ${prefix} [${level.toUpperCase()}] ${message}`
  }

  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(this.formatMessage("debug", message), ...args)
    }
  }

  info(message: string, ...args: any[]): void {
    console.log(this.formatMessage("info", message), ...args)
  }

  warn(message: string, ...args: any[]): void {
    console.warn(this.formatMessage("warn", message), ...args)
  }

  error(message: string, error?: Error | any, ...args: any[]): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(this.formatMessage("error", message, errorMessage), error, ...args)
  }
}

// Export singleton instance
export const logger = new ContextLogger()
export default logger

