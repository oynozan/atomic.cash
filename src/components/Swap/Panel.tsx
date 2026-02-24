"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Github } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import ConnectWallet from "@/components/Header/Connect";
import { useWalletSession } from "@/components/Wrappers/Wallet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { usePoolsStore } from "@/store/pools";
import { useTokenPriceStore } from "@/store/tokenPrice";

type Direction = "bch_to_token" | "token_to_bch";

type TokenOption = {
    category: string;
    symbol?: string;
    name?: string;
    iconUrl?: string;
    poolCount: number;
    totalBchLiquidity: number;
    balance?: number;
};

type SwapQuote = {
    inputAmount: number;
    outputAmount: number;
    priceImpact: number;
    effectivePrice: number;
    fee: number;
};

function formatNumber(n: number, maxDecimals = 6): string {
    if (!Number.isFinite(n)) return "-";
    const fixed = n.toFixed(maxDecimals);
    const [intPart, decPart] = fixed.split(".");
    const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const dec = (decPart || "").replace(/0+$/, "");
    return dec ? `${intWithSep}.${dec}` : intWithSep;
}

function TokenAvatar({ symbol, iconUrl }: { symbol: string; iconUrl?: string }) {
    if (iconUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={iconUrl}
                alt={symbol}
                className="size-8 rounded-full object-cover border border-background/40"
            />
        );
    }
    return (
        <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold">
            {symbol.slice(0, 1)}
        </div>
    );
}

