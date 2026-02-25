"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ExternalLink } from "lucide-react";

import { useWalletSession } from "@/components/Wrappers/Wallet";
import ConnectWallet from "@/components/Header/Connect";
import { BCMR_API_URL } from "@/dapp/config";
import { getExplorerUrl } from "@/dapp/explorer";

type DappTxItem = {
  txid: string;
  address: string;
  type: "swap" | "create_pool" | "add_liquidity" | "remove_liquidity";
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

type HistoryResponse = {
  chain: {
    transactions: never[];
    total: number;
    hasMore: boolean;
    nextCursor?: number;
  };
  dapp: {
    transactions: DappTxItem[];
    total: number;
    hasMore: boolean;
    nextCursor?: number;
  };
};

type TokenMeta = {
  symbol: string;
  name?: string;
  iconUrl?: string;
};

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function PortfolioActivityFull() {
  const { address, isConnected } = useWalletSession();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenMeta, setTokenMeta] = useState<Record<string, TokenMeta>>({});

  const buildUrl = () => {
    const params = new URLSearchParams();
    params.set("address", address ?? "");
    params.set("limit", "50");
    return `/api/portfolio/history?${params.toString()}`;
  };

  useEffect(() => {
    if (!address?.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(buildUrl())
      .then((res) => {
        if (!res.ok) {
          return res
            .json()
            .then((b) => Promise.reject(new Error(b?.error || res.statusText)));
        }
        return res.json();
      })
      .then((json: HistoryResponse) => {
        if (!cancelled) {
          setData(json);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load activity");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const dappTxs = data?.dapp.transactions ?? [];

  // Benzersiz token kategorileri
  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          dappTxs
            .map((tx) => tx.tokenCategory)
            .filter((c): c is string => !!c),
        ),
      ),
    [dappTxs],
  );

  // Fetch token metadata (symbol + icon)
  useEffect(() => {
    let cancelled = false;

    const fetchMeta = async () => {
      const missing = categories.filter((c) => !tokenMeta[c]);
      if (missing.length === 0) return;

      const entries: [string, TokenMeta][] = [];

      for (const cat of missing) {
        try {
          const res = await fetch(`${BCMR_API_URL}/${cat}/`);
          if (!res.ok) continue;
          const json = await res.json();
          entries.push([
            cat,
            {
              symbol: json.token?.symbol || json.name || cat.slice(0, 8),
              name: json.name,
              iconUrl: json.uris?.icon,
            },
          ]);
        } catch {
          // Swallow metadata errors silently
        }
      }

      if (!cancelled && entries.length > 0) {
        setTokenMeta((prev) => {
          const next = { ...prev };
          for (const [cat, meta] of entries) {
            next[cat] = meta;
          }
          return next;
        });
      }
    };

    if (categories.length > 0) {
      void fetchMeta();
    }

    return () => {
      cancelled = true;
    };
  }, [categories, tokenMeta]);

  if (!isConnected || !address) {
    return (
      <div className="rounded-[24px] border border-dashed bg-muted/30 flex flex-col items-center justify-center py-10 px-6">
        <p className="text-muted-foreground text-center mb-4">
          Connect your wallet to see recent activity.
        </p>
        <ConnectWallet className="py-3 px-5" />
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-[24px] border bg-popover flex items-center justify-center py-10 px-6 text-muted-foreground">
        Loading activity…
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

  if (dappTxs.length === 0) {
    return (
      <div className="rounded-[24px] border bg-popover py-6 px-6 text-sm text-muted-foreground">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Activity</div>
            <div className="text-xs text-muted-foreground">No transactions yet</div>
          </div>
        </div>
        <p className="text-xs">
          Your swaps, pool creations, and liquidity changes will appear here once you
          start using Atomic Cash.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border bg-popover py-4 px-4 flex flex-col gap-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <div className="text-sm font-semibold text-foreground">All activity</div>
          <div className="text-xs text-muted-foreground">
            {data?.dapp.total ?? dappTxs.length} transaction
            {(data?.dapp.total ?? dappTxs.length) > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Header row */}
      <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,2fr)_minmax(0,2fr)] px-3 py-2 text-[11px] text-muted-foreground border-b border-border/60">
        <div>Time</div>
        <div>Type</div>
        <div>Amount</div>
        <div className="text-right">Transaction</div>
      </div>

      <div className="divide-y divide-border/40">
        {dappTxs.map((tx, index) => {
          const href = getExplorerUrl(tx.txid);
          const meta = tx.tokenCategory ? tokenMeta[tx.tokenCategory] : undefined;

          const typeLabel = (() => {
            switch (tx.type) {
              case "swap":
                return "Swapped";
              case "create_pool":
                return "Created pool";
              case "add_liquidity":
                return "Added liquidity";
              case "remove_liquidity":
                return "Removed liquidity";
              default:
                return "Activity";
            }
          })();

          const amountLines: string[] = [];
          if (tx.amounts) {
            const { bchIn, bchOut, tokenIn, tokenOut } = tx.amounts;
            if (bchIn != null) amountLines.push(`-${bchIn} BCH`);
            if (bchOut != null) amountLines.push(`+${bchOut} BCH`);
            if (tokenIn != null)
              amountLines.push(`-${tokenIn} ${meta?.symbol ?? "TOK"}`);
            if (tokenOut != null)
              amountLines.push(`+${tokenOut} ${meta?.symbol ?? "TOK"}`);
          }

          return (
            <a
              key={`dapp-${tx.txid}-${index}`}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,2fr)_minmax(0,2fr)] items-center px-3 py-3 text-xs hover:bg-background/40 transition-colors"
            >
              {/* Time */}
              <div className="text-[11px] text-muted-foreground">
                {formatDate(tx.createdAt)}
              </div>

              {/* Type */}
              <div className="flex items-center gap-1">
                <ArrowRightLeft className="size-3 mr-1 text-primary" />
                <span className="text-xs font-medium text-foreground">{typeLabel}</span>
              </div>

              {/* Amount */}
              <div className="flex items-center gap-2">
                {meta?.iconUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={meta.iconUrl}
                    alt={meta.symbol}
                    className="size-5 rounded-full object-cover border border-background/40"
                  />
                )}
                <div className="flex flex-col">
                  {amountLines.length > 0 ? (
                    amountLines.map((line) => (
                      <span key={line} className="font-mono text-[11px]">
                        {line}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-muted-foreground">-</span>
                  )}
                </div>
              </div>

              {/* Tx link */}
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
    </div>
  );
}
