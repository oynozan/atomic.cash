import { SwapDirection, SwapType } from '../types';
import type { UnsignedTxTemplate } from '../types';
/**
 * Swap parameters (base)
 */
export interface SwapParamsBase {
    /** Token category */
    tokenCategory: string;
    /** Token decimal (optional) */
    tokenDecimals?: number;
    /** Slippage tolerance (%) - default: 0.5 */
    slippageTolerance?: number;
}

/**
 * Swap options
 */
export interface SwapOptions {
    /** Pool owner PKH (which pool to use) */
    poolOwnerPkh: Uint8Array;
    /** User public key */
    userPublicKey: Uint8Array;
    /** User token address */
    userAddress: string;
}

/**
 * swapExactBchForTokens parameters
 * Send exact BCH → Minimum token receive
 */
export interface SwapExactBchForTokensParams extends SwapParamsBase {
    /** Amount to send (human format) */
    bchAmount: number;
    /** Minimum token to receive (optional, calculated with slippage) */
    minTokens?: number;
}

/**
 * swapBchForExactTokens parameters
 * Send maximum BCH → Exact token receive
 */
export interface SwapBchForExactTokensParams extends SwapParamsBase {
    /** Amount to receive (human format) */
    tokenAmount: number;
    /** Maximum BCH to send (optional) */
    maxBch?: number;
}

/**
 * swapExactTokensForBch parameters
 * Send exact token → Minimum BCH receive
 */
export interface SwapExactTokensForBchParams extends SwapParamsBase {
    /** Amount to send (human format) */
    tokenAmount: number;
    /** Minimum BCH to receive (optional) */
    minBch?: number;
}

/**
 * swapTokensForExactBch parameters
 * Send maximum token → Exact BCH receive
 */
export interface SwapTokensForExactBchParams extends SwapParamsBase {
    /** Amount to receive (human format) */
    bchAmount: number;
    /** Maximum token to send (optional) */
    maxTokens?: number;
}

/**
 * Quote information
 */
export interface SwapQuote {
    inputAmount: number;
    outputAmount: number;
    priceImpact: number;
    effectivePrice: number;
    fee: number;
}

/**
 * Swap result
 */
export interface SwapResult {
    success: boolean;
    error?: string;
    /** Swap direction */
    direction: SwapDirection;
    /** Swap type */
    swapType: SwapType;
    /** Input amount (human format) */
    inputAmount: number;
    /** Input amount (raw) */
    inputAmountRaw: bigint;
    /** Output amount (human format) */
    outputAmount: number;
    /** Output amount (raw) */
    outputAmountRaw: bigint;
    /** Price impact (%) */
    priceImpact: number;
    /** Effective price */
    effectivePrice: number;
    /** New pool BCH */
    newPoolBch?: bigint;
    /** New pool tokens */
    newPoolTokens?: bigint;
    /** Quote details */
    quote: SwapQuote;
    /** Unsigned TX template */
    unsignedTx?: UnsignedTxTemplate;
}

/**
 * Route quote (single pool)
 */
export interface RouteQuote {
    /** Pool owner PKH (hex) */
    poolOwnerPkhHex: string;
    /** Pool address */
    poolAddress: string;
    /** Input amount */
    inputAmount: number;
    /** Output amount */
    outputAmount: number;
    /** Effective price */
    effectivePrice: number;
    /** Price impact (%) */
    priceImpact: number;
    /** Pool BCH */
    poolBch: number;
    /** Pool tokens */
    poolTokens: number;
}

/**
 * Best route result
 */
export interface BestRouteResult {
    /** Best route */
    bestRoute: RouteQuote | null;
    /** All routes (sorted - from best to worst) */
    allRoutes: RouteQuote[];
    /** No route found? */
    noRouteFound: boolean;
    /** Error message */
    error?: string;
}

/**
 * Split route result
 */
export interface SplitRouteResult {
    /** Split routes */
    routes: Array<RouteQuote & { percentage: number }>;
    /** Total output */
    totalOutput: number;
    /** Average effective price */
    avgEffectivePrice: number;
    /** Single pool output */
    singlePoolOutput: number;
    /** Split routing advantage (%) */
    splitAdvantage: number;
}
