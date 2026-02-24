"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ChevronDown } from "lucide-react";

import { useWalletSession } from "@/components/Wrappers/Wallet";
import ConnectWallet from "@/components/Header/Connect";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signWcTransaction } from "@/lib/web3";
import { formatError } from "@/lib/utils";
import { useTokenPriceStore } from "@/store/tokenPrice";
import { usePoolsStore } from "@/store/pools";
import { useTokensOverviewStore } from "@/store/tokensOverview";

type TokenItem = {
  category: string;
  symbol?: string;
  name?: string | null;
  decimals: number;
  amount: number;
  amountRaw: string;
  iconUrl?: string | null;
};

type BalancesResponse = {
  bch: number;
  bchRaw: string;
  tokens: TokenItem[];
};

/* eslint-disable @next/next/no-img-element */
function TokenIcon({ iconUrl, symbol }: { iconUrl?: string | null; symbol: string }) {
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt={symbol}
        className="size-6 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
      {symbol.slice(0, 1)}
    </div>
  );
}
/* eslint-enable @next/next/no-img-element */

export default function CreatePoolPage() {
  const router = useRouter();
  const { address, session, isConnected } = useWalletSession();
  const [loading, setLoading] = useState(false);
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenItem | null>(null);
  const [bchAmount, setBchAmount] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [lastEdited, setLastEdited] = useState<"bch" | "token" | null>(null);
  const [hasMarketPools, setHasMarketPools] = useState(false);
  const [marketPrice, setMarketPrice] = useState<number | null>(null);
  const [hasOwnPoolForToken, setHasOwnPoolForToken] = useState(false);

  // Fetch balances once per address
  useEffect(() => {
    if (!address?.trim()) return;
    let cancelled = false;
    setBalancesLoading(true);
    fetch(`/api/portfolio/balances?address=${encodeURIComponent(address)}`)
      .then((res) => {
        if (!res.ok) return res.json().then((b) => Promise.reject(new Error(b?.error || res.statusText)));
        return res.json();
      })
      .then((json: BalancesResponse) => {
        if (!cancelled) {
          setBalances(json);
        }
      })
      .catch(() => {
        if (!cancelled) setBalances(null);
      })
      .finally(() => {
        if (!cancelled) setBalancesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  // After balances load, auto-select first token (only once)
  useEffect(() => {
    if (!balances || selectedToken) return;
    const tokens = balances.tokens.filter((t) => t.amount > 0);
    if (tokens.length > 0) {
      setSelectedToken(tokens[0]);
    }
  }, [balances, selectedToken]);

  const tokenCategory = selectedToken?.category ?? "";
  const fetchTokenPrice = useTokenPriceStore((s) => s.fetchPrice);
  useEffect(() => {
    if (!tokenCategory) {
      setHasMarketPools(false);
      setMarketPrice(null);
      return;
    }
    let cancelled = false;
    fetchTokenPrice(tokenCategory).then((result) => {
      if (cancelled) return;
      if (result) {
        setHasMarketPools(result.hasMarketPools);
        setMarketPrice(Number.isFinite(result.marketPrice) ? result.marketPrice : null);
      } else {
        setHasMarketPools(false);
        setMarketPrice(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tokenCategory, fetchTokenPrice]);

  // Check if user already has a pool for selected token
  useEffect(() => {
    if (!address?.trim() || !tokenCategory) {
      setHasOwnPoolForToken(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/user/pools?address=${encodeURIComponent(address)}`)
      .then((res) => {
        if (!res.ok) return res.json().then((b) => Promise.reject(new Error(b?.error || res.statusText)));
        return res.json();
      })
      .then((json: { pools: { tokenCategory: string }[] }) => {
        if (cancelled) return;
        const exists = json.pools?.some((p) => p.tokenCategory === tokenCategory);
        setHasOwnPoolForToken(Boolean(exists));
      })
      .catch(() => {
        if (!cancelled) setHasOwnPoolForToken(false);
      });
    return () => {
      cancelled = true;
    };
  }, [address, tokenCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address || !session) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (!tokenCategory.trim()) {
      toast.error("Select a token from your balance.");
      return;
    }

    const parsedBch = bchAmount ? parseFloat(bchAmount) : undefined;
    const parsedToken = tokenAmount ? parseFloat(tokenAmount) : undefined;

    let bch: number | undefined = parsedBch;
    let token: number | undefined = parsedToken;
    let shouldUseMarketPrice = false;

    if (hasMarketPools && marketPrice && marketPrice > 0) {
      shouldUseMarketPrice = true;
      if (!lastEdited) {
        toast.error("When pools exist, enter BCH or token amount.");
        return;
      }
      if (lastEdited === "bch") {
        if (parsedBch === undefined || Number.isNaN(parsedBch) || parsedBch <= 0) {
          toast.error("Enter a valid positive BCH amount.");
          return;
        }
        bch = parsedBch;
        token = undefined; // let backend compute exact token amount
      } else {
        if (parsedToken === undefined || Number.isNaN(parsedToken) || parsedToken <= 0) {
          toast.error("Enter a valid positive token amount.");
          return;
        }
        token = parsedToken;
        bch = undefined; // let backend compute exact BCH amount
      }
    } else {
      // First pool: both required, user sets initial price freely
      if (
        parsedBch === undefined ||
        Number.isNaN(parsedBch) ||
        parsedBch <= 0 ||
        parsedToken === undefined ||
        Number.isNaN(parsedToken) ||
        parsedToken <= 0
      ) {
        toast.error("For the first pool, provide both BCH and token amounts (positive numbers).");
        return;
      }
      bch = parsedBch;
      token = parsedToken;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/pool/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenCategory: tokenCategory.trim(),
          bchAmount: bch,
          tokenAmount: token,
          useMarketPrice: shouldUseMarketPrice || undefined,
          ownerTokenAddress: address,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create pool");
      }

      toast.info("Transaction prepared. Please confirm it in your wallet.");

      const wcObj = JSON.parse(data.wcTransactionJson);
      const signResult = await signWcTransaction(wcObj, session);
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
        // Fire-and-forget: record pool creation for Activity
        void fetch("/api/portfolio/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txid,
            address,
            type: "create_pool",
            tokenCategory: tokenCategory.trim(),
            amounts: {
              bchIn: bch,
              tokenIn: token,
            },
          }),
        }).catch(() => {
          // Non-fatal: ignore logging errors
        });
      }

      const registerRes = await fetch("/api/registry/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pkhHex: data.poolOwnerPkhHex,
          address,
        }),
      });
      if (!registerRes.ok) {
        const regData = await registerRes.json().catch(() => ({}));
        toast.warning(
          regData?.error ?? "Pool created but failed to add to list. You can still use the pool."
        );
      }

      toast.success("Pool created successfully!");
      usePoolsStore.getState().invalidate();
      useTokensOverviewStore.getState().invalidate();
      router.push("/pools");
    } catch (err) {
      toast.error(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const tokensWithBalance = balances?.tokens?.filter((t) => t.amount > 0) ?? [];

  const formatPrice = (value: number): string => {
    const s = value.toFixed(8);
    return s.replace(/\.?0+$/, "");
  };

  let initialPriceDisplay: string | null = null;
  if (hasMarketPools && marketPrice && marketPrice > 0) {
    initialPriceDisplay = `${formatPrice(marketPrice)} BCH per token (market price)`;
  } else {
    const bchVal = bchAmount ? parseFloat(bchAmount) : NaN;
    const tokenVal = tokenAmount ? parseFloat(tokenAmount) : NaN;
    if (Number.isFinite(bchVal) && Number.isFinite(tokenVal) && tokenVal > 0) {
      const price = bchVal / tokenVal;
      initialPriceDisplay = `${formatPrice(price)} BCH per token`;
    }
  }

  if (!isConnected || !address) {
    return (
      <section className="w-screen pt-44 flex justify-center">
        <div className="home-container">
          <Link
            href="/pools"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="size-4" />
            Back to Pools
          </Link>
          <h1 className="text-4xl font-figtree font-bold mb-6">Create Pool</h1>
          <div className="rounded-[24px] border border-dashed bg-muted/30 flex flex-col items-center justify-center py-16 px-6">
            <p className="text-muted-foreground text-center mb-6">
              Connect your wallet to create a pool.
            </p>
            <ConnectWallet className="py-4 px-6" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="w-screen pt-44 flex justify-center">
      <div className="home-container max-w-xl">
        <Link
          href="/pools"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to Pools
        </Link>
        <h1 className="text-4xl font-figtree font-bold mb-6">Create Pool</h1>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-[24px] border bg-secondary/80 p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none">Token</label>
            {balancesLoading ? (
              <div className="flex h-12 items-center rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground">
                Loading your tokens…
              </div>
            ) : tokensWithBalance.length === 0 ? (
              <div className="flex h-12 items-center rounded-md border border-dashed bg-muted/30 px-3 text-sm text-muted-foreground">
                No tokens in your wallet. Add token balance to create a pool.
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between h-12 font-normal"
                  >
                    <span className="flex items-center gap-2 truncate">
                      {selectedToken ? (
                        <>
                          <TokenIcon
                            iconUrl={selectedToken.iconUrl}
                            symbol={selectedToken.symbol ?? selectedToken.category.slice(0, 8)}
                          />
                          <span>
                            {selectedToken.symbol ?? selectedToken.category.slice(0, 8)}
                            {selectedToken.name ? ` · ${selectedToken.name}` : ""}
                          </span>
                        </>
                      ) : (
                        "0"
                      )}
                    </span>
                    <ChevronDown className="size-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) max-h-64 overflow-y-auto">
                  {tokensWithBalance.map((t) => (
                    <DropdownMenuItem
                      key={t.category}
                      onSelect={() => setSelectedToken(t)}
                      className="flex items-center gap-2"
                    >
                      <TokenIcon
                        iconUrl={t.iconUrl}
                        symbol={t.symbol ?? t.category.slice(0, 8)}
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

          {hasOwnPoolForToken ? (
            <div className="space-y-3 rounded-[20px] border border-amber-500/40 bg-amber-500/5 px-4 py-4">
              <p className="text-sm font-medium text-amber-100">
                You already have a pool for this token.
              </p>
              <p className="text-xs text-amber-100/80">
                Manage your liquidity from the My Liquidity Pools page.
              </p>
              <div>
                <Link href="/pools/manage">
                  <Button variant="outline" size="sm" className="bg-background/40">
                    Go to My Liquidity Pools
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex gap-4">
                <div className="flex-1 space-y-3">
                  <label className="text-sm font-medium leading-none">BCH Amount</label>
                  <div className="flex items-center justify-between gap-3 rounded-[20px] border bg-popover px-4 py-3">
                    <input
                      id="bchAmount"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={bchAmount}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLastEdited("bch");
                        setBchAmount(v);
                        if (hasMarketPools && marketPrice && marketPrice > 0) {
                          const num = parseFloat(v);
                          if (!Number.isNaN(num)) {
                            const derived = num / marketPrice;
                            setTokenAmount(derived ? String(derived) : "");
                          }
                        }
                      }}
                      className="w-full border-0 bg-transparent text-3xl leading-none font-medium text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:text-muted-foreground/50"
                      disabled={!selectedToken || balancesLoading}
                    />
                    <div className="flex items-center gap-2 rounded-full border bg-background/20 px-3 py-1 text-sm font-semibold shrink-0">
                      <Image
                        src="/icons/bch.svg"
                        alt="BCH"
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                      <span>BCH</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <label className="text-sm font-medium leading-none">Token Amount</label>
                  <div className="flex items-center justify-between gap-3 rounded-[20px] border bg-popover px-4 py-3">
                    <input
                      id="tokenAmount"
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={tokenAmount}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLastEdited("token");
                        setTokenAmount(v);
                        if (hasMarketPools && marketPrice && marketPrice > 0) {
                          const num = parseFloat(v);
                          if (!Number.isNaN(num)) {
                            const derived = num * marketPrice;
                            setBchAmount(derived ? String(derived) : "");
                          }
                        }
                      }}
                      className="w-full border-0 bg-transparent text-3xl leading-none font-medium text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:text-muted-foreground/50"
                      disabled={!selectedToken || balancesLoading}
                    />
                    <div className="inline-flex items-center gap-2 rounded-full border bg-background/20 px-3 py-1 text-sm font-semibold shrink-0">
                      {selectedToken ? (
                        <>
                          <TokenIcon
                            iconUrl={selectedToken.iconUrl}
                            symbol={selectedToken.symbol ?? selectedToken.category.slice(0, 8)}
                          />
                          <span>{selectedToken.symbol ?? selectedToken.category.slice(0, 8)}</span>
                        </>
                      ) : (
                        <span>TOKEN</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {hasMarketPools
                    ? "Existing pools detected: enter ONLY BCH or ONLY token amount; the other will follow market price."
                    : "First pool for this token: set both BCH and token amounts (this defines the initial price)."}
                </p>
                {initialPriceDisplay && (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/5 px-3 py-1 text-xs font-medium text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>Initial price: {initialPriceDisplay}</span>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  loading ||
                  balancesLoading ||
                  !selectedToken ||
                  (!bchAmount.trim() && !tokenAmount.trim()) ||
                  tokensWithBalance.length === 0
                }
              >
                {loading ? "Creating…" : "Create Pool"}
              </Button>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
