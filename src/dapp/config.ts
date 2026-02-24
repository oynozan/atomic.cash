import { Network } from './types';

const networkEnv = process.env.NEXT_PUBLIC_NETWORK?.toLowerCase() || 'chipnet';

export const NETWORK: Network = 
    networkEnv === 'mainnet' ? Network.MAINNET : Network.CHIPNET;

export const NETWORK_STRING: string = 
    NETWORK === Network.MAINNET ? 'mainnet' : 'chipnet';

// Public Electrum/Fulcrum endpoints (for host selection / future failover)
// Order matters: index 0 is preferred.
export const ELECTRUM_ENDPOINTS: { host: string }[] =
    NETWORK === Network.MAINNET
        ? [
            { host: 'bitcoincash.network' },
          ]
        : [
            // chipnet.bch.ninja public Electrum (default used by CashScript examples)
            { host: 'chipnet.bch.ninja' },
          ];

export const ADDRESS_PREFIX: 'bitcoincash' | 'bchtest' = 
    NETWORK === Network.MAINNET ? 'bitcoincash' : 'bchtest';

export const BCH_DECIMALS = 8;
export const DEFAULT_TOKEN_DECIMALS = 8;

export const DEFAULT_MINER_FEE = 3000n;
export const DUST_LIMIT = 546n;
export const DEFAULT_SLIPPAGE_TOLERANCE = 0.5; // %0.5

export const SWAP_FEE_NUMERATOR = 997n;   // 1000 - 3 = 997 (0.3% fee)
export const SWAP_FEE_DENOMINATOR = 1000n;

export const BCMR_API_URL = NETWORK === Network.MAINNET
    ? 'https://bcmr.paytaca.com/api/tokens'
    : 'https://bcmr-chipnet.paytaca.com/api/tokens';
