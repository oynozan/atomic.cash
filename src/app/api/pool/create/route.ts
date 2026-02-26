import { NextRequest, NextResponse } from "next/server";

import { registerPoolOwner } from "@/dapp/queries/registry";
import { createPool } from "@/dapp/pool/create";
import { templateToWcTransactionObject } from "@/dapp/walletconnect";
import { getAuthFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/pool/create
 * Body: CreatePoolParams
 * Returns WC transaction object (JSON string) for WalletConnect signing.
 */
export async function POST(request: NextRequest) {
    let body: {
        tokenCategory?: string;
        bchAmount?: number;
        tokenAmount?: number;
        tokenDecimals?: number;
        priceDeviationTolerance?: number;
        useMarketPrice?: boolean;
    };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { tokenCategory, bchAmount, tokenAmount, tokenDecimals, priceDeviationTolerance, useMarketPrice } =
        body;

    const auth = getAuthFromRequest(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!tokenCategory || typeof tokenCategory !== "string" || tokenCategory.trim() === "") {
        return NextResponse.json({ error: "tokenCategory is required" }, { status: 400 });
    }
    try {
        const result = await createPool(
            {
                tokenCategory: tokenCategory.trim(),
                bchAmount,
                tokenAmount,
                tokenDecimals,
                priceDeviationTolerance,
                useMarketPrice,
            },
            {
                ownerTokenAddress: auth.address.trim(),
            },
        );

        if (!result.success || !result.unsignedTx) {
            return NextResponse.json(
                // @ts-expect-error - result.error is not typed
                { error: result.error ?? "Failed to build create-pool transaction" },
                { status: 400 },
            );
        }

        // Ensure pool owner is registered in Mongo so routing & stats can see this owner,
        // even if the frontend later fails to make an explicit registry call.
        await registerPoolOwner(result.unsignedTx.poolOwnerPkhHex, auth.address.trim());

        const wcTransactionJson = templateToWcTransactionObject(result.unsignedTx, {
            broadcast: false,
            userPrompt: "Create Pool",
        });

        return NextResponse.json({
            success: true,
            wcTransactionJson,
            poolAddress: result.poolAddress,
            poolBch: result.poolBch.toString(),
            poolTokens: result.poolTokens.toString(),
            initialPrice: result.initialPrice,
            poolOwnerPkhHex: result.unsignedTx.poolOwnerPkhHex,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create pool";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
