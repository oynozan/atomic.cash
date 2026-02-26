"use client";

import { createAppKit } from "@reown/appkit/core";
import type { SessionTypes } from "@walletconnect/types";
import UniversalProvider from "@walletconnect/universal-provider";
import { toast } from "sonner";
import React, { createContext, useContext, useEffect, useState } from "react";

import { formatError } from "@/lib/utils";

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

export const activeBchNetwork = isChipnet ? bchChipnet : bchMainnet;
export const BCH_CHAIN_ID = activeBchNetwork.caipNetworkId;

export const wcMetadata = {
    name: "Atomic Cash",
    description: "Experience seamless trading at instant",
    url: "https://atomic.cash",
    icons: ["https://www.walletconnect.com/icon.png"],
};
const ADDRESS_STORAGE_KEY = "atomic.cash:bchAddress";
export const networks = [bchMainnet, bchChipnet] as const;
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
    isAuthorizing: boolean;
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
    const [isAuthorizing, setIsAuthorizing] = useState(false);
    const [isAuthed, setIsAuthed] = useState(false);

    const readAddress = async (p: UniversalProvider): Promise<string | null> => {
        const addresses = await p.request({ method: "bch_getAddresses", params: {} }, BCH_CHAIN_ID);
        if (!Array.isArray(addresses) || addresses.length === 0) {
            setAddress(null);
            return null;
        }
        const first = addresses[0];
        const addr = typeof first === "string" ? getAddressFromCaipAccount(first) : null;
        setAddress(addr);
        if (typeof window !== "undefined" && addr) {
            window.localStorage.setItem(ADDRESS_STORAGE_KEY, addr);
        }
        return addr;
    };

    const refreshExistingAuth = async (addr: string) => {
        try {
            const res = await fetch("/api/auth/verify", {
                method: "GET",
                credentials: "same-origin",
            });
            if (!res.ok) return;
            const data = (await res.json()) as {
                authenticated?: boolean;
                address?: string;
            };
            if (data.authenticated && data.address && data.address === addr) {
                setIsAuthed(true);
            }
        } catch {
            // best-effort only; if this fails, user can reconnect manually
        }
    };

    const ensureBackendAuth = async (addr: string, p: UniversalProvider) => {
        // 1) Check if we already have a valid auth cookie for this address
        const existing = await fetch("/api/auth/verify", {
            method: "GET",
            credentials: "same-origin",
        });
        if (existing.ok) {
            const data = (await existing.json()) as {
                authenticated?: boolean;
                address?: string;
            };
            if (data.authenticated && data.address && data.address === addr) {
                setIsAuthed(true);
                return;
            }
        }

        try {
            // 2) Request a short-lived challenge from the backend
            const challengeRes = await fetch("/api/auth/challenge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ address: addr }),
            });
            if (!challengeRes.ok) {
                throw new Error("Failed to start auth flow");
            }
            const challengeJson = (await challengeRes.json()) as {
                message?: string;
                expiresAt?: number;
            };
            const message = challengeJson.message;
            if (!message) {
                throw new Error("Invalid auth challenge from server");
            }

            // 3) Ask the wallet to sign the challenge message
            const signResult = await p.request(
                {
                    method: "bch_signMessage",
                    // Param shape follows BCH signmessage: { address, message }
                    params: { address: addr, message },
                },
                BCH_CHAIN_ID,
            );

            // Support both simple string results and structured objects
            let signatureHex: string | undefined;
            let publicKeyHex: string | undefined;

            if (typeof signResult === "string") {
                signatureHex = signResult;
            } else if (signResult && typeof signResult === "object") {
                const resultObj = signResult as {
                    signatureHex?: string;
                    publicKeyHex?: string;
                    signature?: string;
                    publicKey?: string;
                };
                signatureHex = resultObj.signatureHex ?? resultObj.signature;
                publicKeyHex = resultObj.publicKeyHex ?? resultObj.publicKey;
            }

            if (!signatureHex) {
                throw new Error("Wallet did not return a signature for auth.");
            }

            // 4) Verify on backend and set auth cookie
            const verifyRes = await fetch("/api/auth/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({
                    address: addr,
                    message,
                    signatureHex,
                    ...(publicKeyHex ? { publicKeyHex } : {}),
                }),
            });
            if (!verifyRes.ok) {
                const errJson = await verifyRes.json().catch(() => null);
                throw new Error(errJson?.error || "Failed to verify wallet signature.");
            }

            setIsAuthed(true);
        } finally {
            setIsAuthorizing(false);
        }
    };

    const connectWallet = async () => {
        if (initError || !provider || !modal || isConnecting) return;

        try {
            setIsConnecting(true);
            setIsAuthed(false);

            const existingNamespaces = provider.session?.namespaces ?? {};
            const hasBch = Object.prototype.hasOwnProperty.call(existingNamespaces, BCH_NAMESPACE);
            if (provider.session && !hasBch) {
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
            setIsAuthorizing(true);
            modal.close();

            const approved = session.namespaces ?? {};
            if (!Object.prototype.hasOwnProperty.call(approved, BCH_NAMESPACE)) {
                throw new Error("Connected session does not include BCH namespace.");
            }

            const addr = await readAddress(provider);
            if (!addr) {
                throw new Error("Wallet did not return a BCH address.");
            }

            await ensureBackendAuth(addr, provider);
            setSession(session);
        } catch (err) {
            modal?.close();
            // On any connection/auth failure, fully reset wallet state.
            try {
                if (provider?.session) {
                    await provider.disconnect();
                }
            } catch {
                // ignore disconnect errors
            }
            setSession(null);
            setAddress(null);
            setIsAuthed(false);

            // Normalize user-rejected errors vs. real failures
            const msg = formatError(err);
            if (msg.toLowerCase().includes("user rejected")) {
                toast.error("Signature rejected in your wallet.");
            } else {
                toast.error(msg || "Failed to connect wallet.");
            }
        } finally {
            setIsConnecting(false);
            setIsAuthorizing(false);
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
            if (provider.session) {
                await provider.disconnect();
            }
        } catch (err) {
            console.error("[wallet] provider.disconnect failed", err);
        } finally {
            setAddress(null);
            setSession(null);
            setIsAuthed(false);
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
            setInitError(
                "WalletConnect project ID is not configured (NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID).",
            );
            return;
        }
        (async () => {
            const p = await UniversalProvider.init({
                projectId,
                metadata: wcMetadata,
                logger: "silent",
            });

            const m = createAppKit({
                projectId,
                networks: [
                    activeBchNetwork as Parameters<typeof createAppKit>[0]["networks"][number],
                ],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- version mismatch between @reown/appkit's bundled @walletconnect/universal-provider and the project's direct dependency
                universalProvider: p as any,
                manualWCControl: true,
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
                setIsConnecting(true);
                try {
                    setSession(p.session as SessionTypes.Struct);
                    const addr = await readAddress(p);
                    if (addr) {
                        await refreshExistingAuth(addr);
                    }
                } catch {
                    setAddress(null);
                    setSession(null);
                    setIsAuthed(false);
                } finally {
                    setIsConnecting(false);
                }
            }
        })().catch(err => {
            setInitError(err instanceof Error ? err.message : "Failed to initialize wallet.");
        });
    }, []);

    // React-friendly subscription to AppKit modal events so we can reset the
    // "Connecting..." state when the user closes/cancels the WalletConnect modal
    // or when a modal-related error occurs.
    useEffect(() => {
        if (!modal) return;

        type ModalEvent = { data?: { event?: string } };
        const anyModal = modal as unknown as {
            subscribeEvents?: (cb: (event: ModalEvent) => void) => (() => void) | void;
        };
        if (typeof anyModal.subscribeEvents !== "function") return;

        const handler = (event: ModalEvent) => {
            const name = event.data?.event;
            if (!name) return;

            // Known events include MODAL_OPEN, MODAL_CLOSE and possibly
            // MODAL_ERROR / MODAL_REJECT. We only keep the spinner for
            // the "open" state; any terminal modal state should clear it.
            if (name === "MODAL_OPEN") return;
            if (name.startsWith("MODAL_") && !session && !isAuthorizing) {
                setIsConnecting(false);
            }
        };

        const unsubscribe = anyModal.subscribeEvents(handler);
        return () => {
            if (typeof unsubscribe === "function") {
                try {
                    unsubscribe();
                } catch {
                    // ignore unsubscribe errors
                }
            }
        };
    }, [modal, session, isAuthorizing]);

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
            if (typeof window !== "undefined") {
                window.localStorage.removeItem(ADDRESS_STORAGE_KEY);
                window.location.reload();
            }
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
                isConnected: !!address && isAuthed,
                isConnecting,
                isAuthorizing,
                connectWallet,
                openWalletModal,
                disconnectWallet,
            }}
        >
            {children}
        </WalletSessionContext.Provider>
    );
}
