"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useWalletSession } from "@/components/Wrappers/Wallet";
import ConnectWallet from "@/components/Header/Connect";
import { usePortfolioBalancesStore } from "@/store/portfolioBalances";

function formatAmount(value: number, maxDecimals = 6): string {
  if (value === 0) return "0";
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
  const s = value.toFixed(maxDecimals);
  return parseFloat(s).toString();
}

export default function PortfolioTable({ showViewAllLink = true }: { showViewAllLink?: boolean }) {
  const { address, isConnected } = useWalletSession();
  const fetchBalances = usePortfolioBalancesStore((s) => s.fetch);
  const byAddress = usePortfolioBalancesStore((s) => s.byAddress);
  const loadingByAddress = usePortfolioBalancesStore((s) => s.loading);
  const errorByAddress = usePortfolioBalancesStore((s) => s.error);

  const data = address ? (byAddress[address]?.data ?? null) : null;
  const loading = address ? (loadingByAddress[address] ?? false) : false;
  const error = address ? (errorByAddress[address] ?? null) : null;

  useEffect(() => {
    if (!address?.trim()) return;
    fetchBalances(address);
  }, [address, fetchBalances]);

  const rows: {
    type: "bch" | "token";
    symbol: string;
    name: string;
    amount: number;
    category?: string;
    iconUrl?: string | null;
  }[] = [];

  if (data) {
    if (data.bch > 0) {
      rows.push({ type: "bch", symbol: "BCH", name: "Bitcoin Cash", amount: data.bch });
    }
    for (const t of data.tokens) {
      if (t.amount > 0) {
        rows.push({
          type: "token",
          symbol: t.symbol ?? t.category.slice(0, 8),
          name: t.name ?? t.symbol ?? t.category.slice(0, 8) + "…",
          amount: t.amount,
          category: t.category,
          iconUrl: t.iconUrl,
        });
      }
    }
  }

  // BCH always at the top, then tokens by largest balance
  const bchRow = rows.find((r) => r.type === "bch");
  const tokenRows = rows
    .filter((r) => r.type === "token")
    .sort((a, b) => b.amount - a.amount);

  // Show BCH + all tokens on the overview card
  const visibleTokens = tokenRows;
  const tokenCount = tokenRows.length + (bchRow ? 1 : 0);

  if (!isConnected || !address) {
    return (
      <div className="rounded-[24px] border border-dashed bg-muted/30 flex flex-col items-center justify-center py-10 px-6">
        <p className="text-muted-foreground text-center mb-4">
          Connect your wallet to see your BCH and token balances.
        </p>
        <ConnectWallet className="py-3 px-5" />
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-[24px] border bg-popover flex items-center justify-center py-10 px-6 text-muted-foreground">
        Loading balances…
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

  if (!data || tokenCount === 0) {
    return (
      <div className="rounded-[24px] border bg-popover py-6 px-6 text-sm text-muted-foreground">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Tokens</div>
            <div className="text-xs text-muted-foreground">No balances yet</div>
          </div>
        </div>
        <p className="text-xs">
          Swap or add liquidity to receive BCH or CashTokens. Your assets will be listed here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border bg-popover overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-secondary/80">
        <div>
          <div className="text-sm font-semibold text-foreground">Tokens</div>
          <div className="text-xs text-muted-foreground">
            {tokenCount} token{tokenCount > 1 ? "s" : ""}
          </div>
        </div>
        {showViewAllLink && (
          <Link
            href="/portfolio/tokens"
            className="text-[11px] font-medium text-primary hover:underline"
          >
            View all tokens →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] px-5 py-2 text-[11px] text-muted-foreground border-b">
        <div>Token</div>
        <div className="text-right">Balance</div>
      </div>

      <div>
        {bchRow && (
          <div className="flex items-center w-full py-3 px-5 gap-4 bg-background/20">
            <div className="flex items-center gap-2 min-w-[120px]">
              <Image src="/icons/bch.svg" alt="BCH" width={24} height={24} />
              <div className="flex flex-col">
                <span className="font-medium text-sm">BCH</span>
                <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                  Bitcoin Cash
                </span>
              </div>
            </div>
            <div className="flex-1 text-right text-sm font-mono tabular-nums">
              {formatAmount(bchRow.amount)}
            </div>
          </div>
        )}

        {visibleTokens.map((row, i) => (
          <div
            key={row.category ?? i}
            className={`flex items-center w-full py-3 px-5 gap-4 ${
              i % 2 === 0 ? "bg-background/30" : "bg-background/10"
            }`}
          >
            <div className="flex items-center gap-2 min-w-[120px]">
              {row.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- BCMR icon URLs are dynamic (various domains)
                <img
                  src={row.iconUrl}
                  alt={row.symbol}
                  className="w-6 h-6 rounded-full object-cover"
                  width={24}
                  height={24}
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  {row.symbol.slice(0, 1)}
                </div>
              )}
              <div className="flex flex-col">
                <span className="font-medium text-sm">{row.symbol}</span>
                <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">
                  {row.name}
                </span>
              </div>
            </div>
            <div className="flex-1 text-right text-sm font-mono tabular-nums">
              {formatAmount(row.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
