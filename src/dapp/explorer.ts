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

