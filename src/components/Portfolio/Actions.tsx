"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Wallet, ChevronDown, Copy } from "lucide-react";
import { toast } from "sonner";
import { decodeCashAddress, encodeCashAddress } from "@bitauth/libauth";

import { useWalletSession } from "@/components/Wrappers/Wallet";
import { usePortfolioBalancesStore } from "@/store/portfolioBalances";
import { usePortfolioBalanceHistoryStore } from "@/store/portfolioBalanceHistory";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import QRCode from "react-qr-code";

type BalancesResponse = import("@/store/portfolioBalances").PortfolioBalancesResponse;

type PriceResponse = {
    hasMarketPools?: boolean;
    marketPrice?: number;
};

function formatNumber(n: number, maxDecimals = 6): string {
    if (!Number.isFinite(n)) return "-";
    const fixed = n.toFixed(maxDecimals);
    const [intPart, decPart] = fixed.split(".");
    const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const dec = (decPart || "").replace(/0+$/, "");
    return dec ? `${intWithSep}.${dec}` : intWithSep;
}

/* eslint-disable @next/next/no-img-element */
function TokenIcon({ iconUrl, symbol }: { iconUrl?: string | null; symbol: string }) {
    if (iconUrl) {
        return (
            <img src={iconUrl} alt={symbol} className="size-5 rounded-full object-cover shrink-0" />
        );
    }
    return (
        <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0">
            {symbol.slice(0, 1)}
        </div>
    );
}
/* eslint-enable @next/next/no-img-element */

