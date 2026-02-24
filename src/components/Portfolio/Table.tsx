"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useWalletSession } from "@/components/Wrappers/Wallet";
import ConnectWallet from "@/components/Header/Connect";

type TokenBalanceItem = {
  category: string;
  symbol?: string;
  /** Token name from BCMR */
  name?: string | null;
  decimals: number;
  amount: number;
  amountRaw: string;
  iconUrl?: string | null;
};

type BalancesResponse = {
  bch: number;
  bchRaw: string;
  tokens: TokenBalanceItem[];
};

function formatAmount(value: number, maxDecimals = 6): string {
  if (value === 0) return "0";
  if (value >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
  const s = value.toFixed(maxDecimals);
  return parseFloat(s).toString();
}

export default function PortfolioTable() {
  const { address, isConnected } = useWalletSession();
  const [data, setData] = useState<BalancesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address?.trim()) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
    fetch(`/api/portfolio/balances?address=${encodeURIComponent(address)}`)
      .then((res) => {
        if (!res.ok) return res.json().then((b) => Promise.reject(new Error(b?.error || res.statusText)));
        return res.json();
      })
      .then((json: BalancesResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load balances");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

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

  const tokenCount = rows.length;

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
      </div>

      <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)] px-5 py-2 text-[11px] text-muted-foreground border-b">
        <div>Token</div>
        <div className="text-right">Balance</div>
      </div>

      <div>
        {rows.map((row, i) => (
          <div
            key={row.type === "bch" ? "bch" : row.category ?? i}
            className={`flex items-center w-full py-3 px-5 gap-4 ${
              i % 2 === 0 ? "bg-background/30" : "bg-background/10"
            }`}
          >
            <div className="flex items-center gap-2 min-w-[120px]">
              {row.type === "bch" ? (
                <Image src="/icons/bch.svg" alt="BCH" width={24} height={24} />
              ) : row.iconUrl ? (
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
