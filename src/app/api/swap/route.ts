import { NextRequest, NextResponse } from "next/server";
import { hexToBin } from "@bitauth/libauth";

import { SwapDirection, SwapType } from "@/dapp/types";
import {
    swapExactBchForTokens,
    swapExactTokensForBch,
    swapBchForExactTokens,
    swapTokensForExactBch,
} from "@/dapp/swap/exchange";
import {
    findBestRouteForBchToToken,
    findBestRouteForTokenToBch,
    findBestRouteForBchForExactTokens,
    findBestRouteForTokensForExactBch,
} from "@/dapp/swap/router";
import { templateToWcTransactionObject } from "@/dapp/walletconnect";

export const dynamic = "force-dynamic";

type SwapBody = {
    direction?: SwapDirection | string;
    tokenCategory?: string;
    amount?: number;
    slippageTolerance?: number;
    userTokenAddress?: string;
    swapType?: SwapType | string;
};

/**
 * POST /api/swap
 * Body: { direction, tokenCategory, amount, slippageTolerance?, userTokenAddress }
 * Uses router.ts to find the best pool, then builds unsigned swap TX.
 */
export async function POST(request: NextRequest) {
    let body: SwapBody;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { direction, tokenCategory, amount, slippageTolerance, userTokenAddress, swapType } =
        body;

    if (
        !direction ||
        (direction !== SwapDirection.BCH_TO_TOKEN && direction !== SwapDirection.TOKEN_TO_BCH)
    ) {
        return NextResponse.json(
            { error: "direction must be bch_to_token or token_to_bch" },
            { status: 400 },
        );
    }

    if (!tokenCategory || typeof tokenCategory !== "string" || tokenCategory.trim() === "") {
        return NextResponse.json({ error: "tokenCategory is required" }, { status: 400 });
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    if (
        !userTokenAddress ||
        typeof userTokenAddress !== "string" ||
        userTokenAddress.trim() === ""
    ) {
        return NextResponse.json(
            { error: "userTokenAddress is required (token-aware address)" },
            { status: 400 },
        );
    }

    const trimmedCategory = tokenCategory.trim();
    const trimmedAddress = userTokenAddress.trim();

    const normalizedSwapType =
        swapType === SwapType.EXACT_OUTPUT || swapType === "exact_output"
            ? SwapType.EXACT_OUTPUT
            : SwapType.EXACT_INPUT;

    try {
        // 1. Find best pool via router.ts (different functions for exact input/output)
        let routeResult;
        if (direction === SwapDirection.BCH_TO_TOKEN) {
            routeResult =
                normalizedSwapType === SwapType.EXACT_INPUT
                    ? await findBestRouteForBchToToken(trimmedCategory, amount)
                    : await findBestRouteForBchForExactTokens(trimmedCategory, amount);
        } else {
            routeResult =
                normalizedSwapType === SwapType.EXACT_INPUT
                    ? await findBestRouteForTokenToBch(trimmedCategory, amount)
                    : await findBestRouteForTokensForExactBch(trimmedCategory, amount);
        }

        if (routeResult.noRouteFound || !routeResult.bestRoute) {
            return NextResponse.json(
                { error: routeResult.error ?? "No suitable pool found for this token." },
                { status: 400 },
            );
        }

        const poolOwnerPkh = hexToBin(routeResult.bestRoute.poolOwnerPkhHex);

        // 2. Build unsigned swap TX using exchange.ts
        const swapResult =
            direction === SwapDirection.BCH_TO_TOKEN
                ? normalizedSwapType === SwapType.EXACT_INPUT
                    ? await swapExactBchForTokens(
                          {
                              tokenCategory: trimmedCategory,
                              bchAmount: amount,
                              slippageTolerance,
                          },
                          {
                              poolOwnerPkh,
                              // Not used by current implementation but required by type
                              userPublicKey: new Uint8Array(),
                              userAddress: trimmedAddress,
                          },
                      )
                    : await swapBchForExactTokens(
                          {
                              tokenCategory: trimmedCategory,
                              tokenAmount: amount,
                              slippageTolerance,
                          },
                          {
                              poolOwnerPkh,
                              userPublicKey: new Uint8Array(),
                              userAddress: trimmedAddress,
                          },
                      )
                : normalizedSwapType === SwapType.EXACT_INPUT
                  ? await swapExactTokensForBch(
                        {
                            tokenCategory: trimmedCategory,
                            tokenAmount: amount,
                            slippageTolerance,
                        },
                        {
                            poolOwnerPkh,
                            userPublicKey: new Uint8Array(),
                            userAddress: trimmedAddress,
                        },
                    )
                  : await swapTokensForExactBch(
                        {
                            tokenCategory: trimmedCategory,
                            bchAmount: amount,
                            slippageTolerance,
                        },
                        {
                            poolOwnerPkh,
                            userPublicKey: new Uint8Array(),
                            userAddress: trimmedAddress,
                        },
                    );

        if (!swapResult.success || !swapResult.unsignedTx) {
            return NextResponse.json(
                { error: swapResult.error ?? "Failed to build swap transaction" },
                { status: 400 },
            );
        }

        const wcTransactionJson = templateToWcTransactionObject(swapResult.unsignedTx, {
            broadcast: false,
            userPrompt: "Swap tokens",
        });

        return NextResponse.json({
            success: true,
            wcTransactionJson,
            direction: swapResult.direction,
            swapType: swapResult.swapType,
            inputAmount: swapResult.inputAmount,
            outputAmount: swapResult.outputAmount,
            priceImpact: swapResult.priceImpact,
            effectivePrice: swapResult.effectivePrice,
            quote: swapResult.quote,
            poolOwnerPkhHex: swapResult.unsignedTx.poolOwnerPkhHex,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to build swap transaction";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
