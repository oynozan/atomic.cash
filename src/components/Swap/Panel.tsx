"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, Github } from "lucide-react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";

import ConnectWallet from "@/components/Header/Connect";
import { useWalletSession } from "@/components/Wrappers/Wallet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatBchPrice, roundBch } from "@/lib/utils";
import { useTokenPriceStore } from "@/store/tokenPrice";
import { usePortfolioBalancesStore } from "@/store/portfolioBalances";
import { getAddressExplorerUrl } from "@/dapp/explorer";
import { cn } from "@/lib/utils";
import { getSocket } from "@/lib/socket";

type Direction = "bch_to_token" | "token_to_bch";

type TokenOption = {
    category: string;
    symbol?: string;
    name?: string;
    iconUrl?: string;
    poolCount?: number;
    totalBchLiquidity?: number;
    priceBch?: number | null;
    balance?: number;
};

type SwapQuote = {
    inputAmount: number;
    outputAmount: number;
    priceImpact: number;
    effectivePrice: number;
    spotPrice?: number;
    fee: number;
};

const QUOTE_REFRESH_INTERVAL_MS = 20_000;

type SwapPanelProps = {
    onSwapCompleted?: () => void;
    className?: string;
    initialToken?: TokenOption | null;
    /**
     * When true, the panel will NOT override the initially selected token
     * based on the URL (?token= or /swap/[tokenCategory]). Useful on the
     * dedicated token detail page where the page itself controls identity.
     */
    disableUrlPreselect?: boolean;
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
    tokensLoading,
    ensureBalances,
    onClose,
    onSelect,
}: {
    tokens: TokenOption[];
    tokensLoading: boolean;
    ensureBalances?: () => void;
    onClose: () => void;
    onSelect: (t: TokenOption) => void;
}) {
    const [search, setSearch] = useState("");

    // Remote search results from backend when there is a search query.
    const [remoteTokens, setRemoteTokens] = useState<TokenOption[] | null>(null);
    const [searchLoading, setSearchLoading] = useState(false);

    // Base list: all tokens sorted by total BCH liquidity (most popular first),
    // then by user balance.
    const sortedByPopularity = useMemo(
        () =>
            [...tokens].sort((a, b) => {
                const liqDiff = (b.totalBchLiquidity ?? 0) - (a.totalBchLiquidity ?? 0);
                if (liqDiff !== 0) return liqDiff;
                return (b.balance ?? 0) - (a.balance ?? 0);
            }),
        [tokens],
    );

    // Debounced backend search over the full token list.
    useEffect(() => {
        const q = search.trim();
        if (!q) {
            setRemoteTokens(null);
            setSearchLoading(false);
            return;
        }

        let cancelled = false;
        setSearchLoading(true);
        const handle = setTimeout(async () => {
            try {
                const res = await fetch(`/api/tokens/overview?q=${encodeURIComponent(q)}`);
                if (!res.ok) throw new Error("Failed to search tokens");
                const json = (await res.json()) as {
                    tokens: {
                        tokenCategory: string;
                        symbol?: string;
                        name?: string;
                        iconUrl?: string;
                        priceBch: number | null;
                        tvlBch: number;
                    }[];
                };
                if (cancelled) return;

                const mapped: TokenOption[] = json.tokens.map(t => {
                    const existing = tokens.find(x => x.category === t.tokenCategory);
                    return {
                        category: t.tokenCategory,
                        symbol: t.symbol ?? existing?.symbol,
                        name: t.name ?? existing?.name,
                        iconUrl: t.iconUrl ?? existing?.iconUrl,
                        priceBch: t.priceBch ?? existing?.priceBch,
                        totalBchLiquidity: t.tvlBch,
                        balance: existing?.balance,
                    };
                });

                setRemoteTokens(mapped);
                // After a successful search, re-trigger balances so newly
                // surfaced tokens also get up-to-date balances.
                ensureBalances?.();
            } catch {
                if (!cancelled) {
                    setRemoteTokens([]);
                }
            } finally {
                if (!cancelled) {
                    setSearchLoading(false);
                }
            }
        }, 300);

        return () => {
            cancelled = true;
            clearTimeout(handle);
        };
    }, [search, tokens]);

    const filtered = useMemo(() => {
        // No search: show only the top 20 most popular tokens.
        if (!search.trim()) {
            return sortedByPopularity.slice(0, 20);
        }

        // With a search query: show backend search results (already filtered).
        return remoteTokens ?? [];
    }, [search, sortedByPopularity, remoteTokens]);

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
                    {/* Loading states */}
                    {!search.trim() && tokensLoading && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            Loading tokens…
                        </div>
                    )}
                    {search.trim() && searchLoading && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            Searching tokens…
                        </div>
                    )}

                    {/* Empty state */}
                    {!tokensLoading &&
                        !searchLoading &&
                        filtered.length === 0 && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                No tokens with liquidity.
                            </div>
                        )}

                    {/* Results */}
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

