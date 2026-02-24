"use client";

import type { ReactNode } from "react";
import PortfolioTabs from "@/components/Portfolio/Tabs";
import { useWalletSession } from "@/components/Wrappers/Wallet";
import ConnectWallet from "@/components/Header/Connect";
import PortfolioActions from "./Actions";
import PortfolioOverviewContent from "./OverviewContent";

type Props = {
  active: "tokens" | "activity";
  children: ReactNode;
};

export default function PortfolioLayout({ active, children }: Props) {
  const { isConnected, address } = useWalletSession();

  const connected = isConnected && !!address;

  if (!connected) {
    return (
      <div className="home-container">
        <h1 className="text-4xl font-figtree font-bold mb-6">Portfolio</h1>
        <div className="rounded-[32px] border bg-linear-to-r from-primary/20 via-primary/10 to-transparent px-8 py-10 flex flex-col items-center justify-center text-center">
          <p className="text-lg font-medium mb-3">
            Connect a wallet to view your portfolio
          </p>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            See your BCH and CashToken balances, recent swaps, pool creations,
            and liquidity changes in one place.
          </p>
          <ConnectWallet className="px-6 py-3 text-base font-semibold rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <h1 className="text-4xl font-figtree font-bold mb-6">Portfolio</h1>
      <PortfolioActions />
      {/* Always show balance chart + weekly stats under actions */}
      <PortfolioOverviewContent />
      <PortfolioTabs active={active} />
      {children}
    </div>
  );
}

