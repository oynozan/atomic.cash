"use client";

import Link from "next/link";

type Props = {
  active: "overview" | "tokens" | "activity";
};

export default function PortfolioTabs({ active }: Props) {
  const base =
    "px-4 py-1.5 text-xs font-medium rounded-full transition-colors";
  const activeCls = "bg-primary text-primary-foreground";
  const inactiveCls =
    "bg-background/40 text-muted-foreground hover:bg-background/70";

  return (
    <div className="flex items-center gap-2 mb-4 text-xs">
      <Link
        href="/portfolio"
        className={`${base} ${
          active === "overview" ? activeCls : inactiveCls
        }`}
      >
        Overview
      </Link>
      <Link
        href="/portfolio/tokens"
        className={`${base} ${
          active === "tokens" ? activeCls : inactiveCls
        }`}
      >
        Tokens
      </Link>
      <Link
        href="/portfolio/activity"
        className={`${base} ${
          active === "activity" ? activeCls : inactiveCls
        }`}
      >
        Activity
      </Link>
    </div>
  );
}

