import { decodeCashAddress } from '@bitauth/libauth';
import { NetworkProvider } from 'cashscript';
import { provider } from '../common';
import type { TxHistoryItem, TxHistoryResult, GetTxHistoryParams } from './types';
import { getExplorerUrl } from '../explorer';

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
 * Get transaction history for an address.
 *
 * - Uses Electrum address history
 * - Returns the newest N txids (no pagination – intended for UI overviews)
 * - Script / contract etkileşimleri, `/api/portfolio/history` tarafında
 *   Mongo dapp kayıtları ile txid bazında zaten ayrıştırılıyor.
 */
export async function getTxHistory(params: GetTxHistoryParams): Promise<TxHistoryResult> {
    const { address, limit = 5 } = params;

    const normalized = normalizeAddress(address);
    if (!normalized) {
        return { transactions: [], total: 0, hasMore: false };
    }

    try {
        const electrum = provider as NetworkProvider & {
            performRequest: (method: string, ...params: unknown[]) => Promise<unknown>;
        };

        const history = await electrum.performRequest(
            'blockchain.address.get_history',
            normalized
        ) as Array<{ tx_hash: string; height: number }>;

        if (!history || history.length === 0) {
            return { transactions: [], total: 0, hasMore: false };
        }

        // Newest first
        const sorted = [...history].sort((a, b) => b.height - a.height);
        const slice = sorted.slice(0, limit);

        const transactions: TxHistoryItem[] = slice.map((item) => ({
            txid: item.tx_hash,
            blockHeight: item.height,
            explorerUrl: getExplorerUrl(item.tx_hash),
        }));

        return {
            transactions,
            total: transactions.length,
            hasMore: false,
            nextCursor: undefined,
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
