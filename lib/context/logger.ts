/**
 * Context-aware logger that automatically includes MDC context in logs
 */

import MDC from "./mdc"

type LogLevel = "debug" | "info" | "warn" | "error"

class ContextLogger {
  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const prefix = MDC.getLogPrefix()
    const timestamp = new Date().toISOString()
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

