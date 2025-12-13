import { logger } from "@/lib/context/logger"
import { TokenRepository } from "./tokenRepository"

/**
 * Unauthorized Handler
 * Handles 401 Unauthorized responses by:
 * 1. Using the token already in scope (from failed request)
 * 2. Fetching new token directly from API
 * 3. Comparing old vs new token
 * 4. Updating DB only if tokens are different
 */
export class UnauthorizedHandler {
  private tokenRepository: TokenRepository
  private fetchTokenFromApi: () => Promise<{ token: string; expiresAt: Date; metadata?: Record<string, any> }>

  constructor(
    tokenRepository: TokenRepository,
    fetchTokenFromApi: () => Promise<{ token: string; expiresAt: Date; metadata?: Record<string, any> }>
  ) {
    this.tokenRepository = tokenRepository
    this.fetchTokenFromApi = fetchTokenFromApi
  }

  /**
   * Handle 401 Unauthorized response
   * @param oldToken - The token that failed (already in scope from the request)
   * @returns New token after refresh
   */
  async handle401(oldToken: string): Promise<string> {
    logger.warn(`[UnauthorizedHandler] Handling 401 - old token (full): ${oldToken}`)

    // Fetch new token directly from API (bypass DB check)
    logger.info(`[UnauthorizedHandler] Fetching new token from API...`)
    const { token: newToken, expiresAt, metadata } = await this.fetchTokenFromApi()

    if (!newToken || newToken.trim().length === 0) {
      logger.error(`[UnauthorizedHandler] New token is empty after fetch`)
      throw new Error("Re-authentication returned empty token")
    }

    logger.info(`[UnauthorizedHandler] New token obtained (full): ${newToken}`)
    logger.info(`[UnauthorizedHandler] New token length: ${newToken.length}`)

    // Compare tokens
    const tokensAreDifferent = this.tokenRepository.compareTokens(oldToken, newToken)
    logger.info(`[UnauthorizedHandler] Token changed: ${tokensAreDifferent ? "YES" : "NO"}`)

    if (tokensAreDifferent) {
      // Tokens are different - update DB
      logger.info(`[UnauthorizedHandler] Tokens are different, updating DB with new token`)
      await this.tokenRepository.saveTokenToDb(newToken, expiresAt, metadata)
    } else {
      // Tokens are the same - this is unusual but can happen
      logger.warn(
        `[UnauthorizedHandler] API returned the same token that failed. This may indicate invalid credentials or account issues.`
      )
      // Still update DB to refresh expiration time
      await this.tokenRepository.saveTokenToDb(newToken, expiresAt, metadata)
    }

    return newToken
  }
}

