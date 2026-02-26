import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { buildAuthMessage } from "@/lib/auth";

export const dynamic = "force-dynamic";

type ChallengeBody = {
    address?: string;
};

/**
 * POST /api/auth/challenge
 * Body: { address }
 *
 * Returns a short-lived login message that the wallet must sign.
 */
export async function POST(request: NextRequest) {
    let body: ChallengeBody;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const address = body.address?.trim();
    if (!address) {
        return NextResponse.json({ error: "address is required" }, { status: 400 });
    }

    const now = Date.now();
    const ttlMs = 5 * 60 * 1000; // 5 minutes
    const expiresAt = now + ttlMs;
    const nonce = randomUUID();

    const message = buildAuthMessage(address, nonce, expiresAt);

    return NextResponse.json({
        message,
        expiresAt,
    });
}

