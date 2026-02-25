import { hexToBin } from "@bitauth/libauth";
import { getExchangeContract, satoshiToBch, tokenFromOnChain, fetchTokenMetadata } from "../common";
import { getPoolOwnersCollection } from "@/lib/mongodb";
import type { RegisteredPoolOwner, AllPoolsResult, PoolSummary } from "./types";
import { getOrSet } from "@/lib/cache";

const ALL_POOLS_CACHE_KEY = "registry:all-pools";
// Pool liquidity and counts do not need sub-second accuracy,
// so a short-lived TTL is acceptable to reduce load.
const ALL_POOLS_TTL_MS = 15_000;

const POOLS_FOR_TOKEN_TTL_MS = 15_000;

/**
 * Register pool owner (persisted in MongoDB)
 */
export async function registerPoolOwner(
    pkhHex: string,
    address?: string,
    label?: string,
): Promise<void> {
    const col = await getPoolOwnersCollection();
    const existing = await col.findOne({ pkhHex });
    if (existing) return;

    await col.insertOne({
        pkhHex,
        address,
        label,
        registeredAt: Date.now(),
    });
}

/**
 * Register multiple pool owners
 */
export async function registerPoolOwners(
    owners: Array<{ pkhHex: string; address?: string; label?: string }>,
): Promise<void> {
    const col = await getPoolOwnersCollection();
    for (const owner of owners) {
        const existing = await col.findOne({ pkhHex: owner.pkhHex });
        if (!existing) {
            await col.insertOne({
                pkhHex: owner.pkhHex,
                address: owner.address,
                label: owner.label,
                registeredAt: Date.now(),
            });
        }
    }
}

/**
 * Get registered pool owners from MongoDB
 */
export async function getRegisteredOwners(): Promise<RegisteredPoolOwner[]> {
    const col = await getPoolOwnersCollection();
    const docs = await col.find({}).sort({ registeredAt: 1 }).toArray();
    return docs.map(d => ({
        pkhHex: d.pkhHex,
        address: d.address,
        label: d.label,
        registeredAt: d.registeredAt,
    }));
}

/**
 * Check if pool owner is registered
 */
export async function isOwnerRegistered(pkhHex: string): Promise<boolean> {
    const col = await getPoolOwnersCollection();
    const doc = await col.findOne({ pkhHex });
    return doc != null;
}

/**
 * Unregister pool owner
 */
export async function unregisterPoolOwner(pkhHex: string): Promise<void> {
    const col = await getPoolOwnersCollection();
    await col.deleteOne({ pkhHex });
}

/**
 * Clear all registrations (use with care)
 */
export async function clearRegistry(): Promise<void> {
    const col = await getPoolOwnersCollection();
    await col.deleteMany({});
}

async function computeAllPools(): Promise<AllPoolsResult> {
    const owners = await getRegisteredOwners();
    const pools: PoolSummary[] = [];
    const tokenCounts = new Map<string, number>();
    let totalBchLiquidity = 0;

    for (const owner of owners) {
        const pkh = hexToBin(owner.pkhHex);
        const contract = getExchangeContract(pkh);
        const utxos = await contract.getUtxos();

        for (const utxo of utxos) {
            if (!utxo.token) continue;

            const metadata = await fetchTokenMetadata(utxo.token.category);

            const bchReserve = satoshiToBch(utxo.satoshis);
            const tokenReserve = tokenFromOnChain(utxo.token.amount, utxo.token.category);
            const tokenPriceInBch = bchReserve / tokenReserve;

            pools.push({
                poolAddress: contract.tokenAddress,
                poolOwnerPkhHex: owner.pkhHex,
                tokenCategory: utxo.token.category,
                tokenSymbol: metadata?.symbol,
                tokenName: metadata?.name,
                tokenIconUrl: metadata?.iconUrl,
                bchReserve,
                tokenReserve,
                tokenPriceInBch,
            });

            totalBchLiquidity += bchReserve;

            const count = tokenCounts.get(utxo.token.category) || 0;
            tokenCounts.set(utxo.token.category, count + 1);
        }
    }

    return {
        totalPools: pools.length,
        totalBchLiquidity,
        tokenCounts,
        pools,
    };
}

/**
 * Get all registered pools (from registered owners + on-chain UTXOs),
 * cached in memory to avoid repeated Electrum + metadata lookups.
 */
export async function getAllPools(): Promise<AllPoolsResult> {
    return getOrSet(ALL_POOLS_CACHE_KEY, computeAllPools, ALL_POOLS_TTL_MS);
}

/**
 * Get all pools for a specific token.
 * Result is cached per tokenCategory for a short TTL.
 */
export async function getPoolsForToken(tokenCategory: string): Promise<PoolSummary[]> {
    return getOrSet(
        `registry:pools:${tokenCategory}`,
        async () => {
            const owners = await getRegisteredOwners();
            const pools: PoolSummary[] = [];

            for (const owner of owners) {
                const pkh = hexToBin(owner.pkhHex);
                const contract = getExchangeContract(pkh);
                const utxos = await contract.getUtxos();

                const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);

                if (poolUtxo && poolUtxo.token) {
                    const metadata = await fetchTokenMetadata(tokenCategory);

                    const bchReserve = satoshiToBch(poolUtxo.satoshis);
                    const tokenReserve = tokenFromOnChain(poolUtxo.token.amount, tokenCategory);
                    const tokenPriceInBch = bchReserve / tokenReserve;

                    pools.push({
                        poolAddress: contract.tokenAddress,
                        poolOwnerPkhHex: owner.pkhHex,
                        tokenCategory,
                        tokenSymbol: metadata?.symbol,
                        tokenName: metadata?.name,
                        tokenIconUrl: metadata?.iconUrl,
                        bchReserve,
                        tokenReserve,
                        tokenPriceInBch,
                    });
                }
            }

            pools.sort((a, b) => b.bchReserve - a.bchReserve);
            return pools;
        },
        POOLS_FOR_TOKEN_TTL_MS,
    );
}

/**
 * Get the best pool for a specific token (highest liquidity)
 */
export async function getBestPoolForToken(tokenCategory: string): Promise<PoolSummary | null> {
    const pools = await getPoolsForToken(tokenCategory);
    return pools.length > 0 ? pools[0] : null;
}

/**
 * Get all tokens (unique) across registered pools
 */
export async function getAllTokens(): Promise<
    Array<{
        category: string;
        symbol?: string;
        poolCount: number;
        totalBchLiquidity: number;
    }>
> {
    const result = await getAllPools();
    const tokenMap = new Map<string, { symbol?: string; poolCount: number; totalBch: number }>();

    for (const pool of result.pools) {
        const existing = tokenMap.get(pool.tokenCategory);

        if (existing) {
            existing.poolCount++;
            existing.totalBch += pool.bchReserve;
        } else {
            tokenMap.set(pool.tokenCategory, {
                symbol: pool.tokenSymbol,
                poolCount: 1,
                totalBch: pool.bchReserve,
            });
        }
    }

    return Array.from(tokenMap.entries()).map(([category, data]) => ({
        category,
        symbol: data.symbol,
        poolCount: data.poolCount,
        totalBchLiquidity: data.totalBch,
    }));
}
