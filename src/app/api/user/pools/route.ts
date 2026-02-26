import { NextRequest, NextResponse } from "next/server";

import { getPoolsByAddress } from "@/dapp/queries/user";
import { getAuthFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/pools
 * Returns pools owned by the given address (normal or token-aware).
 */
export async function GET(request: NextRequest) {
    const auth = getAuthFromRequest(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const pools = await getPoolsByAddress(auth.address.trim());
        return NextResponse.json({ pools });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch user pools";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
