"use client";

import Link from "next/link";
import Image from "next/image";
import { ExternalLink, Menu } from "lucide-react";
import { usePathname } from "next/navigation";

import ConnectWallet from "./Connect";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Header() {
    const pathname = usePathname();

    const navLinkClass = (href: string) => {
        const isActive = pathname === href;
        return [
            "transition-colors text-lg",
            isActive ? "text-white" : "text-white/60 hover:text-primary",
        ].join(" ");
    };

    const navLinks = (
        <>
            <Link href="/" className={navLinkClass("/")}>
                Swap
            </Link>
            <Link href="/pools" className={navLinkClass("/pools")}>
                Pools
            </Link>
            <Link href="/tokens" className={navLinkClass("/tokens")}>
                Tokens
            </Link>
            <Link href="/trades" className={navLinkClass("/trades")}>
                Trades
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
                rel="noreferrer"
                className="flex items-center gap-1.5 hover:text-white transition-colors text-lg"
            >
                Docs <ExternalLink size={16} />
            </a>
        </>
    );

    return (
        <header className="fixed z-50 w-full flex items-center justify-center pt-4 px-2 sm:px-4">
            <div className="home-container flex items-center justify-between gap-2 sm:gap-4 border h-14 sm:h-20 lg:h-24 rounded-full backdrop-blur-xs bg-background/20 min-w-0">
                <Link href="/" className="shrink-0">
                    <Image
                        src="/logo-text.png"
                        alt="Atomic Cash Logo"
                        width={200}
                        height={32}
                        className="h-8 w-auto sm:h-9 lg:h-10 object-contain max-w-[180px] sm:max-w-none"
                    />
                </Link>
                {/* Desktop nav: hidden below lg */}
                <div className="hidden lg:flex gap-5 text-white/60 flex-1 justify-center min-w-0">
                    {navLinks}
                </div>
                <div className="max-[500px]:flex-1 flex items-center justify-end gap-2 min-w-0">
                    <div className="shrink min-w-0 max-w-[50vw] sm:max-w-none overflow-hidden">
                        <ConnectWallet className="py-3 px-4 sm:py-4.5 sm:px-6! text-sm sm:text-base w-full min-w-0 truncate" />
                    </div>
                    {/* Mobile menu: visible below lg */}
                    <div className="flex lg:hidden items-center gap-2 shrink-0">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-white/80 hover:text-white hover:bg-white/10 rounded-full"
                                    aria-label="Open menu"
                                >
                                    <Menu size={24} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem asChild>
                                    <Link href="/">Swap</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/pools">Pools</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/tokens">Tokens</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/trades">Trades</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/portfolio">Portfolio</Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <Link href="/aUSD" className="text-gold">
                                        aUSD
                                    </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a
                                        href="https://docs.atomic.cash"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Docs <ExternalLink size={14} className="inline ml-1" />
                                    </a>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
        </header>
    );
}
