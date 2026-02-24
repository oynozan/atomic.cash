// Simplified swap estimation functions

import {
    getExchangeContract,
    bchToSatoshi,
    satoshiToBch,
    tokenToOnChain,
    tokenFromOnChain,
    ensureTokenDecimals,
    getInputPrice,
    getOutputPrice,
} from '../common';
import type { SwapEstimate } from './types';

/**
 * BCH → Token swap estimation
 * 
 * @param poolOwnerPkh - Pool owner PKH
 * @param tokenCategory - Token category
 * @param bchAmount - Amount to send (human readable)
 * @returns Swap estimation
 * 
 * @example
 * ```ts
 * const estimate = await estimateBchToToken(pkh, category, 0.01);
 * ```
 */
export async function estimateBchToToken(
    poolOwnerPkh: Uint8Array,
    tokenCategory: string,
    bchAmount: number,
    tokenDecimals?: number
): Promise<SwapEstimate> {
    await ensureTokenDecimals(tokenCategory, tokenDecimals);
    
    const contract = getExchangeContract(poolOwnerPkh);
    const utxos = await contract.getUtxos();
    const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
    
    if (!poolUtxo || !poolUtxo.token) {
        return {
            valid: false,
            error: 'Pool not found! Create a pool first with createPool.',
            inputAmount: bchAmount,
            outputAmount: 0,
            effectivePrice: 0,
            spotPrice: 0,
            priceImpact: 0,
            fee: 0,
        };
    }
    
    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;
    
    const inputRaw = bchToSatoshi(bchAmount);
    const outputRaw = getInputPrice(inputRaw, poolBch, poolTokens);
    const outputAmount = tokenFromOnChain(outputRaw, tokenCategory);
    
    const effectivePrice = bchAmount / outputAmount; // BCH per token (human)
    
    // Calculate price impact
    const spotPriceHuman = satoshiToBch(poolBch) / tokenFromOnChain(poolTokens, tokenCategory);
    const priceImpact = ((effectivePrice - spotPriceHuman) / spotPriceHuman) * 100;
    
    const fee = bchAmount * 0.003;
    
    return {
        valid: true,
        inputAmount: bchAmount,
        outputAmount,
        effectivePrice,
        spotPrice: spotPriceHuman,
        priceImpact: Math.abs(priceImpact),
        fee,
    };
}

/**
 * Token → BCH swap estimation
 * 
 * @param poolOwnerPkh - Pool owner PKH
 * @param tokenCategory - Token category
 * @param tokenAmount - Amount to send (human readable)
 * @returns Swap estimation
 */
export async function estimateTokenToBch(
    poolOwnerPkh: Uint8Array,
    tokenCategory: string,
    tokenAmount: number,
    tokenDecimals?: number
): Promise<SwapEstimate> {
    await ensureTokenDecimals(tokenCategory, tokenDecimals);
    
    const contract = getExchangeContract(poolOwnerPkh);
    const utxos = await contract.getUtxos();
    const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
    
    if (!poolUtxo || !poolUtxo.token) {
        return {
            valid: false,
            error: 'Pool not found! Create a pool first with createPool.',
            inputAmount: tokenAmount,
            outputAmount: 0,
            effectivePrice: 0,
            spotPrice: 0,
            priceImpact: 0,
            fee: 0,
        };
    }
    
    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;
    
    const inputRaw = tokenToOnChain(tokenAmount, tokenCategory);
    const outputRaw = getInputPrice(inputRaw, poolTokens, poolBch);
    const outputAmount = satoshiToBch(outputRaw);
    
    const spotPriceHuman = satoshiToBch(poolBch) / tokenFromOnChain(poolTokens, tokenCategory);
    const effectivePrice = outputAmount / tokenAmount; // BCH per token
    
    const priceImpact = ((spotPriceHuman - effectivePrice) / spotPriceHuman) * 100;
    
    const fee = tokenAmount * 0.003;
    
    return {
        valid: true,
        inputAmount: tokenAmount,
        outputAmount,
        effectivePrice,
        spotPrice: spotPriceHuman,
        priceImpact: Math.abs(priceImpact),
        fee,
    };
}

