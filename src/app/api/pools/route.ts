import { NextResponse } from "next/server";
import { getAllPools } from "@/dapp/queries/registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/pools
 * Returns all registered pools (from MongoDB registry + on-chain data).
 */
export async function GET() {
  try {
    const result = await getAllPools();
    return NextResponse.json({
      totalPools: result.totalPools,
      totalBchLiquidity: result.totalBchLiquidity,
      tokenCounts: Object.fromEntries(result.tokenCounts),
      pools: result.pools,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch pools";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
