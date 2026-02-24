import type { UnsignedTxTemplate } from "../types";

/**
 * Create pool parameters
 *
 * If there are other pools in the market:
 * - bchAmount OR tokenAmount must be provided (not both)
 * - The other is automatically calculated based on the market price
 * - This way, arbitrage risk is avoided
 *
 * If it is the first pool: Both must be provided (price is set by you)
 */
export interface CreatePoolParams {
    /** Token category (32 byte hex) */
    tokenCategory: string;
    /** First BCH amount (human format: 0.1 = 0.1 BCH) */
    bchAmount?: number;
    /** First token amount (human format) */
    tokenAmount?: number;
    /** Token decimal (optional, fetched from BCMR) */
    tokenDecimals?: number;
    /** Price deviation tolerance (%) - default %1 */
    priceDeviationTolerance?: number;
    /** Force use market price (true if automatic calculation) */
    useMarketPrice?: boolean;
}

/**
 * Create pool options
 */
export interface CreatePoolOptions {
    /** Pool owner token address */
    ownerTokenAddress: string;
}

/**
 * Create pool result (discriminated union)
 */
export type CreatePoolResult =
    | {
          success: true;
          /** Unsigned TX template */
          unsignedTx?: UnsignedTxTemplate;
          /** New pool BCH amount */
          poolBch: bigint;
          /** New pool token amount */
          poolTokens: bigint;
          /** Pool contract address */
          poolAddress?: string;
          /** Initial price (BCH/Token) */
          initialPrice?: number;
          /** Market price (if available) */
          marketPrice?: number;
          /** Price deviation (%) */
          priceDeviation?: number;
          /** Are there any pools in the market? */
          hasMarketPools?: boolean;
      }
    | {
          success: false;
          error: string;
      };

/**
 * Add liquidity parameters
 *
 * NOTE: bchAmount OR tokenAmount must be provided (not both).
 * The other is automatically calculated based on the market price.
 * This way, price remains the same.
 */
export interface AddLiquidityParams {
    /** Token category */
    tokenCategory: string;
    /** Amount to add (human format) - if provided, token is automatically calculated */
    bchAmount?: number;
    /** Amount to add (human format) - if provided, BCH is automatically calculated */
    tokenAmount?: number;
    /** Token decimal (optional) */
    tokenDecimals?: number;
}

/**
 * Add liquidity options
 */
export interface AddLiquidityOptions {
    /** Pool owner token address */
    ownerTokenAddress: string;
}

/**
 * Add liquidity result
 */
export interface AddLiquidityResult {
    success: boolean;
    error?: string;
    /** Unsigned TX template */
    unsignedTx?: UnsignedTxTemplate;
    /** Added BCH (human format) */
    bchAdded: number;
    /** Added token (human format) */
    tokensAdded: number;
    /** New pool BCH amount */
    newPoolBch: bigint;
    /** New pool token amount */
    newPoolTokens: bigint;
}

/**
 * Remove liquidity parameters
 *
 * 3 options:
 * 1. percentage: Remove %X of the pool (e.g. 50 = %50)
 * 2. bchAmount: Remove specific BCH, token is automatically calculated
 * 3. withdrawAll: Withdraw all liquidity
 */
export interface RemoveLiquidityParams {
    /** Token category */
    tokenCategory: string;
    /** Amount to remove (1-100) - BCH and token are automatically calculated */
    percentage?: number;
    /** Amount to remove (human format) - token is automatically calculated */
    bchAmount?: number;
    /** Withdraw all liquidity */
    withdrawAll?: boolean;
    /** Token decimal (optional) */
    tokenDecimals?: number;
}

/**
 * Remove liquidity options
 */
export interface RemoveLiquidityOptions {
    /** Pool owner token address */
    ownerTokenAddress: string;
}

/**
 * Remove liquidity result
 */
export interface RemoveLiquidityResult {
    success: boolean;
    error?: string;
    /** Unsigned TX template */
    unsignedTx?: UnsignedTxTemplate;
    /** Withdrawn BCH (human format) */
    bchWithdrawn: number;
    /** Withdrawn token (human format) */
    tokensWithdrawn: number;
    /** Remaining BCH */
    remainingBch: bigint;
    /** Remaining token */
    remainingTokens: bigint;
}
