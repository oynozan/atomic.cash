"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import SwapPanel from "@/components/Swap/Panel";
import TokenDetailHeader from "@/components/TokenDetail/Header";
import TokenDetailPriceChart from "@/components/TokenDetail/PriceChart";
import TokenDetailTradeHistory from "@/components/TokenDetail/TradeHistory";
import TokenDetailInfo from "@/components/TokenDetail/Info";
import { useEffect, useState } from "react";

type TokenDetailResponse = {
  tokenCategory: string;
  symbol?: string;
  name?: string;
  iconUrl?: string;
  priceBch: number | null;
  tvlBch: number;
  tokenReserveTotal: number;
  volume24hBch: number;
  volume30dBch: number;
  prev24hBch: number;
  prev30dBch: number;
  change1dPercent: number | null;
  change7dPercent: number | null;
};

export default function SwapTokenPage() {
  const params = useParams();
  const tokenCategory = typeof params?.tokenCategory === "string" ? params.tokenCategory : null;
  const [data, setData] = useState<TokenDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tokenCategory) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/tokens/${encodeURIComponent(tokenCategory)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) {
            return Promise.reject(new Error("Token not found"));
          }
          return res
            .json()
            .then((b) => Promise.reject(new Error(b?.error || res.statusText)));
        }
        return res.json();
      })
      .then((json: TokenDetailResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load token");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenCategory]);

  if (!tokenCategory) {
    return (
      <section className="w-screen min-h-screen pt-44 pb-32 flex justify-center">
        <div className="home-container max-w-6xl text-center text-muted-foreground">
          Invalid token.
        </div>
      </section>
    );
  }

  if (loading && !data) {
    return (
      <section className="w-screen min-h-screen pt-44 pb-32 flex justify-center">
        <div className="home-container max-w-6xl flex items-center justify-center py-20 text-muted-foreground">
          Loading…
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="w-screen min-h-screen pt-44 pb-32 flex justify-center">
        <div className="home-container max-w-6xl text-center">
          <p className="text-destructive mb-4">{error ?? "Token not found"}</p>
          <Link
            href="/tokens"
            className="text-sm text-primary hover:underline"
          >
            Back to Tokens
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="w-screen min-h-screen pt-44 pb-32 flex justify-center">
      <div className="home-container max-w-6xl w-full">
        <div className="mb-6">
          <TokenDetailHeader
            data={{
              symbol: data.symbol,
              name: data.name,
              iconUrl: data.iconUrl,
              priceBch: data.priceBch,
              change1dPercent: data.change1dPercent,
              change7dPercent: data.change7dPercent,
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)] gap-6">
          {/* Left column: chart + trade history */}
          <div className="space-y-6">
            <TokenDetailPriceChart
              tokenCategory={data.tokenCategory}
              currentPrice={data.priceBch}
            />
            <TokenDetailTradeHistory
              tokenCategory={data.tokenCategory}
              tokenSymbol={data.symbol}
              tokenIconUrl={data.iconUrl}
            />
          </div>

          {/* Right column: swap + info */}
          <div className="space-y-6">
            <div className="rounded-[24px] border bg-popover p-5">
              <SwapPanel />
            </div>
            <TokenDetailInfo
              data={{
                tokenCategory: data.tokenCategory,
                symbol: data.symbol,
                name: data.name,
                tvlBch: data.tvlBch,
                tokenReserveTotal: data.tokenReserveTotal,
                volume24hBch: data.volume24hBch,
                volume30dBch: data.volume30dBch,
                prev24hBch: data.prev24hBch,
                prev30dBch: data.prev30dBch,
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
