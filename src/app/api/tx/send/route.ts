import { NextRequest, NextResponse } from "next/server";

import {
    bchToSatoshi,
    ensureTokenDecimals,
    filterBchUtxos,
    filterTokenUtxos,
    provider,
    tokenToOnChain,
    toTokenAddress,
} from "@/dapp/common";
import { DUST_LIMIT, DEFAULT_MINER_FEE } from "@/dapp/config";
import type { TxOutput, UnsignedTxTemplate, UtxoInput } from "@/dapp/types";
import { templateToWcTransactionObject } from "@/dapp/walletconnect";
import { getAuthFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Body = {
    toAddress?: string;
    amount?: number;
    /**
     * If provided, send `amount` of this token category (CashTokens).
     * Otherwise, a plain BCH send is prepared.
     */
    tokenCategory?: string;
};

/**
 * POST /api/tx/send
 *
 * Prepares a simple BCH send transaction (user -> address) and returns a
 * WalletConnect transaction JSON for signing in the user's wallet.
 *
 * NOTE: Currently BCH-only; tokens are not handled here.
 */
export async function POST(request: NextRequest) {
    let body: Body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { toAddress, amount, tokenCategory } = body;

    const auth = getAuthFromRequest(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!toAddress || typeof toAddress !== "string" || toAddress.trim() === "") {
        return NextResponse.json({ error: "toAddress is required" }, { status: 400 });
    }

    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 });
    }

    const from = auth.address.trim();
    const to = toAddress.trim();

    // If a tokenCategory is provided, build a CashTokens "send token" transaction.
    if (tokenCategory && tokenCategory.trim() !== "") {
        try {
            const category = tokenCategory.trim();

            // Ensure token decimals are initialized before using tokenToOnChain()
            await ensureTokenDecimals(category);

            // Use token-aware address forms when querying UTXOs and creating token outputs
            const fromTokenAddress = toTokenAddress(from);
            const toTokenAddressStr = toTokenAddress(to);

            const ownerUtxos = await provider.getUtxos(fromTokenAddress);
            const tokenUtxos = filterTokenUtxos(ownerUtxos, category);
            const bchUtxos = filterBchUtxos(ownerUtxos);

            if (!tokenUtxos || tokenUtxos.length === 0) {
                return NextResponse.json(
                    { error: "No token UTXOs available to send for this category." },
                    { status: 400 },
                );
            }

            const tokenAmountRaw = tokenToOnChain(amount, category);

            // Select token UTXOs until we cover the requested token amount
            const inputs: UtxoInput[] = [];
            let totalTokenIn = 0n;
            let totalBchInFromTokenUtxos = 0n;

            for (const utxo of tokenUtxos) {
                if (!utxo.token) continue;
                inputs.push({
                    txid: utxo.txid,
                    vout: utxo.vout,
                    satoshis: utxo.satoshis,
                    token: {
                        category: utxo.token.category,
                        amount: utxo.token.amount,
                    },
                    type: "user",
                });
                totalTokenIn += utxo.token.amount;
                totalBchInFromTokenUtxos += utxo.satoshis;
                if (totalTokenIn >= tokenAmountRaw) break;
            }

            if (totalTokenIn < tokenAmountRaw) {
                return NextResponse.json(
                    { error: "Not enough tokens to cover requested amount." },
                    { status: 400 },
                );
            }

            // We will create:
            // - 1 token output to the recipient (dust: 1000 sat)
            // - Optional 1 token change output back to sender (dust: 1000 sat)
            // - Optional BCH change output back to sender (subject to DUST_LIMIT)
            const TOKEN_OUTPUT_DUST = 1000n;
            const minerFee = DEFAULT_MINER_FEE;

            const hasTokenChange = totalTokenIn > tokenAmountRaw;
            const requiredBchForTokenOutputs =
                TOKEN_OUTPUT_DUST + (hasTokenChange ? TOKEN_OUTPUT_DUST : 0n);

            let totalBchIn = totalBchInFromTokenUtxos;

            // If BCH inside token UTXOs is not enough for dust+fee, add BCH-only UTXOs
            const requiredForAllOutputs = requiredBchForTokenOutputs + minerFee;
            if (totalBchIn < requiredForAllOutputs) {
                for (const utxo of bchUtxos) {
                    if (totalBchIn >= requiredForAllOutputs) break;
                    inputs.push({
                        txid: utxo.txid,
                        vout: utxo.vout,
                        satoshis: utxo.satoshis,
                        type: "user",
                    });
                    totalBchIn += utxo.satoshis;
                }
            }

            if (totalBchIn < requiredForAllOutputs) {
                return NextResponse.json(
                    { error: "Not enough BCH to cover token dust outputs and miner fee." },
                    { status: 400 },
                );
            }

            const outputs: TxOutput[] = [];

            // Recipient token output
            outputs.push({
                to: toTokenAddressStr,
                amount: TOKEN_OUTPUT_DUST,
                token: {
                    category,
                    amount: tokenAmountRaw,
                },
            });

            // Token change back to sender, if any
            const tokenChange = totalTokenIn - tokenAmountRaw;
            if (tokenChange > 0n) {
                outputs.push({
                    to: fromTokenAddress,
                    amount: TOKEN_OUTPUT_DUST,
                    token: {
                        category,
                        amount: tokenChange,
                    },
                });
            }

            const bchSpentOnTokenOutputs =
                TOKEN_OUTPUT_DUST + (tokenChange > 0n ? TOKEN_OUTPUT_DUST : 0n);
            const bchChange = totalBchIn - bchSpentOnTokenOutputs - minerFee;

            if (bchChange >= DUST_LIMIT) {
                outputs.push({
                    to: fromTokenAddress,
                    amount: bchChange,
                });
            }

            const template: UnsignedTxTemplate = {
                inputs,
                outputs,
                // Plain user P2PKH send; no pool involved
                poolAddress: "",
                poolOwnerPkhHex: "".padStart(40, "0"),
                minerFee,
                ownerAddress: fromTokenAddress,
            };

            const wcTransactionJson = templateToWcTransactionObject(template, {
                broadcast: false,
                userPrompt: "Send token",
            });

            return NextResponse.json({
                success: true,
                wcTransactionJson,
            });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Failed to prepare token send transaction";
            return NextResponse.json({ error: message }, { status: 500 });
        }
    }

    // Default: plain BCH send
    try {
        // 1. Gather BCH-only UTXOs for the sender
        const utxos = await provider.getUtxos(from);
        const bchUtxos = filterBchUtxos(utxos);

        if (!bchUtxos || bchUtxos.length === 0) {
            return NextResponse.json({ error: "No BCH UTXOs available to send." }, { status: 400 });
        }

        const amountSats = bchToSatoshi(amount);
        const feeSats = DEFAULT_MINER_FEE;

        // 2. Simple coin selection: take UTXOs until we cover amount + fee
        const selected: typeof bchUtxos = [];
        let totalIn = 0n;

        for (const utxo of bchUtxos) {
            selected.push(utxo);
            totalIn += utxo.satoshis;
            if (totalIn >= amountSats + feeSats) break;
        }

        if (totalIn < amountSats + feeSats) {
            return NextResponse.json(
                { error: "Not enough BCH to cover amount + fee." },
                { status: 400 },
            );
        }

        const change = totalIn - amountSats - feeSats;

        // 3. Build template inputs/outputs
        const inputs: UtxoInput[] = selected.map(u => ({
            txid: u.txid,
            vout: u.vout,
            satoshis: u.satoshis,
            type: "user",
        }));

        const outputs: TxOutput[] = [
            {
                to,
                amount: amountSats,
            },
        ];

        if (change >= DUST_LIMIT) {
            outputs.push({
                to: from,
                amount: change,
            });
        }

        const template: UnsignedTxTemplate = {
            inputs,
            outputs,
            poolAddress: "",
            poolOwnerPkhHex: "".padStart(40, "0"),
            minerFee: feeSats,
            ownerAddress: from,
        };

        const wcTransactionJson = templateToWcTransactionObject(template, {
            broadcast: false,
            userPrompt: "Send BCH",
        });

        return NextResponse.json({
            success: true,
            wcTransactionJson,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to prepare send transaction";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
