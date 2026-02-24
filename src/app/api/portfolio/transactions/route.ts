import { NextRequest, NextResponse } from "next/server";
import {
  getTransactionsCollection,
  type StoredTransaction,
} from "@/lib/mongodb";

export const dynamic = "force-dynamic";

type Body = {
  txid?: string;
  address?: string;
  type?: StoredTransaction["type"];
  direction?: StoredTransaction["direction"];
  tokenCategory?: string;
  amounts?: StoredTransaction["amounts"];
};

/**
 * POST /api/portfolio/transactions
 *
 * Records a high-level dapp transaction (swap, create pool, add/remove liquidity)
 * into Mongo so that the Activity view can later display it with rich details.
 */
export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { txid, address, type, direction, tokenCategory, amounts } = body;

  if (!txid || typeof txid !== "string" || txid.trim() === "") {
    return NextResponse.json({ error: "txid is required" }, { status: 400 });
  }
  if (!address || typeof address !== "string" || address.trim() === "") {
    return NextResponse.json({ error: "address is required" }, { status: 400 });
  }
  if (!type) {
    return NextResponse.json({ error: "type is required" }, { status: 400 });
  }

  const trimmedTxid = txid.trim();
  const trimmedAddress = address.trim();

  try {
    const coll = await getTransactionsCollection();

    const doc: StoredTransaction = {
      txid: trimmedTxid,
      address: trimmedAddress,
      type,
      direction,
      tokenCategory,
      amounts,
      createdAt: Date.now(),
    };

    await coll.insertOne(doc);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to record transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

