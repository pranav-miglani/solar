/**
 * Context-aware logger that automatically includes MDC context in logs
 * Writes logs to both console and files in the logs/ directory
 * 
 * Toggle between structured logger and console.log via USE_STRUCTURED_LOGGER env variable:
 * - USE_STRUCTURED_LOGGER=true: Uses structured logger with MDC context and file logging
 * - USE_STRUCTURED_LOGGER=false or unset: Uses simple console.log/console.error
 */

import MDC from "./mdc"
import fs from "fs"
import path from "path"

type LogLevel = "debug" | "info" | "warn" | "error"

// Check if structured logger should be used (default: true for backward compatibility)
const USE_STRUCTURED_LOGGER = process.env.USE_STRUCTURED_LOGGER !== "false"

// Ensure logs directory exists
const LOGS_DIR = path.join(process.cwd(), "logs")
if (!fs.existsSync(LOGS_DIR)) {
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true })
  } catch (error) {
    console.error("Failed to create logs directory:", error)
  }
}

// Log rotation configuration
const MAX_LOG_SIZE_MB = 500
const MAX_LOG_SIZE_BYTES = MAX_LOG_SIZE_MB * 1024 * 1024 // 500 MB in bytes
let lastRotationCheck = 0
const ROTATION_CHECK_INTERVAL = 60 * 1000 // Check every minute

/**
 * Get all log files with their sizes and modification times
 */
function getLogFiles(): Array<{ path: string; size: number; mtime: number }> {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      return []
    }

    const files = fs.readdirSync(LOGS_DIR)
    const logFiles: Array<{ path: string; size: number; mtime: number }> = []

    for (const file of files) {
      if (file.startsWith("app-") && file.endsWith(".log")) {
        const filePath = path.join(LOGS_DIR, file)
        try {
          const stats = fs.statSync(filePath)
          logFiles.push({
            path: filePath,
            size: stats.size,
            mtime: stats.mtime.getTime(),
          })
        } catch (error) {
          // Skip files that can't be accessed
          continue
        }
      }
    }

    return logFiles
  } catch (error) {
    console.error("Error reading log files:", error)
    return []
  }
}

/**
 * Rotate logs: delete oldest log files if total size exceeds MAX_LOG_SIZE_MB
 */
function rotateLogs(): void {
  try {
    const now = Date.now()
    
    // Throttle rotation checks to avoid excessive file system operations
    if (now - lastRotationCheck < ROTATION_CHECK_INTERVAL) {
      return
    }
    lastRotationCheck = now

    const logFiles = getLogFiles()
    
    // Calculate total size
    const totalSize = logFiles.reduce((sum, file) => sum + file.size, 0)

    // If total size is under limit, no rotation needed
    if (totalSize <= MAX_LOG_SIZE_BYTES) {
      return
    }

    // Sort by modification time (oldest first)
    logFiles.sort((a, b) => a.mtime - b.mtime)

    // Delete oldest files until we're under the limit
    let currentSize = totalSize
    let deletedCount = 0
    let deletedSize = 0

    for (const file of logFiles) {
      if (currentSize <= MAX_LOG_SIZE_BYTES) {
        break
      }

      try {
        fs.unlinkSync(file.path)
        currentSize -= file.size
        deletedCount++
        deletedSize += file.size
      } catch (error) {
        console.error(`Failed to delete log file ${file.path}:`, error)
      }
    }

    if (deletedCount > 0) {
      console.log(
        `🗑️  Log rotation: Deleted ${deletedCount} log file(s), ` +
        `freed ${(deletedSize / 1024 / 1024).toFixed(2)} MB. ` +
        `Current total: ${(currentSize / 1024 / 1024).toFixed(2)} MB`
      )
    }
  } catch (error) {
    console.error("Error during log rotation:", error)
  }
}

/**
 * Get the log file path for today (daily rotation)
 * Format: logs/app-YYYY-MM-DD.log
 */
