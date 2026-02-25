"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import { useWalletSession } from "@/components/Wrappers/Wallet";
import ConnectWallet from "@/components/Header/Connect";
import { Button } from "@/components/ui/button";
import { signWcTransaction } from "@/lib/web3";
import { formatError } from "@/lib/utils";
import { toast } from "sonner";
import type { SessionTypes } from "@walletconnect/types";
import type UniversalProvider from "@walletconnect/universal-provider";
import { useUserPoolsStore, type UserPoolSummary } from "@/store/userPools";

function formatNumber(n: number, maxDecimals = 4): string {
    if (!Number.isFinite(n)) return "-";
    const fixed = n.toFixed(maxDecimals);
    const [intPart, decPart] = fixed.split(".");
    const intWithSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const dec = (decPart || "").replace(/0+$/, "");
    return dec ? `${intWithSep}.${dec}` : intWithSep;
}

function Modal({
    title,
    onClose,
    children,
}: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-2xl border bg-popover p-5 shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-sm text-muted-foreground hover:text-foreground"
                    >
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

type AddLiquidityContentProps = {
    pool: UserPoolSummary;
    address: string;
    session: SessionTypes.Struct;
    provider: UniversalProvider | null;
    addAmount: string;
    setAddAmount: (v: string) => void;
    addMode: "bch" | "token";
    setAddMode: (v: "bch" | "token") => void;
    txLoading: boolean;
    setTxLoading: (v: boolean) => void;
    onDone: () => void;
};

function AddLiquidityContent({
    pool,
    address,
    session,
    provider,
    addAmount,
    setAddAmount,
    addMode,
    setAddMode,
    txLoading,
    setTxLoading,
    onDone,
}: AddLiquidityContentProps) {
    const tokenLabel = pool.tokenSymbol ?? pool.tokenCategory.slice(0, 8) + "…";

    const parsed = parseFloat(addAmount);
    const isValid = Number.isFinite(parsed) && parsed > 0;

    let previewBch: number | null = null;
    let previewToken: number | null = null;

    if (isValid && pool.bchReserve > 0 && pool.tokenReserve > 0) {
        const ratioTokenPerBch = pool.tokenReserve / pool.bchReserve;
        const ratioBchPerToken = pool.bchReserve / pool.tokenReserve;
        if (addMode === "bch") {
            previewBch = parsed;
            previewToken = parsed * ratioTokenPerBch;
        } else {
            previewToken = parsed;
            previewBch = parsed * ratioBchPerToken;
        }
    }

    return (
        <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
                Add liquidity to your micro pool. BCH and token amounts will follow the current pool
                ratio.
            </p>

            <div className="flex gap-2 rounded-full border bg-background/40 p-1 text-xs font-medium">
                <button
                    type="button"
                    className={`flex-1 rounded-full px-3 py-1 ${
                        addMode === "bch"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground"
                    }`}
                    onClick={() => {
                        setAddMode("bch");
                        setAddAmount("");
                    }}
                >
                    Enter BCH
                </button>
                <button
                    type="button"
                    className={`flex-1 rounded-full px-3 py-1 ${
                        addMode === "token"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground"
                    }`}
                    onClick={() => {
                        setAddMode("token");
                        setAddAmount("");
                    }}
                >
                    Enter {tokenLabel}
                </button>
            </div>

            <div className="space-y-3">
                <label className="block text-sm font-medium leading-none mb-2">
                    {addMode === "bch" ? "BCH Amount" : `${tokenLabel} Amount`}
                </label>
                <div className="flex items-center justify-between gap-3 rounded-[20px] border bg-popover px-4 py-3">
                    <input
                        type="number"
                        min="0"
                        step="any"
                        value={addAmount}
                        onChange={e => setAddAmount(e.target.value)}
                        className="w-full border-0 bg-transparent text-2xl leading-none font-medium text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        placeholder="0.01"
                    />
                    <div className="inline-flex items-center gap-2 rounded-full border bg-background/20 px-3 py-1 text-xs font-semibold shrink-0">
                        {addMode === "bch" ? (
                            <>
                                <Image
                                    src="/icons/bch.svg"
                                    alt="BCH"
                                    width={20}
                                    height={20}
                                    className="rounded-full"
                                />
                                <span>BCH</span>
                            </>
                        ) : (
                            /* eslint-disable @next/next/no-img-element */
                            <>
                                <img
                                    src={pool.tokenIconUrl ?? ""}
                                    alt={tokenLabel}
                                    className="size-6 rounded-full object-cover border border-background/40"
                                />
                                <span>{tokenLabel}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {previewBch !== null && previewToken !== null && (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>
                        You will add approximately{" "}
                        <span className="font-mono">
                            {formatNumber(previewBch, 8)} BCH + {formatNumber(previewToken, 4)}{" "}
                            {tokenLabel}
                        </span>
                    </span>
                </div>
            )}

            <Button
                type="button"
                className="w-full"
                disabled={txLoading || !isValid}
                onClick={() =>
                    handleAddLiquidity(
                        pool,
                        address,
                        addAmount,
                        addMode,
                        session,
                        provider,
                        setTxLoading,
                        onDone,
                    )
                }
            >
                {txLoading ? "Submitting…" : "Confirm Add Liquidity"}
            </Button>
        </div>
    );
}

type RemoveLiquidityContentProps = {
    pool: UserPoolSummary;
    address: string;
    session: SessionTypes.Struct;
    provider: UniversalProvider | null;
    removePercentage: string;
    setRemovePercentage: (v: string) => void;
    removeAll: boolean;
    setRemoveAll: (v: boolean) => void;
    txLoading: boolean;
    setTxLoading: (v: boolean) => void;
    onDone: () => void;
};

function RemoveLiquidityContent({
    pool,
    address,
    session,
    provider,
    removePercentage,
    setRemovePercentage,
    removeAll,
    setRemoveAll,
    txLoading,
    setTxLoading,
    onDone,
}: RemoveLiquidityContentProps) {
    const tokenLabel = pool.tokenSymbol ?? pool.tokenCategory.slice(0, 8) + "…";

    const pct = parseFloat(removePercentage);
    const pctValid = Number.isFinite(pct) && pct > 0 && pct <= 100;

    let previewBch: number | null = null;
    let previewToken: number | null = null;

    if (removeAll) {
        previewBch = pool.bchReserve;
        previewToken = pool.tokenReserve;
    } else if (pctValid) {
        const ratio = pct / 100;
        previewBch = pool.bchReserve * ratio;
        previewToken = pool.tokenReserve * ratio;
    }

    return (
        <div className="space-y-5">
            <p className="text-sm text-muted-foreground">
                Remove liquidity proportionally from BCH and token reserves. Pool price will stay
                the same.
            </p>

            <div className="space-y-3">
                <label className="block text-sm font-medium leading-none mb-2">
                    Percentage to withdraw
                </label>
                <div className="flex items-center justify-between gap-3 rounded-[20px] border bg-popover px-4 py-3">
                    <input
                        type="number"
                        min="1"
                        max="100"
                        step="any"
                        value={removePercentage}
                        onChange={e => setRemovePercentage(e.target.value)}
                        disabled={removeAll}
                        className="w-full border-0 bg-transparent text-2xl leading-none font-medium text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:text-muted-foreground/60"
                        placeholder="25"
                    />
                    <div className="inline-flex items-center gap-2 rounded-full border bg-background/20 px-3 py-1 text-xs font-semibold shrink-0">
                        <span>%</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <input
                    id="withdrawAll"
                    type="checkbox"
                    checked={removeAll}
                    onChange={e => setRemoveAll(e.target.checked)}
                    className="rounded"
                />
                <label htmlFor="withdrawAll" className="text-xs text-muted-foreground">
                    Withdraw all liquidity
                </label>
            </div>

            {previewBch !== null && previewToken !== null && (
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>
                        You will receive approximately{" "}
                        <span className="font-mono">
                            {formatNumber(previewBch, 8)} BCH + {formatNumber(previewToken, 4)}{" "}
                            {tokenLabel}
                        </span>
                    </span>
                </div>
            )}

            <Button
                type="button"
                className="w-full"
                disabled={txLoading || (!removeAll && !pctValid)}
                variant="destructive"
                onClick={() =>
                    handleRemoveLiquidity(
                        pool,
                        address,
                        removePercentage,
                        removeAll,
                        session,
                        provider,
                        setTxLoading,
                        onDone,
                    )
                }
            >
                {txLoading ? "Submitting…" : "Confirm Remove Liquidity"}
            </Button>
        </div>
    );
}

async function handleAddLiquidity(
    pool: UserPoolSummary,
    address: string,
    amount: string,
    mode: "bch" | "token",
    _session: SessionTypes.Struct,
    provider: UniversalProvider | null,
    setTxLoading: (v: boolean) => void,
    onDone: () => void,
) {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
        toast.error(`Enter a valid ${mode === "bch" ? "BCH" : "token"} amount.`);
        return;
    }

    setTxLoading(true);
    try {
        const res = await fetch("/api/pool/add-liquidity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                tokenCategory: pool.tokenCategory,
                bchAmount: mode === "bch" ? value : undefined,
                tokenAmount: mode === "token" ? value : undefined,
                ownerTokenAddress: address,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Failed to build add-liquidity transaction");
        }

        toast.info("Transaction prepared. Please confirm it in your wallet.");
        const wcObj = JSON.parse(data.wcTransactionJson);
        const signResult = await signWcTransaction(wcObj, provider);
        if (!signResult?.signedTransaction) {
            toast.error("Transaction signing failed or was rejected.");
            return;
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

        const txid: string | undefined = broadcastData?.txid || broadcastData?.transactionId;

        if (txid) {
            // Fire-and-forget: record add-liquidity action for Activity
            void fetch("/api/portfolio/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    txid,
                    address,
                    type: "add_liquidity",
                    tokenCategory: pool.tokenCategory,
                    amounts: {
                        bchIn: data.bchAdded,
                        tokenIn: data.tokensAdded,
                    },
                }),
            }).catch(() => {
                // Non-fatal: ignore logging errors
            });
        }

        toast.success("Liquidity added successfully.");
        onDone();
    } catch (err) {
        toast.error(formatError(err));
    } finally {
        setTxLoading(false);
    }
}

