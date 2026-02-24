import { NextRequest, NextResponse } from "next/server";
import { removeLiquidity } from "@/dapp/pool/removeLiquidity";
import { templateToWcTransactionObject } from "@/dapp/walletconnect";

export const dynamic = "force-dynamic";

/**
 * POST /api/pool/remove-liquidity
 * Body: { tokenCategory, percentage?, bchAmount?, withdrawAll?, ownerTokenAddress }
 * Returns WC transaction object (JSON string) for WalletConnect signing.
 */
export async function POST(request: NextRequest) {
  let body: {
    tokenCategory?: string;
    percentage?: number;
    bchAmount?: number;
    withdrawAll?: boolean;
    ownerTokenAddress?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tokenCategory, percentage, bchAmount, withdrawAll, ownerTokenAddress } = body;

  if (!tokenCategory || typeof tokenCategory !== "string" || tokenCategory.trim() === "") {
    return NextResponse.json({ error: "tokenCategory is required" }, { status: 400 });
  }
  if (!ownerTokenAddress || typeof ownerTokenAddress !== "string" || ownerTokenAddress.trim() === "") {
    return NextResponse.json(
      { error: "ownerTokenAddress is required (token-aware address)" },
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
        ownerTokenAddress: ownerTokenAddress.trim(),
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

