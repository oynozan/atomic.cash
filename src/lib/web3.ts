import { stringify } from "@bitauth/libauth";
import { type WcTransactionObject } from "cashscript";
import { type SessionTypes } from "@walletconnect/types";

import { bchMainnet, signClient } from "@/components/Wrappers/Wallet";

interface SignedTxObject {
    signedTransaction: string;
    signedTransactionHash: string;
}

export async function signWcTransaction(
    wcTransactionObj: WcTransactionObject,
    session: SessionTypes.Struct,
): Promise<SignedTxObject | undefined> {
    try {
        const result = await signClient.request<SignedTxObject>({
            chainId: bchMainnet.caipNetworkId,
            topic: session?.topic,
            request: {
                method: "bch_signTransaction",
                params: JSON.parse(stringify(wcTransactionObj)),
            },
        });
        return result;
    } catch (error) {
        console.error("Transaction signing failed:", error);
        return undefined;
    }
}
