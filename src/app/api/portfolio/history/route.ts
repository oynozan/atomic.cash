import { NextRequest, NextResponse } from "next/server";
import { getTransactionsCollection } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfolio/history?address=...&limit=...
 *
 * Returns:
 * - `chain` → BCH / token transfers from Electrum (address history)
 * - `dapp`  → High-level dapp transactions (swap, pool create, add/remove liquidity)
 *
 * The client decides how many to show (e.g. last 5 on overview).
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");

  if (!address || address.trim() === "") {
    return NextResponse.json(
      { error: "Missing or empty address" },
      { status: 400 },
    );
  }

  const limitParam = request.nextUrl.searchParams.get("limit");

  const limit = limitParam ? Number.parseInt(limitParam, 10) || 10 : 10;

  const trimmedAddress = address.trim();

  try {
    // 1) Dapp transactions from Mongo (sorted by createdAt desc)
    const coll = await getTransactionsCollection();

    const dappDocs = await coll
      .find({ address: trimmedAddress })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return NextResponse.json({
      chain: {
        transactions: [],
        total: 0,
        hasMore: false,
      },
      dapp: {
        transactions: dappDocs,
        total: dappDocs.length,
        hasMore: false,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch activity history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

