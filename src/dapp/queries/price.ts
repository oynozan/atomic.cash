import {
    getExchangeContract,
    satoshiToBch,
    bchToSatoshi,
    tokenToOnChain,
    tokenFromOnChain,
    ensureTokenDecimals,
    getInputPrice,
    getOutputPrice,
    calculatePriceImpact,
    bytesToHex,
} from "../common";
import type { Utxo } from "cashscript";
import { cache } from "@/lib/cache";

import { SwapDirection, SwapType } from "../types";
import type { PriceQuote, PriceInfo, GetPriceParams, GetQuoteParams } from "./types";

const POOL_UTXO_CACHE_TTL_MS = 10_000;

async function getPoolUtxo(poolOwnerPkh: Uint8Array, tokenCategory: string) {
    const key = `poolUtxo:${bytesToHex(poolOwnerPkh)}:${tokenCategory}`;
    const cached = cache.get<Utxo | null>(key);
    if (cached !== undefined) {
        return cached;
    }

    const contract = getExchangeContract(poolOwnerPkh);
    const utxos = await contract.getUtxos();
    const utxo = utxos.find(u => u.token?.category === tokenCategory) ?? null;
    cache.set<Utxo | null>(key, utxo, POOL_UTXO_CACHE_TTL_MS);
    return utxo;
}
/**
 * Get current price
 *
 * @example
 * ```ts
 * const price = await getPrice({
 *   poolOwnerPkh: ownerPkh,
 *   tokenCategory: '1d2aad...',
 * });
 * ```
 */
export async function getPrice(params: GetPriceParams): Promise<PriceInfo | null> {
    const { poolOwnerPkh, tokenCategory, tokenDecimals } = params;

    await ensureTokenDecimals(tokenCategory, tokenDecimals);

    const poolUtxo = await getPoolUtxo(poolOwnerPkh, tokenCategory);

    if (!poolUtxo || !poolUtxo.token) {
        return null;
    }

    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;

    // Spot price (direct ratio - preserved in liquidity addition)
    // AMM formula gives incorrect results for large amounts, spot price is more accurate
    const liquidityBch = satoshiToBch(poolBch);
    const liquidityToken = tokenFromOnChain(poolTokens, tokenCategory);

    // 1 Token = x BCH
    const tokenPriceInBch = liquidityBch / liquidityToken;

    // 1 BCH = x Token
    const bchPriceInToken = liquidityToken / liquidityBch;

    return {
        tokenPriceInBch,
        bchPriceInToken,
        liquidityBch,
        liquidityToken,
    };
}

/**
 * Get quote for a swap
 *
 * @example
 * ```ts
 * const quote = await getQuote({
 *   poolOwnerPkh: ownerPkh,
 *   tokenCategory: '1d2aad...',
 *   direction: SwapDirection.BCH_TO_TOKEN,
 *   swapType: SwapType.EXACT_INPUT,
 *   amount: 0.1,
 * });
 * ```
 */
export async function getQuote(params: GetQuoteParams): Promise<PriceQuote | null> {
    const {
        poolOwnerPkh,
        tokenCategory,
        tokenDecimals,
        direction,
        swapType,
        amount,
        slippageTolerance = 0.5,
    } = params;

    await ensureTokenDecimals(tokenCategory, tokenDecimals);

    const poolUtxo = await getPoolUtxo(poolOwnerPkh, tokenCategory);

    if (!poolUtxo || !poolUtxo.token) {
        return null;
    }

    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;

    let inputAmountRaw: bigint;
    let outputAmountRaw: bigint;
    let inputType: "bch" | "token";
    let outputType: "bch" | "token";

    // Calculate based on direction and type
    if (direction === SwapDirection.BCH_TO_TOKEN) {
        inputType = "bch";
        outputType = "token";

        if (swapType === SwapType.EXACT_INPUT) {
            inputAmountRaw = bchToSatoshi(amount);
            outputAmountRaw = getInputPrice(inputAmountRaw, poolBch, poolTokens);
        } else {
            outputAmountRaw = tokenToOnChain(amount, tokenCategory);
            inputAmountRaw = getOutputPrice(outputAmountRaw, poolBch, poolTokens);
        }
    } else {
        inputType = "token";
        outputType = "bch";

        if (swapType === SwapType.EXACT_INPUT) {
            inputAmountRaw = tokenToOnChain(amount, tokenCategory);
            outputAmountRaw = getInputPrice(inputAmountRaw, poolTokens, poolBch);
        } else {
            outputAmountRaw = bchToSatoshi(amount);
            inputAmountRaw = getOutputPrice(outputAmountRaw, poolTokens, poolBch);
        }
    }

    // Readable values
    const inputAmount =
        inputType === "bch"
            ? satoshiToBch(inputAmountRaw)
            : tokenFromOnChain(inputAmountRaw, tokenCategory);

    const outputAmount =
        outputType === "bch"
            ? satoshiToBch(outputAmountRaw)
            : tokenFromOnChain(outputAmountRaw, tokenCategory);

    // Price impact
    const inputReserve = direction === SwapDirection.BCH_TO_TOKEN ? poolBch : poolTokens;
    const priceImpact = calculatePriceImpact(inputAmountRaw, inputReserve);

    // Fee (0.3%)
    const feeAmountRaw = (inputAmountRaw * 3n) / 1000n;
    const feeAmount =
        inputType === "bch"
            ? satoshiToBch(feeAmountRaw)
            : tokenFromOnChain(feeAmountRaw, tokenCategory);

    // Effective price
    const effectivePrice = inputAmount / outputAmount;

    // Slippage
    const slippageMultiplier = BigInt(Math.floor((100 - slippageTolerance) * 10));
    const minimumReceivedRaw = (outputAmountRaw * slippageMultiplier) / 1000n;
    const minimumReceived =
        outputType === "bch"
            ? satoshiToBch(minimumReceivedRaw)
            : tokenFromOnChain(minimumReceivedRaw, tokenCategory);

    const maxSlippageMultiplier = BigInt(Math.floor((100 + slippageTolerance) * 10));
    const maximumSentRaw = (inputAmountRaw * maxSlippageMultiplier) / 1000n;
    const maximumSent =
        inputType === "bch"
            ? satoshiToBch(maximumSentRaw)
            : tokenFromOnChain(maximumSentRaw, tokenCategory);

    return {
        inputAmount,
        inputAmountRaw,
        inputType,
        outputAmount,
        outputAmountRaw,
        outputType,
        priceImpact,
        feeAmount,
        feeAmountRaw,
        effectivePrice,
        minimumReceived: swapType === SwapType.EXACT_INPUT ? minimumReceived : undefined,
        maximumSent: swapType === SwapType.EXACT_OUTPUT ? maximumSent : undefined,
    };
}

/**
 * Get quotes for multiple amounts (for UI)
 */
export async function getQuotes(
    poolOwnerPkh: Uint8Array,
    tokenCategory: string,
    direction: SwapDirection,
    amounts: number[],
    tokenDecimals?: number,
): Promise<(PriceQuote | null)[]> {
    const quotes: (PriceQuote | null)[] = [];

    for (const amount of amounts) {
        const quote = await getQuote({
            poolOwnerPkh,
            tokenCategory,
            tokenDecimals,
            direction,
            swapType: SwapType.EXACT_INPUT,
            amount,
        });
        quotes.push(quote);
    }

    return quotes;
}
