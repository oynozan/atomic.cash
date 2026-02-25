// This functions return an UNSIGNED TX template.
// It is signed and broadcasted in the client.
//
// Flow:
// 1. Backend: swapExactBchForTokens() is called
// 2. Backend: returns unsignedTx template
// 3. Client: Create TX using the template
// 4. Client: Sign with own private key
// 5. Client: Broadcast the TX

import {
    provider,
    bchToSatoshi,
    satoshiToBch,
    tokenToOnChain,
    tokenFromOnChain,
    getExchangeContract,
    getInputPrice,
    getOutputPrice,
    calculatePriceImpact,
    filterBchUtxos,
    filterTokenUtxos,
    bytesToHex,
    toTokenAddress,
    ensureTokenDecimals,
} from "../common";

import { SwapDirection, SwapType } from "../types";
import type { UnsignedTxTemplate, UtxoInput, TxOutput } from "../types";
import type {
    SwapExactBchForTokensParams,
    SwapBchForExactTokensParams,
    SwapExactTokensForBchParams,
    SwapTokensForExactBchParams,
    SwapOptions,
    SwapResult,
} from "./types";

import { DEFAULT_MINER_FEE, DEFAULT_SLIPPAGE_TOLERANCE } from "../config";

async function getPoolUtxo(poolOwnerPkh: Uint8Array, tokenCategory: string) {
    const contract = getExchangeContract(poolOwnerPkh);
    const utxos = await contract.getUtxos();
    return {
        contract,
        contractTokenAddress: contract.tokenAddress, // Token supported address
        poolUtxo: utxos.find(u => u.token?.category === tokenCategory),
    };
}

/**
 * Swap exact BCH for tokens
 *
 * @returns Unsigned TX template - to be signed and broadcasted in the client
 *
 * @example
 * ```ts
 * const result = await swapExactBchForTokens(
 *   {
 *     tokenCategory: '1d2aad...',
 *     bchAmount: 0.1,
 *   },
 *   {
 *     poolOwnerPkh: poolOwnerPublicKeyHash,
 *     userPublicKey: wallet.publicKey,
 *     userAddress: wallet.tokenAddress,
 *   }
 * );
 *
 * ```
 */
export async function swapExactBchForTokens(
    params: SwapExactBchForTokensParams,
    options: SwapOptions,
): Promise<SwapResult> {
    const {
        tokenCategory,
        bchAmount,
        minTokens = 0,
        slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE,
    } = params;

    const { poolOwnerPkh, userAddress } = options;
    const tokenAddress = toTokenAddress(userAddress);

    // Ensure token decimals are initialized before using tokenToOnChain / tokenFromOnChain.
    await ensureTokenDecimals(tokenCategory);

    const bchAmountRaw = bchToSatoshi(bchAmount);

    // Get pool UTXO
    const { contractTokenAddress, poolUtxo } = await getPoolUtxo(poolOwnerPkh, tokenCategory);
    if (!poolUtxo || !poolUtxo.token) {
        return createErrorResult(
            "Pool not found!",
            SwapDirection.BCH_TO_TOKEN,
            SwapType.EXACT_INPUT,
        );
    }

    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;

    // Calculate output
    const tokensOut = getInputPrice(bchAmountRaw, poolBch, poolTokens);
    const tokensOutHuman = tokenFromOnChain(tokensOut, tokenCategory);

    // Slippage control
    const minTokensRaw =
        minTokens > 0
            ? tokenToOnChain(minTokens, tokenCategory)
            : (tokensOut * BigInt(Math.floor((100 - slippageTolerance) * 10))) / 1000n;

    if (tokensOut < minTokensRaw) {
        return createErrorResult(
            `Slippage: ${tokensOutHuman} < ${tokenFromOnChain(minTokensRaw, tokenCategory)}`,
            SwapDirection.BCH_TO_TOKEN,
            SwapType.EXACT_INPUT,
        );
    }

    // Fee and price
    const feeAmount = Number(bchAmountRaw) * 0.003;
    const priceImpact = calculatePriceImpact(bchAmountRaw, poolBch);
    const effectivePrice = bchAmount / tokensOutHuman;

    // User UTXOs
    const userUtxos = await provider.getUtxos(userAddress);
    const bchUtxos = filterBchUtxos(userUtxos);
    const userBch = bchUtxos.reduce((sum, u) => sum + u.satoshis, 0n);

    const minerFee = DEFAULT_MINER_FEE;

    if (userBch < bchAmountRaw + minerFee) {
        return createErrorResult(
            `Insufficient BCH! Required: ${satoshiToBch(bchAmountRaw + minerFee)}`,
            SwapDirection.BCH_TO_TOKEN,
            SwapType.EXACT_INPUT,
        );
    }

    // Create unsigned TX template
    const inputs: UtxoInput[] = [];
    const outputs: TxOutput[] = [];

    // Input 0: Pool UTXO
    inputs.push({
        txid: poolUtxo.txid,
        vout: poolUtxo.vout,
        satoshis: poolUtxo.satoshis,
        token: poolUtxo.token
            ? {
                  category: poolUtxo.token.category,
                  amount: poolUtxo.token.amount,
              }
            : undefined,
        type: "pool",
        unlockFunction: "swapExactInput",
    });

    // User BCH inputs
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

    // New pool values
    const newPoolBch = poolBch + bchAmountRaw;
    const newPoolTokens = poolTokens - tokensOut;

    // Output 0: Updated pool (token supported address!)
    outputs.push({
        to: contractTokenAddress,
        amount: newPoolBch,
        token: { category: tokenCategory, amount: newPoolTokens },
    });

    // Output 1: To user (token-capable address)
    outputs.push({
        to: tokenAddress,
        amount: 1000n,
        token: { category: tokenCategory, amount: tokensOut },
    });

    // Output 2: BCH change
    const change = addedBch - bchAmountRaw - minerFee;
    if (change > 546n) {
        outputs.push({ to: userAddress, amount: change });
    }

    const unsignedTx: UnsignedTxTemplate = {
        inputs,
        outputs,
        poolAddress: contractTokenAddress,
        poolOwnerPkhHex: bytesToHex(poolOwnerPkh),
        minerFee,
        ownerAddress: userAddress,
    };

    return {
        success: true,
        direction: SwapDirection.BCH_TO_TOKEN,
        swapType: SwapType.EXACT_INPUT,
        inputAmount: bchAmount,
        inputAmountRaw: bchAmountRaw,
        outputAmount: tokensOutHuman,
        outputAmountRaw: tokensOut,
        priceImpact,
        effectivePrice,
        newPoolBch,
        newPoolTokens,
        quote: {
            inputAmount: bchAmount,
            outputAmount: tokensOutHuman,
            priceImpact,
            effectivePrice,
            fee: feeAmount,
        },
        unsignedTx,
    };
}