function TokenSelectModal({
    tokens,
    onClose,
    onSelect,
}: {
    tokens: TokenOption[];
    onClose: () => void;
    onSelect: (t: TokenOption) => void;
}) {
    const [search, setSearch] = useState("");

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();

        // Sort by user balance first (descending)
        const sorted = [...tokens].sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0));

        if (!q) return sorted;

        return sorted.filter(t => {
            const symbol = t.symbol ?? t.category.slice(0, 8);
            const name = t.name ?? "";
            return (
                symbol.toLowerCase().includes(q) ||
                name.toLowerCase().includes(q) ||
                t.category.toLowerCase().includes(q)
            );
        });
    }, [tokens, search]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-[24px] border bg-popover p-5 shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Select a token</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        ✕
                    </button>
                </div>

                <div className="mb-3">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search tokens"
                        className="w-full rounded-full border bg-background/40 px-4 py-2 text-sm outline-none"
                    />
                </div>

                <div className="max-h-80 overflow-y-auto space-y-1">
                    {filtered.length === 0 && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            No tokens with liquidity.
                        </div>
                    )}
                    {filtered.map(t => {
                        const primary = t.name ?? t.symbol ?? `${t.category.slice(0, 8)}…`;
                        const secondary =
                            t.name && t.symbol ? t.symbol : t.category.slice(0, 20) + "…";
                        return (
                            <button
                                key={t.category}
                                type="button"
                                onClick={() => {
                                    onSelect(t);
                                    onClose();
                                }}
                                className="flex w-full items-center justify-between rounded-[16px] px-3 py-2 hover:bg-background/40 text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <TokenAvatar symbol={primary} iconUrl={t.iconUrl} />
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium">{primary}</span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {secondary}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right text-[11px] text-muted-foreground">
                                    {t.balance !== undefined && t.balance > 0 && (
                                        <div className="font-mono text-foreground">
                                            {formatNumber(t.balance, 4)}{" "}
                                            {t.symbol ?? t.name ?? "TOK"}
                                        </div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function SwapPanel() {
    const { address, isConnected, session } = useWalletSession();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const [direction, setDirection] = useState<Direction>("bch_to_token");
    const [inputAmount, setInputAmount] = useState("");
    const [outputAmount, setOutputAmount] = useState("");
    const [swapType, setSwapType] = useState<"exact_input" | "exact_output">("exact_input");
    const [slippage, setSlippage] = useState<number>(0.5);

    const { data: poolsData, loading: tokensLoading, error: tokensError, fetch: fetchPools } = usePoolsStore();

    const tokens = useMemo(() => {
        const pools = poolsData?.pools;
        if (!pools?.length) return [];
        const map = new Map<string, TokenOption>();
        for (const p of pools) {
            const existing = map.get(p.tokenCategory);
            if (existing) {
                existing.poolCount += 1;
                existing.totalBchLiquidity += p.bchReserve;
            } else {
                map.set(p.tokenCategory, {
                    category: p.tokenCategory,
                    symbol: p.tokenSymbol,
                    name: p.tokenName,
                    iconUrl: p.tokenIconUrl,
                    poolCount: 1,
                    totalBchLiquidity: p.bchReserve,
                });
            }
        }
        return Array.from(map.values()).sort(
            (a, b) => b.totalBchLiquidity - a.totalBchLiquidity,
        );
    }, [poolsData?.pools]);

    const [selectedToken, setSelectedToken] = useState<TokenOption | null>(null);
    const [showTokenModal, setShowTokenModal] = useState(false);

    const [quote, setQuote] = useState<SwapQuote | null>(null);
    const [priceImpact, setPriceImpact] = useState<number | null>(null);
    const [effectivePrice, setEffectivePrice] = useState<number | null>(null);
    const [spotPrice, setSpotPrice] = useState<number | null>(null);

    const [txLoading, setTxLoading] = useState(false);
    const [isQuoting, setIsQuoting] = useState(false);

    const [bchBalance, setBchBalance] = useState<number | null>(null);
    const [tokenBalances, setTokenBalances] = useState<{ category: string; amount: number }[]>([]);
    const tokensWithBalance = useMemo(
        () =>
            tokens.map(t => ({
                ...t,
                balance: tokenBalances.find(tb => tb.category === t.category)?.amount,
            })),
        [tokens, tokenBalances],
    );
    const [lastEdited, setLastEdited] = useState<"input" | "output">("input");
    const quoteAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        fetchPools();
    }, [fetchPools]);

    // Preselect token from URL when pools data is ready
    useEffect(() => {
        if (!tokens.length) return;
        const tokenFromPath = pathname?.match(/^\/swap\/([a-fA-F0-9]+)$/)?.[1];
        const urlToken = searchParams?.get("token") ?? tokenFromPath;
        if (!urlToken) return;
        const found = tokens.find(t => t.category === urlToken);
        if (found) {
            setSelectedToken(found);
        } else {
            toast.error("No pool found for the requested token.");
            setSelectedToken(null);
        }
    }, [tokens, pathname, searchParams]);

    // Load user balances for percentage buttons
    useEffect(() => {
        if (!isConnected || !address) {
            setBchBalance(null);
            setTokenBalances([]);
            return;
        }

        let cancelled = false;

        fetch(`/api/portfolio/balances?address=${encodeURIComponent(address)}`)
            .then(res => {
                if (!res.ok) {
                    return res
                        .json()
                        .then(b => Promise.reject(new Error(b?.error || res.statusText)));
                }
                return res.json();
            })
            .then((json: { bch: number; tokens: { category: string; amount: number }[] }) => {
                if (cancelled) return;
                setBchBalance(json.bch);
                setTokenBalances(
                    json.tokens?.map(t => ({ category: t.category, amount: t.amount })) ?? [],
                );
            })
            .catch(() => {
                if (!cancelled) {
                    setBchBalance(null);
                    setTokenBalances([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isConnected, address]);

    const activeAmount = lastEdited === "input" ? inputAmount : outputAmount;

    const activeAmountNumber = useMemo(() => {
        const v = parseFloat(activeAmount);
        return Number.isFinite(v) && v > 0 ? v : 0;
    }, [activeAmount]);

    const validationError = useMemo(() => {
        if (!isConnected || !address || !selectedToken) return null;

        // No positive amount entered
        if (!activeAmountNumber) return null;

        // Balance checks
        if (direction === "bch_to_token") {
            if (bchBalance != null && bchBalance < activeAmountNumber) {
                return "Not enough BCH to swap.";
            }
        } else {
            const tb = tokenBalances.find(t => t.category === selectedToken.category);
            if (tb && tb.amount < activeAmountNumber) {
                return `Not enough ${selectedToken.symbol ?? "tokens"} to swap.`;
            }
        }

        // Quote-based checks (amount too small / cannot produce output)
        if (quote) {
            if (quote.outputAmount === 0) {
                return "Amount is too small to swap. Please increase the amount.";
            }
            if (
                swapType === "exact_input" &&
                (quote as unknown as { minimumReceived?: number }).minimumReceived === 0
            ) {
                return "Amount is too small to swap with current slippage.";
            }
        }

        return null;
    }, [
        isConnected,
        address,
        selectedToken,
        activeAmountNumber,
        direction,
        bchBalance,
        tokenBalances,
        quote,
        swapType,
    ]);

    const canSwap =
        isConnected &&
        !!address &&
        !!selectedToken &&
        !tokensLoading &&
        !tokensError &&
        activeAmountNumber > 0 &&
        !validationError;

    const inputLabel = direction === "bch_to_token" ? "You pay" : "You pay (token)";
    const outputLabel = direction === "bch_to_token" ? "You receive (token)" : "You receive";

    const inputTokenLabel =
        direction === "bch_to_token" ? "BCH" : (selectedToken?.symbol ?? "Select token");
    const outputTokenLabel =
        direction === "bch_to_token" ? (selectedToken?.symbol ?? "Select token") : "BCH";

    // Load spot price for selected token (cached in store, 60s TTL)
    const fetchPrice = useTokenPriceStore(s => s.fetchPrice);
    useEffect(() => {
        if (!selectedToken) {
            setSpotPrice(null);
            return;
        }
        let cancelled = false;
        fetchPrice(selectedToken.category).then(result => {
            if (!cancelled) setSpotPrice(result?.marketPrice ?? null);
        });
        return () => {
            cancelled = true;
        };
    }, [selectedToken, fetchPrice]);

    const handleFlipDirection = () => {
        setDirection(d => (d === "bch_to_token" ? "token_to_bch" : "bch_to_token"));
        setOutputAmount("");
        setQuote(null);
        setPriceImpact(null);
        setEffectivePrice(null);
        setSwapType("exact_input");
        setLastEdited("input");
    };

    const handleSwap = async () => {
        if (!canSwap || !selectedToken || !address || !session) return;
        const rawAmount = lastEdited === "input" ? inputAmount : outputAmount;
        const value = parseFloat(rawAmount);
        if (!Number.isFinite(value) || value <= 0) return;

        setTxLoading(true);
        try {
            const res = await fetch("/api/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    direction,
                    tokenCategory: selectedToken.category,
                    amount: value,
                    slippageTolerance: slippage,
                    userTokenAddress: address,
                    swapType,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to build swap transaction");
            }

            setOutputAmount(String(data.outputAmount ?? ""));
            if (data.quote) {
                setQuote(data.quote as SwapQuote);
            } else {
                setQuote(null);
            }
            setPriceImpact(typeof data.priceImpact === "number" ? data.priceImpact : null);
            setEffectivePrice(typeof data.effectivePrice === "number" ? data.effectivePrice : null);

            const wcObj = JSON.parse(data.wcTransactionJson);

            // Inform the user that the wallet should show a signing prompt
            toast.success("Swap transaction is ready. Please confirm in your wallet.");

            const { signWcTransaction } = await import("@/lib/web3");
            const signResult = await signWcTransaction(wcObj, session);
            if (!signResult?.signedTransaction) {
                throw new Error("Transaction signing failed or was rejected.");
            }

            const broadcastRes = await fetch("/api/tx/broadcast", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signedTxHex: signResult.signedTransaction }),
            });
            const broadcastData = await broadcastRes.json();
            if (!broadcastRes.ok) {
                throw new Error(broadcastData.error || "Failed to broadcast");
            }

            // Swap + broadcast succeeded
            const txid: string | undefined = broadcastData?.txid || broadcastData?.transactionId;
            toast.success(
                txid
                    ? `Swap submitted successfully. TxID: ${txid}`
                    : "Swap submitted successfully.",
            );

            if (txid) {
                // Fire-and-forget: record this swap in Mongo for detailed activity view
                void fetch("/api/portfolio/transactions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        txid,
                        address,
                        type: "swap",
                        direction,
                        tokenCategory: selectedToken.category,
                        amounts: {
                            // For now we only persist human-readable amounts;
                            // they are sufficient for the Activity summary.
                            ...(direction === "bch_to_token"
                                ? { bchIn: value, tokenOut: data.outputAmount }
                                : { tokenIn: value, bchOut: data.outputAmount }),
                        },
                    }),
                }).catch(() => {
                    // Non-fatal: ignore logging errors
                });
            }

            // Reset form state after successful swap
            setInputAmount("");
            setOutputAmount("");
            setQuote(null);
            setPriceImpact(null);
            setEffectivePrice(null);
            setLastEdited("input");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to swap");
        } finally {
            setTxLoading(false);
        }
    };

    // Auto-quote when user edits either side (depends only on activeAmount so setting the other side from quote doesn't re-trigger)
    useEffect(() => {
        if (!selectedToken) {
            setQuote(null);
            setPriceImpact(null);
            setEffectivePrice(null);
            return;
        }

        const active = lastEdited === "input" ? inputAmount : outputAmount;
        const value = parseFloat(active);
        if (!Number.isFinite(value) || value <= 0) {
            setQuote(null);
            setPriceImpact(null);
            setEffectivePrice(null);
            if (lastEdited === "input") {
                setOutputAmount("");
            } else {
                setInputAmount("");
            }
            return;
        }

        let cancelled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const run = async () => {
            const controller = new AbortController();
            quoteAbortRef.current = controller;
            setIsQuoting(true);
            try {
                const res = await fetch("/api/swap/quote", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: controller.signal,
                    body: JSON.stringify({
                        direction,
                        swapType,
                        tokenCategory: selectedToken.category,
                        amount: value,
                        slippageTolerance: slippage,
                    }),
                });
                const data = await res.json();
                if (!res.ok || cancelled) {
                    if (!cancelled) {
                        toast.error(data?.error || "Failed to fetch swap quote. Please try again.");
                    }
                    return;
                }

                const raw = data?.quote;
                const hasQuote =
                    raw &&
                    typeof raw === "object" &&
                    typeof raw.inputAmount === "number" &&
                    Number.isFinite(raw.inputAmount) &&
                    typeof raw.outputAmount === "number" &&
                    Number.isFinite(raw.outputAmount) &&
                    typeof raw.priceImpact === "number" &&
                    Number.isFinite(raw.priceImpact) &&
                    typeof raw.effectivePrice === "number" &&
                    Number.isFinite(raw.effectivePrice);
                const feeVal =
                    typeof raw?.feeAmount === "number" && Number.isFinite(raw.feeAmount)
                        ? raw.feeAmount
                        : typeof raw?.fee === "number" && Number.isFinite(raw.fee)
                          ? raw.fee
                          : 0;

                if (!hasQuote || cancelled) {
                    if (!cancelled && !hasQuote) {
                        toast.error("Invalid quote response. Please try again.");
                    }
                    return;
                }

                setQuote({
                    inputAmount: raw.inputAmount,
                    outputAmount: raw.outputAmount,
                    priceImpact: raw.priceImpact,
                    effectivePrice: raw.effectivePrice,
                    fee: feeVal,
                });
                setPriceImpact(raw.priceImpact);
                setEffectivePrice(raw.effectivePrice);

                if (swapType === "exact_input") {
                    setOutputAmount(raw.outputAmount.toString());
                } else {
                    setInputAmount(raw.inputAmount.toString());
                }
            } catch (err) {
                if (cancelled) return;
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to fetch swap quote. Please try again.",
                );
                setQuote(null);
                setPriceImpact(null);
                setEffectivePrice(null);
            } finally {
                if (!cancelled) setIsQuoting(false);
                quoteAbortRef.current = null;
            }
        };

        // Debounce 400ms: wait for user to stop typing
        timeoutId = setTimeout(() => {
            if (!cancelled) {
                run();
            }
        }, 400);

        return () => {
            cancelled = true;
            quoteAbortRef.current?.abort();
            quoteAbortRef.current = null;
            if (timeoutId) clearTimeout(timeoutId);
        };
        // activeAmount (not inputAmount/outputAmount) to avoid duplicate quote when we set the other side from API
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [direction, swapType, lastEdited, activeAmount, slippage, selectedToken]);

    return (
        <div id="swap-panel" className="w-full max-w-120">
            <div className="relative overflow-hidden rounded-[24px] border bg-popover">
                {/* Top: input leg */}
                <div className="flex items-center justify-between gap-3 px-5 py-4 rounded-t-[24px]">
                    <div className="min-w-0 flex-1">
                        <p className="text-lg leading-none font-semibold text-muted-foreground">
                            {inputLabel}
                        </p>
                        <input
                            type="number"
                            min="0"
                            step="any"
                            aria-label="Input amount"
                            placeholder="0"
                            value={inputAmount}
                            disabled={
                                (direction === "token_to_bch" && !selectedToken) ||
                                (isQuoting && lastEdited === "output")
                            }
                            onChange={e => {
                                setInputAmount(e.target.value);
                                setSwapType("exact_input");
                                setLastEdited("input");
                                setOutputAmount("");
                                setQuote(null);
                                setPriceImpact(null);
                                setEffectivePrice(null);
                            }}
                            className="mt-2 w-full border-0 bg-transparent text-5xl leading-none font-medium text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                    </div>

                    <div className="mt-1 flex flex-col items-end gap-3 shrink-0">
                        <button
                            type="button"
                            disabled={direction === "bch_to_token"}
                            onClick={() => setShowTokenModal(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-full border bg-background/20 px-4 text-sm font-semibold shrink-0 disabled:cursor-default disabled:opacity-60"
                        >
                            {direction === "bch_to_token" ? (
                                <span className="leading-none flex items-center gap-2">
                                    {/* eslint-disable @next/next/no-img-element */}
                                    <img
                                        src="/icons/bch.svg"
                                        alt="BCH"
                                        className="size-4 rounded-full"
                                    />
                                    <span>BCH</span>
                                </span>
                            ) : (
                                <span className="leading-none flex items-center gap-2">
                                    {selectedToken?.iconUrl && (
                                        /* eslint-disable @next/next/no-img-element */
                                        <img
                                            src={selectedToken.iconUrl}
                                            alt={inputTokenLabel}
                                            className="size-4 rounded-full"
                                        />
                                    )}
                                    <span>{selectedToken ? inputTokenLabel : "Select token"}</span>
                                </span>
                            )}
                        </button>
                        <p className="text-sm leading-none font-semibold text-muted-foreground text-nowrap">
                            {/* Balance placeholder */}
                        </p>
                        {/* Percentage buttons for active leg */}
                        {(() => {
                            let maxAmount: number | null = null;
                            if (direction === "bch_to_token") {
                                maxAmount = bchBalance ?? null;
                            } else if (selectedToken) {
                                const tb = tokenBalances.find(
                                    t => t.category === selectedToken.category,
                                );
                                maxAmount = tb?.amount ?? null;
                            }

                            if (!maxAmount || maxAmount <= 0) return null;

                            const handlePercent = (pct: number) => {
                                const v = (maxAmount! * pct) / 100;
                                setInputAmount(v.toString());
                                setSwapType("exact_input");
                                setLastEdited("input");
                                setOutputAmount("");
                                setQuote(null);
                                setPriceImpact(null);
                                setEffectivePrice(null);
                            };

                            return (
                                <div className="flex items-center gap-1 text-[11px]">
                                    {[25, 50, 75].map(pct => (
                                        <button
                                            key={pct}
                                            type="button"
                                            onClick={() => handlePercent(pct)}
                                            className="rounded-full border bg-background/40 px-2 py-0.5 hover:bg-background/70"
                                        >
                                            {pct}%
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => handlePercent(100)}
                                        className="rounded-full border bg-background/40 px-2 py-0.5 hover:bg-background/70"
                                    >
                                        Max
                                    </button>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Middle: direction toggle */}
                <div className="relative border-t bg-secondary px-5 py-4 rounded-b-[24px]">
                    <button
                        type="button"
                        className="absolute left-1/2 top-0 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-3 border-popover bg-secondary"
                        onClick={handleFlipDirection}
                    >
                        <ArrowDown className="size-7" />
                    </button>

                    {/* Bottom: output leg */}
                    <div className="mt-1 flex items-center justify-between gap-3 px-0">
                        <div className="min-w-0 flex-1">
                            <p className="text-lg leading-none font-semibold text-muted-foreground">
                                {outputLabel}
                            </p>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                aria-label="Output amount"
                                placeholder="0"
                                value={outputAmount}
                                disabled={
                                    (direction === "bch_to_token" && !selectedToken) ||
                                    (isQuoting && lastEdited === "input")
                                }
                                onChange={e => {
                                    setOutputAmount(e.target.value);
                                    setSwapType("exact_output");
                                    setLastEdited("output");
                                    setInputAmount("");
                                    setQuote(null);
                                    setPriceImpact(null);
                                    setEffectivePrice(null);
                                }}
                                className="mt-2 w-full border-0 bg-transparent text-5xl leading-none font-medium text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                        </div>

                        <div className="mt-1 flex flex-col items-end gap-3 shrink-0">
                            <button
                                type="button"
                                disabled={direction === "token_to_bch"}
                                onClick={() => setShowTokenModal(true)}
                                className="inline-flex h-10 items-center gap-2 rounded-full border bg-background/20 px-4 text-sm font-semibold shrink-0 disabled:cursor-default disabled:opacity-60"
                            >
                                <span className="flex items-center gap-2">
                                    {direction === "bch_to_token" ? (
                                        <>
                                            {selectedToken?.iconUrl && (
                                                <img
                                                    src={selectedToken.iconUrl}
                                                    alt={outputTokenLabel}
                                                    className="size-4 rounded-full"
                                                />
                                            )}
                                            <span>
                                                {selectedToken ? outputTokenLabel : "Select token"}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <img
                                                src="/icons/bch.svg"
                                                alt="BCH"
                                                className="size-4 rounded-full"
                                            />
                                            <span>{outputTokenLabel}</span>
                                        </>
                                    )}
                                </span>
                            </button>
                            <p className="text-sm leading-none font-semibold text-muted-foreground text-nowrap">
                                {/* Balance placeholder */}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slippage controls */}
            <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <span className="font-semibold">Slippage</span>
                    <div className="inline-flex gap-1 rounded-full border bg-background/40 px-1 py-0.5">
                        {[0.1, 0.5, 1].map(v => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setSlippage(v)}
                                className={`rounded-full px-2 py-0.5 text-[11px] ${
                                    slippage === v
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {v}%
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px]">Custom</span>
                    <input
                        type="number"
                        min="0"
                        step="any"
                        value={slippage}
                        onChange={e => {
                            const v = parseFloat(e.target.value);
                            if (Number.isFinite(v) && v >= 0) setSlippage(v);
                        }}
                        className="w-16 rounded-full border bg-background/40 px-2 py-0.5 text-right text-[11px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-[11px]">%</span>
                </div>
            </div>

            {/* Swap / connect button */}
            {isConnected ? (
                <>
                    <Button
                        type="button"
                        className="w-full mt-3 text-lg font-semibold h-14 rounded-full"
                        onClick={handleSwap}
                        disabled={!canSwap || txLoading || isQuoting}
                    >
                        {txLoading ? "Swapping…" : "Swap"}
                    </Button>
                    {validationError && (
                        <div className="mt-2 rounded-[14px] border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive text-center">
                            {validationError}
                        </div>
                    )}
                </>
            ) : (
                <ConnectWallet className="w-full mt-3 text-lg font-semibold h-14 rounded-full" />
            )}

            {/* Details (price / fees / impact) */}
            {selectedToken && (
                <div className="mt-3 rounded-[20px] border bg-popover px-4 py-3 text-xs space-y-1.5">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Price</span>
                        <span className="font-mono">
                            1 {selectedToken?.symbol ?? selectedToken?.name ?? "TOKEN"} ≈{" "}
                            {(() => {
                                // We always want: 1 TOKEN = X BCH
                                // Prefer live quote, but fall back cleanly to spot price
                                const spot = spotPrice && spotPrice > 0 ? spotPrice : null;

                                if (quote) {
                                    const rawEff =
                                        effectivePrice && effectivePrice > 0
                                            ? effectivePrice
                                            : quote.effectivePrice;

                                    // rawEff:
                                    // - BCH_TO_TOKEN: BCH per token
                                    // - TOKEN_TO_BCH: tokens per BCH (invert)
                                    if (Number.isFinite(rawEff) && rawEff > 0) {
                                        const bchPerToken =
                                            direction === "bch_to_token" ? rawEff : 1 / rawEff;
                                        if (Number.isFinite(bchPerToken) && bchPerToken > 0) {
                                            return formatNumber(bchPerToken, 8);
                                        }
                                    }

                                    // Degenerate quote (e.g. output ~0) → show spot price instead of "-"
                                    if (spot) {
                                        return formatNumber(spot, 8);
                                    }
                                    return "-";
                                }

                                if (spot) {
                                    return formatNumber(spot, 8);
                                }
                                return "-";
                            })()}{" "}
                            BCH
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Liquidity provider fee (0.3%)</span>
                        <span className="font-mono">
                            {quote ? `${formatNumber(quote.fee, 8)} ${inputTokenLabel}` : "-"}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Network fee</span>
                        <span className="font-mono">
                            {/* we can refine later when miner fee is surfaced */}
                            {quote ? "Included in output" : "-"}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Price impact</span>
                        <span className="font-mono">
                            {quote ? `${formatNumber(priceImpact ?? quote.priceImpact, 4)}%` : "-"}
                        </span>
                    </div>
                </div>
            )}

            {/* Footer notice */}
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

            {showTokenModal && tokensWithBalance.length > 0 && (
                <TokenSelectModal
                    tokens={tokensWithBalance}
                    onClose={() => setShowTokenModal(false)}
                    onSelect={t => {
                        setSelectedToken(t);
                        setQuote(null);
                        setPriceImpact(null);
                        setEffectivePrice(null);
                        setOutputAmount("");
                    }}
                />
            )}

            {tokensError && (
                <p className="mt-2 text-xs text-destructive text-center">{tokensError}</p>
            )}
        </div>
    );
}
