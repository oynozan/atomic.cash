/**
 * Network type
 */
export enum Network {
    MAINNET = 'mainnet',
    CHIPNET = 'chipnet',
}

/**
 * Swap direction
 */
export enum SwapDirection {
    BCH_TO_TOKEN = 'bch_to_token',
    TOKEN_TO_BCH = 'token_to_bch',
}

/**
 * Swap type (Uniswap V1 style)
 */
export enum SwapType {
    EXACT_INPUT = 'exact_input',
    EXACT_OUTPUT = 'exact_output',
}

/**
 * Token metadata (from BCMR)
 */
export interface TokenMetadata {
    name: string;
    symbol: string;
    decimals: number;
    category: string;
    iconUrl?: string;
    description?: string;
    isNft?: boolean;
}

/**
 * UTXO Input information (for TX template)
 */
export interface UtxoInput {
    txid: string;
    vout: number;
    satoshis: bigint;
    token?: {
        category: string;
        amount: bigint;
    };
    /** Input type */
    type: 'pool' | 'user';
    /** Pool unlock function (for pool inputs) */
    unlockFunction?: 'swapExactInput' | 'swapExactOutput' | 'addLiquidity' | 'removeLiquidity';
}

/**
 * TX Output information
 */
export interface TxOutput {
    /** Target address */
    to: string;
    /** BCH amount (satoshi) */
    amount: bigint;
    /** Token information (optional) */
    token?: {
        category: string;
        amount: bigint;
    };
}

/**
 * Operation type (for automatic registry)
 */
export enum OperationType {
    CREATE_POOL = 'create_pool',
    ADD_LIQUIDITY = 'add_liquidity',
    REMOVE_LIQUIDITY = 'remove_liquidity',
    SWAP = 'swap',
}

/**
 * Unsigned TX Template
 */
export interface UnsignedTxTemplate {
    /** Inputs (detailed information) */
    inputs: UtxoInput[];
    /** Outputs */
    outputs: TxOutput[];
    /** Pool contract address */
    poolAddress: string;
    /** Pool owner PKH (hex) */
    poolOwnerPkhHex: string;
    /** Miner fee */
    minerFee: bigint;
    /** Operation type (for automatic registry) */
    operationType?: OperationType;
    /** Pool owner address (for registry) */
    ownerAddress?: string;
}

/**
 * Wallet information
 */
export interface WalletInfo {
    address: string;
    tokenAddress: string;
    publicKey: Uint8Array;
    publicKeyHex: string;
}

/**
 * Wallet (with signing capability)
 */
export interface Wallet extends WalletInfo {
    privateKey: Uint8Array;
}