export default function SwapPanel(props: SwapPanelProps) {
    const { onSwapCompleted, className, initialToken, disableUrlPreselect } = props;
    const { address, isConnected, session, provider } = useWalletSession();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();

    const [direction, setDirection] = useState<Direction>("bch_to_token");
    const [inputAmount, setInputAmount] = useState("");
    const [outputAmount, setOutputAmount] = useState("");
    const [swapType, setSwapType] = useState<"exact_input" | "exact_output">("exact_input");
    const [slippage, setSlippage] = useState<number>(0.5);

    // Top tokens for the swap panel (same source as Tokens page, but limited).
    const [overviewTokens, setOverviewTokens] = useState<
        {
            tokenCategory: string;
            symbol?: string;
            name?: string;
            iconUrl?: string;
            priceBch: number | null;
            tvlBch: number;
        }[]
    >([]);
    const [tokensError, setTokensError] = useState<string | null>(null);
    const [tokensLoading, setTokensLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setTokensError(null);
            setTokensLoading(true);
            try {
                // Fetch full tokens overview once; the modal will only show
                // the top N by default, but we keep the complete list here
                // so search, balances and pool detection always work correctly.
                const res = await fetch("/api/tokens/overview");
                if (!res.ok) throw new Error("Failed to load tokens overview");
                const json = (await res.json()) as {
                    tokens: {
                        tokenCategory: string;
                        symbol?: string;
                        name?: string;
                        iconUrl?: string;
                        priceBch: number | null;
                        tvlBch: number;
                    }[];
                };
                if (!cancelled) {
                    setOverviewTokens(json.tokens);
                }
            } catch (err) {
                if (!cancelled) {
                    setTokensError(
                        err instanceof Error ? err.message : "Failed to load tokens overview",
                    );
                }
            } finally {
                if (!cancelled) {
                    setTokensLoading(false);
                }
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, []);

    const tokens = useMemo(() => {
        if (!overviewTokens.length) return [];
        return overviewTokens
            .map<TokenOption>(t => ({
                category: t.tokenCategory,
                symbol: t.symbol,
                name: t.name,
                iconUrl: t.iconUrl,
                priceBch: t.priceBch,
                totalBchLiquidity: t.tvlBch,
            }))
            .sort((a, b) => (b.totalBchLiquidity ?? 0) - (a.totalBchLiquidity ?? 0));
    }, [overviewTokens]);

    const [selectedToken, setSelectedToken] = useState<TokenOption | null>(initialToken ?? null);
    const [showTokenModal, setShowTokenModal] = useState(false);

    const [quote, setQuote] = useState<SwapQuote | null>(null);
    const [priceImpact, setPriceImpact] = useState<number | null>(null);
    const [, setEffectivePrice] = useState<number | null>(null);
    const [spotPrice, setSpotPrice] = useState<number | null>(null);
    const [activePool, setActivePool] = useState<{
        ownerPkhHex: string;
        address?: string | null;
    } | null>(null);

    const [txLoading, setTxLoading] = useState(false);
    const [isQuoting, setIsQuoting] = useState(false);

    const portfolioBalances = usePortfolioBalancesStore(s =>
        address ? (s.byAddress[address]?.data ?? null) : null,
    );
    const fetchPortfolioBalances = usePortfolioBalancesStore(s => s.fetch);

    const bchBalance = portfolioBalances?.bch ?? null;
    const tokenBalances = useMemo(
        () =>
            portfolioBalances?.tokens?.map(t => ({ category: t.category, amount: t.amount })) ?? [],
        [portfolioBalances?.tokens],
    );
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

    // Keep selectedToken in sync with initialToken.
    // - If nothing selected yet, use initialToken directly
    // - If category changed, replace completely
    // - On token detail page (disableUrlPreselect=true), always merge latest fields
    //   (including priceBch) for the same category so header/panel stay in sync.
    // - On the generic swap page, only enrich identity once so we don't override
    //   user-chosen tokens after they've switched.
    useEffect(() => {
        if (!initialToken) return;
        setSelectedToken(prev => {
            if (!prev) return initialToken;
            if (prev.category !== initialToken.category) return initialToken;

            if (disableUrlPreselect) {
                // Token detail page: keep same category but always refresh token fields.
                return { ...prev, ...initialToken };
            }

            const prevHasIdentity = Boolean(prev.symbol || prev.name || prev.iconUrl);
            const nextHasIdentity = Boolean(
                initialToken.symbol || initialToken.name || initialToken.iconUrl,
            );

            if (!prevHasIdentity && nextHasIdentity) {
                return { ...prev, ...initialToken };
            }

            return prev;
        });
    }, [initialToken, disableUrlPreselect]);

    // Preselect token from URL when pools data is ready (unless explicitly disabled)
    useEffect(() => {
        if (disableUrlPreselect) return;
        if (!tokens.length) return;
        const tokenFromPath = pathname?.match(/^\/swap\/([a-fA-F0-9]+)$/)?.[1];
        const urlToken = searchParams?.get("token") ?? tokenFromPath;
        if (!urlToken) return;
        const found = tokens.find(t => t.category === urlToken);
        if (found) {
            setSelectedToken(prev => (prev && prev.category === found.category ? prev : found));
        } else {
            toast.error("No pool found for the requested token.");
            setSelectedToken(null);
        }
    }, [tokens, pathname, searchParams, disableUrlPreselect]);

    // Load user balances for percentage buttons (reuses portfolioBalances store with TTL)
    const ensureBalances = useCallback(() => {
        if (!isConnected || !address) return;
        void fetchPortfolioBalances(address);
    }, [isConnected, address, fetchPortfolioBalances]);

    // Load user balances for percentage buttons (reuses portfolioBalances store with TTL)
    useEffect(() => {
        ensureBalances();
    }, [ensureBalances]);

    const activeAmount = useMemo(
        () => (lastEdited === "input" ? inputAmount : outputAmount),
        [lastEdited, inputAmount, outputAmount],
    );

    const activeAmountNumber = useMemo(() => {
        const v = parseFloat(activeAmount);
        return Number.isFinite(v) && v > 0 ? v : 0;
    }, [activeAmount]);

    const validationError = useMemo(() => {
        if (!isConnected || !address || !selectedToken) return null;

        // No positive amount entered
        if (!activeAmountNumber) return null;

        // Wallet balance checks
        if (direction === "bch_to_token") {
            if (bchBalance != null && bchBalance < activeAmountNumber) {
                return "Not enough BCH to swap.";
            }
        } else {
            const tb = tokenBalances.find(t => t.category === selectedToken.category);
            const tokenBalance = tb?.amount ?? 0;
            if (tokenBalance < activeAmountNumber) {
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

    const hasValidQuote = quote && quote.outputAmount > 0;

    // Used only for UX (button label): true whenever the UI knows
    // that it is (or soon will be) refreshing the quote for the
    // current amount.
    const isQuoteStaleOrLoading =
        !!selectedToken &&
        activeAmountNumber > 0 &&
        !validationError &&
        (!hasValidQuote || isQuoting);

    const canSwap =
        isConnected &&
        !!address &&
        !!selectedToken &&
        activeAmountNumber > 0 &&
        !validationError &&
        !!hasValidQuote &&
        !isQuoting &&
        !txLoading;

    // Periodically refresh quote for the current amount to keep prices fresh,
    // similar to popular DEX UIs (e.g. ~20s interval).
    useEffect(() => {
        if (!selectedToken) return;
        if (!hasValidQuote) return;
        if (!isConnected || !address) return;
        if (!activeAmountNumber) return;
        if (txLoading) return;

        let cancelled = false;

        const intervalId = setInterval(() => {
            if (cancelled) return;
            if (isQuoting) return;
            if (txLoading) return;

            const value = parseFloat(activeAmount);
            if (!Number.isFinite(value) || value <= 0) return;

            const controller = new AbortController();
            quoteAbortRef.current = controller;
            setIsQuoting(true);

            (async () => {
                try {
                    const res = await fetch("/api/swap/quote", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "same-origin",
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
                        return;
                    }

                    setQuote({
                        inputAmount: raw.inputAmount,
                        outputAmount: raw.outputAmount,
                        priceImpact: raw.priceImpact,
                        effectivePrice: raw.effectivePrice,
                        spotPrice:
                            typeof raw.spotPrice === "number" && Number.isFinite(raw.spotPrice)
                                ? raw.spotPrice
                                : undefined,
                        fee: feeVal,
                    });
                    setPriceImpact(raw.priceImpact);
                    setEffectivePrice(raw.effectivePrice);
                    if (data.pool && typeof data.pool.ownerPkhHex === "string") {
                        setActivePool({
                            ownerPkhHex: data.pool.ownerPkhHex,
                            address:
                                typeof data.pool.address === "string" ? data.pool.address : null,
                        });
                    } else {
                        setActivePool(null);
                    }

                    if (swapType === "exact_input") {
                        setOutputAmount(raw.outputAmount.toString());
                    } else {
                        setInputAmount(raw.inputAmount.toString());
                    }
                } catch {
                    // Silently ignore periodic quote errors; keep last good quote.
                } finally {
                    setIsQuoting(false);
                    if (quoteAbortRef.current === controller) {
                        quoteAbortRef.current = null;
                    }
                }
            })().catch(() => {
                // already handled above
            });
        }, QUOTE_REFRESH_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [
        selectedToken,
        hasValidQuote,
        isConnected,
        address,
        activeAmount,
        activeAmountNumber,
        isQuoting,
        direction,
        swapType,
        slippage,
        txLoading,
    ]);

    const inputLabel = direction === "bch_to_token" ? "You pay" : "You pay (token)";
    const outputLabel = direction === "bch_to_token" ? "You receive (token)" : "You receive";

    const inputTokenLabel =
        direction === "bch_to_token" ? "BCH" : (selectedToken?.symbol ?? "Select token");
    const outputTokenLabel =
        direction === "bch_to_token" ? (selectedToken?.symbol ?? "Select token") : "BCH";

    // Spot price: prefer page data (same BCH-weighted price as header/chart). Only call price
    // endpoint when page didn't provide price (e.g. token from list without detail). This avoids
    // redundant request and prevents overwriting with a different/lower-precision value.
    const fetchPrice = useTokenPriceStore(s => s.fetchPrice);
    const selectedCategory = selectedToken?.category ?? null;
    const cachedPrice = useTokenPriceStore(
        useCallback(
            s => (selectedCategory ? s.getCached(selectedCategory) : null),
            [selectedCategory],
        ),
    );
    useEffect(() => {
        if (!selectedToken) {
            setSpotPrice(null);
            return;
        }
        const pagePrice =
            typeof selectedToken.priceBch === "number" && selectedToken.priceBch > 0
                ? selectedToken.priceBch
                : null;
        if (pagePrice != null) {
            setSpotPrice(roundBch(pagePrice));
            return;
        }
        let cancelled = false;
        fetchPrice(selectedToken.category).then(result => {
            if (!cancelled && result?.marketPrice != null) {
                setSpotPrice(roundBch(result.marketPrice));
            }
        });
        return () => {
            cancelled = true;
        };
    }, [selectedToken, fetchPrice]);

    // Keep local spotPrice in sync with the latest cached on-chain price so that
    // when the socket-driven token price store refreshes (e.g. after any swap
    // event), all swap panels showing that token update together.
    useEffect(() => {
        if (!selectedCategory) return;
        if (!cachedPrice) return;
        setSpotPrice(roundBch(cachedPrice.marketPrice));
    }, [selectedCategory, cachedPrice?.marketPrice]);

    // Panel-local safety net: listen to swap transactions for the currently
    // selected token and force-refresh its on-chain spot price in the global
    // token price store. This ensures the homepage swap panel (which doesn't
    // have a dedicated token detail header) still picks up price changes even
    // if other socket listeners are not mounted.
    useEffect(() => {
        if (!selectedCategory) return;
        const socket = getSocket();
        if (!socket) return;

        type TxPayload = {
            type?: string;
            tokenCategory?: string;
        };

        const handleSwapTx = (payload: TxPayload) => {
            if (!payload || payload.type !== "swap") return;
            if (payload.tokenCategory !== selectedCategory) return;

            const store = useTokenPriceStore.getState();
            store.invalidate(selectedCategory);
            void store.fetchPrice(selectedCategory);
        };

        socket.on("transaction:swap", handleSwapTx);

        return () => {
            socket.off("transaction:swap", handleSwapTx);
        };
    }, [selectedCategory]);

    const handleFlipDirection = () => {
        setDirection(d => (d === "bch_to_token" ? "token_to_bch" : "bch_to_token"));
        setOutputAmount("");
        setQuote(null);
        setPriceImpact(null);
        setEffectivePrice(null);
        setActivePool(null);
        setSwapType("exact_input");
        setLastEdited("input");
    };

    const handleSwap = async () => {
        if (!canSwap || !selectedToken || !address || !session) return;
        const rawAmount = lastEdited === "input" ? inputAmount : outputAmount;
        const value = parseFloat(rawAmount);
        if (!Number.isFinite(value) || value <= 0) return;

        // Stop any in-flight quote while we build/sign the swap TX.
        quoteAbortRef.current?.abort();
        quoteAbortRef.current = null;
        setIsQuoting(false);

        setTxLoading(true);
        try {
            const res = await fetch("/api/swap", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                    direction,
                    tokenCategory: selectedToken.category,
                    amount: value,
                    slippageTolerance: slippage,
                    swapType,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to build swap transaction");
            }

            setOutputAmount(String(data.outputAmount ?? ""));

            const wcObj = JSON.parse(data.wcTransactionJson);

            // Inform the user that the wallet should show a signing prompt
            toast.success("Swap transaction is ready. Please confirm in your wallet.");

            const { signWcTransaction } = await import("@/lib/web3");
            const signResult = await signWcTransaction(wcObj, provider);
            if (!signResult?.signedTransaction) {
                // User closed/cancelled in wallet – treat as graceful cancel, not error.
                toast.info("Swap cancelled in your wallet.");
                return;
            }

            const broadcastRes = await fetch("/api/tx/broadcast", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
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
                // Record swap in Mongo so trade history and activity show it.
                // Await so that onSwapCompleted() refetch sees the new trade.
                await fetch("/api/portfolio/transactions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify({
                        txid,
                        type: "swap",
                        direction,
                        tokenCategory: selectedToken.category,
                        amounts: {
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
            setActivePool(null);

            // Notify parent so token detail page can refresh price, chart, and trade history.
            onSwapCompleted?.();
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
            setActivePool(null);
            return;
        }

        // While a swap transaction is being built/signed/broadcast,
        // don't fire new quote requests.
        if (txLoading) {
            return;
        }

        const value = parseFloat(activeAmount);
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
                    credentials: "same-origin",
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
                        // Clear stale quote/pool so details rows show "-"
                        setQuote(null);
                        setPriceImpact(null);
                        setEffectivePrice(null);
                        setActivePool(null);
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
                        // Clear stale quote/pool so details rows show "-"
                        setQuote(null);
                        setPriceImpact(null);
                        setEffectivePrice(null);
                        setActivePool(null);
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
                if (data.pool && typeof data.pool.ownerPkhHex === "string") {
                    setActivePool({
                        ownerPkhHex: data.pool.ownerPkhHex,
                        address: typeof data.pool.address === "string" ? data.pool.address : null,
                    });
                } else {
                    setActivePool(null);
                }

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
                // On error, drop quote and pool so UI shows "-"
                setQuote(null);
                setPriceImpact(null);
                setEffectivePrice(null);
                setActivePool(null);
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
    }, [direction, swapType, lastEdited, activeAmount, slippage, selectedToken, txLoading]);

    return (
        <div id="swap-panel" className={cn(className ? "w-full min-w-0" : "w-full max-w-[min(100%,36rem)] sm:max-w-[36rem] min-w-0", className)}>
            <div className="relative overflow-hidden rounded-[24px] border bg-popover">
                {/* Top: input leg — right column fixed width so both rows keep same input width */}
                <div className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 rounded-t-[24px] min-w-0">
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
                                setActivePool(null);
                            }}
                            className="mt-2 w-full min-w-0 border-0 bg-transparent text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-none font-medium text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        />
                    </div>

                    <div className="mt-1 flex flex-col items-end gap-3 shrink-0 w-[7.5rem] min-w-[7.5rem]">
                        <button
                            type="button"
                            disabled={direction === "bch_to_token"}
                            onClick={() => setShowTokenModal(true)}
                            className="inline-flex h-10 items-center gap-2 rounded-full border bg-background/20 px-4 text-sm font-semibold shrink-0 disabled:cursor-default disabled:opacity-60 w-full justify-center"
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
                                <span className="leading-none flex items-center gap-2 truncate">
                                    {selectedToken?.iconUrl && (
                                        /* eslint-disable @next/next/no-img-element */
                                        <img
                                            src={selectedToken.iconUrl}
                                            alt={inputTokenLabel}
                                            className="size-4 rounded-full shrink-0"
                                        />
                                    )}
                                    <span className="truncate">{selectedToken ? inputTokenLabel : "Select token"}</span>
                                </span>
                            )}
                        </button>
                        <p className="text-sm leading-none font-semibold text-muted-foreground text-nowrap h-[1.25rem]">
                            {/* Balance placeholder — fixed height so layout stable */}
                        </p>
                        {/* Percentage buttons for active leg — always reserve space so row height doesn't change */}
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

                            const handlePercent = (pct: number) => {
                                if (!maxAmount || maxAmount <= 0) return;
                                const v = (maxAmount * pct) / 100;
                                setInputAmount(v.toString());
                                setSwapType("exact_input");
                                setLastEdited("input");
                                setOutputAmount("");
                                setQuote(null);
                                setPriceImpact(null);
                                setEffectivePrice(null);
                                setActivePool(null);
                            };

                            return (
                                <div className="flex items-center gap-1 text-[11px] min-h-[1.5rem]">
                                    {maxAmount && maxAmount > 0 ? (
                                        <>
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
                                        </>
                                    ) : (
                                        <span className="invisible">0%</span>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Middle: direction toggle */}
                <div className="relative border-t bg-secondary px-3 sm:px-5 py-3 sm:py-4 rounded-b-[24px] min-w-0">
                    <button
                        type="button"
                        className="absolute left-1/2 top-0 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-3 border-popover bg-secondary"
                        onClick={handleFlipDirection}
                    >
                        <ArrowDown className="size-7" />
                    </button>

                    {/* Bottom: output leg */}
                    <div className="mt-1 flex items-center justify-between gap-2 sm:gap-3 px-0 min-w-0">
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
                                    setActivePool(null);
                                }}
                                className="mt-2 w-full min-w-0 border-0 bg-transparent text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-none font-medium text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                        </div>

                        <div className="mt-1 flex flex-col items-end gap-3 shrink-0 w-[7.5rem] min-w-[7.5rem]">
                            <button
                                type="button"
                                disabled={direction === "token_to_bch"}
                                onClick={() => setShowTokenModal(true)}
                                className="inline-flex h-10 items-center gap-2 rounded-full border bg-background/20 px-4 text-sm font-semibold shrink-0 disabled:cursor-default disabled:opacity-60 w-full justify-center"
                            >
                                <span className="flex items-center gap-2 truncate">
                                    {direction === "bch_to_token" ? (
                                        <>
                                            {selectedToken?.iconUrl && (
                                                <img
                                                    src={selectedToken.iconUrl}
                                                    alt={outputTokenLabel}
                                                    className="size-4 rounded-full shrink-0"
                                                />
                                            )}
                                            <span className="truncate">
                                                {selectedToken ? outputTokenLabel : "Select token"}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <img
                                                src="/icons/bch.svg"
                                                alt="BCH"
                                                className="size-4 rounded-full shrink-0"
                                            />
                                            <span className="truncate">{outputTokenLabel}</span>
                                        </>
                                    )}
                                </span>
                            </button>
                            <p className="text-sm leading-none font-semibold text-muted-foreground text-nowrap h-[1.25rem]">
                                {/* Balance placeholder — same height as input row */}
                            </p>
                            <div className="min-h-[1.5rem]" aria-hidden />
                        </div>
                    </div>
                </div>
            </div>

            {/* Slippage controls */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:gap-3 px-1 text-xs text-muted-foreground min-w-0">
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
                        {txLoading
                            ? "Swapping…"
                            : isQuoteStaleOrLoading
                              ? "Updating quote…"
                              : "Swap"}
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
                    {/* Global spot price: all pools weighted average */}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Spot price</span>
                        <span className="font-mono">
                            1 {selectedToken?.symbol ?? selectedToken?.name ?? "TOKEN"} ≈{" "}
                            {(() => {
                                const spot =
                                    typeof spotPrice === "number" && spotPrice > 0
                                        ? spotPrice
                                        : null;

                                if (spot != null) {
                                    return formatBchPrice(spot);
                                }
                                return "-";
                            })()}{" "}
                            BCH
                        </span>
                    </div>
                    {/* Selected pool spot price (micro pool used for this quote) */}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Pool price</span>
                        <span className="font-mono">
                            {(() => {
                                if (!quote) return "-";

                                // Prefer backend-provided pool spot price (BCH per token). If it is
                                // missing, fall back to the global spot price for this token.
                                const poolSpotRaw =
                                    typeof quote.spotPrice === "number" &&
                                    Number.isFinite(quote.spotPrice) &&
                                    quote.spotPrice > 0
                                        ? quote.spotPrice
                                        : typeof selectedToken?.priceBch === "number" &&
                                            selectedToken.priceBch > 0
                                          ? selectedToken.priceBch
                                          : null;

                                const poolSpot =
                                    poolSpotRaw != null && Number.isFinite(poolSpotRaw) && poolSpotRaw > 0
                                        ? roundBch(poolSpotRaw)
                                        : null;

                                if (!poolSpot || !Number.isFinite(poolSpot) || poolSpot <= 0) {
                                    return "-";
                                }

                                return `1 ${
                                    selectedToken?.symbol ?? selectedToken?.name ?? "TOKEN"
                                } ≈ ${formatBchPrice(roundBch(poolSpot))} BCH`;
                            })()}
                        </span>
                    </div>
                    {/* Quote price: always shown as 1 TOKEN ≈ X BCH (direction-agnostic) */}
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Quote price</span>
                        <span className="font-mono">
                            {(() => {
                                if (!quote || quote.inputAmount <= 0 || quote.outputAmount <= 0) {
                                    return "-";
                                }

                                // Derive BCH per token directly from the quoted amounts so that
                                // this stays stable regardless of how the backend reports
                                // effectivePrice for different directions.
                                const rawBchPerToken =
                                    direction === "bch_to_token"
                                        ? quote.inputAmount / quote.outputAmount
                                        : quote.outputAmount / quote.inputAmount;

                                if (
                                    !Number.isFinite(rawBchPerToken) ||
                                    rawBchPerToken <= 0
                                ) {
                                    return "-";
                                }

                                const bchPerToken = roundBch(rawBchPerToken);

                                return `1 ${
                                    selectedToken?.symbol ?? selectedToken?.name ?? "TOKEN"
                                } ≈ ${formatBchPrice(roundBch(bchPerToken))} BCH`;
                            })()}
                        </span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Selected pool</span>
                        {quote && activePool ? (
                            <a
                                href={getAddressExplorerUrl(
                                    activePool.address ?? activePool.ownerPkhHex,
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-primary hover:underline"
                                onClick={e => e.stopPropagation()}
                            >
                                {activePool.address
                                    ? `${activePool.address.slice(0, 6)}…${activePool.address.slice(-6)}`
                                    : `${activePool.ownerPkhHex.slice(0, 6)}…${activePool.ownerPkhHex.slice(-6)}`}
                            </a>
                        ) : (
                            <span className="font-mono">-</span>
                        )}
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Price impact</span>
                        <span className="font-mono">
                            {quote ? `${formatNumber(priceImpact ?? quote.priceImpact, 4)}%` : "-"}
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
                        <span className="text-muted-foreground">Liquidity provider fee (0.3%)</span>
                        <span className="font-mono">
                            {quote ? `${formatNumber(quote.fee, 8)} ${inputTokenLabel}` : "-"}
                        </span>
                    </div>
                </div>
            )}

            {/* Footer notice */}
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground font-semibold px-2 sm:px-4 text-center wrap-break-word">
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

            {showTokenModal && (
                <TokenSelectModal
                    tokens={tokensWithBalance}
                    tokensLoading={tokensLoading}
                    ensureBalances={ensureBalances}
                    onClose={() => setShowTokenModal(false)}
                    onSelect={t => {
                        setSelectedToken(t);
                        setQuote(null);
                        setPriceImpact(null);
                        setEffectivePrice(null);
                        setOutputAmount("");
                        // Update URL for deep linking
                        try {
                            const path = pathname || "/swap";

                            // If we are on token overview route (/swap/[tokenCategory]),
                            // navigate by updating the path param so the whole page data refreshes.
                            if (/^\/swap\/[a-fA-F0-9]+$/.test(path)) {
                                router.push(`/swap/${t.category}`, { scroll: false });
                            } else {
                                // On the homepage (e.g. "/"), just update the ?token= query param.
                                const basePath = path;
                                const params = new URLSearchParams(searchParams?.toString());
                                params.set("token", t.category);
                                const qs = params.toString();
                                router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
                            }
                        } catch {
                            // non-fatal – URL update best-effort only
                        }
                    }}
                />
            )}

            {tokensError && (
                <p className="mt-2 text-xs text-destructive text-center">{tokensError}</p>
            )}
        </div>
    );
}
