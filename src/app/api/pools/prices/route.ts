import { NextRequest, NextResponse } from "next/server";

import { getMarketPrice } from "@/dapp/pool/create";

export const dynamic = "force-dynamic";

type PriceInfo = {
    hasMarketPools: boolean;
    marketPrice: number | null;
    totalLiquidity?: number;
    poolCount?: number;
};

type PricesResponse = {
    prices: Record<string, PriceInfo>;
};

/**
 * GET /api/pools/prices?tokenCategory=cat1&tokenCategory=cat2...
 *
 * Bulk market price lookup for multiple tokens.
 * Internally reuses getMarketPrice for each token category.
 */
export async function GET(request: NextRequest) {
    const url = request.nextUrl;
    let categories = url.searchParams.getAll("tokenCategory");

    // Also support comma-separated tokenCategories param for convenience.
    const csv = url.searchParams.get("tokenCategories");
    if (csv) {
        categories = categories.concat(
            csv
                .split(",")
                .map(c => c.trim())
                .filter(c => c.length > 0),
        );
    }

    const unique = Array.from(new Set(categories.map(c => c.trim()).filter(c => c !== "")));

    if (unique.length === 0) {
        return NextResponse.json(
            { error: "At least one tokenCategory is required" },
            { status: 400 },
        );
    }

    try {
        const entries = await Promise.all(
            unique.map(async cat => {
                const info = await getMarketPrice(cat);
                if (!info || !info.hasMarket) {
                    return [
                        cat,
                        {
                            hasMarketPools: false,
                            marketPrice: null,
                        } as PriceInfo,
                    ] as const;
                }
                return [
                    cat,
                    {
                        hasMarketPools: true,
                        marketPrice: info.avgPrice,
                        totalLiquidity: info.totalLiquidity,
                        poolCount: info.poolCount,
                    } as PriceInfo,
                ] as const;
            }),
        );

        const prices: Record<string, PriceInfo> = {};
        for (const [cat, info] of entries) {
            prices[cat] = info;
        }

        const body: PricesResponse = { prices };
        return NextResponse.json(body);
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch bulk market prices";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