async function handleRemoveLiquidity(
    pool: UserPoolSummary,
    address: string,
    percentage: string,
    withdrawAll: boolean,
    _session: SessionTypes.Struct,
    provider: UniversalProvider | null,
    setTxLoading: (v: boolean) => void,
    onDone: () => void,
) {
    const body: {
        tokenCategory: string;
        ownerTokenAddress: string;
        withdrawAll?: boolean;
        percentage?: number;
    } = {
        tokenCategory: pool.tokenCategory,
        ownerTokenAddress: address,
    };

    if (withdrawAll) {
        body.withdrawAll = true;
    } else {
        const pct = parseFloat(percentage);
        if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
            toast.error("Percentage must be between 1 and 100.");
            return;
        }
        body.percentage = pct;
    }

    setTxLoading(true);
    try {
        const res = await fetch("/api/pool/remove-liquidity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || "Failed to build remove-liquidity transaction");
        }

        toast.info("Transaction prepared. Please confirm it in your wallet.");
        const wcObj = JSON.parse(data.wcTransactionJson);
        const signResult = await signWcTransaction(wcObj, provider);
        if (!signResult?.signedTransaction) {
            toast.error("Transaction signing failed or was rejected.");
            return;
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

        const txid: string | undefined = broadcastData?.txid || broadcastData?.transactionId;

        if (txid) {
            // Fire-and-forget: record remove-liquidity action for Activity
            void fetch("/api/portfolio/transactions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    txid,
                    address,
                    type: "remove_liquidity",
                    tokenCategory: pool.tokenCategory,
                    amounts: {
                        bchOut: data.bchWithdrawn,
                        tokenOut: data.tokensWithdrawn,
                    },
                }),
            }).catch(() => {
                // Non-fatal: ignore logging errors
            });
        }

        toast.success("Liquidity removed successfully.");
        onDone();
    } catch (err) {
        toast.error(formatError(err));
    } finally {
        setTxLoading(false);
    }
}

