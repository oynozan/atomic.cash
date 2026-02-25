// Only the pool owner can remove liquidity.
// The ratio is preserved - the price does not change.
//
// Usage:
// - percentage: Remove %X of the pool (e.g. 50 = %50)
// - bchAmount: Remove specific BCH, token is calculated proportionally
// - withdrawAll: Withdraw all liquidity

import {
    provider,
    bchToSatoshi,
    satoshiToBch,
    tokenFromOnChain,
    getExchangeContract,
    filterBchUtxos,
    bytesToHex,
    toTokenAddress,
    ensureTokenDecimals,
} from "../common";

import { DEFAULT_MINER_FEE, DUST_LIMIT } from "../config";
import type { UnsignedTxTemplate, UtxoInput, TxOutput } from "../types";
import type { RemoveLiquidityParams, RemoveLiquidityOptions, RemoveLiquidityResult } from "./types";
import { addressToPkh } from "../queries/user";

/**
 * Remove liquidity from the pool (ratio is preserved)
 *
 * @example
 * ```ts
 * await removeLiquidity(
 *   { tokenCategory, percentage: 25 },
 *   { ownerPublicKey, ownerTokenAddress }
 * );
 *
 * await removeLiquidity(
 *   { tokenCategory, bchAmount: 0.01 },
 *   { ownerPublicKey, ownerTokenAddress }
 * );
 *
 * await removeLiquidity(
 *   { tokenCategory, withdrawAll: true },
 *   { ownerPublicKey, ownerTokenAddress }
 * );
 * ```
 */
