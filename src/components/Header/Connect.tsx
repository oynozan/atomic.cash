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

type BalancesResponse = {
    bch: number;
    bchRaw: string;
};

export default function ConnectWallet({ className }: { className?: string }) {
    const session = useWalletSession();
    const router = useRouter();
    const [bchBalance, setBchBalance] = useState<number | null>(null);

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
            return toast.error(session?.initError || "An error occurred while connecting the wallet.");
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
        if (!isConnected || !session.address) {
            setBchBalance(null);
            return;
        }
        let cancelled = false;
        fetch(`/api/portfolio/balances?address=${encodeURIComponent(session.address)}`)
            .then((res) => {
                if (!res.ok) {
                    return res.json().then((b) => Promise.reject(new Error(b?.error || res.statusText)));
                }
                return res.json();
            })
            .then((json: BalancesResponse) => {
                if (cancelled) return;
                setBchBalance(json.bch);
            })
            .catch(() => {
                if (!cancelled) setBchBalance(null);
            });
        return () => {
            cancelled = true;
        };
    }, [isConnected, session.address]);

    const formattedAddress = session.address ? formatAddress(session.address) : "";
    const balanceLabel =
        bchBalance !== null && Number.isFinite(bchBalance) ? `${bchBalance.toFixed(4)} BCH` : "";

    const label = isConnected
        ? [formattedAddress, balanceLabel].filter(Boolean).join(" · ")
        : session.isConnecting
            ? "Connecting..."
            : "Connect Wallet";

    const disabled = session.isConnecting;

    if (isConnected) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button className={className} disabled={disabled}>
                        {label}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" align="end" className="min-w-40">
                    <DropdownMenuItem
                        onSelect={(event) => {
                            event.preventDefault();
                            router.push("/portfolio");
                        }}
                    >
                        View portfolio
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onSelect={(event) => {
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
            {label}
        </Button>
    );
}