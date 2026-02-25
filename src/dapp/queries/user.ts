import { decodeCashAddress, hexToBin } from "@bitauth/libauth";
import {
    provider,
    getExchangeContract,
    satoshiToBch,
    tokenFromOnChain,
    ensureTokenDecimals,
    fetchTokenMetadata,
    bytesToHex,
} from "../common";
import type { UserBalance, TokenBalance, PoolSummary } from "./types";

/**
 * Extract PKH from Cash address
 * Supports both normal and token addresses
 */
export function addressToPkh(address: string): Uint8Array | null {
    const decoded = decodeCashAddress(address);

    if (typeof decoded === "string") {
        // Error
        return null;
    }

    // payload is PKH
    return decoded.payload;
}

/**
 * Extract PKH hex from Cash address
 */
export function addressToPkhHex(address: string): string | null {
    const pkh = addressToPkh(address);
    return pkh ? bytesToHex(pkh) : null;
}

/**
 * Get pools by user address
 *
 * @example
 * ```ts
 * const pools = await getPoolsByAddress('bchtest:qz...');
 * ```
 */
export async function getPoolsByAddress(userAddress: string): Promise<PoolSummary[]> {
    const pkh = addressToPkh(userAddress);

    if (!pkh) {
        throw new Error("Invalid address!");
    }

    const contract = getExchangeContract(pkh);
    const utxos = await contract.getUtxos();

    const pools: PoolSummary[] = [];

    for (const utxo of utxos) {
        if (!utxo.token) continue;

        const metadata = await fetchTokenMetadata(utxo.token.category);
        const decimals = metadata?.decimals;
        if (typeof decimals === "number") {
            // keep conversion helpers in sync with BCMR decimals
            await ensureTokenDecimals(utxo.token.category, decimals);
        }

        const bchReserve = satoshiToBch(utxo.satoshis);
        const tokenReserve = tokenFromOnChain(utxo.token.amount, utxo.token.category);
        const tokenPriceInBch = bchReserve / tokenReserve;

        pools.push({
            poolAddress: contract.tokenAddress,
            poolOwnerPkhHex: bytesToHex(pkh),
            tokenCategory: utxo.token.category,
            tokenSymbol: metadata?.symbol,
            tokenIconUrl: metadata?.iconUrl,
            bchReserve,
            tokenReserve,
            tokenPriceInBch,
        });
    }

    return pools;
}

/**
 * Get user BCH and token balances
 *
 * @example
 * ```ts
 * const balance = await getUserBalances('bchtest:zz...');
 * ```
 */
export async function getUserBalances(userTokenAddress: string): Promise<UserBalance> {
    const utxos = await provider.getUtxos(userTokenAddress);

    let bchRaw = 0n;
    const tokenMap = new Map<string, bigint>();

    for (const utxo of utxos) {
        bchRaw += utxo.satoshis;

        if (utxo.token) {
            const existing = tokenMap.get(utxo.token.category) || 0n;
            tokenMap.set(utxo.token.category, existing + utxo.token.amount);
        }
    }

    const tokens: TokenBalance[] = [];

    for (const [category, amountRaw] of tokenMap) {
        const metadata = await fetchTokenMetadata(category);
        const decimals = metadata?.decimals;
        if (typeof decimals === "number") {
            await ensureTokenDecimals(category, decimals);
        }

        tokens.push({
            category,
            symbol: metadata?.symbol,
            name: metadata?.name,
            decimals: decimals ?? 0,
            amount: tokenFromOnChain(amountRaw, category),
            amountRaw,
            iconUrl: metadata?.iconUrl,
        });
    }

    return {
        bch: satoshiToBch(bchRaw),
        bchRaw,
        tokens,
    };
}

/**
 * Get user token balance for a specific token
 */
export async function getUserTokenBalance(
    userTokenAddress: string,
    tokenCategory: string,
    tokenDecimals?: number,
): Promise<TokenBalance | null> {
    await ensureTokenDecimals(tokenCategory, tokenDecimals);

    const utxos = await provider.getUtxos(userTokenAddress);

    let amountRaw = 0n;

    for (const utxo of utxos) {
        if (utxo.token?.category === tokenCategory) {
            amountRaw += utxo.token.amount;
        }
    }

    if (amountRaw === 0n) {
        return null;
    }

    const metadata = await fetchTokenMetadata(tokenCategory);
    const decimals = metadata?.decimals;
    if (typeof decimals === "number") {
        await ensureTokenDecimals(tokenCategory, decimals);
    }

    return {
        category: tokenCategory,
        symbol: metadata?.symbol,
        name: metadata?.name,
        decimals: decimals ?? 0,
        amount: tokenFromOnChain(amountRaw, tokenCategory),
        amountRaw,
        iconUrl: metadata?.iconUrl,
    };
}

/**
 * Get user BCH balance
 */
export async function getUserBchBalance(
    userAddress: string,
): Promise<{ bch: number; bchRaw: bigint }> {
    const utxos = await provider.getUtxos(userAddress);

    let bchRaw = 0n;

    for (const utxo of utxos) {
        if (!utxo.token) {
            bchRaw += utxo.satoshis;
        }
    }

    return {
        bch: satoshiToBch(bchRaw),
        bchRaw,
    };
}

/**
 * Get pools by PKH hex
 */
export async function getPoolsByPkhHex(pkhHex: string): Promise<PoolSummary[]> {
    const pkh = hexToBin(pkhHex);

    const contract = getExchangeContract(pkh);
    const utxos = await contract.getUtxos();

    const pools: PoolSummary[] = [];

    for (const utxo of utxos) {
        if (!utxo.token) continue;

        const metadata = await fetchTokenMetadata(utxo.token.category);

        const bchReserve = satoshiToBch(utxo.satoshis);
        const tokenReserve = tokenFromOnChain(utxo.token.amount, utxo.token.category);
        const tokenPriceInBch = bchReserve / tokenReserve;

        pools.push({
            poolAddress: contract.tokenAddress,
            poolOwnerPkhHex: pkhHex,
            tokenCategory: utxo.token.category,
            tokenSymbol: metadata?.symbol,
            tokenIconUrl: metadata?.iconUrl,
            bchReserve,
            tokenReserve,
            tokenPriceInBch,
        });
    }

    return pools;
}