/* eslint-disable @next/next/no-img-element */
function TokenAvatar({ symbol, iconUrl }: { symbol: string; iconUrl?: string }) {
    if (iconUrl) {
        return (
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
/* eslint-enable @next/next/no-img-element */

export default function ManagePoolsPage() {
    const { address, isConnected, session, provider } = useWalletSession();
    const fetchUserPools = useUserPoolsStore(s => s.fetch);
    const byAddress = useUserPoolsStore(s => s.byAddress);
    const loadingByAddress = useUserPoolsStore(s => s.loading);
    const errorByAddress = useUserPoolsStore(s => s.error);

    const [activeModal, setActiveModal] = useState<{
        type: "add" | "remove";
        pool: UserPoolSummary;
    } | null>(null);
    const [addAmount, setAddAmount] = useState("");
    const [addMode, setAddMode] = useState<"bch" | "token">("bch");
    const [removePercentage, setRemovePercentage] = useState("");
    const [removeAll, setRemoveAll] = useState(false);
    const [txLoading, setTxLoading] = useState(false);

    const data = address ? byAddress[address]?.data ?? null : null;
    const loading = address ? loadingByAddress[address] ?? false : false;
    const error = address ? errorByAddress[address] ?? null : null;

    useEffect(() => {
        if (!isConnected || !address) return;
        void fetchUserPools(address);
    }, [address, isConnected, fetchUserPools]);

    const grouped = useMemo(() => {
        if (!data) return [];
        const map = new Map<
            string,
            {
                tokenCategory: string;
                tokenSymbol?: string;
                tokenIconUrl?: string;
                totalBch: number;
                totalToken: number;
                pools: UserPoolSummary[];
            }
        >();

        for (const pool of data.pools) {
            const existing = map.get(pool.tokenCategory);
            if (existing) {
                existing.totalBch += pool.bchReserve;
                existing.totalToken += pool.tokenReserve;
                existing.pools.push(pool);
            } else {
                map.set(pool.tokenCategory, {
                    tokenCategory: pool.tokenCategory,
                    tokenSymbol: pool.tokenSymbol,
                    tokenIconUrl: pool.tokenIconUrl,
                    totalBch: pool.bchReserve,
                    totalToken: pool.tokenReserve,
                    pools: [pool],
                });
            }
        }

        return Array.from(map.values()).sort((a, b) => b.totalBch - a.totalBch);
    }, [data]);

    if (!isConnected || !address) {
        return (
            <section className="w-screen pt-44 pb-32 flex justify-center">
                <div className="home-container max-w-xl">
                    <Link
                        href="/pools"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
                    >
                        ← Back to Pools
                    </Link>
                    <h1 className="text-4xl font-figtree font-bold mb-6">My Liquidity Pools</h1>
                    <div className="rounded-[24px] border border-dashed bg-muted/30 flex flex-col items-center justify-center py-16 px-6">
                        <p className="text-muted-foreground text-center mb-6">
                            Connect your wallet to see and manage your pools.
                        </p>
                        <ConnectWallet className="py-4 px-6" />
                    </div>
                </div>
            </section>
        );
    }

    const isInitialLoading = loading && !data && !error;

    if (isInitialLoading) {
        return (
            <section className="w-screen pt-44 pb-32 flex justify-center">
                <div className="home-container max-w-xl">
                    <Link
                        href="/pools"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
                    >
                        ← Back to Pools
                    </Link>
                    <h1 className="text-4xl font-figtree font-bold mb-6">My Liquidity Pools</h1>
                    <div className="rounded-[24px] border bg-popover flex items-center justify-center py-16 px-6 text-muted-foreground">
                        Loading your pools…
                    </div>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="w-screen pt-44 pb-32 flex justify-center">
                <div className="home-container max-w-xl">
                    <Link
                        href="/pools"
                        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
                    >
                        ← Back to Pools
                    </Link>
                    <h1 className="text-4xl font-figtree font-bold mb-6">My Liquidity Pools</h1>
                    <div className="rounded-[24px] border border-destructive/50 bg-destructive/5 flex items-center justify-center py-16 px-6 text-destructive">
                        {error}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="w-screen pt-44 pb-32 flex justify-center">
            <div className="home-container max-w-3xl">
                <Link
                    href="/pools"
                    className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
                >
                    ← Back to Pools
                </Link>
                <h1 className="text-4xl font-figtree font-bold mb-6">My Liquidity Pools</h1>

                {grouped.length === 0 ? (
                    <div className="rounded-[24px] border bg-popover flex flex-col items-center justify-center py-16 px-6 text-muted-foreground">
                        You do not have any pools yet. Create a pool from the Pools page.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {grouped.map(group => (
                            <div
                                key={group.tokenCategory}
                                className="rounded-[24px] border bg-popover px-5 py-4 space-y-3"
                            >
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center -space-x-3">
                                            <TokenAvatar
                                                symbol={
                                                    group.tokenSymbol ??
                                                    group.tokenCategory.slice(0, 8) + "…"
                                                }
                                                iconUrl={group.tokenIconUrl}
                                            />
                                            <div className="size-9 rounded-full border border-background/40 bg-emerald-500/10 grid place-items-center">
                                                <Image
                                                    src="/icons/bch.svg"
                                                    alt="BCH"
                                                    width={24}
                                                    height={24}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-lg font-semibold">
                                                {group.tokenSymbol ??
                                                    group.tokenCategory.slice(0, 8) + "…"}{" "}
                                                - BCH
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                Total liquidity:{" "}
                                                <span className="font-mono text-foreground">
                                                    {formatNumber(group.totalBch, 4)} BCH
                                                </span>
                                            </span>
                                            <span className="text-[11px] text-muted-foreground">
                                                Total tokens:{" "}
                                                <span className="font-mono text-foreground">
                                                    {formatNumber(group.totalToken, 4)}{" "}
                                                    {group.tokenSymbol ??
                                                        group.tokenCategory.slice(0, 4) + "…"}
                                                </span>
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {group.pools.length} micro pool
                                        {group.pools.length > 1 ? "s" : ""}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {group.pools
                                        .slice()
                                        .sort((a, b) => b.bchReserve - a.bchReserve)
                                        .map((pool, idx) => (
                                            <div
                                                key={`${pool.poolOwnerPkhHex}-${pool.tokenCategory}-${idx}`}
                                                className="flex items-center justify-between rounded-[16px] bg-background/40 px-4 py-3 text-xs"
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-medium">
                                                        Micro pool #{idx + 1}
                                                    </span>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        Pool address: {pool.poolAddress.slice(-10)}…
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-right">
                                                        <div className="text-[11px] text-muted-foreground">
                                                            Liquidity
                                                        </div>
                                                        <div className="font-mono">
                                                            {formatNumber(pool.bchReserve, 4)}{" "}
                                                            <span className="text-muted-foreground">
                                                                BCH
                                                            </span>
                                                        </div>
                                                        <div className="font-mono text-[11px] text-muted-foreground">
                                                            {formatNumber(pool.tokenReserve, 4)}{" "}
                                                            <span className="text-muted-foreground">
                                                                {group.tokenSymbol ??
                                                                    group.tokenCategory.slice(
                                                                        0,
                                                                        4,
                                                                    ) + "…"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-xs"
                                                            onClick={() => {
                                                                setActiveModal({
                                                                    type: "add",
                                                                    pool,
                                                                });
                                                                setAddAmount("");
                                                                setAddMode("bch");
                                                            }}
                                                        >
                                                            Add Liquidity
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-xs"
                                                            onClick={() => {
                                                                setActiveModal({
                                                                    type: "remove",
                                                                    pool,
                                                                });
                                                                setRemovePercentage("");
                                                                setRemoveAll(false);
                                                            }}
                                                        >
                                                            Remove Liquidity
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {activeModal && session && (
                <Modal
                    title={activeModal.type === "add" ? "Add Liquidity" : "Remove Liquidity"}
                    onClose={() => setActiveModal(null)}
                >
                    {activeModal.type === "add" ? (
                        <AddLiquidityContent
                            pool={activeModal.pool}
                            address={address}
                            session={session}
                            provider={provider}
                            addAmount={addAmount}
                            setAddAmount={setAddAmount}
                            addMode={addMode}
                            setAddMode={setAddMode}
                            txLoading={txLoading}
                            setTxLoading={setTxLoading}
                            onDone={() => {
                                setActiveModal(null);
                                if (address) {
                                    void fetchUserPools(address, true);
                                }
                            }}
                        />
                    ) : (
                        <RemoveLiquidityContent
                            pool={activeModal.pool}
                            address={address}
                            session={session}
                            provider={provider}
                            removePercentage={removePercentage}
                            setRemovePercentage={setRemovePercentage}
                            removeAll={removeAll}
                            setRemoveAll={setRemoveAll}
                            txLoading={txLoading}
                            setTxLoading={setTxLoading}
                            onDone={() => {
                                setActiveModal(null);
                                if (address) {
                                    void fetchUserPools(address, true);
                                }
                            }}
                        />
                    )}
                </Modal>
            )}
        </section>
    );
}
