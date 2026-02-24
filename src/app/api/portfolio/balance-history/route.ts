import { NextRequest, NextResponse } from "next/server";

import { getTransactionsCollection, type StoredTransaction } from "@/lib/mongodb";
import { getAllPools } from "@/dapp/queries/registry";
import { getUserBalances } from "@/dapp/queries/user";

export const dynamic = "force-dynamic";

type BalancePoint = {
  timestamp: number;
  valueBch: number;
  bch: number;
};

type BalanceHistoryResponse = {
  points: BalancePoint[];
  swapsThisWeek: number;
  swappedThisWeekBch: number;
};

function extractBchVolume(tx: StoredTransaction): number {
  const a = tx.amounts;
  if (!a) return 0;
  const candidates = [a.bchIn, a.bchOut].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  return candidates[0] ?? 0;
}

/**
 * Replay swap txs backwards from current balance to build history.
 * Only swap txs have the amounts we need; other types are skipped.
 */
export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    const [balance, allPoolsResult, txColl] = await Promise.all([
      getUserBalances(address),
      getAllPools(),
      getTransactionsCollection(),
    ]);
    const pools = allPoolsResult.pools;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const maxRange = 90 * dayMs;
    const from = now - maxRange;

    const txs = await txColl
      .find({
        address,
        type: "swap",
        createdAt: { $gte: from },
      })
      .sort({ createdAt: -1 })
      .toArray();

    const tokenPricesNum = new Map<string, number>();
    const priceDenByCat = new Map<string, number>();
    for (const p of pools) {
      const weighted = p.tokenPriceInBch * p.bchReserve;
      tokenPricesNum.set(
        p.tokenCategory,
        (tokenPricesNum.get(p.tokenCategory) ?? 0) + weighted,
      );
      priceDenByCat.set(
        p.tokenCategory,
        (priceDenByCat.get(p.tokenCategory) ?? 0) + p.bchReserve,
      );
    }
    const priceByCat = new Map<string, number>();
    for (const [cat, num] of tokenPricesNum) {
      const den = priceDenByCat.get(cat) ?? 1;
      priceByCat.set(cat, den > 0 ? num / den : 0);
    }

    const currentBch = balance.bch;
    const currentTokens = new Map<string, number>();
    for (const t of balance.tokens) {
      currentTokens.set(t.category, t.amount);
    }

    function toValueBch(bch: number, tokens: Map<string, number>): number {
      let v = bch;
      for (const [cat, amount] of tokens) {
        const price = priceByCat.get(cat);
        if (price != null && Number.isFinite(price)) v += amount * price;
      }
      return v;
    }

    let bch = currentBch;
    const tokens = new Map<string, number>(currentTokens);

    const points: BalancePoint[] = [];
    points.push({
      timestamp: now,
      valueBch: toValueBch(bch, tokens),
      bch,
    });

    for (const tx of txs) {
      const a = tx.amounts;
      if (!a || !tx.tokenCategory) continue;

      if (tx.direction === "bch_to_token") {
        const bchIn = typeof a.bchIn === "number" && a.bchIn > 0 ? a.bchIn : 0;
        const tokenOut =
          typeof a.tokenOut === "number" && a.tokenOut > 0 ? a.tokenOut : 0;
        bch += bchIn;
        const prev = tokens.get(tx.tokenCategory) ?? 0;
        const next = prev - tokenOut;
        if (next <= 0) tokens.delete(tx.tokenCategory);
        else tokens.set(tx.tokenCategory, next);
      } else if (tx.direction === "token_to_bch") {
        const bchOut =
          typeof a.bchOut === "number" && a.bchOut > 0 ? a.bchOut : 0;
        const tokenIn =
          typeof a.tokenIn === "number" && a.tokenIn > 0 ? a.tokenIn : 0;
        bch -= bchOut;
        const prev = tokens.get(tx.tokenCategory) ?? 0;
        tokens.set(tx.tokenCategory, prev + tokenIn);
      }

      points.push({
        timestamp: tx.createdAt,
        valueBch: toValueBch(bch, tokens),
        bch,
      });
    }

    points.sort((a, b) => a.timestamp - b.timestamp);

    const weekStart = now - 7 * dayMs;
    const txsThisWeek = txs.filter((tx) => tx.createdAt >= weekStart);
    const swapsThisWeek = txsThisWeek.length;
    const swappedThisWeekBch = txsThisWeek.reduce(
      (sum, tx) => sum + extractBchVolume(tx),
      0,
    );

    const body: BalanceHistoryResponse = {
      points,
      swapsThisWeek,
      swappedThisWeekBch,
    };
    return NextResponse.json(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch balance history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
