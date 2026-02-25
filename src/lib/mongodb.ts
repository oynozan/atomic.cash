import { MongoClient, type MongoClientOptions } from "mongodb";

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
    // eslint-disable-next-line no-var
    var __mongodbClientPromise: Promise<MongoClient> | undefined;
}

function getClient(): Promise<MongoClient> {
    if (!uri) {
        throw new Error("MONGODB_URI is not set");
    }
    if (process.env.NODE_ENV === "development") {
        if (!global.__mongodbClientPromise) {
            client = new MongoClient(uri, options);
            global.__mongodbClientPromise = client.connect();
        }
        return global.__mongodbClientPromise!;
    }
    if (!clientPromise) {
        client = new MongoClient(uri, options);
        clientPromise = client.connect();
    }
    return clientPromise;
}

export const DB_NAME = "atomic_cash";
export const COLLECTION_POOL_OWNERS = "pool_owners";
export const COLLECTION_TRANSACTIONS = "transactions";

export async function getDb() {
    const client = await getClient();
    return client.db(DB_NAME);
}

export async function getPoolOwnersCollection() {
    const db = await getDb();
    return db.collection<{
        pkhHex: string;
        address?: string;
        label?: string;
        registeredAt: number;
    }>(COLLECTION_POOL_OWNERS);
}

export interface StoredTransaction {
    /** On-chain txid */
    txid: string;
    /** User token-aware address that initiated the action */
    address: string;
    /** High-level type of dapp action */
    type: "swap" | "create_pool" | "add_liquidity" | "remove_liquidity";
    /** Optional swap direction (for swaps only) */
    direction?: "bch_to_token" | "token_to_bch";
    /** Optional token category involved in the action */
    tokenCategory?: string;
    /** Human-readable amount details, depends on type */
    amounts?: {
        bchIn?: number;
        bchOut?: number;
        tokenIn?: number;
        tokenOut?: number;
    };
    /** Unix timestamp (ms) when we recorded this action */
    createdAt: number;
}

export async function getTransactionsCollection() {
    const db = await getDb();
    return db.collection<StoredTransaction>(COLLECTION_TRANSACTIONS);
}
