// Each user creates their own pool.
// This function returns an UNSIGNED TX template.
// It is signed and broadcasted in the client.
//
// IMPORTANT: If there are other pools in the market, the new pool should be at the market price. Otherwise, you will be an arbitrage victim!

import { hexToBin } from "@bitauth/libauth";
import {
    provider,
    bchToSatoshi,
    satoshiToBch,
    tokenToOnChain,
    tokenFromOnChain,
    getExchangeContract,
    filterBchUtxos,
    filterTokenUtxos,
    bytesToHex,
    toTokenAddress,
    ensureTokenDecimals,
} from "../common";

import { DEFAULT_MINER_FEE } from "../config";
import { OperationType } from "../types";
import type { UnsignedTxTemplate, UtxoInput, TxOutput } from "../types";
import type { CreatePoolParams, CreatePoolOptions, CreatePoolResult } from "./types";
import { getRegisteredOwners } from "../queries/registry";
import { addressToPkh } from "../queries/user";

export async function getMarketPrice(tokenCategory: string): Promise<{
    hasMarket: boolean;
    avgPrice: number;
    totalLiquidity: number;
    poolCount: number;
} | null> {
    // Ensure token decimals are initialized before using tokenFromOnChain.
    await ensureTokenDecimals(tokenCategory);

    const owners = await getRegisteredOwners();
    if (owners.length === 0) return null;

    let totalBch = 0;
    let totalTokens = 0;
    let poolCount = 0;

    for (const owner of owners) {
        try {
            const pkh = hexToBin(owner.pkhHex);
            const contract = getExchangeContract(pkh);
            const utxos = await contract.getUtxos();

            const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
            if (!poolUtxo || !poolUtxo.token) continue;

            const bch = satoshiToBch(poolUtxo.satoshis);
            const tokens = tokenFromOnChain(poolUtxo.token.amount, tokenCategory);

            totalBch += bch;
            totalTokens += tokens;
            poolCount++;
        } catch {
            continue;
        }
    }

    if (poolCount === 0) return null;

    return {
        hasMarket: true,
        avgPrice: totalBch / totalTokens, // BCH per token
        totalLiquidity: totalBch,
        poolCount,
    };
}

/**
 * Create new liquidity pool
 *
 * @returns Unsigned TX template - to be signed and broadcasted in the client
 *
 * @example
 * ```ts
 * const result = await createPool(
 *   { tokenCategory: '1d2aad...', bchAmount: 0.1, tokenAmount: 1000 },
 *   { ownerPublicKey, ownerTokenAddress }
 * );
 *
 * const result = await createPool(
 *   { tokenCategory: '1d2aad...', bchAmount: 0.1, useMarketPrice: true },
 *   { ownerPublicKey, ownerTokenAddress }
 * );
 * ```
 */
