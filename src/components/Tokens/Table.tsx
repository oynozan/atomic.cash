"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useTokensOverviewStore, type TokenOverview, type TokensOverviewResponse } from "@/store/tokensOverview";

function formatNumber(n: number | null, maxDecimals = 6): string {
  if (n == null || !Number.isFinite(n)) return "-";
  const fixed = n.toFixed(maxDecimals);
  const [intPart, decPart] = fixed.split(".");
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const dec = (decPart || "").replace(/0+$/, "");
  return dec ? `${intWithSep}.${dec}` : intWithSep;
}

function formatPercent(n: number | null): { label: string; positive: boolean } {
  if (n == null || !Number.isFinite(n)) return { label: "–", positive: true };
  const rounded = n.toFixed(2);
  return { label: `${rounded}%`, positive: n >= 0 };
}

export default function TokensTable() {
  const { data, loading, error, fetch: fetchTokens } = useTokensOverviewStore();
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const tokens = data?.tokens ?? [];

  const filteredTokens = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tokens;
    return tokens.filter((t) => {
      const symbol = t.symbol ?? "";
      const name = t.name ?? "";
      const category = t.tokenCategory;
      return (
        symbol.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        category.toLowerCase().includes(q)
      );
    });
  }, [tokens, search]);

  if (loading && !tokens.length) {
    return (
      <div className="rounded-[24px] border bg-popover flex items-center justify-center py-10 px-6 text-muted-foreground">
        Loading tokens…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-destructive/50 bg-destructive/5 flex items-center justify-center py-10 px-6 text-destructive text-sm text-center">
        {error}
      </div>
    );
  }

  if (!tokens.length) {
    return (
      <div className="rounded-[24px] border bg-popover py-6 px-6 text-sm text-muted-foreground">
        No tokens yet.
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border bg-popover py-4 px-4 flex flex-col gap-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-foreground">Tokens</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tokens"
          className="w-40 md:w-56 rounded-full border bg-background/40 px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      {/* Header */}
      <div className="grid grid-cols-[40px_minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] px-3 py-2 text-[11px] text-muted-foreground border-b border-border/60">
        <div>#</div>
        <div>Token name</div>
        <div>Price</div>
        <div>1 day</div>
        <div>7 days</div>
        <div>TVL</div>
        <div>30d Volume</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/40">
        {filteredTokens.map((t, idx) => {
          const change1d = formatPercent(t.change1dPercent);
          const change7d = formatPercent(t.change7dPercent);

          return (
            <Link
              key={t.tokenCategory}
              href={`/swap/${t.tokenCategory}`}
              className="grid grid-cols-[40px_minmax(0,2.5fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.6fr)] items-center px-3 py-3 text-xs hover:bg-background/40 transition-colors cursor-pointer"
            >
              <div className="text-[11px] text-muted-foreground">{idx + 1}</div>

              {/* Token name */}
              <div className="flex items-center gap-2">
                {t.iconUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.iconUrl}
                    alt={t.symbol}
                    className="size-6 rounded-full object-cover border border-background/40"
                  />
                )}
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{t.name ?? t.symbol ?? "Token"}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t.symbol ?? t.tokenCategory.slice(0, 6)}
                  </span>
                </div>
              </div>

              {/* Price */}
              <div className="font-mono text-[11px]">
                {formatNumber(t.priceBch, 8)} BCH
              </div>

              {/* 1 day */}
              <div className="flex items-center gap-1">
                {change1d.label !== "–" &&
                  (change1d.positive ? (
                    <ArrowUpRight className="size-3 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="size-3 text-red-400" />
                  ))}
                <span
                  className={
                    change1d.label === "–"
                      ? "text-[11px] text-muted-foreground"
                      : change1d.positive
                        ? "text-[11px] text-emerald-400"
                        : "text-[11px] text-red-400"
                  }
                >
                  {change1d.label}
                </span>
              </div>

              {/* 7 days */}
              <div className="flex items-center gap-1">
                {change7d.label !== "–" &&
                  (change7d.positive ? (
                    <ArrowUpRight className="size-3 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="size-3 text-red-400" />
                  ))}
                <span
                  className={
                    change7d.label === "–"
                      ? "text-[11px] text-muted-foreground"
                      : change7d.positive
                        ? "text-[11px] text-emerald-400"
                        : "text-[11px] text-red-400"
                  }
                >
                  {change7d.label}
                </span>
              </div>

              {/* TVL */}
              <div className="font-mono text-[11px]">
                {formatNumber(t.tvlBch, 4)} BCH
              </div>

              {/* 30d Volume */}
              <div className="font-mono text-[11px]">
                {formatNumber(t.volume30dBch, 4)} BCH
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

