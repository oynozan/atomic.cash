"use client";

import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { usePathname } from "next/navigation";

import ConnectWallet from "./Connect";

export default function Header() {
    const pathname = usePathname();

    const navLinkClass = (href: string) => {
        const isActive = pathname === href;
        return [
            "transition-colors text-lg",
            isActive ? "text-white" : "text-white/60 hover:text-primary",
        ].join(" ");
    };

    return (
        <header className="fixed z-50 w-full flex items-center justify-center pt-4">
            <div className="home-container flex items-center justify-between px-10 border h-24 rounded-full backdrop-blur-xs bg-background/20">
                <Link href="/">
                    <Image src="/logo-text.png" alt="Atomic Cash Logo" width={200} height={32} />
                </Link>
                <div className="flex gap-10 text-white/60">
                    <Link href="/" className={navLinkClass("/")}> 
                        Swap
                    </Link>
                    <Link href="/pools" className={navLinkClass("/pools")}> 
                        Pools
                    </Link>
                    <Link href="/portfolio" className={navLinkClass("/portfolio")}> 
                        Portfolio
                    </Link>
                    <Link href="/aUSD" className="text-gold! font-medium text-shadow-2xs text-lg">
                        aUSD
                    </Link>
                    <a
                        href="https://docs.atomic.cash"
                        target="_blank"
                        className="flex items-center gap-1.5 hover:text-white transition-colors text-lg"
                    >
                        Docs <ExternalLink size={16} />
                    </a>
                </div>
                <div>
                    <ConnectWallet className="py-4.5 px-6!" />
                </div>
            </div>
        </header>
    )
}
