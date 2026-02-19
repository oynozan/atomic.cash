"use client";

import { toast } from "sonner"
import { useRouter } from "next/navigation";

import { Button } from "../ui/button";
import { useWalletSession } from "../Wrappers/Wallet";
import { formatAddress, formatError } from "@/lib/utils";

export default function ConnectWallet({ className }: { className?: string }) {
    const session = useWalletSession();
    const router = useRouter();

    const handleRedirection = async () => {
        router.push("/portfolio");
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
    }

    const isConnected = session.isConnected && Boolean(session.address);
    const label = isConnected && session.address
        ? formatAddress(session.address)
        : session.isConnecting
            ? "Connecting..."
            : "Connect Wallet";
    const onClick = isConnected ? handleRedirection : handleConnect;
    const disabled = session.isConnecting;

    return (
        <Button className={className} onClick={onClick} disabled={disabled}>
            {label}
        </Button>
    )
}