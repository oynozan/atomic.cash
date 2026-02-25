import { hash160 } from "@cashscript/utils";
export { hash160 };
import {
    secp256k1,
    hexToBin,
    binToHex,
    decodeCashAddress,
    encodeCashAddress,
} from "@bitauth/libauth";

export { secp256k1 };
import {
    Contract,
    ElectrumNetworkProvider,
    SignatureTemplate,
    TransactionBuilder,
    type NetworkProvider,
    type Utxo,
} from "cashscript";
import { compileFile } from "cashc";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import {
    NETWORK_STRING,
    BCMR_API_URL,
    BCH_DECIMALS,
    DEFAULT_TOKEN_DECIMALS,
    ELECTRUM_ENDPOINTS,
} from "./config";

import type { TokenMetadata, UnsignedTxTemplate } from "./types";
import { cache } from "../lib/cache";

const electrumNetwork = NETWORK_STRING as "mainnet" | "testnet4" | "chipnet";

type ElectrumWithRequest = ElectrumNetworkProvider & {
    performRequest: (
        name: string,
        ...parameters: (string | number | boolean)[]
    ) => Promise<unknown>;
};

function createFailoverElectrumProvider(): NetworkProvider {
    if (ELECTRUM_ENDPOINTS.length === 0) {
        return new ElectrumNetworkProvider(electrumNetwork);
    }

    // Create a separate ElectrumNetworkProvider instance for each endpoint and
    // cache their original performRequest methods so we can rotate between them.
    const providers: Array<{
        instance: ElectrumWithRequest;
        performRequest: ElectrumWithRequest["performRequest"];
    }> = ELECTRUM_ENDPOINTS.map(endpoint => {
        const instance = new ElectrumNetworkProvider(electrumNetwork, {
            hostname: endpoint.host,
        }) as ElectrumWithRequest;

        return {
            instance,
            performRequest: instance.performRequest.bind(instance),
        };
    });

    let currentIndex = 0;

    async function performWithFailover(
        method: string,
        ...params: (string | number | boolean)[]
    ): Promise<unknown> {
        let lastError: unknown;

        for (let i = 0; i < providers.length; i++) {
            const index = (currentIndex + i) % providers.length;
            const { performRequest } = providers[index];

            try {
                const result = await performRequest(method, ...params);
                currentIndex = index;
                return result;
            } catch (error) {
                lastError = error;
                continue;
            }
        }

        throw lastError ?? new Error("All Electrum endpoints failed");
    }

    // Patch the first provider instance to route all low-level Electrum
    // calls through the failover-aware performRequest implementation.
    providers[0].instance.performRequest = performWithFailover as ElectrumWithRequest["performRequest"];

    return providers[0].instance;
}

export const provider: NetworkProvider = createFailoverElectrumProvider();

const contractPath = join(dirname(fileURLToPath(import.meta.url)), "contracts", "atomic.cash");

export const artifact = compileFile(contractPath);

const TOKEN_DECIMALS_CACHE_PREFIX = "token:decimals:";
const TOKEN_METADATA_CACHE_PREFIX = "token:metadata:";

/**
 * Convert a standard CashAddr (p2pkh / p2sh) to its
 * token-aware variant (p2pkhWithTokens / p2shWithTokens).
 *
 * - If the address is already token-aware, it is returned as-is.
 * - On decode/encode error, the original address is returned.
 */
export function toTokenAddress(address: string): string {
    const decoded = decodeCashAddress(address);

    if (typeof decoded === "string") {
        // Decoding failed – return original, upstream code will surface error
        return address;
    }

    if (decoded.type === "p2pkhWithTokens" || decoded.type === "p2shWithTokens") {
        return address;
    }

    const tokenType = decoded.type === "p2sh" ? "p2shWithTokens" : "p2pkhWithTokens";

    const encoded = encodeCashAddress({
        prefix: decoded.prefix,
        type: tokenType as typeof decoded.type,
        payload: decoded.payload,
    });

    if (typeof encoded === "string") {
        // Encoding failed, fall back
        return address;
    }

    return encoded.address;
}

/**
 * Add token decimal value to central cache.
 */
export function setTokenDecimals(tokenCategory: string, decimals: number): void {
    cache.set<number>(`${TOKEN_DECIMALS_CACHE_PREFIX}${tokenCategory}`, decimals);
}

/**
 * Get token decimal value from central cache.
 * IMPORTANT: ensureTokenDecimals() or setTokenDecimals() MUST be called before this.
 */
export function getTokenDecimals(tokenCategory: string): number {
    const cached = cache.get<number>(`${TOKEN_DECIMALS_CACHE_PREFIX}${tokenCategory}`);
    if (cached === undefined) {
        throw new Error(
            `Token decimals not initialized for ${tokenCategory}. Call ensureTokenDecimals() or setTokenDecimals() first.`,
        );
    }
    return cached;
}

