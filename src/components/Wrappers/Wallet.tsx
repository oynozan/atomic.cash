"use client";

import { createAppKit } from "@reown/appkit/core";
import SignClient from "@walletconnect/sign-client";
import UniversalProvider from "@walletconnect/universal-provider";
import React, { createContext, useContext, useEffect, useState } from "react";

export const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!;
export const bchMainnet = {
    id: "bch-mainnet",
    caipNetworkId: "bch:bitcoincash",
    chainNamespace: "bch",
    name: "Bitcoin Cash",
    nativeCurrency: {
        name: "Bitcoin Cash",
        symbol: "BCH",
        decimals: 8,
    },
    rpcUrls: {
        default: {
            http: [],
        },
    },
};
export const wcMetadata = {
    name: "Atomic Cash",
    description: "Experience seamless trading at instant",
    url: "https://atomic.cash",
    icons: ["https://www.walletconnect.com/icon.png"],
};
export const networks = [bchMainnet] as const;
export const signClient = await SignClient.init({
    projectId,
    relayUrl: "wss://relay.walletconnect.com",
    metadata: wcMetadata,
});

const BCH_CHAIN_ID = bchMainnet.caipNetworkId;
const BCH_NAMESPACE = "bch";
const BCH_METHODS = ["bch_getAddresses", "bch_signTransaction", "bch_signMessage"] as const;
const BCH_EVENTS = ["addressesChanged"] as const;

const getAddressFromCaipAccount = (account: string) => {
    const match = account.match(/^[^:]+:[^:]+:(.+)$/);
    if (match?.[1]) return match[1];
    const prefix = `${BCH_CHAIN_ID}:`;
    if (account.startsWith(prefix)) return account.slice(prefix.length);
    return account;
};

type WalletState = {
    provider: UniversalProvider | null;
    modal: ReturnType<typeof createAppKit> | null;
    initError: string | null;
    address: string | null;
    isConnected: boolean;
    isConnecting: boolean;
    connectWallet: () => Promise<void>;
    openWalletModal: () => Promise<void>;
    disconnectWallet: () => Promise<void>;
};

const WalletSessionContext = createContext<WalletState | null>(null);

export function useWalletSession() {
    const ctx = useContext(WalletSessionContext);
    if (!ctx) throw new Error("useWalletSession must be used within WalletWrapper");
    return ctx;
}

export default function WalletWrapper({ children }: { children: React.ReactNode }) {
    const [provider, setProvider] = useState<UniversalProvider | null>(null);
    const [modal, setModal] = useState<ReturnType<typeof createAppKit> | null>(null);
    const [initError, setInitError] = useState<string | null>(null);
    const [address, setAddress] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const readAddress = async (p: UniversalProvider) => {
        const addresses = await p.request({ method: "bch_getAddresses", params: {} }, BCH_CHAIN_ID);
        if (!Array.isArray(addresses) || addresses.length === 0) {
            setAddress(null);
            return;
        }
        const first = addresses[0];
        setAddress(typeof first === "string" ? getAddressFromCaipAccount(first) : null);
    };

    const connectWallet = async () => {
        if (initError || !provider || !modal || isConnecting) return;

        try {
            setIsConnecting(true);

            const existingNamespaces = provider.session?.namespaces ?? {};
            const hasBch = Object.prototype.hasOwnProperty.call(existingNamespaces, BCH_NAMESPACE);
            if (provider.session && !hasBch) {
                await modal.disconnect();
                await provider.disconnect();
            }

            modal.open();
            const session = await provider.connect({
                optionalNamespaces: {
                    [BCH_NAMESPACE]: {
                        methods: [...BCH_METHODS],
                        chains: [BCH_CHAIN_ID],
                        events: [...BCH_EVENTS],
                    },
                },
            });

            if (!session) throw new Error("No session found");
            modal.close();

            const approved = session.namespaces ?? {};
            if (!Object.prototype.hasOwnProperty.call(approved, BCH_NAMESPACE)) {
                throw new Error("Connected session does not include BCH namespace.");
            }

            await readAddress(provider);
        } catch (err) {
            modal?.close();
            throw err;
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnectWallet = async () => {
        if (!provider || !modal) return;
        await modal.disconnect();
        await provider.disconnect();
        setAddress(null);
    };

    const openWalletModal = async () => {
        if (!modal) return;
        await modal.open({ view: "Account" });
    };

    useEffect(() => {
        (async () => {
            const p = await UniversalProvider.init({
                projectId,
                metadata: wcMetadata,
            });

            const m = createAppKit({
                projectId,
                networks: [bchMainnet as Parameters<typeof createAppKit>[0]["networks"][number]],
                universalProvider: p,
                manualWCControl: true,
            });

            setProvider(p);
            setModal(m);

            const hasBch = Boolean(p.session?.namespaces?.[BCH_NAMESPACE]);
            if (hasBch) {
                try {
                    await readAddress(p);
                } catch {
                    setAddress(null);
                }
            }
        })().catch(err => {
            setInitError(err instanceof Error ? err.message : "Failed to initialize wallet.");
        });
    }, []);

    useEffect(() => {
        if (!provider) return;

        const handleAccountsChanged = (accounts: string[]) => {
            const hasBch = Boolean(provider.session?.namespaces?.[BCH_NAMESPACE]);
            if (!hasBch) {
                setAddress(null);
                return;
            }
            const first = accounts[0];
            if (typeof first === "string") setAddress(getAddressFromCaipAccount(first));
            else setAddress(null);
        };

        const handleDisconnect = () => setAddress(null);

        provider.on("accountsChanged", handleAccountsChanged);
        provider.on("disconnect", handleDisconnect);

        return () => {
            provider.off("accountsChanged", handleAccountsChanged);
            provider.off("disconnect", handleDisconnect);
        };
    }, [provider]);

    return (
        <WalletSessionContext.Provider
            value={{
                provider,
                modal,
                initError,
                address,
                isConnected: !!address,
                isConnecting,
                connectWallet,
                openWalletModal,
                disconnectWallet,
            }}
        >
            {children}
        </WalletSessionContext.Provider>
    );
}
