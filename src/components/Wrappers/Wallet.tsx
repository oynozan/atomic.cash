"use client";

import { createAppKit } from "@reown/appkit/core";
import SignClient from "@walletconnect/sign-client";
import UniversalProvider from "@walletconnect/universal-provider";
import type { SessionTypes } from "@walletconnect/types";
import React, { createContext, useContext, useEffect, useState } from "react";

const rawProjectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID;
export const projectId = rawProjectId?.trim() || "";

const isChipnet = process.env.NEXT_PUBLIC_NETWORK === "chipnet";

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

export const bchChipnet = {
    id: "bch-chipnet",
    caipNetworkId: "bch:bchtest",
    chainNamespace: "bch",
    name: "Bitcoin Cash (Chipnet)",
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

/** Active network: chipnet if NEXT_PUBLIC_NETWORK=chipnet, otherwise mainnet */
export const activeBchNetwork = isChipnet ? bchChipnet : bchMainnet;
/** WalletConnect/CAIP-2 chain ID (bch:bitcoincash or bch:bchtest) */
export const BCH_CHAIN_ID = activeBchNetwork.caipNetworkId;

export const wcMetadata = {
    name: "Atomic Cash",
    description: "Experience seamless trading at instant",
    url: "https://atomic.cash",
    icons: ["https://www.walletconnect.com/icon.png"],
};
const ADDRESS_STORAGE_KEY = "atomic.cash:bchAddress";
export const networks = [bchMainnet, bchChipnet] as const;
export const signClient = await SignClient.init({
    projectId,
    relayUrl: "wss://relay.walletconnect.com",
    metadata: wcMetadata,
});
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
    session: SessionTypes.Struct | null;
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
    const [session, setSession] = useState<SessionTypes.Struct | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const readAddress = async (p: UniversalProvider) => {
        const addresses = await p.request({ method: "bch_getAddresses", params: {} }, BCH_CHAIN_ID);
        if (!Array.isArray(addresses) || addresses.length === 0) {
            setAddress(null);
            return;
        }
        const first = addresses[0];
        const addr = typeof first === "string" ? getAddressFromCaipAccount(first) : null;
        setAddress(addr);
        if (typeof window !== "undefined" && addr) {
            window.localStorage.setItem(ADDRESS_STORAGE_KEY, addr);
        }
    };

    const connectWallet = async () => {
        if (initError || !provider || !modal || isConnecting) return;

        try {
            setIsConnecting(true);

            const existingNamespaces = provider.session?.namespaces ?? {};
            const hasBch = Object.prototype.hasOwnProperty.call(existingNamespaces, BCH_NAMESPACE);
            if (provider.session && !hasBch) {
                // If there's an old incompatible session, just drop it from the provider.
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

            setSession(session);
            await readAddress(provider);
        } catch (err) {
            modal?.close();
            throw err;
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnectWallet = async () => {
        if (!provider) {
            setAddress(null);
            setSession(null);
            if (typeof window !== "undefined") {
                window.localStorage.removeItem(ADDRESS_STORAGE_KEY);
            }
            return;
        }

        try {
            // Only call disconnect if there is an active WC2 session
            if (provider.session) {
                await provider.disconnect();
            }
        } catch (err) {
            // In some cases UniversalProvider may throw "Please call connect() before enable()";
            // we swallow it here because we will clear the address on the UI side anyway.
            console.error("[wallet] provider.disconnect failed", err);
        } finally {
            setAddress(null);
            setSession(null);
            if (typeof window !== "undefined") {
                window.localStorage.removeItem(ADDRESS_STORAGE_KEY);
            }
        }
    };

    const openWalletModal = async () => {
        if (!modal) return;
        await modal.open({ view: "Account" });
    };

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = window.localStorage.getItem(ADDRESS_STORAGE_KEY);
        if (stored) setAddress(stored);
    }, []);

    useEffect(() => {
        if (!projectId) {
            setInitError("WalletConnect project ID is not configured (NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID).");
            return;
        }
        (async () => {
            const p = await UniversalProvider.init({
                projectId,
                metadata: wcMetadata,
            });

            const m = createAppKit({
                projectId,
                networks: [activeBchNetwork as Parameters<typeof createAppKit>[0]["networks"][number]],
                universalProvider: p,
                manualWCControl: true,
                // Sadece WalletConnect QR kodu, altta wallet arama/listesi yok
                allWallets: "HIDE",
                enableWalletGuide: false,
                features: {
                    connectMethodsOrder: ["wallet"],
                },
            });

            setProvider(p);
            setModal(m);

            const hasBch = Boolean(p.session?.namespaces?.[BCH_NAMESPACE]);
            if (hasBch && p.session) {
                setSession(p.session as SessionTypes.Struct);
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

        const handleDisconnect = () => {
            setAddress(null);
            setSession(null);
        };

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
                session,
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
