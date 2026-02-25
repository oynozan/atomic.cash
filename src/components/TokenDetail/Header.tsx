"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export type TokenDetailHeaderData = {
    symbol?: string;
    name?: string;
    iconUrl?: string;
    priceBch: number | null;
    change1dPercent: number | null;
    change7dPercent: number | null;
};

function formatBch(n: number | null): string {
    if (n == null || !Number.isFinite(n)) return "–";
    if (Math.abs(n) < 0.00000001) return "0";
    const fixed = n.toFixed(8);
    const [intPart, decPart] = fixed.split(".");
    const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const dec = (decPart || "").replace(/0+$/, "");
    return dec ? `${intWithSep}.${dec}` : intWithSep;
}

export default function TokenDetailHeader({ data }: { data: TokenDetailHeaderData }) {
    const rawChange = data.change1dPercent ?? data.change7dPercent ?? null;
    const hasRawChange = rawChange != null && Number.isFinite(rawChange);
    const change =
        hasRawChange && Math.abs(rawChange as number) >= 0.005 ? (rawChange as number) : null;
    const hasChange = change != null;
    const positive = hasChange && change! >= 0;

    return (
        <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
                {data.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={data.iconUrl}
                        alt={data.symbol ?? ""}
                        className="size-12 rounded-full object-cover border border-background/40"
                    />
                ) : (
                    <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-semibold">
                        {(data.symbol ?? data.name ?? "T").slice(0, 1)}
                    </div>
                )}
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-figtree font-bold text-foreground">
                        {data.name ?? data.symbol ?? "Token"}
                    </h1>
                    <span className="text-sm font-medium text-muted-foreground">
                        {data.symbol ?? ""}
                    </span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xl font-semibold text-foreground">
                    {formatBch(data.priceBch)} BCH
                </span>
                {hasChange && (
                    <span
                        className={
                            "inline-flex items-center gap-1 text-sm font-medium " +
                            (positive ? "text-emerald-400" : "text-red-400")
                        }
                    >
                        {positive ? (
                            <ArrowUpRight className="size-4" />
                        ) : (
                            <ArrowDownRight className="size-4" />
                        )}
                        {Math.abs(change!).toFixed(2)}%
                    </span>
                )}
            </div>
        </div>
    );
}
