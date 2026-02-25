"use client";

import Link from "next/link";

type Props = {
    active: "tokens" | "activity";
    onChange?: (tab: "tokens" | "activity") => void;
};

export default function PortfolioTabs({ active, onChange }: Props) {
    const base = "px-4 py-1.5 text-xs font-medium rounded-full transition-colors";
    const activeCls = "bg-primary text-primary-foreground";
    const inactiveCls = "bg-background/40 text-muted-foreground hover:bg-background/70";

    return (
        <div className="flex items-center gap-2 mb-6 text-xs">
            {/* Overview tab intentionally removed – only Tokens & Activity remain */}
            {onChange ? (
                <>
                    <button
                        type="button"
                        onClick={() => onChange("tokens")}
                        className={`${base} ${active === "tokens" ? activeCls : inactiveCls}`}
                    >
                        Tokens
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange("activity")}
                        className={`${base} ${active === "activity" ? activeCls : inactiveCls}`}
                    >
                        Activity
                    </button>
                </>
            ) : (
                <>
                    <Link
                        href="/portfolio"
                        className={`${base} ${active === "tokens" ? activeCls : inactiveCls}`}
                    >
                        Tokens
                    </Link>
                    <Link
                        href="/portfolio/activity"
                        className={`${base} ${active === "activity" ? activeCls : inactiveCls}`}
                    >
                        Activity
                    </Link>
                </>
            )}
        </div>
    );
}
