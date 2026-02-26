"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { useTokenPriceStore } from "@/store/tokenPrice";

export default function SocketWrapper({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const socket = getSocket();
        if (!socket) {
            console.warn("[socket-client] window is undefined, skipping socket init");
            return;
        }

        console.log("[socket-client] attempting connection", {
            connected: socket.connected,
        });

        const handleConnect = () => {
            console.log("[socket-client] connected", {
                id: socket.id,
            });
        };

        const handleDisconnect = (reason: string) => {
            console.log("[socket-client] disconnected", {
                id: socket.id,
                reason,
            });
        };

        const handleConnectError = (err: unknown) => {
            console.error("[socket-client] connect_error", err);
        };

        const handleAny = (event: string, ...args: unknown[]) => {
            console.log("[socket-client] outgoing/incoming event", {
                event,
                payloadPreview: JSON.stringify(args).slice(0, 500),
            });
        };

        type TxPayload = {
            type?: string;
            tokenCategory?: string;
        };

        const handleSwapTx = (payload: TxPayload) => {
            if (!payload || payload.type !== "swap") return;
            if (!payload.tokenCategory) return;

            const category = payload.tokenCategory;
            const store = useTokenPriceStore.getState();

            // Invalidate and refetch the on-chain spot price for this token so
            // all swap panels that read from the price store see the same
            // updated value after each swap, regardless of which page fired it.
            store.invalidate(category);
            void store.fetchPrice(category);
        };

        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("connect_error", handleConnectError);
        socket.onAny(handleAny);
        socket.on("transaction:swap", handleSwapTx);

        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("connect_error", handleConnectError);
            socket.offAny(handleAny);
            socket.off("transaction:swap", handleSwapTx);
        };
    }, []);

    return <>{children}</>;
}

