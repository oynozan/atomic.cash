import { NextRequest, NextResponse } from "next/server";
import { provider } from "@/dapp/common";

export const dynamic = "force-dynamic";

/**
 * POST /api/tx/broadcast
 * Body: { signedTxHex: string }
 * Broadcasts a signed transaction and returns the txid.
 */
export async function POST(request: NextRequest) {
  let body: { signedTxHex?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { signedTxHex } = body;
  if (!signedTxHex || typeof signedTxHex !== "string" || signedTxHex.trim() === "") {
    return NextResponse.json({ error: "signedTxHex is required" }, { status: 400 });
  }

  try {
    const txid = await provider.sendRawTransaction(signedTxHex.trim());
    return NextResponse.json({ ok: true, txid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to broadcast transaction";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
