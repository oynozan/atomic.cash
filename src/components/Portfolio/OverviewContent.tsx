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
    const fetchHistory = usePortfolioBalanceHistoryStore(s => s.fetch);
    const [balanceData, setBalanceData] = useState<BalanceHistoryResponse | null>(() => {
        if (!address) return null;
        // Synchronously hydrate from store cache (if present) so we avoid
        // layout shifts when navigating between portfolio tabs.
        return usePortfolioBalanceHistoryStore.getState().getCached(address) ?? null;
    });

    useEffect(() => {
        if (!address) return;

        let cancelled = false;

        const run = async () => {
            // Try cache first
            const cached = usePortfolioBalanceHistoryStore.getState().getCached(address);
            if (cached) {
                if (!cancelled) setBalanceData(cached);
                return;
            }
            const data = await fetchHistory(address);
            if (!cancelled && data) {
                setBalanceData(data);
            }
        };

        void run();

        return () => {
            cancelled = true;
        };
    }, [address, fetchHistory]);

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
