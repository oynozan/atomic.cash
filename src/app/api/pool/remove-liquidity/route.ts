import { NextRequest, NextResponse } from "next/server";

import { removeLiquidity } from "@/dapp/pool/removeLiquidity";
import { templateToWcTransactionObject, serializeUnsignedTxTemplate } from "@/dapp/walletconnect";
import { getAuthFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/pool/remove-liquidity
 * Body: { tokenCategory, percentage?, bchAmount?, withdrawAll? }
 * Returns WC transaction object (JSON string) for WalletConnect signing.
 */
export async function POST(request: NextRequest) {
    let body: {
        tokenCategory?: string;
        percentage?: number;
        bchAmount?: number;
        withdrawAll?: boolean;
    };

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { tokenCategory, percentage, bchAmount, withdrawAll } = body;

    const auth = getAuthFromRequest(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!tokenCategory || typeof tokenCategory !== "string" || tokenCategory.trim() === "") {
        return NextResponse.json({ error: "tokenCategory is required" }, { status: 400 });
    }
    const hasWithdrawAll = withdrawAll === true;
    const hasPercentage =
        typeof percentage === "number" &&
        Number.isFinite(percentage) &&
        percentage >= 1 &&
        percentage <= 100;
    const hasBchAmount =
        typeof bchAmount === "number" && Number.isFinite(bchAmount) && bchAmount > 0;
    if (!hasWithdrawAll && !hasPercentage && !hasBchAmount) {
        return NextResponse.json(
            {
                error: "Provide either withdrawAll: true, or percentage (1–100), or a positive bchAmount",
            },
            { status: 400 },
        );
    }

    try {
        const result = await removeLiquidity(
            {
                tokenCategory: tokenCategory.trim(),
                percentage,
                bchAmount,
                withdrawAll,
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
            userPrompt: "Remove Liquidity",
        });

        return NextResponse.json({
            success: true,
            wcTransactionJson,
            unsignedTxTemplate: serializeUnsignedTxTemplate(result.unsignedTx),
            poolOwnerPkhHex: result.unsignedTx.poolOwnerPkhHex,
            bchWithdrawn: result.bchWithdrawn,
            tokensWithdrawn: result.tokensWithdrawn,
        });
    } catch (err) {
        const message =
            err instanceof Error ? err.message : "Failed to build remove-liquidity transaction";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
