import { NextRequest, NextResponse } from "next/server";
import { getPoolsByAddress } from "@/dapp/queries/user";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/pools?address=...
 * Returns pools owned by the given address (normal or token-aware).
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || address.trim() === "") {
    return NextResponse.json(
      { error: "Missing or empty address" },
      { status: 400 },
    );
  }

  try {
    const pools = await getPoolsByAddress(address.trim());
    return NextResponse.json({ pools });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch user pools";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