/**
 * Swap maximum BCH for exact tokens
 */
export async function swapBchForExactTokens(
    params: SwapBchForExactTokensParams,
    options: SwapOptions,
): Promise<SwapResult> {
    const {
        tokenCategory,
        tokenAmount,
        maxBch,
        slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE,
    } = params;

    const { poolOwnerPkh, userAddress } = options;
    const tokenAddress = toTokenAddress(userAddress);

    await ensureTokenDecimals(tokenCategory);

    const tokenAmountRaw = tokenToOnChain(tokenAmount, tokenCategory);

    const { contractTokenAddress, poolUtxo } = await getPoolUtxo(poolOwnerPkh, tokenCategory);
    if (!poolUtxo || !poolUtxo.token) {
        return createErrorResult(
            "Pool not found!",
            SwapDirection.BCH_TO_TOKEN,
            SwapType.EXACT_OUTPUT,
        );
    }

    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;

    // Does the pool have enough tokens?
    if (tokenAmountRaw >= poolTokens) {
        return createErrorResult(
            `Pool does not have enough tokens! Required: ${tokenAmount}, Available: ${tokenFromOnChain(poolTokens, tokenCategory)}`,
            SwapDirection.BCH_TO_TOKEN,
            SwapType.EXACT_OUTPUT,
        );
    }

    // Required BCH
    const bchRequired = getOutputPrice(tokenAmountRaw, poolBch, poolTokens);
    const bchRequiredHuman = satoshiToBch(bchRequired);

    // Maximum control
    const maxBchRaw = maxBch
        ? bchToSatoshi(maxBch)
        : (bchRequired * BigInt(Math.floor((100 + slippageTolerance) * 10))) / 1000n;

    if (bchRequired > maxBchRaw) {
        return createErrorResult(
            `Slippage: ${bchRequiredHuman} > ${satoshiToBch(maxBchRaw)}`,
            SwapDirection.BCH_TO_TOKEN,
            SwapType.EXACT_OUTPUT,
        );
    }

    const feeAmount = Number(bchRequired) * 0.003;
    const priceImpact = calculatePriceImpact(bchRequired, poolBch);
    const effectivePrice = bchRequiredHuman / tokenAmount;

    const userUtxos = await provider.getUtxos(userAddress);
    const bchUtxos = filterBchUtxos(userUtxos);
    const userBch = bchUtxos.reduce((sum, u) => sum + u.satoshis, 0n);

    const minerFee = DEFAULT_MINER_FEE;

    if (userBch < bchRequired + minerFee) {
        return createErrorResult(
            "Insufficient BCH!",
            SwapDirection.BCH_TO_TOKEN,
            SwapType.EXACT_OUTPUT,
        );
    }

    // Create unsigned TX template
    const inputs: UtxoInput[] = [];
    const outputs: TxOutput[] = [];

    inputs.push({
        txid: poolUtxo.txid,
        vout: poolUtxo.vout,
        satoshis: poolUtxo.satoshis,
        token: poolUtxo.token
            ? {
                  category: poolUtxo.token.category,
                  amount: poolUtxo.token.amount,
              }
            : undefined,
        type: "pool",
        unlockFunction: "swapExactOutput",
    });

    let addedBch = 0n;
    for (const utxo of bchUtxos) {
        if (addedBch >= bchRequired + minerFee) break;
        inputs.push({
            txid: utxo.txid,
            vout: utxo.vout,
            satoshis: utxo.satoshis,
            type: "user",
        });
        addedBch += utxo.satoshis;
    }

    const newPoolBch = poolBch + bchRequired;
    const newPoolTokens = poolTokens - tokenAmountRaw;

    outputs.push({
        to: contractTokenAddress,
        amount: newPoolBch,
        token: { category: tokenCategory, amount: newPoolTokens },
    });

    outputs.push({
        // Token output to token-capable address
        to: tokenAddress,
        amount: 1000n,
        token: { category: tokenCategory, amount: tokenAmountRaw },
    });

    const change = addedBch - bchRequired - minerFee;
    if (change > 546n) {
        outputs.push({ to: userAddress, amount: change });
    }

    const unsignedTx: UnsignedTxTemplate = {
        inputs,
        outputs,
        poolAddress: contractTokenAddress,
        poolOwnerPkhHex: bytesToHex(poolOwnerPkh),
        minerFee,
        ownerAddress: userAddress,
    };

    return {
        success: true,
        direction: SwapDirection.BCH_TO_TOKEN,
        swapType: SwapType.EXACT_OUTPUT,
        inputAmount: bchRequiredHuman,
        inputAmountRaw: bchRequired,
        outputAmount: tokenAmount,
        outputAmountRaw: tokenAmountRaw,
        priceImpact,
        effectivePrice,
        newPoolBch,
        newPoolTokens,
        quote: {
            inputAmount: bchRequiredHuman,
            outputAmount: tokenAmount,
            priceImpact,
            effectivePrice,
            fee: feeAmount,
        },
        unsignedTx,
    };
}

