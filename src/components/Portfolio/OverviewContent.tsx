"use client";

import { useEffect, useState } from "react";
import { useWalletSession } from "@/components/Wrappers/Wallet";
import PortfolioBalanceChart from "@/components/Portfolio/BalanceChart";
import SwapThisWeekCard from "@/components/Portfolio/SwapThisWeekCard";

type BalanceHistoryResponse = {
  points: { timestamp: number; valueBch: number; bch: number }[];
  swapsThisWeek: number;
  swappedThisWeekBch: number;
};

export default function PortfolioOverviewContent() {
  const { address } = useWalletSession();
  const [balanceData, setBalanceData] = useState<BalanceHistoryResponse | null>(
    null,
  );

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetch(
      `/api/portfolio/balance-history?address=${encodeURIComponent(address)}`,
    )
      .then((res) => {
        if (!res.ok) {
          return res
            .json()
            .then((b) => Promise.reject(new Error(b?.error || res.statusText)));
        }
        return res.json();
      })
      .then((json: BalanceHistoryResponse) => {
        if (!cancelled) setBalanceData(json);
      })
      .catch(() => {
        if (!cancelled) setBalanceData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  if (!address) return null;

  return (
    <div className="mb-6 grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] gap-6">
      <SwapThisWeekCard
        swapsThisWeek={balanceData?.swapsThisWeek ?? 0}
        swappedThisWeekBch={balanceData?.swappedThisWeekBch ?? 0}
      />
      <PortfolioBalanceChart address={address} initialData={balanceData} />
    </div>
  );
}
