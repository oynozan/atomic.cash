"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useWalletSession } from "../Wrappers/Wallet";
import { formatAddress, formatError } from "@/lib/utils";
import { usePortfolioBalancesStore } from "@/store/portfolioBalances";

export default function ConnectWallet({ className }: { className?: string }) {
    const session = useWalletSession();
    const router = useRouter();
    const [bchBalance, setBchBalance] = useState<number | null>(null);
    const fetchBalances = usePortfolioBalancesStore(s => s.fetch);

    const handleDisconnect = async () => {
        try {
            await session.disconnectWallet();
        } catch (error) {
            console.error("[wallet-ui] disconnect failed", error);
            toast.error(formatError(error));
        }
    };

    const handleConnect = async () => {
        if (!session.provider || !session.modal) {
            return toast.error(
                session?.initError || "An error occurred while connecting the wallet.",
            );
        }
        try {
            await session.connectWallet();
        } catch (error) {
            console.error("[wallet-ui] connect failed", error);
            toast.error(formatError(error));
        }
    };

    const isConnected = session.isConnected && Boolean(session.address);

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!isConnected || !session.address) {
                if (!cancelled) {
                    setBchBalance(null);
                }
                return;
            }

            const store = usePortfolioBalancesStore.getState();
            const cached = store.getCached(session.address!);
            if (cached && !cancelled) {
                setBchBalance(cached.bch);
            }
            const data = await fetchBalances(session.address!);
            if (!cancelled && data) {
                setBchBalance(data.bch);
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [isConnected, session.address, fetchBalances]);

    const formattedAddress = session.address ? formatAddress(session.address) : "";
    const balanceLabel =
        bchBalance !== null && Number.isFinite(bchBalance) ? `${bchBalance.toFixed(4)} BCH` : "";

    const disabled = session.isConnecting || session.isAuthorizing;

    if (isConnected) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className={className} disabled={disabled}>
                        <>
                            <span className="max-[500px]:hidden">{formattedAddress} · </span>
                            {balanceLabel || ""}
                        </>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" className="min-w-40 cursor-pointer">
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={event => {
                            event.preventDefault();
                            router.push("/pools/manage");
                        }}
                    >
                        My Liquidity Pools
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={event => {
                            event.preventDefault();
                            router.push("/portfolio");
                        }}
                    >
                        View Portfolio
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="cursor-pointer"
                        onSelect={event => {
                            event.preventDefault();
                            handleDisconnect();
                        }}
                    >
                        Disconnect
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <Button className={className} onClick={handleConnect} disabled={disabled}>
            {session.isAuthorizing ? (
                "Signing..."
            ) : session.isConnecting ? (
                "Connecting..."
            ) : (
                "Connect Wallet"
            )}
        </Button>
    );
}
