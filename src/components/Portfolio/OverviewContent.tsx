"use client";

import { useEffect, useState } from "react";
import { useWalletSession } from "@/components/Wrappers/Wallet";
import PortfolioBalanceChart from "@/components/Portfolio/BalanceChart";
import SwapThisWeekCard from "@/components/Portfolio/SwapThisWeekCard";
import {
  usePortfolioBalanceHistoryStore,
  type BalanceHistoryResponse,
} from "@/store/portfolioBalanceHistory";

export default function PortfolioOverviewContent() {
  const { address } = useWalletSession();
  const getCached = usePortfolioBalanceHistoryStore((s) => s.getCached);
  const fetchHistory = usePortfolioBalanceHistoryStore((s) => s.fetch);
  const [balanceData, setBalanceData] = useState<BalanceHistoryResponse | null>(null);

  useEffect(() => {
    if (!address) return;
    const cached = getCached(address);
    if (cached) {
      setBalanceData(cached);
      return;
    }
    let cancelled = false;
    fetchHistory(address).then((data) => {
      if (!cancelled && data) setBalanceData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [address, getCached, fetchHistory]);

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
