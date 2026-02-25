// Only the pool owner can add liquidity.
// The ratio is preserved - the price does not change.
//
// Usage:
// - if bchAmount is provided, tokenAmount is automatically calculated
// - if tokenAmount is provided, bchAmount is automatically calculated

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
} from "../common";

import { DEFAULT_MINER_FEE } from "../config";
import type { UnsignedTxTemplate, UtxoInput, TxOutput } from "../types";
import type { AddLiquidityParams, AddLiquidityOptions, AddLiquidityResult } from "./types";
import { addressToPkh } from "../queries/user";

/**
 * Add liquidity to the pool (ratio is preserved)
 *
 * @example
 * ```ts
 * await addLiquidity(
 *   { tokenCategory, bchAmount: 0.01 },
 *   { ownerPublicKey, ownerTokenAddress }
 * );
 *
 * await addLiquidity(
 *   { tokenCategory, tokenAmount: 100 },
 *   { ownerPublicKey, ownerTokenAddress }
 * );
 * ```
 */
export async function addLiquidity(
    params: AddLiquidityParams,
    options: AddLiquidityOptions,
): Promise<AddLiquidityResult> {
    const { tokenCategory, bchAmount, tokenAmount } = params;
    const { ownerTokenAddress } = options;

    // At least one must be provided
    if (bchAmount === undefined && tokenAmount === undefined) {
        return createErrorResult("bchAmount or tokenAmount must be provided!");
    }

    // Contract (derive PKH from owner address)
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

    // Calculate the ratio: tokenAmount / bchAmount = currentTokens / currentBch
    // So: tokenAmount = bchAmount * (currentTokens / currentBch)
    // Or: bchAmount = tokenAmount * (currentBch / currentTokens)

    let bchToAdd: bigint;
    let tokensToAdd: bigint;

    if (bchAmount !== undefined) {
        // BCH provided, calculate token
        bchToAdd = bchToSatoshi(bchAmount);
        tokensToAdd = (bchToAdd * currentTokens) / currentBch;
    } else {
        // Token provided, calculate BCH
        tokensToAdd = tokenToOnChain(tokenAmount!, tokenCategory);
        bchToAdd = (tokensToAdd * currentBch) / currentTokens;
    }

    const bchToAddHuman = satoshiToBch(bchToAdd);
    const tokensToAddHuman = tokenFromOnChain(tokensToAdd, tokenCategory);

    // Owner UTXOs (use token-aware address for fetching UTXOs)
    const ownerTokenAddressTokenAware = toTokenAddress(ownerTokenAddress);
    const ownerUtxos = await provider.getUtxos(ownerTokenAddressTokenAware);
    const bchUtxos = filterBchUtxos(ownerUtxos);
    const tokenUtxos = filterTokenUtxos(ownerUtxos, tokenCategory);

    const totalBch = bchUtxos.reduce((sum, u) => sum + u.satoshis, 0n);
    const totalTokens = tokenUtxos.reduce((sum, u) => sum + (u.token?.amount || 0n), 0n);

    const minerFee = DEFAULT_MINER_FEE;

    if (totalBch < bchToAdd + minerFee) {
        return createErrorResult(
            `Insufficient BCH! Required: ${satoshiToBch(bchToAdd + minerFee)}, Current: ${satoshiToBch(totalBch)}`,
        );
    }

    if (totalTokens < tokensToAdd) {
        return createErrorResult(
            `Insufficient token! Required: ${tokensToAddHuman}, Current: ${tokenFromOnChain(totalTokens, tokenCategory)}`,
        );
    }

    // New pool values
    const newPoolBch = currentBch + bchToAdd;
    const newPoolTokens = currentTokens + tokensToAdd;

    // Create unsigned TX template
    const inputs: UtxoInput[] = [];
    const outputs: TxOutput[] = [];

    // Input 0: Current pool
    inputs.push({
        txid: poolUtxo.txid,
        vout: poolUtxo.vout,
        satoshis: poolUtxo.satoshis,
        token: {
            category: poolUtxo.token.category,
            amount: poolUtxo.token.amount,
        },
        type: "pool",
        unlockFunction: "addLiquidity",
    });

    // Add BCH UTXOs
    let addedBch = 0n;
    for (const utxo of bchUtxos) {
        if (addedBch >= bchToAdd + minerFee) break;
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
        if (addedTokens >= tokensToAdd) break;
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

    // Output 0: Updated pool
    outputs.push({
        to: contractTokenAddress,
        amount: newPoolBch,
        token: { category: tokenCategory, amount: newPoolTokens },
    });

    // BCH change
    const bchChange = addedBch - bchToAdd - minerFee;
    if (bchChange > 546n) {
        outputs.push({ to: ownerTokenAddressTokenAware, amount: bchChange });
    }

    // Token change
    const tokenChange = addedTokens - tokensToAdd;
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
        poolAddress: contractTokenAddress,
        poolOwnerPkhHex: bytesToHex(ownerPkh),
        minerFee,
        ownerAddress: ownerTokenAddressTokenAware,
    };

    return {
        success: true,
        unsignedTx,
        bchAdded: bchToAddHuman,
        tokensAdded: tokensToAddHuman,
        newPoolBch,
        newPoolTokens,
    };
}

function createErrorResult(error: string): AddLiquidityResult {
    return {
        success: false,
        error,
        bchAdded: 0,
        tokensAdded: 0,
        newPoolBch: 0n,
        newPoolTokens: 0n,
    };
}

export default addLiquidity;
