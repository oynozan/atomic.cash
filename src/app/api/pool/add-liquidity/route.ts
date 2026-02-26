import { NextRequest, NextResponse } from "next/server";

import { addLiquidity } from "@/dapp/pool/addLiquidity";
import { templateToWcTransactionObject } from "@/dapp/walletconnect";
import { getAuthFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/pool/add-liquidity
 * Body: { tokenCategory, bchAmount?, tokenAmount? }
 * Returns WC transaction object (JSON string) for WalletConnect signing.
 */
export async function POST(request: NextRequest) {
    let body: {
        tokenCategory?: string;
        bchAmount?: number;
        tokenAmount?: number;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { tokenCategory, bchAmount, tokenAmount } = body;

    const auth = getAuthFromRequest(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!tokenCategory || typeof tokenCategory !== "string" || tokenCategory.trim() === "") {
        return NextResponse.json({ error: "tokenCategory is required" }, { status: 400 });
    }
    const hasBch = typeof bchAmount === "number" && Number.isFinite(bchAmount) && bchAmount > 0;
    const hasToken =
        typeof tokenAmount === "number" && Number.isFinite(tokenAmount) && tokenAmount > 0;
    if (!hasBch && !hasToken) {
        return NextResponse.json(
            {
                error: "At least one of bchAmount or tokenAmount is required and must be a positive number",
            },
            { status: 400 },
        );
    }

    try {
        const result = await addLiquidity(
            {
                tokenCategory: tokenCategory.trim(),
                bchAmount,
                tokenAmount,
            },
            {
                ownerTokenAddress: auth.address.trim(),
            },
        );

        if (!result.success || !result.unsignedTx) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        const wcTransactionJson = templateToWcTransactionObject(result.unsignedTx, {
            broadcast: false,
            userPrompt: "Add Liquidity",
        });

        return NextResponse.json({
            success: true,
            wcTransactionJson,
            poolOwnerPkhHex: result.unsignedTx.poolOwnerPkhHex,
            bchAdded: result.bchAdded,
            tokensAdded: result.tokensAdded,
        });
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Failed to build add-liquidity transaction";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
