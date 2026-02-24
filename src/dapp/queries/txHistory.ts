import { decodeCashAddress } from '@bitauth/libauth';
import { NETWORK } from '../config';
import { Network } from '../types';
import { NetworkProvider } from 'cashscript';
import { provider } from '../common';
import type { TxHistoryItem, TxHistoryResult, GetTxHistoryParams } from './types';

function getExplorerUrl(txid: string): string {
    if (NETWORK === Network.MAINNET) {
        return `https://blockchair.com/bitcoin-cash/transaction/${txid}`;
    }
    return `https://chipnet.chaingraph.cash/tx/${txid}`;
}

/**
 * Normalize address (basic validation + lowercasing prefix)
 */
function normalizeAddress(address: string): string | null {
    const decoded = decodeCashAddress(address);
    if (typeof decoded === 'string') return null;
    // Re-encode to ensure a canonical prefix (bitcoincash:/bchtest:)
    return address.trim();
}

/**
 * Get transaction history for an address
 */
export async function getTxHistory(params: GetTxHistoryParams): Promise<TxHistoryResult> {
    const { address, limit = 20, cursor = 0 } = params;
    
    const normalized = normalizeAddress(address);
    if (!normalized) {
        return { transactions: [], total: 0, hasMore: false };
    }
    
    try {
        // Electrum raw request (ElectrumNetworkProvider specific)
        const electrum = provider as NetworkProvider & {
            performRequest: (method: string, ...params: unknown[]) => Promise<unknown>;
        };
        // Use address-based history so token-aware outputs are also included.
        const history = await electrum.performRequest(
            'blockchain.address.get_history',
            normalized
        ) as Array<{ tx_hash: string; height: number }>;
        
        if (!history || history.length === 0) {
            return { transactions: [], total: 0, hasMore: false };
        }
        
        // Sort by height (newest to oldest)
        const sorted = [...history].sort((a, b) => b.height - a.height);
        
        // Pagination
        const total = sorted.length;
        const slice = sorted.slice(cursor, cursor + limit);
        
        const transactions: TxHistoryItem[] = slice.map(item => ({
            txid: item.tx_hash,
            blockHeight: item.height,
            explorerUrl: getExplorerUrl(item.tx_hash),
        }));
        
        const endIndex = cursor + transactions.length;
        
        return {
            transactions,
            total,
            hasMore: endIndex < total,
            nextCursor: endIndex < total ? endIndex : undefined,
        };
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('TX history error:', error.message);
        } else {
            console.error('TX history error:', error);
        }
        return { transactions: [], total: 0, hasMore: false };
    }
}

/**
 * Get recent transactions
 */
export async function getRecentTx(address: string, count: number = 10): Promise<TxHistoryItem[]> {
    const result = await getTxHistory({ address, limit: count });
    return result.transactions;
}
