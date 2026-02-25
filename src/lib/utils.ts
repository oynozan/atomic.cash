import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export const formatError = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
        return JSON.stringify(error);
    } catch {
        return "Failed to connect wallet.";
    }
};

export const formatAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
};

/** BCH uses 8 decimals (satoshi). Use for all BCH price/amount displays so they stay consistent. */
export const BCH_DECIMALS = 8;

/** Round to BCH precision to avoid float display issues (e.g. 0.00000025 becoming 0.0000002). */
export function roundBch(n: number): number {
    if (!Number.isFinite(n)) return n;
    const factor = 10 ** BCH_DECIMALS;
    return Math.round(n * factor) / factor;
}

/** Format BCH price/amount with exactly BCH_DECIMALS; rounds first so "5" doesn't disappear. */
export function formatBchPrice(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return "-";
    if (Math.abs(n) < 10 ** -BCH_DECIMALS) return "0";
    const rounded = roundBch(n);
    const fixed = rounded.toFixed(BCH_DECIMALS);
    const [intPart, decPart] = fixed.split(".");
    const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const dec = (decPart || "").replace(/0+$/, "");
    return dec ? `${intWithSep}.${dec}` : intWithSep;
}

/** General BCH amount formatter for balances/TVL/volume (no K/M). */
export function formatBchAmount(n: number | null | undefined): string {
    return (() => {
        if (n == null || !Number.isFinite(n)) return "-";
        const abs = Math.abs(n);
        if (abs >= 0.0001) return n.toFixed(6);
        if (abs >= 0.01) return n.toFixed(4);
        if (abs >= 1) return n.toFixed(2);
        return n.toFixed(8);
    })().replace(/\.?0+$/, "");
}

/** Compact BCH formatter with K/M suffix for high-level stats. */
export function formatBchCompact(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return "-";
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return formatBchAmount(n);
}
