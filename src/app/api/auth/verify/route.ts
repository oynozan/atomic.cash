import { NextRequest, NextResponse } from "next/server";

import {
    createAuthCookie,
    createAuthToken,
    getAuthFromRequest,
    parseAuthMessage,
    verifyWalletSignature,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

type VerifyBody = {
    address?: string;
    message?: string;
    signatureHex?: string;
    publicKeyHex?: string;
};

/**
 * POST /api/auth/verify
 * Body: { address, message, signatureHex, publicKeyHex }
 *
 * Verifies signed login message and issues an auth cookie.
 */
export async function POST(request: NextRequest) {
    let body: VerifyBody;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const address = body.address?.trim();
    const message = body.message?.trim();
    const signatureHex = body.signatureHex?.trim();
    const publicKeyHex = body.publicKeyHex?.trim();

    if (!address || !message || !signatureHex) {
        return NextResponse.json(
            { error: "address, message and signatureHex are required" },
            { status: 400 },
        );
    }

    const parsed = parseAuthMessage(message);
    if (!parsed.ok || !parsed.address || !parsed.expiresAt) {
        return NextResponse.json({ error: "Invalid auth message format" }, { status: 400 });
    }

    if (parsed.address !== address) {
        return NextResponse.json({ error: "Auth message address does not match" }, { status: 400 });
    }

    if (parsed.expiresAt < Date.now()) {
        return NextResponse.json({ error: "Auth message has expired" }, { status: 400 });
    }

    const valid = await verifyWalletSignature({ message, signatureHex, publicKeyHex });
    if (!valid) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // 1 week auth cookie by default
    const ttlSeconds = 7 * 24 * 60 * 60;
    const { token, payload } = createAuthToken({
        address,
        publicKeyHex,
        ttlSeconds,
    });

    const cookie = createAuthCookie(token, ttlSeconds);
    const response = NextResponse.json({
        ok: true,
        address: payload.sub,
        publicKeyHex: payload.pub,
        expiresAt: payload.exp * 1000,
        token,
    });

    response.cookies.set(cookie.name, cookie.value, cookie.options);

    return response;
}

/**
 * GET /api/auth/verify
 * Returns current auth context if the cookie is present and valid.
 */
export async function GET(request: NextRequest) {
    const auth = getAuthFromRequest(request);
    if (!auth) {
        return NextResponse.json({ authenticated: false }, { status: 200 });
    }
    return NextResponse.json({
        authenticated: true,
        address: auth.address,
        publicKeyHex: auth.publicKeyHex,
        expiresAt: auth.expiresAt,
    });
}

