import { NextRequest, NextResponse } from "next/server";
import { getMarketPrice } from "@/dapp/pool/create";

export const dynamic = "force-dynamic";

/**
 * GET /api/pools/price?tokenCategory=...
 * Returns market info for a given token (if any pools exist).
 */
export async function GET(request: NextRequest) {
    const tokenCategory = request.nextUrl.searchParams.get("tokenCategory");
    if (!tokenCategory || tokenCategory.trim() === "") {
        return NextResponse.json({ error: "tokenCategory is required" }, { status: 400 });
    }

    try {
        const info = await getMarketPrice(tokenCategory.trim());
        if (!info) {
            return NextResponse.json({
                hasMarketPools: false,
            });
        }

        return NextResponse.json({
            hasMarketPools: info.hasMarket,
            marketPrice: info.avgPrice,
            totalLiquidity: info.totalLiquidity,
            poolCount: info.poolCount,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch market price";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
