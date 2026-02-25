// This function finds the best price for a swap between BCH and tokens.
// It also supports split routing for large swaps.

import { hexToBin } from "@bitauth/libauth";
import {
    getExchangeContract,
    getInputPrice,
    getOutputPrice,
    satoshiToBch,
    bchToSatoshi,
    tokenFromOnChain,
    tokenToOnChain,
    ensureTokenDecimals,
    getTokenToBchExactInputOutput,
} from "../common";
import { getRegisteredOwners } from "../queries/registry";
import type { RouteQuote, BestRouteResult, SplitRouteResult } from "./types";

/**
 * Find the best price for a swap between BCH and tokens (exact BCH input)
 */
export async function findBestRouteForBchToToken(
    tokenCategory: string,
    bchAmount: number,
): Promise<BestRouteResult> {
    // Ensure token decimals are initialized before any tokenFromOnChain calls.
    await ensureTokenDecimals(tokenCategory);
    const owners = await getRegisteredOwners();

    if (owners.length === 0) {
        return {
            bestRoute: null,
            allRoutes: [],
            noRouteFound: true,
            error: "Registry is empty - no pools registered",
        };
    }

    const bchAmountRaw = bchToSatoshi(bchAmount);
    const routes: RouteQuote[] = [];

    for (const owner of owners) {
        try {
            const pkh = hexToBin(owner.pkhHex);
            const contract = getExchangeContract(pkh);
            const utxos = await contract.getUtxos();

            const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
            if (!poolUtxo || !poolUtxo.token) continue;

            const poolBch = poolUtxo.satoshis;
            const poolTokens = poolUtxo.token.amount;

            // Calculate output
            const tokensOut = getInputPrice(bchAmountRaw, poolBch, poolTokens);
            const tokensOutHuman = tokenFromOnChain(tokensOut, tokenCategory);

            // Price impact
            const priceImpact = (Number(bchAmountRaw) / Number(poolBch + bchAmountRaw)) * 100;

            // Effective price (how many tokens/BCH)
            const effectivePrice = tokensOutHuman / bchAmount;

            routes.push({
                poolOwnerPkhHex: owner.pkhHex,
                poolAddress: contract.tokenAddress,
                inputAmount: bchAmount,
                outputAmount: tokensOutHuman,
                effectivePrice,
                priceImpact,
                poolBch: satoshiToBch(poolBch),
                poolTokens: tokenFromOnChain(poolTokens, tokenCategory),
            });
        } catch {
            // Pool not accessible, skip
            continue;
        }
    }

    if (routes.length === 0) {
        return {
            bestRoute: null,
            allRoutes: [],
            noRouteFound: true,
            error: `No pool found for ${tokenCategory.substring(0, 16)}...`,
        };
    }

    // Sort by highest output
    routes.sort((a, b) => b.outputAmount - a.outputAmount);

    return {
        bestRoute: routes[0],
        allRoutes: routes,
        noRouteFound: false,
    };
}

/**
 * Find the best price for a swap between BCH and tokens (exact token output)
 * Chooses the pool that requires the lowest BCH input for a given token amount.
 */
export async function findBestRouteForBchForExactTokens(
    tokenCategory: string,
    tokenAmount: number,
): Promise<BestRouteResult> {
    await ensureTokenDecimals(tokenCategory);
    const owners = await getRegisteredOwners();

    if (owners.length === 0) {
        return {
            bestRoute: null,
            allRoutes: [],
            noRouteFound: true,
            error: "Registry is empty - no pools registered",
        };
    }

    const tokenAmountRaw = tokenToOnChain(tokenAmount, tokenCategory);
    const routes: RouteQuote[] = [];

    for (const owner of owners) {
        try {
            const pkh = hexToBin(owner.pkhHex);
            const contract = getExchangeContract(pkh);
            const utxos = await contract.getUtxos();

            const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
            if (!poolUtxo || !poolUtxo.token) continue;

            const poolBch = poolUtxo.satoshis;
            const poolTokens = poolUtxo.token.amount;

            // Does the pool have enough tokens?
            if (tokenAmountRaw >= poolTokens) continue;

            // Required BCH input
            const bchRequired = getOutputPrice(tokenAmountRaw, poolBch, poolTokens);
            const bchRequiredHuman = satoshiToBch(bchRequired);

            const priceImpact = (Number(bchRequired) / Number(poolBch + bchRequired)) * 100;
            const effectivePrice = tokenAmount / bchRequiredHuman;

            routes.push({
                poolOwnerPkhHex: owner.pkhHex,
                poolAddress: contract.tokenAddress,
                inputAmount: bchRequiredHuman,
                outputAmount: tokenAmount,
                effectivePrice,
                priceImpact,
                poolBch: satoshiToBch(poolBch),
                poolTokens: tokenFromOnChain(poolTokens, tokenCategory),
            });
        } catch {
            continue;
        }
    }

    if (routes.length === 0) {
        return {
            bestRoute: null,
            allRoutes: [],
            noRouteFound: true,
            error: `${tokenCategory.substring(0, 16)}... no suitable pool found`,
        };
    }

    // Sort by lowest BCH input (cheapest)
    routes.sort((a, b) => a.inputAmount - b.inputAmount);

    return {
        bestRoute: routes[0],
        allRoutes: routes,
        noRouteFound: false,
    };
}