function getLogFilePath(): string {
  const now = new Date()
  const istTime = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)

  const year = istTime.find((part) => part.type === "year")?.value || "0000"
  const month = istTime.find((part) => part.type === "month")?.value || "00"
  const day = istTime.find((part) => part.type === "day")?.value || "00"

  return path.join(LOGS_DIR, `app-${year}-${month}-${day}.log`)
}

/**
 * Write log to file (async, non-blocking)
 * Includes log rotation check before writing
 */
function writeToFile(level: LogLevel, formattedMessage: string, args: any[]): void {
  try {
    // Check and rotate logs if needed (throttled)
    rotateLogs()

    const logFile = getLogFilePath()
    const logLine = args.length > 0
      ? `${formattedMessage} ${JSON.stringify(args, null, 0)}\n`
      : `${formattedMessage}\n`
    
    fs.appendFileSync(logFile, logLine, "utf8")
  } catch (error) {
    // Silently fail if file write fails to avoid breaking the application
    // Only log to console if it's a critical error
    if (error instanceof Error && error.message.includes("ENOSPC")) {
      console.error("Disk space full, cannot write logs to file")
    }
  }
}

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
      const formatted = this.formatMessage("debug", message, ...args)
      console.debug(formatted, ...args)
      writeToFile("debug", formatted, args)
    }
  }

  info(message: string, ...args: any[]): void {
    const formatted = this.formatMessage("info", message, ...args)
    console.log(formatted, ...args)
    writeToFile("info", formatted, args)
  }

  warn(message: string, ...args: any[]): void {
    const formatted = this.formatMessage("warn", message, ...args)
    console.warn(formatted, ...args)
    writeToFile("warn", formatted, args)
  }

  error(message: string, error?: Error | any, ...args: any[]): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const formatted = this.formatMessage("error", message, errorMessage)
    console.error(formatted, error, ...args)
    
    // Include error stack trace in file log
    const errorDetails = error instanceof Error 
      ? { message: error.message, stack: error.stack, ...args }
      : { error, ...args }
    writeToFile("error", formatted, [errorDetails])
  }
}

/**
 * Simple console-based logger (no MDC context, no file logging)
 * Used when USE_STRUCTURED_LOGGER=false
 */
class ConsoleLogger {
  debug(message: string, ...args: any[]): void {
    if (process.env.NODE_ENV === "development") {
      const timestamp = formatISTTimestamp()
      console.debug(`[${timestamp}] [DEBUG] ${message}`, ...args)
    }
  }

  info(message: string, ...args: any[]): void {
    const timestamp = formatISTTimestamp()
    console.log(`[${timestamp}] [INFO] ${message}`, ...args)
  }

  warn(message: string, ...args: any[]): void {
    const timestamp = formatISTTimestamp()
    console.warn(`[${timestamp}] [WARN] ${message}`, ...args)
  }

  error(message: string, error?: Error | any, ...args: any[]): void {
    const timestamp = formatISTTimestamp()
    if (error instanceof Error) {
      console.error(`[${timestamp}] [ERROR] ${message}`, error.message, error.stack, ...args)
    } else {
      console.error(`[${timestamp}] [ERROR] ${message}`, error, ...args)
    }
  }
}

// Export logger instance based on environment variable
// If USE_STRUCTURED_LOGGER=false, use simple console logger
// Otherwise, use structured logger with MDC context and file logging
export const logger = USE_STRUCTURED_LOGGER 
  ? new ContextLogger() 
  : new ConsoleLogger()

// Log which logger mode is active (using console directly to avoid circular dependency)
if (!USE_STRUCTURED_LOGGER) {
  console.log(`[Logger] Using console logging mode (USE_STRUCTURED_LOGGER=false)`)
} else {
  // Use setTimeout to ensure this runs after module initialization
  setTimeout(() => {
    try {
      logger.info(`[Logger] Using structured logger mode (USE_STRUCTURED_LOGGER=true or unset)`)
    } catch {
      // Fallback if logger not ready yet
      console.log(`[Logger] Using structured logger mode (USE_STRUCTURED_LOGGER=true or unset)`)
    }
  }, 0)
}

export default logger

