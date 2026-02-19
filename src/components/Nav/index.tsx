"use client";

import { ArrowRightLeft, Cylinder, DollarSign, Wallet } from "lucide-react";

import Dock from "./Dock";

const items = [
    { icon: <ArrowRightLeft size={24} />, label: "Swap", href: "/" },
    { icon: <Cylinder size={24} />, label: "Pool", href: "/pools" },
    {
        icon: <Wallet size={24} />,
        label: "Portfolio",
        href: "/portfolio",
    },
    { icon: <DollarSign size={24} />, label: "AUSD", href: "/aUSD" },
];

export default function Nav() {
    return (
        <nav className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
            <Dock items={items} panelHeight={86} baseItemSize={60} magnification={80} />
        </nav>
    );
}
