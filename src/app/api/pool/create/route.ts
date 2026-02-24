import { NextRequest, NextResponse } from "next/server";
import { createPool } from "@/dapp/pool/create";
import { templateToWcTransactionObject } from "@/dapp/walletconnect";

export const dynamic = "force-dynamic";

/**
 * POST /api/pool/create
 * Body: CreatePoolParams + { ownerTokenAddress: string }
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
    ownerTokenAddress?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    tokenCategory,
    bchAmount,
    tokenAmount,
    tokenDecimals,
    priceDeviationTolerance,
    useMarketPrice,
    ownerTokenAddress,
  } = body;

  if (!tokenCategory || typeof tokenCategory !== "string" || tokenCategory.trim() === "") {
    return NextResponse.json({ error: "tokenCategory is required" }, { status: 400 });
  }
  if (!ownerTokenAddress || typeof ownerTokenAddress !== "string" || ownerTokenAddress.trim() === "") {
    return NextResponse.json({ error: "ownerTokenAddress is required (token-aware address)" }, { status: 400 });
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
        ownerTokenAddress: ownerTokenAddress.trim(),
      }
    );

    if (!result.success || !result.unsignedTx) {
      return NextResponse.json({ error: result.error ?? "Failed to build create-pool transaction" }, { status: 400 });
    }

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