/**
 * Fetch token metadata from BCMR API
 */
export async function fetchTokenMetadata(tokenCategory: string): Promise<TokenMetadata | null> {
    const cacheKey = `${TOKEN_METADATA_CACHE_PREFIX}${tokenCategory}`;
    const cached = cache.get<TokenMetadata>(cacheKey);
    if (cached) return cached;

    try {
        const response = await fetch(`${BCMR_API_URL}/${tokenCategory}/`);

        if (!response.ok) return null;

        const data = await response.json();

        const decimals: number =
            typeof data.token?.decimals === "number"
                ? data.token.decimals
                : DEFAULT_TOKEN_DECIMALS;

        const metadata: TokenMetadata = {
            name: data.name || "Unknown",
            symbol: data.token?.symbol || "UNKNOWN",
            decimals,
            category: tokenCategory,
            iconUrl: data.uris?.icon,
            description: data.description,
            isNft: data.is_nft,
        };

        cache.set<TokenMetadata>(cacheKey, metadata);
        setTokenDecimals(tokenCategory, metadata.decimals);

        return metadata;
    } catch {
        return null;
    }
}

/**
 * Get token decimal value from cache or fetch from BCMR
 */
export async function ensureTokenDecimals(
    tokenCategory: string,
    providedDecimals?: number,
): Promise<number> {
    if (providedDecimals !== undefined) {
        setTokenDecimals(tokenCategory, providedDecimals);
        return providedDecimals;
    }

    const cached = cache.get<number>(`${TOKEN_DECIMALS_CACHE_PREFIX}${tokenCategory}`);
    if (cached !== undefined) return cached;

    const metadata = await fetchTokenMetadata(tokenCategory);
    if (!metadata || typeof metadata.decimals !== "number") {
        throw new Error(
            `Token metadata for ${tokenCategory} is missing decimals – cannot derive human amounts.`,
        );
    }
    setTokenDecimals(tokenCategory, metadata.decimals);
    return metadata.decimals;
}

/**
 * Convert BCH to satoshi
 */
export function bchToSatoshi(bch: number): bigint {
    return BigInt(Math.round(bch * 10 ** BCH_DECIMALS));
}

/**
 * Convert satoshi to BCH
 */
export function satoshiToBch(satoshi: bigint): number {
    return Number(satoshi) / 10 ** BCH_DECIMALS;
}

/**
 * Convert token amount to on-chain format
 */
export function tokenToOnChain(amount: number, tokenCategory: string): bigint {
    const decimals = getTokenDecimals(tokenCategory);
    return BigInt(Math.round(amount * 10 ** decimals));
}

/**
 * Convert on-chain token amount to human format
 */
export function tokenFromOnChain(amount: bigint, tokenCategory: string): number {
    const decimals = getTokenDecimals(tokenCategory);
    return Number(amount) / 10 ** decimals;
}

/**
 * Filter out UTXOs that do not contain tokens
 */
export function filterBchUtxos(utxos: Utxo[]): Utxo[] {
    return utxos.filter(u => !u.token);
}

/**
 * Filter out UTXOs that contain a specific token category
 */
export function filterTokenUtxos(utxos: Utxo[], tokenCategory: string): Utxo[] {
    return utxos.filter(u => u.token?.category === tokenCategory);
}

/**
 * Create exchange contract
 * @param poolOwnerPkh - Pool owner public key hash (20 byte)
 */
export function getExchangeContract(poolOwnerPkh: Uint8Array): Contract {
    return new Contract(artifact, [poolOwnerPkh], { provider });
}

/**
 * Create contract from public key
 * @param publicKey - Public key (33 byte compressed)
 */
export function getExchangeContractFromPublicKey(publicKey: Uint8Array): Contract {
    const pkh = hash160(publicKey);
    return getExchangeContract(pkh);
}

/**
 * Find all pools (for a specific token)
 */
export async function findPoolsForToken(
    tokenCategory: string,
    knownPoolOwnerPkhs: Uint8Array[],
): Promise<{ contract: Contract; utxo: Utxo; poolOwnerPkh: Uint8Array }[]> {
    const pools: { contract: Contract; utxo: Utxo; poolOwnerPkh: Uint8Array }[] = [];

    for (const pkh of knownPoolOwnerPkhs) {
        const contract = getExchangeContract(pkh);
        const utxos = await contract.getUtxos();
        const poolUtxo = utxos.find(u => u.token?.category === tokenCategory);

        if (poolUtxo) {
            pools.push({ contract, utxo: poolUtxo, poolOwnerPkh: pkh });
        }
    }

    return pools;
}

