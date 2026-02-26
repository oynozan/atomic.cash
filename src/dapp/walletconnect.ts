/**
 * Serialize an UnsignedTxTemplate to a plain JSON-safe object.
 * BigInt fields (satoshis, token amounts, minerFee) are converted to strings
 * so the result can be passed through JSON.stringify / NextResponse.json.
 */
export function serializeUnsignedTxTemplate(template: UnsignedTxTemplate) {
    return {
        inputs: template.inputs.map(input => ({
            txid: input.txid,
            vout: input.vout,
            satoshis: input.satoshis.toString(),
            token: input.token
                ? {
                      category: input.token.category,
                      amount: input.token.amount.toString(),
                  }
                : undefined,
            type: input.type,
            unlockFunction: input.unlockFunction,
        })),
        outputs: template.outputs.map(output => ({
            to: output.to,
            amount: output.amount.toString(),
            token: output.token
                ? {
                      category: output.token.category,
                      amount: output.token.amount.toString(),
                  }
                : undefined,
        })),
        poolAddress: template.poolAddress,
        poolOwnerPkhHex: template.poolOwnerPkhHex,
        minerFee: template.minerFee.toString(),
        operationType: template.operationType,
        ownerAddress: template.ownerAddress,
    };
}

/**
 * Convert UnsignedTxTemplate to WcTransactionObject for WalletConnect signing.
 *
 * - User inputs (type: "user") are unlocked with placeholderP2PKHUnlocker(ownerAddress)
 *   so the wallet can provide the final P2PKH signatures.
 * - Pool inputs (type: "pool") are unlocked via the Atomic contract using
 *   placeholder public key / signature, so the wallet can sign as pool owner.
 *
 * This works for:
 * - createPool (only user inputs)
 * - addLiquidity / removeLiquidity (one pool input + user inputs)
 * - swaps (one pool input + user inputs)
 */
import {
    TransactionBuilder,
    Unlocker,
    placeholderP2PKHUnlocker,
    placeholderPublicKey,
    placeholderSignature,
} from "cashscript";
import type { Contract } from "cashscript";
import { hexToBin, stringify } from "@bitauth/libauth";
import { getExchangeContract, provider } from "./common";
import type { UnsignedTxTemplate, UtxoInput } from "./types";

export function templateToWcTransactionObject(
    template: UnsignedTxTemplate,
    options?: { broadcast?: boolean; userPrompt?: string },
): string {
    const ownerAddress = template.ownerAddress;
    if (!ownerAddress) {
        throw new Error("UnsignedTxTemplate must have ownerAddress for WC conversion");
    }

    const builder = new TransactionBuilder({ provider });
    const p2pkhUnlocker = placeholderP2PKHUnlocker(ownerAddress);

    // If there is any pool input, initialise the contract and placeholders once.
    const hasPoolInput = template.inputs.some(i => i.type === "pool");
    const poolContract: Contract | null = hasPoolInput
        ? getExchangeContract(hexToBin(template.poolOwnerPkhHex))
        : null;
    const placeholderPk = hasPoolInput ? placeholderPublicKey() : undefined;
    const placeholderSig = hasPoolInput ? placeholderSignature() : undefined;

    // IMPORTANT: Iterate over template.inputs in order without changing indices
    // so this.activeInputIndex / output index mapping in the contract stays valid.
    for (const input of template.inputs) {
        if (input.type === "user") {
            addInputToBuilder(builder, input, p2pkhUnlocker);
        } else if (input.type === "pool") {
            if (!poolContract || !placeholderPk || !placeholderSig) {
                throw new Error("Pool contract or placeholders not initialised for pool input");
            }
            const unlocker = getContractUnlocker(
                poolContract,
                input,
                placeholderPk,
                placeholderSig,
            );
            addInputToBuilder(builder, input, unlocker);
        } else {
            throw new Error(`Unknown input type: ${String((input as { type?: unknown }).type)}`);
        }
    }

    // 3. Outputs
    for (const output of template.outputs) {
        builder.addOutput({
            to: output.to,
            amount: output.amount,
            token: output.token,
        });
    }

    const wcObj = builder.generateWcTransactionObject({
        broadcast: options?.broadcast ?? false,
        userPrompt: options?.userPrompt ?? "Sign transaction",
    });

    return stringify(wcObj);
}

function addInputToBuilder(
    builder: TransactionBuilder,
    input: UtxoInput,
    // `any` is used here because CashScript unlocker types are not exported in TS defs
    // and are only consumed by TransactionBuilder at runtime.
    unlocker: Unlocker,
) {
    const utxo = {
        txid: input.txid,
        vout: input.vout,
        satoshis: input.satoshis,
        token: input.token,
    };
    builder.addInput(utxo, unlocker);
}

function getContractUnlocker(
    contract: Contract,
    input: UtxoInput,
    placeholderPk: Uint8Array,
    placeholderSig: Uint8Array,
): Unlocker {
    switch (input.unlockFunction) {
        case "addLiquidity":
            return contract.unlock.addLiquidity(placeholderPk, placeholderSig);
        case "removeLiquidity":
            return contract.unlock.removeLiquidity(placeholderPk, placeholderSig);
        case "swapExactInput":
            return contract.unlock.swapExactInput();
        case "swapExactOutput":
            return contract.unlock.swapExactOutput();
        default:
            throw new Error(
                `Unsupported pool unlock function: ${input.unlockFunction ?? "unknown"}`,
            );
    }
}
