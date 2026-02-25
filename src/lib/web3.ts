import { stringify } from "@bitauth/libauth";
import { type WcTransactionObject } from "cashscript";
import type UniversalProvider from "@walletconnect/universal-provider";

import { BCH_CHAIN_ID } from "@/components/Wrappers/Wallet";

interface SignedTxObject {
    signedTransaction: string;
    signedTransactionHash: string;
}

/** Uses the same provider that created the session so the correct WalletConnect client handles the request. */
export async function signWcTransaction(
    wcTransactionObj: WcTransactionObject,
    provider: UniversalProvider | null,
): Promise<SignedTxObject | undefined> {
    if (!provider) {
        console.error("Transaction signing failed: No wallet provider.");
        return undefined;
    }
    try {
        const result = await provider.request<SignedTxObject>(
            {
                method: "bch_signTransaction",
                params: JSON.parse(stringify(wcTransactionObj)),
            },
            BCH_CHAIN_ID,
        );
        return result;
    } catch (error) {
        console.error("Transaction signing failed:", error);
        return undefined;
    }
}