/**
 * Swap exact tokens for minimum BCH
 */
export async function swapExactTokensForBch(
    params: SwapExactTokensForBchParams,
    options: SwapOptions,
): Promise<SwapResult> {
    const {
        tokenCategory,
        tokenAmount,
        minBch = 0,
        slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE,
    } = params;

    const { poolOwnerPkh, userAddress } = options;
    const tokenAddress = toTokenAddress(userAddress);

    await ensureTokenDecimals(tokenCategory);

    const tokenAmountRaw = tokenToOnChain(tokenAmount, tokenCategory);

    const { contractTokenAddress, poolUtxo } = await getPoolUtxo(poolOwnerPkh, tokenCategory);
    if (!poolUtxo || !poolUtxo.token) {
        return createErrorResult(
            "Pool not found!",
            SwapDirection.TOKEN_TO_BCH,
            SwapType.EXACT_INPUT,
        );
    }

    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;

    // Calculate output
    const bchOut = getInputPrice(tokenAmountRaw, poolTokens, poolBch);
    const bchOutHuman = satoshiToBch(bchOut);

    const minBchRaw =
        minBch > 0
            ? bchToSatoshi(minBch)
            : (bchOut * BigInt(Math.floor((100 - slippageTolerance) * 10))) / 1000n;

    if (bchOut < minBchRaw) {
        return createErrorResult(
            `Slippage: ${bchOutHuman} < ${satoshiToBch(minBchRaw)}`,
            SwapDirection.TOKEN_TO_BCH,
            SwapType.EXACT_INPUT,
        );
    }

    const feeAmount = Number(bchOut) * 0.003;
    const priceImpact = calculatePriceImpact(tokenAmountRaw, poolTokens);
    const effectivePrice = tokenAmount / bchOutHuman;

    const userUtxos = await provider.getUtxos(userAddress);
    const bchUtxos = filterBchUtxos(userUtxos);
    const tokenUtxos = filterTokenUtxos(userUtxos, tokenCategory);

    const userTokens = tokenUtxos.reduce((sum, u) => sum + (u.token?.amount || 0n), 0n);
    const userBch = bchUtxos.reduce((sum, u) => sum + u.satoshis, 0n);

    const minerFee = DEFAULT_MINER_FEE;

    if (userTokens < tokenAmountRaw) {
        return createErrorResult(
            "Insufficient tokens!",
            SwapDirection.TOKEN_TO_BCH,
            SwapType.EXACT_INPUT,
        );
    }

    if (userBch < minerFee + 1000n) {
        return createErrorResult(
            "Insufficient BCH for miner fee!",
            SwapDirection.TOKEN_TO_BCH,
            SwapType.EXACT_INPUT,
        );
    }

    // Create unsigned TX template
    const inputs: UtxoInput[] = [];
    const outputs: TxOutput[] = [];

    inputs.push({
        txid: poolUtxo.txid,
        vout: poolUtxo.vout,
        satoshis: poolUtxo.satoshis,
        token: poolUtxo.token
            ? {
                  category: poolUtxo.token.category,
                  amount: poolUtxo.token.amount,
              }
            : undefined,
        type: "pool",
        unlockFunction: "swapExactInput",
    });

    // BCH (for fee)
    let addedBch = 0n;
    for (const utxo of bchUtxos) {
        if (addedBch >= minerFee + 1000n) break;
        inputs.push({
            txid: utxo.txid,
            vout: utxo.vout,
            satoshis: utxo.satoshis,
            type: "user",
        });
        addedBch += utxo.satoshis;
    }

    // Token inputs
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

    const newPoolBch = poolBch - bchOut;
    const newPoolTokens = poolTokens + tokenAmountRaw;

    // Pool output
    outputs.push({
        to: contractTokenAddress,
        amount: newPoolBch,
        token: { category: tokenCategory, amount: newPoolTokens },
    });

    // User BCH output
    outputs.push({
        to: userAddress,
        amount: bchOut + addedBch - minerFee,
    });

    // Token change
    const tokenChange = addedTokens - tokenAmountRaw;
    if (tokenChange > 0n) {
        outputs.push({
            // Token change to token-capable address
            to: tokenAddress,
            amount: 1000n,
            token: { category: tokenCategory, amount: tokenChange },
        });
    }

    const unsignedTx: UnsignedTxTemplate = {
        inputs,
        outputs,
        poolAddress: contractTokenAddress,
        poolOwnerPkhHex: bytesToHex(poolOwnerPkh),
        minerFee,
        ownerAddress: userAddress,
    };

    return {
        success: true,
        direction: SwapDirection.TOKEN_TO_BCH,
        swapType: SwapType.EXACT_INPUT,
        inputAmount: tokenAmount,
        inputAmountRaw: tokenAmountRaw,
        outputAmount: bchOutHuman,
        outputAmountRaw: bchOut,
        priceImpact,
        effectivePrice,
        newPoolBch,
        newPoolTokens,
        quote: {
            inputAmount: tokenAmount,
            outputAmount: bchOutHuman,
            priceImpact,
            effectivePrice,
            fee: feeAmount,
        },
        unsignedTx,
    };
}

