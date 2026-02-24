"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, ExternalLink } from "lucide-react";

import { useWalletSession } from "@/components/Wrappers/Wallet";
import ConnectWallet from "@/components/Header/Connect";

type TxItem = {
  txid: string;
  blockHeight: number;
  explorerUrl: string;
};

type HistoryResponse = {
  transactions: TxItem[];
  total: number;
};

export default function PortfolioActivity() {
  const { address, isConnected } = useWalletSession();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address?.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/portfolio/history?address=${encodeURIComponent(address)}&limit=5`)
      .then((res) => {
        if (!res.ok) {
          return res
            .json()
            .then((b) => Promise.reject(new Error(b?.error || res.statusText)));
        }
        return res.json();
      })
      .then((json: HistoryResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load activity");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

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

  const txs = data?.transactions ?? [];

  if (txs.length === 0) {
    return (
      <div className="rounded-[24px] border bg-popover py-6 px-6 text-sm text-muted-foreground">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Recent activity</div>
            <div className="text-xs text-muted-foreground">No transactions yet</div>
          </div>
        </div>
        <p className="text-xs">
          Your swaps, pool creations, and liquidity changes will appear here once you start using
          Atomic Cash.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border bg-popover py-4 px-4 flex flex-col gap-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <div>
          <div className="text-sm font-semibold text-foreground">Recent activity</div>
          <div className="text-xs text-muted-foreground">
            {txs.length} transaction{txs.length > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {txs.map((tx) => (
          <a
            key={tx.txid}
            href={tx.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-[16px] bg-background/40 px-3 py-2 text-xs hover:bg-background/70 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ArrowRightLeft className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">Transaction</span>
                <span className="text-[11px] text-muted-foreground">
                  {tx.txid.slice(0, 8)}…{tx.txid.slice(-4)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span>View</span>
              <ExternalLink className="size-3" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

