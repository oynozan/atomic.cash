"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ExternalLink } from "lucide-react";
import { getExplorerUrl } from "@/dapp/explorer";

type StoredTrade = {
  txid: string;
  address: string;
  type: "swap";
  direction?: "bch_to_token" | "token_to_bch";
  tokenCategory?: string;
  amounts?: {
    bchIn?: number;
    bchOut?: number;
    tokenIn?: number;
    tokenOut?: number;
  };
  createdAt: number;
};

type TradesResponse = { trades: StoredTrade[]; total: number };

function formatNumber(n: number, maxDecimals = 6): string {
  if (!Number.isFinite(n)) return "-";
  const fixed = n.toFixed(maxDecimals);
  const [intPart, decPart] = fixed.split(".");
  const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const dec = (decPart || "").replace(/0+$/, "");
  return dec ? `${intWithSep}.${dec}` : intWithSep;
}

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function TokenDetailTradeHistory({
  tokenCategory,
  tokenSymbol,
  tokenIconUrl,
}: {
  tokenCategory: string;
  tokenSymbol?: string;
  tokenIconUrl?: string;
}) {
  const [data, setData] = useState<TradesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(
      `/api/trades/recent?limit=20&tokenCategory=${encodeURIComponent(tokenCategory)}`,
    )
      .then((res) => {
        if (!res.ok) {
          return res
            .json()
            .then((b) => Promise.reject(new Error(b?.error || res.statusText)));
        }
        return res.json();
      })
      .then((json: TradesResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load trades");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenCategory]);

  const trades = data?.trades ?? [];

  return (
    <div className="rounded-[24px] border bg-popover py-4 px-4 flex flex-col gap-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <div className="text-sm font-semibold text-foreground">Trade history</div>
          <div className="text-xs text-muted-foreground">
            {data?.total ?? trades.length} trade{(data?.total ?? trades.length) !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {loading && !data && (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}
      {error && (
        <div className="py-6 text-center text-sm text-destructive">{error}</div>
      )}
      {!loading && !error && trades.length === 0 && (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No trades for this token yet.
        </div>
      )}
      {!loading && trades.length > 0 && (
        <>
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,2.1fr)_minmax(0,2fr)_minmax(0,1.4fr)] px-3 py-2 text-[11px] text-muted-foreground border-b border-border/60">
            <div>Time</div>
            <div>Type</div>
            <div>{tokenSymbol ?? "Token"}</div>
            <div>For</div>
            <div className="text-right">Transaction</div>
          </div>
          <div className="divide-y divide-border/40">
            {trades.map((tx) => {
              const isBuy = tx.direction === "bch_to_token";
              const tokenAmount = (() => {
                if (!tx.amounts) return null;
                const { tokenOut, tokenIn } = tx.amounts;
                return isBuy ? tokenOut ?? null : tokenIn ?? null;
              })();
              const bchAmount = (() => {
                if (!tx.amounts) return null;
                const { bchIn, bchOut } = tx.amounts;
                return isBuy ? bchIn ?? null : bchOut ?? null;
              })();
              const txUrl = getExplorerUrl(tx.txid);
              return (
                <a
                  key={tx.txid}
                  href={txUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.4fr)] items-center px-3 py-3 text-xs hover:bg-background/40 transition-colors"
                >
                  <div className="text-[11px] text-muted-foreground">
                    {formatTimeAgo(tx.createdAt)}
                  </div>
                  <div className="flex items-center gap-1">
                    {isBuy ? (
                      <ArrowUpRight className="size-3 text-emerald-400" />
                    ) : (
                      <ArrowDownRight className="size-3 text-red-400" />
                    )}
                    <span
                      className={
                        "text-xs font-medium " +
                        (isBuy ? "text-emerald-400" : "text-red-400")
                      }
                    >
                      {isBuy ? "Buy" : "Sell"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {tokenIconUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tokenIconUrl}
                        alt={tokenSymbol ?? "Token"}
                        className="size-5 rounded-full object-cover border border-background/40"
                      />
                    )}
                    <span className="font-mono text-[11px]">
                      {tokenAmount != null ? formatNumber(tokenAmount, 6) : "–"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/icons/bch.svg"
                        alt="BCH"
                        className="size-3.5 rounded-full"
                      />
                    </div>
                    <span className="font-mono text-[11px]">
                      {bchAmount != null ? formatNumber(bchAmount, 8) : "–"} BCH
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
                    <span className="font-mono">
                      {tx.txid.slice(0, 6)}…{tx.txid.slice(-4)}
                    </span>
                    <ExternalLink className="size-3" />
                  </div>
                </a>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
