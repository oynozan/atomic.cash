"use client";

import { useState } from "react";
import { ArrowDown, ChevronDown, Github } from "lucide-react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ConnectWallet from "../Header/Connect";

const TOKENS = ["BCH", "AUSD"] as const;

export default function SwapPanel() {
    const [sellToken, setSellToken] = useState<typeof TOKENS[number]>("BCH");
    const [buyToken, setBuyToken] = useState<typeof TOKENS[number]>("AUSD");

    return (
        <div id="swap-panel" className="w-full max-w-120">
            <div className="relative overflow-hidden rounded-[24px] border bg-popover">
                <div className="flex items-center justify-between gap-3 px-5 py-4 rounded-t-[24px]">
                    <div>
                        <p className="text-lg leading-none font-semibold text-muted-foreground">
                            Sell
                        </p>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            aria-label="Sell amount"
                            placeholder="0"
                            className="mt-2 w-full border-0 bg-transparent text-5xl leading-none font-medium text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                        <p className="mt-1 text-sm font-medium text-muted-foreground">$0</p>
                    </div>

                    <div className="mt-1 flex flex-col items-end gap-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className="inline-flex h-10 items-center gap-2 rounded-full border bg-background/20 px-4 text-sm font-semibold"
                                >
                                    <span className="leading-none">{sellToken}</span>
                                    <ChevronDown className="size-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-32">
                                {TOKENS.map(token => (
                                    <DropdownMenuItem
                                        key={token}
                                        onSelect={() => setSellToken(token)}
                                    >
                                        {token}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <p className="text-sm leading-none font-semibold text-muted-foreground text-nowrap">
                            0.00007 {sellToken}
                        </p>
                    </div>
                </div>

                <div className="relative border-t bg-secondary px-5 py-4 rounded-b-[24px]">
                    <button
                        type="button"
                        className="absolute left-1/2 top-0 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-3 border-popover bg-secondary"
                    >
                        <ArrowDown className="size-7" />
                    </button>

                    <div className="mt-1 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-lg leading-none font-semibold text-muted-foreground">
                                Buy
                            </p>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                aria-label="Buy amount"
                                placeholder="0"
                                className="mt-2 w-full border-0 bg-transparent text-5xl leading-none font-medium text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                            <p className="mt-1 text-sm font-medium text-muted-foreground">$0</p>
                        </div>

                        <div className="mt-1 flex flex-col items-end gap-3">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="inline-flex h-10 items-center gap-2 rounded-full border bg-background/20 px-4 text-sm font-semibold"
                                    >
                                        <span>{buyToken}</span>
                                        <ChevronDown className="size-4" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-32">
                                    {TOKENS.map(token => (
                                        <DropdownMenuItem
                                            key={token}
                                            onSelect={() => setBuyToken(token)}
                                        >
                                            {token}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <p className="text-sm leading-none font-semibold text-muted-foreground text-nowrap">
                                0.00007 {buyToken}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <ConnectWallet className="w-full py-8! mt-2 text-xl font-bold" />

            <p className="mt-2 text-sm text-muted-foreground font-semibold px-4 text-center">
                <span className="text-primary">Atomic Cash</span> is still in early development. If
                you encounter any issues, please report them at{" "}
                <a
                    href="https://github.com/oynozan/atomic.cash/issues"
                    target="_blank"
                    className="underline hover:text-primary transition-colors font-medium"
                >
                    GitHub <Github size={16} className="inline ml-0.5" />
                </a>
                .
            </p>
        </div>
    );
}