/**
 * Find the best price for a swap between tokens and BCH (exact token input)
 */
export async function findBestRouteForTokenToBch(
    tokenCategory: string,
    tokenAmount: number,
): Promise<BestRouteResult> {
    await ensureTokenDecimals(tokenCategory);
    const owners = await getRegisteredOwners();

    if (owners.length === 0) {
        return {
            bestRoute: null,
            allRoutes: [],
            noRouteFound: true,
            error: "Registry is empty - no pools registered",
        };
    }

    const tokenAmountRaw = tokenToOnChain(tokenAmount, tokenCategory);
    const routes: RouteQuote[] = [];

    for (const owner of owners) {
        try {
            const pkh = hexToBin(owner.pkhHex);
            const contract = getExchangeContract(pkh);
            const utxos = await contract.getUtxos();

            const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
            if (!poolUtxo || !poolUtxo.token) continue;

            const poolBch = poolUtxo.satoshis;
            const poolTokens = poolUtxo.token.amount;

            // Does the pool have enough tokens?
            if (tokenAmountRaw >= poolTokens) continue;

            // Calculate output using the same invariant as the on-chain contract
            const bchOut = getTokenToBchExactInputOutput(tokenAmountRaw, poolTokens, poolBch);
            const bchOutHuman = satoshiToBch(bchOut);

            // Price impact
            const priceImpact =
                (Number(tokenAmountRaw) / Number(poolTokens + tokenAmountRaw)) * 100;

            // Effective price (how many BCH/token)
            const effectivePrice = bchOutHuman / tokenAmount;

            routes.push({
                poolOwnerPkhHex: owner.pkhHex,
                poolAddress: contract.tokenAddress,
                inputAmount: tokenAmount,
                outputAmount: bchOutHuman,
                effectivePrice,
                priceImpact,
                poolBch: satoshiToBch(poolBch),
                poolTokens: tokenFromOnChain(poolTokens, tokenCategory),
            });
        } catch {
            continue;
        }
    }

    if (routes.length === 0) {
        return {
            bestRoute: null,
            allRoutes: [],
            noRouteFound: true,
            error: `${tokenCategory.substring(0, 16)}... no suitable pool found`,
        };
    }

    // Sort by highest BCH output
    routes.sort((a, b) => b.outputAmount - a.outputAmount);

    return {
        bestRoute: routes[0],
        allRoutes: routes,
        noRouteFound: false,
    };
}

/**
 * Find the best price for a swap between tokens and BCH (exact BCH output)
 * Chooses the pool that requires the lowest token input for a given BCH amount.
 */
export async function findBestRouteForTokensForExactBch(
    tokenCategory: string,
    bchAmount: number,
): Promise<BestRouteResult> {
    await ensureTokenDecimals(tokenCategory);
    const owners = await getRegisteredOwners();

    if (owners.length === 0) {
        return {
            bestRoute: null,
            allRoutes: [],
            noRouteFound: true,
            error: "Registry is empty - no pools registered",
        };
    }

    const bchAmountRaw = bchToSatoshi(bchAmount);
    const routes: RouteQuote[] = [];

    for (const owner of owners) {
        try {
            const pkh = hexToBin(owner.pkhHex);
            const contract = getExchangeContract(pkh);
            const utxos = await contract.getUtxos();

            const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
            if (!poolUtxo || !poolUtxo.token) continue;

            const poolBch = poolUtxo.satoshis;
            const poolTokens = poolUtxo.token.amount;

            // Does the pool have enough BCH?
            if (bchAmountRaw >= poolBch) continue;

            // Required token input
            const tokensRequired = getOutputPrice(bchAmountRaw, poolTokens, poolBch);
            const tokensRequiredHuman = tokenFromOnChain(tokensRequired, tokenCategory);

            const priceImpact =
                (Number(tokensRequired) / Number(poolTokens + tokensRequired)) * 100;
            const effectivePrice = bchAmount / tokensRequiredHuman;

            routes.push({
                poolOwnerPkhHex: owner.pkhHex,
                poolAddress: contract.tokenAddress,
                inputAmount: tokensRequiredHuman,
                outputAmount: bchAmount,
                effectivePrice,
                priceImpact,
                poolBch: satoshiToBch(poolBch),
                poolTokens: tokenFromOnChain(poolTokens, tokenCategory),
            });
        } catch {
            continue;
        }
    }

    if (routes.length === 0) {
        return {
            bestRoute: null,
            allRoutes: [],
            noRouteFound: true,
            error: `${tokenCategory.substring(0, 16)}... no suitable pool found`,
        };
    }

    // Sort by lowest token input (cheapest)
    routes.sort((a, b) => a.inputAmount - b.inputAmount);

    return {
        bestRoute: routes[0],
        allRoutes: routes,
        noRouteFound: false,
    };
}

