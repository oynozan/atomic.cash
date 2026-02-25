import { NextRequest, NextResponse } from "next/server";
import { hexToBin } from "@bitauth/libauth";

import { SwapDirection, SwapType } from "@/dapp/types";
import { findBestRouteForBchToToken, findBestRouteForTokenToBch } from "@/dapp/swap/router";
import { getQuote } from "@/dapp/queries/price";
import { getBestPoolForToken } from "@/dapp/queries/registry";

export const dynamic = "force-dynamic";

type QuoteBody = {
    direction?: SwapDirection | string;
    swapType?: SwapType | string;
    tokenCategory?: string;
    amount?: number;
    slippageTolerance?: number;
};

/**
 * POST /api/swap/quote
 * Body: { direction, swapType, tokenCategory, amount, slippageTolerance? }
 * Returns a price quote for the best pool (no unsigned TX is created).
 */
export async function POST(request: NextRequest) {
    let body: QuoteBody;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { direction, swapType, tokenCategory, amount, slippageTolerance } = body;

    if (
        !direction ||
        (direction !== SwapDirection.BCH_TO_TOKEN && direction !== SwapDirection.TOKEN_TO_BCH)
    ) {
        return NextResponse.json(
            { error: "direction must be bch_to_token or token_to_bch" },
            { status: 400 },
        );
    }

    const normalizedSwapType =
        swapType === SwapType.EXACT_OUTPUT || swapType === "exact_output"
            ? SwapType.EXACT_OUTPUT
            : SwapType.EXACT_INPUT;

    if (!tokenCategory || tokenCategory.trim() === "") {
        return NextResponse.json({ error: "tokenCategory is required" }, { status: 400 });
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const trimmedCategory = tokenCategory.trim();

    try {
        // 1. Find best pool via router.ts; if none, fall back to best single pool
        let poolOwnerPkhHex: string | null = null;
        let poolAddress: string | null = null;

        const shouldUseRouter =
            normalizedSwapType === SwapType.EXACT_INPUT &&
            (direction === SwapDirection.BCH_TO_TOKEN || direction === SwapDirection.TOKEN_TO_BCH);

        if (shouldUseRouter) {
            let routeResult;
            if (direction === SwapDirection.BCH_TO_TOKEN) {
                routeResult = await findBestRouteForBchToToken(trimmedCategory, amount);
            } else {
                routeResult = await findBestRouteForTokenToBch(trimmedCategory, amount);
            }

            if (!routeResult.noRouteFound && routeResult.bestRoute) {
                poolOwnerPkhHex = routeResult.bestRoute.poolOwnerPkhHex;
                poolAddress = routeResult.bestRoute.poolAddress;
            }
        }

        // Fallback: use best single pool for token (same logic as Pools page)
        if (!poolOwnerPkhHex) {
            const bestPool = await getBestPoolForToken(trimmedCategory);
            if (!bestPool) {
                return NextResponse.json(
                    { error: "No suitable pool found for this token." },
                    { status: 400 },
                );
            }
            poolOwnerPkhHex = bestPool.poolOwnerPkhHex;
            poolAddress = bestPool.poolAddress;
        }

        const poolOwnerPkh = hexToBin(poolOwnerPkhHex);

        // 2. Use price.getQuote to compute quote
        const quote = await getQuote({
            poolOwnerPkh,
            tokenCategory: trimmedCategory,
            direction,
            swapType: normalizedSwapType,
            amount,
            slippageTolerance,
        });

        if (!quote) {
            return NextResponse.json(
                { error: "Failed to compute quote for this pool" },
                { status: 400 },
            );
        }

        // IMPORTANT: strip BigInt fields from quote before serializing
        // and only return the numeric fields needed by the UI.
        return NextResponse.json({
            success: true,
            direction,
            swapType: normalizedSwapType,
            pool: {
                ownerPkhHex: poolOwnerPkhHex,
                address: poolAddress,
            },
            quote: {
                inputAmount: quote.inputAmount,
                outputAmount: quote.outputAmount,
                priceImpact: quote.priceImpact,
                effectivePrice: quote.effectivePrice,
                feeAmount: quote.feeAmount,
                minimumReceived: quote.minimumReceived,
                maximumSent: quote.maximumSent,
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to compute quote";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