export async function createPool(
    params: CreatePoolParams,
    options: CreatePoolOptions,
): Promise<CreatePoolResult> {
    const {
        tokenCategory,
        priceDeviationTolerance = 1, // default %1
        useMarketPrice = false,
    } = params;
    let { bchAmount, tokenAmount } = params;
    const { ownerTokenAddress } = options;

    const marketInfo = await getMarketPrice(tokenCategory);
    let marketPrice: number | undefined;
    let priceDeviation: number | undefined;

    if (marketInfo && marketInfo.hasMarket) {
        marketPrice = marketInfo.avgPrice;

        if (useMarketPrice) {
            // For market pools, user must provide exactly one side
            const hasBch = bchAmount !== undefined;
            const hasToken = tokenAmount !== undefined;
            if ((hasBch && hasToken) || (!hasBch && !hasToken)) {
                return {
                    success: false,
                    error: "Provide ONLY bchAmount OR tokenAmount when market pools exist.",
                };
            }

            if (bchAmount !== undefined && tokenAmount === undefined) {
                tokenAmount = bchAmount / marketPrice;
            } else if (tokenAmount !== undefined && bchAmount === undefined) {
                bchAmount = tokenAmount * marketPrice;
            }
        } else {
            // Manual price: require both amounts and enforce deviation tolerance
            if (bchAmount !== undefined && tokenAmount !== undefined) {
                const proposedPrice = bchAmount / tokenAmount;
                priceDeviation = (Math.abs(proposedPrice - marketPrice) / marketPrice) * 100;

                if (priceDeviation > priceDeviationTolerance) {
                    return {
                        success: false,
                        error: `Price deviation is too high: ${priceDeviation.toFixed(2)}%`,
                    };
                }
            }
        }
    }

    // Amount check
    if (bchAmount === undefined || tokenAmount === undefined) {
        const error =
            marketInfo && marketInfo.hasMarket
                ? "Provide ONLY bchAmount OR tokenAmount when market pools exist."
                : "Both bchAmount and tokenAmount are required for the first pool.";
        return { success: false, error };
    }

    // Convert to on-chain values
    const bchAmountRaw = bchToSatoshi(bchAmount);
    const tokenAmountRaw = tokenToOnChain(tokenAmount, tokenCategory);

    // Create contract with pool owner PKH (from address)
    const ownerPkh = addressToPkh(ownerTokenAddress);
    if (!ownerPkh) {
        return { success: false, error: "Invalid owner token address" };
    }
    const contract = getExchangeContract(ownerPkh);
    const contractAddress = contract.address;
    const contractTokenAddress = contract.tokenAddress; // Token supported address

    // Check if pool already exists (own pool)
    const existingUtxos = await contract.getUtxos();
    const existingPool = existingUtxos.find(u => u.token?.category === tokenCategory);

    if (existingPool) {
        const error = "Pool already exists for this token! use addLiquidity instead.";
        return { success: false, error };
    }

    // Owner UTXOs
    const ownerTokenAddressTokenAware = toTokenAddress(ownerTokenAddress);

    const ownerUtxos = await provider.getUtxos(ownerTokenAddressTokenAware);
    const bchUtxos = filterBchUtxos(ownerUtxos);
    const tokenUtxos = filterTokenUtxos(ownerUtxos, tokenCategory);

    const totalBch = bchUtxos.reduce((sum, u) => sum + u.satoshis, 0n);
    const totalTokens = tokenUtxos.reduce((sum, u) => sum + (u.token?.amount || 0n), 0n);

    const minerFee = DEFAULT_MINER_FEE;

    // Balance check
    if (totalBch < bchAmountRaw + minerFee) {
        const error = `Insufficient BCH! Required: ${satoshiToBch(bchAmountRaw + minerFee)} BCH`;
        return { success: false, error };
    }

    if (totalTokens < tokenAmountRaw) {
        const error = `Insufficient token! Required: ${tokenAmount}`;
        return { success: false, error };
    }

    // Create unsigned TX template
    const inputs: UtxoInput[] = [];
    const outputs: TxOutput[] = [];

    // Add BCH UTXOs
    let addedBch = 0n;
    for (const utxo of bchUtxos) {
        if (addedBch >= bchAmountRaw + minerFee) break;
        inputs.push({
            txid: utxo.txid,
            vout: utxo.vout,
            satoshis: utxo.satoshis,
            type: "user",
        });
        addedBch += utxo.satoshis;
    }

    // Add Token UTXOs
    let addedTokens = 0n;
    for (const utxo of tokenUtxos) {
        if (addedTokens >= tokenAmountRaw) break;
        inputs.push({
            txid: utxo.txid,
            vout: utxo.vout,
            satoshis: utxo.satoshis,
            token: utxo.token
                ? {
                      category: utxo.token.category,
                      amount: utxo.token.amount,
                  }
                : undefined,
            type: "user",
        });
        addedTokens += utxo.token?.amount || 0n;
    }

    // Output 0: New pool (token supported address should be used!)
    outputs.push({
        to: contractTokenAddress,
        amount: bchAmountRaw,
        token: { category: tokenCategory, amount: tokenAmountRaw },
    });

    // Output 1: BCH change
    const bchChange = addedBch - bchAmountRaw - minerFee;
    if (bchChange > 546n) {
        outputs.push({ to: ownerTokenAddressTokenAware, amount: bchChange });
    }

    // Output 2: Token change
    const tokenChange = addedTokens - tokenAmountRaw;
    if (tokenChange > 0n) {
        outputs.push({
            to: ownerTokenAddressTokenAware,
            amount: 1000n,
            token: { category: tokenCategory, amount: tokenChange },
        });
    }

    const unsignedTx: UnsignedTxTemplate = {
        inputs,
        outputs,
        poolAddress: contractAddress,
        poolOwnerPkhHex: bytesToHex(ownerPkh),
        minerFee,
        operationType: OperationType.CREATE_POOL,
        ownerAddress: ownerTokenAddressTokenAware,
    };

    // Initial price
    const initialPrice = Number(bchAmountRaw) / Number(tokenAmountRaw);

    return {
        success: true,
        unsignedTx,
        poolBch: bchAmountRaw,
        poolTokens: tokenAmountRaw,
        poolAddress: contractAddress,
        initialPrice,
        marketPrice,
        priceDeviation,
        hasMarketPools: marketInfo?.hasMarket ?? false,
    };
}

export default createPool;
