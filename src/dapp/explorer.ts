import { NETWORK } from "./config";
import { Network } from "./types";

export function getExplorerUrl(txid: string): string {
  if (NETWORK === Network.MAINNET) {
    return `https://blockchair.com/bitcoin-cash/transaction/${txid}`;
  }
  return `https://chipnet.chaingraph.cash/tx/${txid}`;
}

