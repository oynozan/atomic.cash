import { NextRequest, NextResponse } from "next/server";

import { getAuthFromRequest } from "@/lib/auth";
import { getTransactionsCollection, type StoredTransaction } from "@/lib/mongodb";
import { getServerSocket } from "@/lib/serverSocket";
import { cache } from "@/lib/cache";

export const dynamic = "force-dynamic";

type Body = {
    txid?: string;
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
 *
 * Socket side: we emit a generic "transaction" event with the full StoredTransaction doc.
 */

async function emitTransaction(doc: StoredTransaction) {
    try {
        // Swap and liquidity actions change on-chain pool state and derived prices.
        // Clear backend caches so the next HTTP requests after this event always
        // recompute fresh values instead of serving slightly stale data.
        cache.clear();

        const socket = await getServerSocket();
        socket.emit("transaction", {
            ...doc,
            emittedAt: Date.now(),
        });
    } catch (err) {
        // Best-effort only; don't fail the API if socket emission fails
        console.error("[api/portfolio/transactions] failed to emit transaction", err);
    }
}
export async function POST(request: NextRequest) {
    let body: Body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { txid, type, direction, tokenCategory, amounts } = body;

    const auth = getAuthFromRequest(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!txid || typeof txid !== "string" || txid.trim() === "") {
        return NextResponse.json({ error: "txid is required" }, { status: 400 });
    }
    const allowedTypes: StoredTransaction["type"][] = [
        "swap",
        "create_pool",
        "add_liquidity",
        "remove_liquidity",
    ];
    if (!type || !allowedTypes.includes(type)) {
        return NextResponse.json(
            {
                error: "type is required and must be one of: swap, create_pool, add_liquidity, remove_liquidity",
            },
            { status: 400 },
        );
    }

    const trimmedTxid = txid.trim();
    const trimmedAddress = auth.address.trim();

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

        // Fire-and-forget: notify all connected clients about this transaction
        void emitTransaction(doc);

        return NextResponse.json({ ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to record transaction";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