export async function removeLiquidity(
    params: RemoveLiquidityParams,
    options: RemoveLiquidityOptions,
): Promise<RemoveLiquidityResult> {
    const { tokenCategory, percentage, bchAmount, withdrawAll = false, tokenDecimals } = params;
    const { ownerTokenAddress } = options;

    // Ensure token decimals are initialized before using tokenFromOnChain.
    await ensureTokenDecimals(tokenCategory, tokenDecimals);

    // At least one must be provided
    if (!withdrawAll && percentage === undefined && bchAmount === undefined) {
        return createErrorResult("percentage, bchAmount or withdrawAll must be provided!");
    }

    // Contract
    const ownerPkh = addressToPkh(ownerTokenAddress);
    if (!ownerPkh) {
        return createErrorResult("Invalid owner token address");
    }
    const contract = getExchangeContract(ownerPkh);
    const contractTokenAddress = contract.tokenAddress;

    // Current pool
    const utxos = await contract.getUtxos();
    const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);

    if (!poolUtxo || !poolUtxo.token) {
        return createErrorResult("Pool not found! Create a pool first with createPool.");
    }

    const currentBch = poolUtxo.satoshis;
    const currentTokens = poolUtxo.token.amount;

    // Calculate the amounts to withdraw
    let bchToWithdraw: bigint;
    let tokensToWithdraw: bigint;

    if (withdrawAll) {
        // Withdraw all (except dust limit)
        bchToWithdraw = currentBch - DUST_LIMIT;
        tokensToWithdraw = currentTokens;
    } else if (percentage !== undefined) {
        // Percentage based withdrawal
        if (percentage <= 0 || percentage > 100) {
            return createErrorResult("Percentage must be between 1 and 100!");
        }

        bchToWithdraw = (currentBch * BigInt(percentage)) / 100n;
        tokensToWithdraw = (currentTokens * BigInt(percentage)) / 100n;
    } else {
        // BCH based withdrawal - token is calculated proportionally
        bchToWithdraw = bchToSatoshi(bchAmount!);
        // Oran: tokensToWithdraw / bchToWithdraw = currentTokens / currentBch
        tokensToWithdraw = (bchToWithdraw * currentTokens) / currentBch;
    }

    const bchToWithdrawHuman = satoshiToBch(bchToWithdraw);
    const tokensToWithdrawHuman = tokenFromOnChain(tokensToWithdraw, tokenCategory);

    // Checks
    const minerFee = DEFAULT_MINER_FEE;
    const remainingBch = currentBch - bchToWithdraw;
    const remainingTokens = currentTokens - tokensToWithdraw;

    if (!withdrawAll && remainingBch < DUST_LIMIT) {
        return createErrorResult(
            `Pool must have at least ${satoshiToBch(DUST_LIMIT)} BCH! use withdrawAll.`,
        );
    }

    if (bchToWithdraw > currentBch || tokensToWithdraw > currentTokens) {
        return createErrorResult("Pool does not have enough liquidity!");
    }

    // For fee, add BCH UTXOs
    // Use token-aware address when fetching UTXOs and creating token outputs
    const ownerTokenAddressTokenAware = toTokenAddress(ownerTokenAddress);
    const ownerUtxos = await provider.getUtxos(ownerTokenAddressTokenAware);
    const bchUtxos = filterBchUtxos(ownerUtxos);

    // Unsigned TX Template
    const inputs: UtxoInput[] = [];
    const outputs: TxOutput[] = [];

    // Input 0: Pool UTXO
    inputs.push({
        txid: poolUtxo.txid,
        vout: poolUtxo.vout,
        satoshis: poolUtxo.satoshis,
        token: {
            category: poolUtxo.token.category,
            amount: poolUtxo.token.amount,
        },
        type: "pool",
        unlockFunction: "removeLiquidity",
    });

    // For fee, add BCH UTXOs
    let addedBch = 0n;
    for (const utxo of bchUtxos) {
        if (addedBch >= minerFee) break;
        inputs.push({
            txid: utxo.txid,
            vout: utxo.vout,
            satoshis: utxo.satoshis,
            type: "user",
        });
        addedBch += utxo.satoshis;
    }

    // Full withdrawal or partial withdrawal?
    const isFullWithdraw = withdrawAll || remainingTokens === 0n;

    if (isFullWithdraw) {
        // Pool is being closed - all values go to the owner
        // Output 0: Owner BCH
        outputs.push({
            to: ownerTokenAddressTokenAware,
            amount: currentBch + addedBch - minerFee,
        });

        // Output 1: Owner token
        outputs.push({
            to: ownerTokenAddressTokenAware,
            amount: 1000n,
            token: { category: tokenCategory, amount: currentTokens },
        });
    } else {
        // Partial withdrawal - pool continues
        // Output 0: Updated pool
        outputs.push({
            to: contractTokenAddress,
            amount: remainingBch,
            token: { category: tokenCategory, amount: remainingTokens },
        });

        // Output 1: Owner BCH
        const bchToOwner = bchToWithdraw + addedBch - minerFee;
        if (bchToOwner > 546n) {
            outputs.push({ to: ownerTokenAddressTokenAware, amount: bchToOwner });
        }

        // Output 2: Owner token
        if (tokensToWithdraw > 0n) {
            outputs.push({
                to: ownerTokenAddressTokenAware,
                amount: 1000n,
                token: { category: tokenCategory, amount: tokensToWithdraw },
            });
        }
    }

    const unsignedTx: UnsignedTxTemplate = {
        inputs,
        outputs,
        poolAddress: contractTokenAddress,
        poolOwnerPkhHex: bytesToHex(ownerPkh),
        minerFee,
        ownerAddress: ownerTokenAddressTokenAware,
    };

    return {
        success: true,
        unsignedTx,
        bchWithdrawn: bchToWithdrawHuman,
        tokensWithdrawn: tokensToWithdrawHuman,
        remainingBch: isFullWithdraw ? 0n : remainingBch,
        remainingTokens: isFullWithdraw ? 0n : remainingTokens,
    };
}

function createErrorResult(error: string): RemoveLiquidityResult {
    return {
        success: false,
        error,
        bchWithdrawn: 0,
        tokensWithdrawn: 0,
        remainingBch: 0n,
        remainingTokens: 0n,
    };
}

export default removeLiquidity;