/**
 * Swap maximum tokens for exact BCH
 */
export async function swapTokensForExactBch(
    params: SwapTokensForExactBchParams,
    options: SwapOptions,
): Promise<SwapResult> {
    const {
        tokenCategory,
        bchAmount,
        maxTokens,
        slippageTolerance = DEFAULT_SLIPPAGE_TOLERANCE,
    } = params;

    const { poolOwnerPkh, userAddress } = options;
    const tokenAddress = toTokenAddress(userAddress);

    await ensureTokenDecimals(tokenCategory);

    const bchAmountRaw = bchToSatoshi(bchAmount);

    const { contractTokenAddress, poolUtxo } = await getPoolUtxo(poolOwnerPkh, tokenCategory);
    if (!poolUtxo || !poolUtxo.token) {
        return createErrorResult(
            "Pool not found!",
            SwapDirection.TOKEN_TO_BCH,
            SwapType.EXACT_OUTPUT,
        );
    }

    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;

    // Does the pool have enough BCH?
    if (bchAmountRaw >= poolBch) {
        return createErrorResult(
            `Pool does not have enough BCH! Required: ${bchAmount}, Available: ${satoshiToBch(poolBch)}`,
            SwapDirection.TOKEN_TO_BCH,
            SwapType.EXACT_OUTPUT,
        );
    }

    // Required tokens
    const tokensRequired = getOutputPrice(bchAmountRaw, poolTokens, poolBch);
    const tokensRequiredHuman = tokenFromOnChain(tokensRequired, tokenCategory);

    const maxTokensRaw = maxTokens
        ? tokenToOnChain(maxTokens, tokenCategory)
        : (tokensRequired * BigInt(Math.floor((100 + slippageTolerance) * 10))) / 1000n;

    if (tokensRequired > maxTokensRaw) {
        return createErrorResult(
            `Slippage: ${tokensRequiredHuman} > ${tokenFromOnChain(maxTokensRaw, tokenCategory)}`,
            SwapDirection.TOKEN_TO_BCH,
            SwapType.EXACT_OUTPUT,
        );
    }

    const feeAmount = Number(bchAmountRaw) * 0.003;
    const priceImpact = calculatePriceImpact(tokensRequired, poolTokens);
    const effectivePrice = tokensRequiredHuman / bchAmount;

    const userUtxos = await provider.getUtxos(userAddress);
    const bchUtxos = filterBchUtxos(userUtxos);
    const tokenUtxos = filterTokenUtxos(userUtxos, tokenCategory);

    const userTokens = tokenUtxos.reduce((sum, u) => sum + (u.token?.amount || 0n), 0n);

    const minerFee = DEFAULT_MINER_FEE;

    if (userTokens < tokensRequired) {
        return createErrorResult(
            "Insufficient tokens!",
            SwapDirection.TOKEN_TO_BCH,
            SwapType.EXACT_OUTPUT,
        );
    }

    // Create unsigned TX template
    const inputs: UtxoInput[] = [];
    const outputs: TxOutput[] = [];

    inputs.push({
        txid: poolUtxo.txid,
        vout: poolUtxo.vout,
        satoshis: poolUtxo.satoshis,
        token: poolUtxo.token
            ? {
                  category: poolUtxo.token.category,
                  amount: poolUtxo.token.amount,
              }
            : undefined,
        type: "pool",
        unlockFunction: "swapExactOutput",
    });

    let addedBch = 0n;
    for (const utxo of bchUtxos) {
        if (addedBch >= minerFee + 1000n) break;
        inputs.push({
            txid: utxo.txid,
            vout: utxo.vout,
            satoshis: utxo.satoshis,
            type: "user",
        });
        addedBch += utxo.satoshis;
    }

    let addedTokens = 0n;
    for (const utxo of tokenUtxos) {
        if (addedTokens >= tokensRequired) break;
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

    const newPoolBch = poolBch - bchAmountRaw;
    const newPoolTokens = poolTokens + tokensRequired;

    outputs.push({
        to: contractTokenAddress,
        amount: newPoolBch,
        token: { category: tokenCategory, amount: newPoolTokens },
    });

    outputs.push({
        to: userAddress,
        amount: bchAmountRaw + addedBch - minerFee,
    });

    const tokenChange = addedTokens - tokensRequired;
    if (tokenChange > 0n) {
        outputs.push({
            // Token change to token-capable address
            to: tokenAddress,
            amount: 1000n,
            token: { category: tokenCategory, amount: tokenChange },
        });
    }

    const unsignedTx: UnsignedTxTemplate = {
        inputs,
        outputs,
        poolAddress: contractTokenAddress,
        poolOwnerPkhHex: bytesToHex(poolOwnerPkh),
        minerFee,
        ownerAddress: userAddress,
    };

    return {
        success: true,
        direction: SwapDirection.TOKEN_TO_BCH,
        swapType: SwapType.EXACT_OUTPUT,
        inputAmount: tokensRequiredHuman,
        inputAmountRaw: tokensRequired,
        outputAmount: bchAmount,
        outputAmountRaw: bchAmountRaw,
        priceImpact,
        effectivePrice,
        newPoolBch,
        newPoolTokens,
        quote: {
            inputAmount: tokensRequiredHuman,
            outputAmount: bchAmount,
            priceImpact,
            effectivePrice,
            fee: feeAmount,
        },
        unsignedTx,
    };
}

function createErrorResult(
    error: string,
    direction: SwapDirection,
    swapType: SwapType,
): SwapResult {
    return {
        success: false,
        error,
        direction,
        swapType,
        inputAmount: 0,
        inputAmountRaw: 0n,
        outputAmount: 0,
        outputAmountRaw: 0n,
        priceImpact: 0,
        effectivePrice: 0,
        quote: {
            inputAmount: 0,
            outputAmount: 0,
            priceImpact: 0,
            effectivePrice: 0,
            fee: 0,
        },
    };
}
