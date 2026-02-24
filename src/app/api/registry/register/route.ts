import { NextRequest, NextResponse } from "next/server";
import { registerPoolOwner } from "@/dapp/queries/registry";

export const dynamic = "force-dynamic";

/**
 * POST /api/registry/register
 * Body: { pkhHex: string, address?: string, label?: string }
 * Call this after a pool is created and broadcast to list the pool in the pools page.
 */
export async function POST(request: NextRequest) {
  let body: { pkhHex?: string; address?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pkhHex, address, label } = body;
  if (!pkhHex || typeof pkhHex !== "string" || pkhHex.trim() === "") {
    return NextResponse.json(
      { error: "pkhHex is required (pool owner public key hash, hex)" },
      { status: 400 }
    );
  }

  try {
    await registerPoolOwner(pkhHex.trim(), address?.trim(), label?.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to register pool owner";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
