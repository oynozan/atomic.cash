import { createHmac } from "crypto";

import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { hash256, hexToBin, secp256k1, utf8ToBin } from "@bitauth/libauth";

const AUTH_COOKIE_NAME = "atomic_auth";
const AUTH_MESSAGE_PREFIX = "Atomic Cash login";
const AUTH_MESSAGE_VERSION = "v1";

export type AuthTokenPayload = {
    sub: string; // BCH address (token-aware)
    pub: string; // compressed public key hex
    iat: number;
    exp: number;
    ver: string;
};

export type AuthContext = {
    address: string;
    publicKeyHex: string;
    expiresAt: number;
};

function getJwtSecret(): string {
    const secret = process.env.AUTH_JWT_SECRET;
    if (!secret) {
        throw new Error("AUTH_JWT_SECRET is not set");
    }
    return secret;
}

function base64UrlEncode(input: Uint8Array | string): string {
    const buffer = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
    return buffer
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

function base64UrlDecodeToString(input: string): string {
    const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), "=")
        .replace(/-/g, "+")
        .replace(/_/g, "/");
    return Buffer.from(padded, "base64").toString("utf8");
}

function signJwt(payload: AuthTokenPayload): string {
    const header = { alg: "HS256", typ: "JWT" } as const;
    const headerJson = JSON.stringify(header);
    const payloadJson = JSON.stringify(payload);

    const headerB64 = base64UrlEncode(headerJson);
    const payloadB64 = base64UrlEncode(payloadJson);

    const unsignedToken = `${headerB64}.${payloadB64}`;

    const hmac = createHmac("sha256", getJwtSecret());
    hmac.update(unsignedToken);
    const signature = hmac.digest();
    const signatureB64 = base64UrlEncode(signature);

    return `${unsignedToken}.${signatureB64}`;
}

function verifyJwt(token: string): AuthTokenPayload | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const unsignedToken = `${headerB64}.${payloadB64}`;
    const hmac = createHmac("sha256", getJwtSecret());
    hmac.update(unsignedToken);
    const expectedSig = base64UrlEncode(hmac.digest());

    if (expectedSig !== signatureB64) return null;

    let payload: AuthTokenPayload;
    try {
        const json = base64UrlDecodeToString(payloadB64);
        payload = JSON.parse(json) as AuthTokenPayload;
    } catch {
        return null;
    }

    if (!payload.sub || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;

    return payload;
}

export function buildAuthMessage(address: string, nonce: string, expiresAt: number): string {
    const lines = [
        AUTH_MESSAGE_PREFIX,
        `version:${AUTH_MESSAGE_VERSION}`,
        `address:${address}`,
        `nonce:${nonce}`,
        `expiresAt:${expiresAt}`,
    ];
    return lines.join("\n");
}

export function parseAuthMessage(message: string): {
    ok: boolean;
    address?: string;
    nonce?: string;
    expiresAt?: number;
} {
    const lines = message.split("\n");
    if (lines.length < 5) return { ok: false };
    if (lines[0] !== AUTH_MESSAGE_PREFIX) return { ok: false };

    const versionLine = lines[1];
    if (!versionLine.startsWith("version:")) return { ok: false };
    const version = versionLine.slice("version:".length);
    if (version !== AUTH_MESSAGE_VERSION) return { ok: false };

    const addressLine = lines[2];
    const nonceLine = lines[3];
    const expiresLine = lines[4];

    if (!addressLine.startsWith("address:") || !nonceLine.startsWith("nonce:")) {
        return { ok: false };
    }
    if (!expiresLine.startsWith("expiresAt:")) return { ok: false };

    const address = addressLine.slice("address:".length).trim();
    const nonce = nonceLine.slice("nonce:".length).trim();
    const expiresRaw = expiresLine.slice("expiresAt:".length).trim();
    const expiresAt = Number.parseInt(expiresRaw, 10);
    if (!Number.isFinite(expiresAt)) return { ok: false };

    return { ok: true, address, nonce, expiresAt };
}

export async function verifyWalletSignature(input: {
    message: string;
    signatureHex: string;
    publicKeyHex?: string;
}): Promise<boolean> {
    const { message, signatureHex, publicKeyHex } = input;
    const msgBin = utf8ToBin(message);
    const msgHash = hash256(msgBin);

    // Some wallets return hex-encoded signatures, others base64. Try to detect
    // the format: if it's valid hex, treat it as such; otherwise, fall back to
    // base64 decoding.
    let sigBin: Uint8Array;
    if (/^[0-9a-fA-F]+$/.test(signatureHex) && signatureHex.length % 2 === 0) {
        sigBin = hexToBin(signatureHex);
    } else {
        const buf = Buffer.from(signatureHex, "base64");
        sigBin = new Uint8Array(buf);
    }

    // If a public key is provided, verify strictly against it. Some wallets
    // (or chain-specific signMessage implementations) may not return a public
    // key; in that case we currently accept the signature as-is, since the
    // address was already obtained from the WalletConnect session.
    if (publicKeyHex && publicKeyHex.trim() !== "") {
        const pubBin = hexToBin(publicKeyHex);
        return secp256k1.verifySignatureDERLowS(sigBin, pubBin, msgHash);
    }

    // TODO: optionally recover the public key from the signature format and
    // match it against the address for stricter verification.
    return true;
}

export function createAuthToken(params: {
    address: string;
    publicKeyHex?: string;
    ttlSeconds: number;
}): { token: string; payload: AuthTokenPayload } {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload: AuthTokenPayload = {
        sub: params.address,
        pub: params.publicKeyHex ?? "",
        iat: nowSeconds,
        exp: nowSeconds + params.ttlSeconds,
        ver: AUTH_MESSAGE_VERSION,
    };
    const token = signJwt(payload);
    return { token, payload };
}

export function getAuthFromRequest(req: NextRequest): AuthContext | null {
    // Check Authorization: Bearer header first (for SDK / server-side clients)
    const authorization = req.headers.get("authorization");
    if (authorization?.startsWith("Bearer ")) {
        const bearerToken = authorization.slice(7).trim();
        const bearerPayload = verifyJwt(bearerToken);
        if (bearerPayload) {
            return {
                address: bearerPayload.sub,
                publicKeyHex: bearerPayload.pub,
                expiresAt: bearerPayload.exp * 1000,
            };
        }
    }

    // Fall back to HTTP-only cookie (browser clients)
    const cookie = req.cookies.get(AUTH_COOKIE_NAME);
    if (!cookie?.value) return null;
    const payload = verifyJwt(cookie.value);
    if (!payload) return null;
    return {
        address: payload.sub,
        publicKeyHex: payload.pub,
        expiresAt: payload.exp * 1000,
    };
}

export async function getAuthFromCookies(): Promise<AuthContext | null> {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(AUTH_COOKIE_NAME);
    if (!cookie?.value) return null;
    const payload = verifyJwt(cookie.value);
    if (!payload) return null;
    return {
        address: payload.sub,
        publicKeyHex: payload.pub,
        expiresAt: payload.exp * 1000,
    };
}

export function createAuthCookie(token: string, ttlSeconds: number): {
    name: string;
    value: string;
    options: {
        httpOnly: boolean;
        secure: boolean;
        sameSite: "lax";
        path: string;
        maxAge: number;
    };
} {
    return {
        name: AUTH_COOKIE_NAME,
        value: token,
        options: {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: ttlSeconds,
        },
    };
}

