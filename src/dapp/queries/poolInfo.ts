import {
    getExchangeContract,
    satoshiToBch,
    tokenFromOnChain,
    ensureTokenDecimals,
    fetchTokenMetadata,
    getInputPrice,
    bchToSatoshi,
    bytesToHex,
    provider,
} from "../common";

import type { PoolInfo, PoolInfoResult } from "./types";

/**
 * Get pools for a specific pool owner
 *
 * @param poolOwnerPkh - Pool owner PKH
 */
export async function getPoolsForOwner(poolOwnerPkh: Uint8Array): Promise<PoolInfoResult> {
    const contract = getExchangeContract(poolOwnerPkh);
    const utxos = await contract.getUtxos();
    const balance = await contract.getBalance();
    const pkhHex = bytesToHex(poolOwnerPkh);

    // Group pools by token category
    const poolsMap = new Map<
        string,
        {
            bch: bigint;
            tokens: bigint;
            txid: string;
            vout: number;
        }
    >();

    for (const utxo of utxos) {
        if (utxo.token) {
            const category = utxo.token.category;
            const existing = poolsMap.get(category);

            if (existing) {
                poolsMap.set(category, {
                    bch: existing.bch + utxo.satoshis,
                    tokens: existing.tokens + utxo.token.amount,
                    txid: utxo.txid,
                    vout: utxo.vout,
                });
            } else {
                poolsMap.set(category, {
                    bch: utxo.satoshis,
                    tokens: utxo.token.amount,
                    txid: utxo.txid,
                    vout: utxo.vout,
                });
            }
        }
    }

    // Create pool information
    const pools: PoolInfo[] = [];

    for (const [category, pool] of poolsMap) {
        const metadata = await fetchTokenMetadata(category);
        const decimals = metadata?.decimals ?? 8;

        const bchReserve = satoshiToBch(pool.bch);
        const tokenReserve = tokenFromOnChain(pool.tokens, category);

        let tokenPriceInBch = 0;
        let bchPriceInToken = 0;

        if (pool.tokens > 0n && pool.bch > 0n) {
            // Spot price (direct ratio, fee excluded)
            // This is the ratio preserved in liquidity addition/removal
            tokenPriceInBch =
                (Number(pool.bch) * Math.pow(10, decimals)) / (Number(pool.tokens) * 1e8);
            bchPriceInToken = 1 / tokenPriceInBch;
        }

        pools.push({
            tokenCategory: category,
            tokenSymbol: metadata?.symbol,
            tokenDecimals: decimals,
            poolOwnerPkhHex: pkhHex,
            poolAddress: contract.address,
            bchReserve,
            tokenReserve,
            bchReserveRaw: pool.bch,
            tokenReserveRaw: pool.tokens,
            tokenPriceInBch,
            bchPriceInToken,
            kValue: pool.bch * pool.tokens,
            utxoTxid: pool.txid,
            utxoVout: pool.vout,
        });
    }

    return {
        contractAddress: contract.address,
        network: provider.network,
        totalBch: satoshiToBch(balance),
        totalBchRaw: balance,
        pools,
    };
}

/**
 * Get a specific pool for a specific pool owner
 */
export async function getPool(
    poolOwnerPkh: Uint8Array,
    tokenCategory: string,
    tokenDecimals?: number,
): Promise<PoolInfo | null> {
    await ensureTokenDecimals(tokenCategory, tokenDecimals);

    const contract = getExchangeContract(poolOwnerPkh);
    const utxos = await contract.getUtxos();
    const pkhHex = bytesToHex(poolOwnerPkh);

    const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);

    if (!poolUtxo || !poolUtxo.token) {
        return null;
    }

    const metadata = await fetchTokenMetadata(tokenCategory);
    const decimals = metadata?.decimals ?? tokenDecimals ?? 8;

    const poolBch = poolUtxo.satoshis;
    const poolTokens = poolUtxo.token.amount;

    const bchReserve = satoshiToBch(poolBch);
    const tokenReserve = tokenFromOnChain(poolTokens, tokenCategory);

    let tokenPriceInBch = 0;
    let bchPriceInToken = 0;

    if (poolTokens > 0n && poolBch > 0n) {
        const oneBchInTokens = getInputPrice(bchToSatoshi(1), poolBch, poolTokens);
        bchPriceInToken = tokenFromOnChain(oneBchInTokens, tokenCategory);
        tokenPriceInBch = bchPriceInToken > 0 ? 1 / bchPriceInToken : 0;
    }

    return {
        tokenCategory,
        tokenSymbol: metadata?.symbol,
        tokenDecimals: decimals,
        poolOwnerPkhHex: pkhHex,
        poolAddress: contract.address,
        bchReserve,
        tokenReserve,
        bchReserveRaw: poolBch,
        tokenReserveRaw: poolTokens,
        tokenPriceInBch,
        bchPriceInToken,
        kValue: poolBch * poolTokens,
        utxoTxid: poolUtxo.txid,
        utxoVout: poolUtxo.vout,
    };
}