/**
 * Create signature template for private key
 * (Used when building/sending TX with a known private key; WalletConnect flow signs in wallet.)
 */
export function createSignatureTemplate(privateKey: Uint8Array): SignatureTemplate {
    return new SignatureTemplate(privateKey);
}

/**
 * Sign and broadcast unsigned TX template
 *
 * @param template - TX template to sign
 * @param signerPrivateKey - Signing private key
 * @returns Transaction ID
 */
export async function signAndBroadcast(
    template: UnsignedTxTemplate,
    signerPrivateKey: Uint8Array,
): Promise<string> {
    const { inputs, outputs, poolOwnerPkhHex } = template;
    const poolOwnerPkh = hexToBin(poolOwnerPkhHex);
    const contract = getExchangeContract(poolOwnerPkh);

    // Create signature template
    const sigTemplate = createSignatureTemplate(signerPrivateKey);

    // Create public key
    const publicKey = secp256k1.derivePublicKeyCompressed(signerPrivateKey) as Uint8Array;

    // Create TransactionBuilder
    let builder = new TransactionBuilder({ provider });

    // Add inputs
    for (const input of inputs) {
        const utxo = {
            txid: input.txid,
            vout: input.vout,
            satoshis: input.satoshis,
            token: input.token
                ? {
                      category: input.token.category,
                      amount: input.token.amount,
                  }
                : undefined,
        };

        if (input.type === "pool" && input.unlockFunction) {
            // Pool UTXO - contract unlock function
            switch (input.unlockFunction) {
                case "swapExactInput":
                    builder = builder.addInput(utxo, contract.unlock.swapExactInput());
                    break;
                case "swapExactOutput":
                    builder = builder.addInput(utxo, contract.unlock.swapExactOutput());
                    break;
                case "addLiquidity":
                    builder = builder.addInput(
                        utxo,
                        contract.unlock.addLiquidity(publicKey, sigTemplate),
                    );
                    break;
                case "removeLiquidity":
                    builder = builder.addInput(
                        utxo,
                        contract.unlock.removeLiquidity(publicKey, sigTemplate),
                    );
                    break;
            }
        } else {
            // User UTXO - P2PKH unlock function
            builder = builder.addInput(utxo, sigTemplate.unlockP2PKH());
        }
    }

    // Add outputs
    for (const output of outputs) {
        if (output.token) {
            builder = builder.addOutput({
                to: output.to,
                amount: output.amount,
                token: {
                    category: output.token.category,
                    amount: output.token.amount,
                },
            });
        } else {
            builder = builder.addOutput({
                to: output.to,
                amount: output.amount,
            });
        }
    }

    // Build and broadcast
    const tx = await builder.send();

    return tx.txid;
}

/**
 * Calculate price for exact input
 * User sends inputAmount, they receive outputAmount
 *
 * @param inputAmount - Amount to send (satoshi/raw)
 * @param inputReserve - Input reserve in the pool
 * @param outputReserve - Output reserve in the pool
 * @returns Amount to receive
 */
export function getInputPrice(
    inputAmount: bigint,
    inputReserve: bigint,
    outputReserve: bigint,
): bigint {
    const inputAmountWithFee = inputAmount * 997n;
    const numerator = inputAmountWithFee * outputReserve;
    const denominator = inputReserve * 1000n + inputAmountWithFee;
    return numerator / denominator;
}

/**
 * Calculate price for exact output
 * User wants to receive outputAmount, they need to send inputAmount
 *
 * @param outputAmount - Amount to receive
 * @param inputReserve - Input reserve in the pool
 * @param outputReserve - Output reserve in the pool
 * @returns Amount to send
 */
export function getOutputPrice(
    outputAmount: bigint,
    inputReserve: bigint,
    outputReserve: bigint,
): bigint {
    const numerator = inputReserve * outputAmount * 1000n;
    const denominator = (outputReserve - outputAmount) * 997n;
    return numerator / denominator + 1n;
}

/**
 * Calculate price impact (%)
 *
 * @param inputAmount - Amount to send
 * @param inputReserve - Input reserve in the pool
 * @returns Price impact percentage
 */
export function calculatePriceImpact(inputAmount: bigint, inputReserve: bigint): number {
    // Simple formula: impact = inputAmount / (inputReserve + inputAmount)
    const impact = Number(inputAmount) / Number(inputReserve + inputAmount);
    return impact * 100;
}

/**
 * Convert bytes to hex
 */
export function bytesToHex(bytes: Uint8Array): string {
    return binToHex(bytes);
}

/**
 * Convert hex to bytes
 */
export function hexToBytes(hex: string): Uint8Array {
    return hexToBin(hex);
}
