import { NextRequest, NextResponse } from "next/server";

import { getTransactionsCollection, type StoredTransaction } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

type TradesResponse = {
  trades: StoredTransaction[];
  total: number;
};

/**
 * GET /api/trades/recent?limit=...&tokenCategory=...
 *
 * Returns the most recent swap transactions (optionally for one token),
 * sorted by `createdAt` desc.
 */
export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) || 50 : 50;
  const tokenCategory = request.nextUrl.searchParams.get("tokenCategory") ?? undefined;

  try {
    const coll = await getTransactionsCollection();

    const filter: { type: "swap"; tokenCategory?: string } = { type: "swap" };
    if (tokenCategory) filter.tokenCategory = tokenCategory;

    const trades = await coll
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    const body: TradesResponse = {
      trades,
      total: trades.length,
    };

    return NextResponse.json(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch recent trades";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

