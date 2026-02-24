import { NextRequest, NextResponse } from "next/server";
import { getRecentTx } from "@/dapp/queries/txHistory";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfolio/history?address=...&limit=...
 * Returns recent transactions for the given address.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  const limitParam = request.nextUrl.searchParams.get("limit");

  if (!address || address.trim() === "") {
    return NextResponse.json({ error: "Missing or empty address" }, { status: 400 });
  }

  const limit = limitParam ? Number.parseInt(limitParam, 10) || 10 : 10;

  try {
    const txs = await getRecentTx(address.trim(), limit);
    return NextResponse.json({
      transactions: txs,
      total: txs.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch transaction history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