export default function PortfolioActions() {
    const { address, isConnected, provider } = useWalletSession();
    const fetchBalances = usePortfolioBalancesStore(s => s.fetch);
    const byAddress = usePortfolioBalancesStore(s => s.byAddress);
    const loadingByAddress = usePortfolioBalancesStore(s => s.loading);
    const setPortfolioBchInStore = usePortfolioBalancesStore(s => s.setPortfolioBch);
    const invalidateBalances = usePortfolioBalancesStore(s => s.invalidate);
    const invalidateBalanceHistory = usePortfolioBalanceHistoryStore(s => s.invalidate);

    const balances = address ? (byAddress[address]?.data ?? null) : null;
    const loadingBalances = address ? (loadingByAddress[address] ?? false) : false;
    const cachedPortfolioBch = address ? (byAddress[address]?.portfolioBch ?? null) : null;

    const [sendOpen, setSendOpen] = useState(false);
    const [receiveOpen, setReceiveOpen] = useState(false);
    const [sendAssetType, setSendAssetType] = useState<"bch" | "token">("bch");
    const [selectedTokenCategory, setSelectedTokenCategory] = useState<string | null>(null);
    const [sendTo, setSendTo] = useState("");
    const [sendAmount, setSendAmount] = useState("");
    const [sending, setSending] = useState(false);
    const [portfolioBch, setPortfolioBch] = useState<number | null>(
        () => cachedPortfolioBch ?? null,
    );

    // Load balances from store (cached per address, no refetch on tab change)
    useEffect(() => {
        if (!isConnected || !address) return;
        fetchBalances(address);
    }, [isConnected, address, fetchBalances]);

    // Restore cached portfolio total when switching back to tab (same address + balances)
    useEffect(() => {
        if (cachedPortfolioBch != null && balances != null) {
            setPortfolioBch(cachedPortfolioBch);
        }
    }, [cachedPortfolioBch, balances]);

    // Approximate total portfolio value in BCH using AMM pool prices (run once per balances, cache in store)
    useEffect(() => {
        if (!balances || !address) {
            setPortfolioBch(null);
            return;
        }
        if (cachedPortfolioBch != null) {
            setPortfolioBch(cachedPortfolioBch);
            return;
        }
        let cancelled = false;

        const compute = async () => {
            let total = balances.bch;
            const uniqueCategories = Array.from(
                new Set(balances.tokens.filter(t => t.amount > 0).map(t => t.category)),
            );

            const priceEntries: Record<string, number> = {};

            await Promise.all(
                uniqueCategories.map(async cat => {
                    try {
                        const res = await fetch(
                            `/api/pools/price?tokenCategory=${encodeURIComponent(cat)}`,
                        );
                        if (!res.ok) return;
                        const json: PriceResponse = await res.json();
                        if (json.hasMarketPools && typeof json.marketPrice === "number") {
                            priceEntries[cat] = json.marketPrice;
                        }
                    } catch {
                        // ignore individual failures
                    }
                }),
            );

            for (const t of balances.tokens) {
                const price = priceEntries[t.category];
                if (price && t.amount > 0) {
                    total += t.amount * price;
                }
            }

            if (!cancelled) {
                setPortfolioBch(total);
                setPortfolioBchInStore(address, total);
            }
        };

        void compute();

        return () => {
            cancelled = true;
        };
    }, [balances, address, cachedPortfolioBch, setPortfolioBchInStore]);

    const selectableTokens = useMemo(
        () => balances?.tokens.filter(t => t.amount > 0).sort((a, b) => b.amount - a.amount) ?? [],
        [balances],
    );

    const selectedToken = useMemo(
        () =>
            selectedTokenCategory
                ? (selectableTokens.find(t => t.category === selectedTokenCategory) ?? null)
                : (selectableTokens[0] ?? null),
        [selectableTokens, selectedTokenCategory],
    );

    const tokenReceiveAddress = useMemo(() => {
        if (!address) return null;
        try {
            const decoded = decodeCashAddress(address);
            if (typeof decoded === "string") return address;
            if (decoded.type === "p2pkhWithTokens" || decoded.type === "p2shWithTokens") {
                return address;
            }
            const tokenType = decoded.type === "p2sh" ? "p2shWithTokens" : "p2pkhWithTokens";
            const encoded = encodeCashAddress({
                prefix: decoded.prefix,
                type: tokenType as typeof decoded.type,
                payload: decoded.payload,
            });
            if (typeof encoded === "string") return address;
            return encoded.address;
        } catch {
            return address;
        }
    }, [address]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isConnected || !address || !provider) {
            toast.error("Connect your wallet first.");
            return;
        }
        const trimmedTo = sendTo.trim();
        const value = parseFloat(sendAmount);
        if (!trimmedTo || !Number.isFinite(value) || value <= 0) {
            toast.error("Enter a valid amount and recipient address.");
            return;
        }

        if (sendAssetType === "token") {
            if (!selectedToken) {
                toast.error("Select a token to send.");
                return;
            }
            if (value > selectedToken.amount) {
                toast.error("You don't have enough balance for this token.");
                return;
            }
        }

        if (sendAssetType === "token" && !selectedToken?.category) {
            toast.error("Invalid token selection.");
            return;
        }

        setSending(true);
        try {
            const res = await fetch("/api/tx/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                    fromAddress: address,
                    toAddress: trimmedTo,
                    amount: value,
                    tokenCategory:
                        sendAssetType === "token" && selectedToken
                            ? selectedToken.category
                            : undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to prepare send transaction");
            }

            const wcObj = JSON.parse(data.wcTransactionJson);
            const { signWcTransaction } = await import("@/lib/web3");
            toast.info("Transaction prepared. Please confirm it in your wallet.");
            const signResult = await signWcTransaction(wcObj, provider);
            if (!signResult?.signedTransaction) {
                throw new Error("Transaction signing failed or was rejected.");
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

            toast.success(
                broadcastData.txid
                    ? `Send submitted successfully. TxID: ${broadcastData.txid}`
                    : "Send submitted successfully.",
            );
            invalidateBalances(address);
            invalidateBalanceHistory(address);
            setSendOpen(false);
            setSendAssetType("bch");
            setSelectedTokenCategory(null);
            setSendAmount("");
            setSendTo("");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to send");
        } finally {
            setSending(false);
        }
    };

    const totalLabel = useMemo(() => {
        if (portfolioBch == null) return "-";
        return `${formatNumber(portfolioBch, 6)} BCH`;
    }, [portfolioBch]);

    const canSend = isConnected && !!address;

    return (
        <>
            <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-stretch">
                {/* Left: actions */}
                <div className="rounded-[24px] border bg-popover px-5 py-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-semibold text-foreground">
                                Quick actions
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Send or receive BCH.
                            </div>
                        </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3">
                        <Button
                            type="button"
                            disabled={!canSend}
                            onClick={() => setSendOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                        >
                            <ArrowUpRight className="size-4" />
                            <span>Send</span>
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!canSend}
                            onClick={() => setReceiveOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                        >
                            <ArrowDownRight className="size-4" />
                            <span>Receive</span>
                        </Button>
                    </div>
                </div>

                {/* Right: total portfolio */}
                <div className="rounded-[24px] border bg-popover px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                            <Wallet className="size-5" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground font-medium">
                                Total portfolio (in BCH)
                            </span>
                            <span className="text-xl font-semibold text-foreground">
                                {loadingBalances ? "…" : totalLabel}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Send modal */}
            {sendOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
                    onClick={() => !sending && setSendOpen(false)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border bg-popover p-5 shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Send</h2>
                            <button
                                type="button"
                                onClick={() => !sending && setSendOpen(false)}
                                className="text-sm text-muted-foreground hover:text-foreground"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleSend} className="space-y-4">
                            <div className="flex flex-col gap-3">
                                <div className="inline-flex self-start rounded-full bg-background/60 p-1 text-xs">
                                    <button
                                        type="button"
                                        onClick={() => setSendAssetType("bch")}
                                        className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
                                            sendAssetType === "bch"
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        BCH
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSendAssetType("token");
                                            if (!selectedToken && selectableTokens[0]) {
                                                setSelectedTokenCategory(
                                                    selectableTokens[0].category,
                                                );
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-full font-semibold transition-colors ${
                                            sendAssetType === "token"
                                                ? "bg-primary text-primary-foreground"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        Token
                                    </button>
                                </div>
                                {sendAssetType === "token" && (
                                    <div className="space-y-1">
                                        <label className="text-xs font-medium text-muted-foreground">
                                            Select token
                                        </label>
                                        {loadingBalances ? (
                                            <div className="flex h-10 items-center rounded-xl border bg-background/40 px-3 text-[11px] text-muted-foreground">
                                                Loading your tokens…
                                            </div>
                                        ) : selectableTokens.length === 0 ? (
                                            <div className="flex h-10 items-center rounded-xl border border-dashed bg-background/40 px-3 text-[11px] text-muted-foreground">
                                                No tokens with balance.
                                            </div>
                                        ) : (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        className="w-full justify-between h-10 rounded-xl px-3 text-xs font-normal"
                                                    >
                                                        <span className="flex items-center gap-2 truncate">
                                                            {selectedToken ? (
                                                                <>
                                                                    <TokenIcon
                                                                        iconUrl={
                                                                            selectedToken.iconUrl
                                                                        }
                                                                        symbol={
                                                                            selectedToken.symbol ??
                                                                            selectedToken.category.slice(
                                                                                0,
                                                                                8,
                                                                            )
                                                                        }
                                                                    />
                                                                    <span className="truncate">
                                                                        {selectedToken.symbol ??
                                                                            selectedToken.category.slice(
                                                                                0,
                                                                                8,
                                                                            )}
                                                                        {selectedToken.name
                                                                            ? ` · ${selectedToken.name}`
                                                                            : ""}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                "Select token"
                                                            )}
                                                        </span>
                                                        <ChevronDown className="size-3 shrink-0 opacity-60" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="start"
                                                    className="w-(--radix-dropdown-menu-trigger-width) max-h-64 overflow-y-auto"
                                                >
                                                    {selectableTokens.map(t => (
                                                        <DropdownMenuItem
                                                            key={t.category}
                                                            onSelect={() =>
                                                                setSelectedTokenCategory(t.category)
                                                            }
                                                            className="flex items-center gap-2 text-xs"
                                                        >
                                                            <TokenIcon
                                                                iconUrl={t.iconUrl}
                                                                symbol={
                                                                    t.symbol ??
                                                                    t.category.slice(0, 8)
                                                                }
                                                            />
                                                            <span className="truncate">
                                                                {t.symbol ?? t.category.slice(0, 8)}
                                                                {t.name ? ` · ${t.name}` : ""}
                                                            </span>
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">
                                    {sendAssetType === "bch"
                                        ? "Amount (BCH)"
                                        : `Amount (${selectedToken?.symbol || selectedToken?.name || "token"})`}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={sendAmount}
                                    onChange={e => setSendAmount(e.target.value)}
                                    className="w-full rounded-xl border bg-background/50 px-3 py-2 text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    placeholder="0.0"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">
                                    To address
                                </label>
                                <input
                                    type="text"
                                    value={sendTo}
                                    onChange={e => setSendTo(e.target.value)}
                                    className="w-full rounded-xl border bg-background/50 px-3 py-2 text-sm outline-none"
                                    placeholder="bitcoincash:..."
                                />
                            </div>
                            <Button
                                type="submit"
                                disabled={sending}
                                className="w-full mt-2 rounded-full"
                            >
                                {sending ? "Sending…" : "Send"}
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {/* Receive modal */}
            {receiveOpen && address && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
                    onClick={() => setReceiveOpen(false)}
                >
                    <div
                        className="w-full max-w-3xl rounded-2xl border bg-popover p-5 shadow-xl flex flex-col gap-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="mb-1 flex items-center justify-between w-full">
                            <h2 className="text-lg font-semibold">Receive crypto</h2>
                            <button
                                type="button"
                                onClick={() => setReceiveOpen(false)}
                                className="text-sm text-muted-foreground hover:text-foreground"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="text-xs text-muted-foreground text-center">
                            Scan the code to receive BCH or CashTokens.
                        </div>
                        <div className="w-full flex flex-col md:flex-row md:items-start md:justify-center gap-6 mt-1">
                            <div className="flex-1 flex flex-col items-center gap-3">
                                <div className="rounded-[24px] bg-background/80 p-4 shadow-inner">
                                    <div className="bg-popover rounded-2xl p-3 border border-border/60">
                                        <QRCode
                                            value={address}
                                            size={180}
                                            fgColor="#ffffff"
                                            bgColor="transparent"
                                            style={{ width: "180px", height: "180px" }}
                                        />
                                    </div>
                                </div>
                                <div className="w-full max-w-xs space-y-1">
                                    <div className="text-xs text-muted-foreground text-center">
                                        BCH address
                                    </div>
                                    <div className="flex items-center justify-between gap-2 rounded-full border bg-background/60 pl-4 pr-1 py-1 mx-auto">
                                        <p className="text-xs font-mono truncate">
                                            {address}
                                        </p>
                                        <Button
                                            type="button"
                                            size="icon"
                                            variant="outline"
                                            onClick={() => {
                                                navigator.clipboard
                                                    .writeText(address)
                                                    .then(() => toast.success("Address copied"))
                                                    .catch(() =>
                                                        toast.error("Failed to copy address"),
                                                    );
                                            }}
                                        >
                                            <Copy size={12} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            {tokenReceiveAddress && (
                                <div className="flex-1 flex flex-col items-center gap-3">
                                    <div className="rounded-[24px] bg-background/80 p-4 shadow-inner">
                                        <div className="bg-popover rounded-2xl p-3 border border-border/60">
                                            <QRCode
                                                value={tokenReceiveAddress}
                                                size={180}
                                                fgColor="#ffffff"
                                                bgColor="transparent"
                                                style={{ width: "180px", height: "180px" }}
                                            />
                                        </div>
                                    </div>
                                    <div className="w-full max-w-xs space-y-1">
                                        <div className="text-xs text-muted-foreground text-center">
                                            Token (CashTokens) address
                                        </div>
                                        <div className="flex items-center justify-between gap-2 rounded-full border bg-background/60 pl-4 pr-1 py-1 mx-auto">
                                            <p className="text-xs font-mono truncate">
                                                {tokenReceiveAddress}
                                            </p>
                                            <Button
                                                type="button"
                                                size="icon"
                                                variant="outline"
                                                onClick={() => {
                                                    navigator.clipboard
                                                        .writeText(tokenReceiveAddress)
                                                        .then(() => toast.success("Address copied"))
                                                        .catch(() =>
                                                            toast.error("Failed to copy address"),
                                                        );
                                                }}
                                            >
                                                <Copy size={12} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
