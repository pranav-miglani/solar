import { logger } from "@/lib/context/logger"

/**
 * Token data structure
 */
export interface TokenData {
  token: string
  expiresAt: Date
  metadata?: Record<string, any>
}

/**
 * Token Repository
 * Centralized token storage and retrieval operations for WMS vendors
 * Handles all database operations for token management
 */
export class TokenRepository {
  private vendorId: number
  private supabaseClient: any

  constructor(vendorId: number, supabaseClient: any) {
    this.vendorId = vendorId
    this.supabaseClient = supabaseClient
  }

  /**
   * Get token from database if valid
   * Returns token if it exists and expires more than 5 minutes from now
   * Returns null if token doesn't exist or is expired
   */
  async getTokenFromDb(): Promise<TokenData | null> {
    if (!this.vendorId || !this.supabaseClient) {
      return null
    }

    try {
      const { data: vendor } = await this.supabaseClient
        .from("wms_vendors")
        .select("access_token, token_expires_at, token_metadata")
        .eq("id", this.vendorId)
        .single()

      if (!vendor?.access_token) {
        logger.info(`[TokenRepository] No cached token found for vendor ${this.vendorId}`)
        return null
      }

      const expiresAt = vendor.token_expires_at ? new Date(vendor.token_expires_at) : null
      const now = new Date()

      // If no expiration, token is considered invalid
      if (!expiresAt) {
        logger.info(`[TokenRepository] Token exists but no expiration set for vendor ${this.vendorId}`)
        return null
      }

      // Token is valid if it expires more than 5 minutes from now
      const buffer = 5 * 60 * 1000 // 5 minutes
      if (expiresAt.getTime() > now.getTime() + buffer) {
        logger.info(
          `[TokenRepository] Valid cached token found for vendor ${this.vendorId} (expires at: ${expiresAt.toISOString()})`
        )
        return {
          token: vendor.access_token,
          expiresAt,
          metadata: vendor.token_metadata || {},
        }
      } else {
        logger.info(
          `[TokenRepository] Cached token expired for vendor ${this.vendorId} (expires at: ${expiresAt.toISOString()})`
        )
        return null
      }
    } catch (error: any) {
      logger.error(`[TokenRepository] Error fetching token from DB: ${error.message}`, { error })
      return null
    }
  }

  /**
   * Save token to database
   */
  async saveTokenToDb(token: string, expiresAt: Date, metadata?: Record<string, any>): Promise<void> {
    if (!this.vendorId || !this.supabaseClient) {
      throw new Error("TokenRepository: vendorId and supabaseClient must be set")
    }

    try {
      const updateData: any = {
        access_token: token,
        token_expires_at: expiresAt.toISOString(),
      }

      if (metadata) {
        updateData.token_metadata = metadata
      }

      const { error } = await this.supabaseClient
        .from("wms_vendors")
        .update(updateData)
        .eq("id", this.vendorId)

      if (error) {
        logger.error(`[TokenRepository] Failed to save token to DB: ${error.message}`, { error })
        throw new Error(`Failed to save token: ${error.message}`)
      }

      logger.info(
        `[TokenRepository] Token saved successfully for vendor ${this.vendorId} (expires at: ${expiresAt.toISOString()})`
      )
    } catch (error: any) {
      logger.error(`[TokenRepository] Exception saving token to DB: ${error.message}`, { error })
      throw error
    }
  }

  /**
   * Clear token from database
   */
  async clearTokenFromDb(): Promise<void> {
    if (!this.vendorId || !this.supabaseClient) {
      return
    }

    try {
      const { error } = await this.supabaseClient
        .from("wms_vendors")
        .update({
          access_token: null,
          token_expires_at: null,
        })
        .eq("id", this.vendorId)

      if (error) {
        logger.error(`[TokenRepository] Failed to clear token from DB: ${error.message}`, { error })
      } else {
        logger.info(`[TokenRepository] Token cleared from DB for vendor ${this.vendorId}`)
      }
    } catch (error: any) {
      logger.error(`[TokenRepository] Exception clearing token from DB: ${error.message}`, { error })
    }
  }

  /**
   * Check if token is valid (not expired with 5-minute buffer)
   */
  isTokenValid(tokenData: TokenData | null): boolean {
    if (!tokenData) {
      return false
    }

    const now = new Date()
    const buffer = 5 * 60 * 1000 // 5 minutes
    return tokenData.expiresAt.getTime() > now.getTime() + buffer
  }

  /**
   * Compare two tokens
   * Returns true if tokens are different
   */
  compareTokens(oldToken: string | null, newToken: string | null): boolean {
    if (!oldToken || !newToken) {
      return true // Consider different if either is null
    }
    return oldToken !== newToken
  }
}

