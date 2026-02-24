import { MongoClient, type MongoClientOptions } from "mongodb";

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
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
