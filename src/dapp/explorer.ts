import { BCMR_API_URL, NETWORK } from "./config";
import { Network } from "./types";

export function getExplorerUrl(txid: string): string {
    if (NETWORK === Network.MAINNET) {
        return `https://blockchair.com/bitcoin-cash/transaction/${txid}`;
    }
    return `https://chipnet.chaingraph.cash/tx/${txid}`;
}

/** Token explorer / BCMR view for a token category */
export function getTokenExplorerUrl(tokenCategory: string): string {
    return `${BCMR_API_URL}/${tokenCategory}/`;
}

/** Address explorer URL for a BCH / CashToken address */
export function getAddressExplorerUrl(address: string): string {
    if (NETWORK === Network.MAINNET) {
        return `https://blockchair.com/bitcoin-cash/address/${address}`;
    }
    // Chipnet – use imaginary.cash address view
    return `https://chipnet.imaginary.cash/address/${address}`;
}
