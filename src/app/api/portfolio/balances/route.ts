import { NextRequest, NextResponse } from "next/server";

import { getUserBalances } from "@/dapp/queries/user";
import { getAuthFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/portfolio/balances
 * Returns BCH and token balances for the given Cash address (token-aware).
 */
export async function GET(request: NextRequest) {
    const auth = getAuthFromRequest(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const balance = await getUserBalances(auth.address.trim());

        return NextResponse.json({
            bch: balance.bch,
            bchRaw: balance.bchRaw.toString(),
            tokens: balance.tokens.map(t => ({
                category: t.category,
                symbol: t.symbol,
                name: t.name,
                decimals: t.decimals,
                amount: t.amount,
                amountRaw: t.amountRaw.toString(),
                iconUrl: t.iconUrl,
            })),
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch balances";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