/**
 * Analyze split routing for large swaps
 *
 * Note: This function is only for analysis - it does not create a real TX
 */
export async function analyzeSplitRoute(
    tokenCategory: string,
    bchAmount: number,
    maxPools: number = 3,
): Promise<SplitRouteResult | null> {
    await ensureTokenDecimals(tokenCategory);
    const owners = await getRegisteredOwners();
    if (owners.length < 2) return null;

    const bchAmountRaw = bchToSatoshi(bchAmount);

    // Add all pools and liquidity
    const pools: Array<{
        pkhHex: string;
        address: string;
        bch: bigint;
        tokens: bigint;
    }> = [];

    for (const owner of owners) {
        try {
            const pkh = hexToBin(owner.pkhHex);
            const contract = getExchangeContract(pkh);
            const utxos = await contract.getUtxos();

            const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
            if (!poolUtxo || !poolUtxo.token) continue;

            pools.push({
                pkhHex: owner.pkhHex,
                address: contract.tokenAddress,
                bch: poolUtxo.satoshis,
                tokens: poolUtxo.token.amount,
            });
        } catch {
            continue;
        }
    }

    if (pools.length < 2) return null;

    // Sort by liquidity
    pools.sort((a, b) => Number(b.bch - a.bch));

    // Select the best N pools
    const selectedPools = pools.slice(0, maxPools);

    // Sort by liquidity
    const totalLiquidity = selectedPools.reduce((sum, p) => sum + p.bch, 0n);

    const routes: Array<RouteQuote & { percentage: number }> = [];
    let totalOutput = 0;

    for (const pool of selectedPools) {
        const percentage = (Number(pool.bch) / Number(totalLiquidity)) * 100;
        const poolBchInput = (bchAmountRaw * pool.bch) / totalLiquidity;

        const tokensOut = getInputPrice(poolBchInput, pool.bch, pool.tokens);
        const tokensOutHuman = tokenFromOnChain(tokensOut, tokenCategory);
        const bchInputHuman = satoshiToBch(poolBchInput);

        const priceImpact = (Number(poolBchInput) / Number(pool.bch + poolBchInput)) * 100;
        const effectivePrice = tokensOutHuman / bchInputHuman;

        routes.push({
            poolOwnerPkhHex: pool.pkhHex,
            poolAddress: pool.address,
            inputAmount: bchInputHuman,
            outputAmount: tokensOutHuman,
            effectivePrice,
            priceImpact,
            poolBch: satoshiToBch(pool.bch),
            poolTokens: tokenFromOnChain(pool.tokens, tokenCategory),
            percentage,
        });

        totalOutput += tokensOutHuman;
    }

    // What would happen if we used a single pool?
    const bestSinglePool = pools[0];
    const singlePoolOutput = tokenFromOnChain(
        getInputPrice(bchAmountRaw, bestSinglePool.bch, bestSinglePool.tokens),
        tokenCategory,
    );

    const splitAdvantage = ((totalOutput - singlePoolOutput) / singlePoolOutput) * 100;
    const avgPrice = totalOutput / bchAmount;

    return {
        routes,
        totalOutput,
        avgEffectivePrice: avgPrice,
        singlePoolOutput,
        splitAdvantage,
    };
}

/**
 * Compare all pool prices (arbitrage opportunity analysis)
 */
export async function comparePoolPrices(tokenCategory: string): Promise<{
    pools: Array<{
        pkhHex: string;
        address: string;
        spotPrice: number;
        bchReserve: number;
        tokenReserve: number;
    }>;
    maxSpread: number;
    arbitrageOpportunity: boolean;
}> {
    await ensureTokenDecimals(tokenCategory);
    const owners = await getRegisteredOwners();
    const pools: Array<{
        pkhHex: string;
        address: string;
        spotPrice: number;
        bchReserve: number;
        tokenReserve: number;
    }> = [];

    for (const owner of owners) {
        try {
            const pkh = hexToBin(owner.pkhHex);
            const contract = getExchangeContract(pkh);
            const utxos = await contract.getUtxos();

            const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);
            if (!poolUtxo || !poolUtxo.token) continue;

            const bchReserve = satoshiToBch(poolUtxo.satoshis);
            const tokenReserve = tokenFromOnChain(poolUtxo.token.amount, tokenCategory);
            const spotPrice = bchReserve / tokenReserve;

            pools.push({
                pkhHex: owner.pkhHex,
                address: contract.tokenAddress,
                spotPrice,
                bchReserve,
                tokenReserve,
            });
        } catch {
            continue;
        }
    }

    if (pools.length < 2) {
        return { pools, maxSpread: 0, arbitrageOpportunity: false };
    }

    // Sort by price
    pools.sort((a, b) => a.spotPrice - b.spotPrice);

    const minPrice = pools[0].spotPrice;
    const maxPrice = pools[pools.length - 1].spotPrice;
    const maxSpread = ((maxPrice - minPrice) / minPrice) * 100;

    // If the spread is greater than 1%, there is an arbitrage opportunity
    const arbitrageOpportunity = maxSpread > 1;

    return { pools, maxSpread, arbitrageOpportunity };
}