/**
 * Estimate BCH for exact tokens
 */
export async function estimateBchForExactTokens(
    poolOwnerPkh: Uint8Array,
    tokenCategory: string,
    tokenAmount: number,
    tokenDecimals?: number
): Promise<SwapEstimate> {
    await ensureTokenDecimals(tokenCategory, tokenDecimals);
    
    const contract = getExchangeContract(poolOwnerPkh);
    const utxos = await contract.getUtxos();
    const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
    
    if (!poolUtxo || !poolUtxo.token) {
        return {
            valid: false,
            error: 'Pool not found! Create a pool first with createPool.',
            inputAmount: 0,
            outputAmount: tokenAmount,
            effectivePrice: 0,
            spotPrice: 0,
            priceImpact: 0,
            fee: 0,
        };
    }
    
    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;
    
    const outputRaw = tokenToOnChain(tokenAmount, tokenCategory);
    
    // Does the pool have enough tokens?
    if (outputRaw >= poolTokens) {
        return {
            valid: false,
            error: 'Pool does not have enough tokens!',
            inputAmount: 0,
            outputAmount: tokenAmount,
            effectivePrice: 0,
            spotPrice: satoshiToBch(poolBch) / tokenFromOnChain(poolTokens, tokenCategory),
            priceImpact: 100,
            fee: 0,
        };
    }
    
    const inputRaw = getOutputPrice(outputRaw, poolBch, poolTokens);
    const inputAmount = satoshiToBch(inputRaw);
    
    const spotPriceHuman = satoshiToBch(poolBch) / tokenFromOnChain(poolTokens, tokenCategory);
    const effectivePrice = inputAmount / tokenAmount;
    
    const priceImpact = ((effectivePrice - spotPriceHuman) / spotPriceHuman) * 100;
    
    const fee = inputAmount * 0.003;
    
    return {
        valid: true,
        inputAmount,
        outputAmount: tokenAmount,
        effectivePrice,
        spotPrice: spotPriceHuman,
        priceImpact: Math.abs(priceImpact),
        fee,
    };
}

/**
 * Estimate tokens for exact BCH
 */
export async function estimateTokensForExactBch(
    poolOwnerPkh: Uint8Array,
    tokenCategory: string,
    bchAmount: number,
    tokenDecimals?: number
): Promise<SwapEstimate> {
    await ensureTokenDecimals(tokenCategory, tokenDecimals);
    
    const contract = getExchangeContract(poolOwnerPkh);
    const utxos = await contract.getUtxos();
    const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
    
    if (!poolUtxo || !poolUtxo.token) {
        return {
            valid: false,
            error: 'Pool not found! Create a pool first with createPool.',
            inputAmount: 0,
            outputAmount: bchAmount,
            effectivePrice: 0,
            spotPrice: 0,
            priceImpact: 0,
            fee: 0,
        };
    }
    
    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;
    
    const outputRaw = bchToSatoshi(bchAmount);
    
    // Does the pool have enough BCH?
    if (outputRaw >= poolBch) {
        return {
            valid: false,
            error: 'Pool does not have enough BCH!',
            inputAmount: 0,
            outputAmount: bchAmount,
            effectivePrice: 0,
            spotPrice: satoshiToBch(poolBch) / tokenFromOnChain(poolTokens, tokenCategory),
            priceImpact: 100,
            fee: 0,
        };
    }
    
    const inputRaw = getOutputPrice(outputRaw, poolTokens, poolBch);
    const inputAmount = tokenFromOnChain(inputRaw, tokenCategory);
    
    const spotPriceHuman = satoshiToBch(poolBch) / tokenFromOnChain(poolTokens, tokenCategory);
    const effectivePrice = bchAmount / inputAmount;
    
    const priceImpact = ((spotPriceHuman - effectivePrice) / spotPriceHuman) * 100;
    
    const fee = inputAmount * 0.003;
    
    return {
        valid: true,
        inputAmount,
        outputAmount: bchAmount,
        effectivePrice,
        spotPrice: spotPriceHuman,
        priceImpact: Math.abs(priceImpact),
        fee,
    };
}
