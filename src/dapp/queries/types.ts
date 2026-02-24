import type { SwapDirection, SwapType } from '../types';

/**
 * User balance information
 */
export interface UserBalance {
    /** BCH balance (human readable) */
    bch: number;
    /** BCH balance (satoshi) */
    bchRaw: bigint;
    /** Token balances */
    tokens: TokenBalance[];
}

/**
 * Token balance
 */
export interface TokenBalance {
    category: string;
    symbol?: string;
    /** Token name from BCMR */
    name?: string;
    decimals: number;
    amount: number;
    amountRaw: bigint;
    /** Icon URL from BCMR (e.g. data.uris.icon) */
    iconUrl?: string;
}

/**
 * Pool summary
 */
export interface PoolSummary {
    poolAddress: string;
    poolOwnerPkhHex: string;
    tokenCategory: string;
    tokenSymbol?: string;
    /** Full token name from BCMR */
    tokenName?: string;
    tokenIconUrl?: string;
    bchReserve: number;
    tokenReserve: number;
    tokenPriceInBch: number;
}

/**
 * Registered pool owner
 */
export interface RegisteredPoolOwner {
    /** PKH (hex) */
    pkhHex: string;
    /** Address (optional) */
    address?: string;
    /** Label/name (optional) */
    label?: string;
    /** Registered at */
    registeredAt: number;
}

/**
 * All pools result
 */
export interface AllPoolsResult {
    /** Total pools */
    totalPools: number;
    /** Total BCH liquidity */
    totalBchLiquidity: number;
    /** Token based pool counts */
    tokenCounts: Map<string, number>;
    /** Pools */
    pools: PoolSummary[];
}

/**
 * Swap estimation result
 */
export interface SwapEstimate {
    /** Is the operation possible? */
    valid: boolean;
    /** Error message (if valid=false) */
    error?: string;
    /** Amount to send (human readable) */
    inputAmount: number;
    /** Amount to receive (human readable) */
    outputAmount: number;
    /** Effective price */
    effectivePrice: number;
    /** Spot price (before swap) */
    spotPrice: number;
    /** Price impact (%) */
    priceImpact: number;
    /** Fee amount */
    fee: number;
}

/**
 * Pool information
 */
export interface PoolInfo {
    /** Token category */
    tokenCategory: string;
    /** Token symbol */
    tokenSymbol?: string;
    /** Token decimal */
    tokenDecimals: number;
    
    /** Pool owner PKH (hex) */
    poolOwnerPkhHex: string;
    /** Pool contract address */
    poolAddress: string;
    
    // Reserves (human readable)
    bchReserve: number;
    tokenReserve: number;
    
    // Reserves (raw)
    bchReserveRaw: bigint;
    tokenReserveRaw: bigint;
    
    // Prices
    tokenPriceInBch: number;
    bchPriceInToken: number;
    
    // AMM values
    kValue: bigint;
    
    // UTXO information
    utxoTxid: string;
    utxoVout: number;
}

/**
 * All pools result
 */
export interface PoolInfoResult {
    contractAddress: string;
    network: string;
    totalBch: number;
    totalBchRaw: bigint;
    pools: PoolInfo[];
}

/**
* Price information
 */
export interface PriceInfo {
    /** Spot price (1 token = x BCH) */
    tokenPriceInBch: number;
    
    /** Spot price (1 BCH = x token) */
    bchPriceInToken: number;
    
    /** 24h change (if available) */
    change24h?: number;
    
    /** Pool liquidity (BCH) */
    liquidityBch: number;
    
    /** Pool liquidity (Token) */
    liquidityToken: number;
}

/**
 * Quote parameters
 */
export interface QuoteParams {
    tokenCategory: string;
    tokenDecimals?: number;
    
    /** Swap direction */
    direction: SwapDirection;
    
    /** Swap type */
    swapType: SwapType;
    
    /** Amount (exact_input: input, exact_output: output) */
    amount: number;
    
    /** Slippage tolerance (%) */
    slippageTolerance?: number;
}

/**
 * Price quote
 */
export interface PriceQuote {
    // Input
    inputAmount: number;
    inputAmountRaw: bigint;
    inputType: 'bch' | 'token';
    
    // Output
    outputAmount: number;
    outputAmountRaw: bigint;
    outputType: 'bch' | 'token';
    
    // Price impact
    priceImpact: number;
    
    // Fees
    feeAmount: number;
    feeAmountRaw: bigint;
    
    // Effective price
    effectivePrice: number;
    
    // Minimum/maximum (based on slippage)
    minimumReceived?: number;
    maximumSent?: number;
}

/**
 * Get price params
 */
export interface GetPriceParams {
    /** Pool owner PKH */
    poolOwnerPkh: Uint8Array;
    /** Token category */
    tokenCategory: string;
    /** Token decimal (optional) */
    tokenDecimals?: number;
}

/**
 * Get quote params
 */
export interface GetQuoteParams extends QuoteParams {
    /** Pool owner PKH */
    poolOwnerPkh: Uint8Array;
}

/**
 * TX history item
 */
export interface TxHistoryItem {
    txid: string;
    blockHeight: number;
    explorerUrl: string;
}

/**
 * TX history result
 */
export interface TxHistoryResult {
    transactions: TxHistoryItem[];
    total: number;
    hasMore: boolean;
    nextCursor?: number;
}

/**
 * Get TX history params
 */
export interface GetTxHistoryParams {
    address: string;
    limit?: number;
    cursor?: number;
}
