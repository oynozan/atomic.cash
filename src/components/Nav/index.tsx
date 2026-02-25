"use client";

import { useState, useEffect } from "react";
import { ArrowRightLeft, Cylinder, DollarSign, Wallet, LineChart, Coins } from "lucide-react";

import Dock from "./Dock";

const items = [
    { icon: <ArrowRightLeft size={24} />, label: "Swap", href: "/" },
    { icon: <Cylinder size={24} />, label: "Pools", href: "/pools" },
    { icon: <Coins size={24} />, label: "Tokens", href: "/tokens" },
    { icon: <LineChart size={24} />, label: "Trades", href: "/trades" },
    {
        icon: <Wallet size={24} />,
        label: "Portfolio",
        href: "/portfolio",
    },
    { icon: <DollarSign size={24} />, label: "aUSD", href: "/aUSD" },
];

const NARROW_BREAKPOINT = 460;

export default function Nav() {
    const [narrow, setNarrow] = useState(false);

    useEffect(() => {
        const check = () => setNarrow(window.innerWidth < NARROW_BREAKPOINT);
        check();
        window.addEventListener("resize", check);
        return () => window.removeEventListener("resize", check);
    }, []);

    return (
        <nav className="fixed bottom-4 left-0 right-0 z-50 flex justify-center max-w-[100vw] overflow-x-auto overflow-y-hidden min-w-0">
            <div className="shrink-0 px-2">
                <Dock
                    items={items}
                    panelHeight={narrow ? 70 : 86}
                    baseItemSize={narrow ? 44 : 56}
                    magnification={narrow ? 56 : 72}
                />
            </div>
        </nav>
    );
}
