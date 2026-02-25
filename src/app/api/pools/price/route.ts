import { NextRequest, NextResponse } from "next/server";
import { BCH_DECIMALS } from "@/dapp/config";
import { getMarketPrice } from "@/dapp/pool/create";

export const dynamic = "force-dynamic";

function roundBch(n: number): number {
    if (!Number.isFinite(n)) return n;
    const factor = 10 ** BCH_DECIMALS;
    return Math.round(n * factor) / factor;
}

/**
 * GET /api/pools/price?tokenCategory=...
 * Returns market info for a given token (if any pools exist).
 * marketPrice is rounded to BCH decimals to avoid float precision issues in JSON.
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
            marketPrice: roundBch(info.avgPrice),
            totalLiquidity: info.totalLiquidity,
            poolCount: info.poolCount,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch market price";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
