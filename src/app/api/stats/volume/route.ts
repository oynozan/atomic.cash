import { NextRequest, NextResponse } from "next/server";

import { getTransactionsCollection, type StoredTransaction } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

type VolumeStatsResponse = {
  volume24hBch: number;
  prev24hBch: number;
  volume30dBch: number;
  prev30dBch: number;
};

function extractBchVolume(tx: StoredTransaction): number {
  const a = tx.amounts;
  if (!a) return 0;
  const candidates = [a.bchIn, a.bchOut].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0,
  );
  if (!candidates.length) return 0;
  return candidates[0]!;
}

/**
 * GET /api/stats/volume
 *
 * Calculates aggregate swap volume (in BCH) over:
 * - last 24h vs previous 24h
 * - last 30d vs previous 30d
 */
export async function GET(_request: NextRequest) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const last24Start = now - dayMs;
  const prev24Start = now - 2 * dayMs;

  const last30Start = now - 30 * dayMs;
  const prev30Start = now - 60 * dayMs;

  try {
    const coll = await getTransactionsCollection();

    const recent = await coll
      .find({
        type: "swap",
        createdAt: { $gte: prev30Start },
      })
      .toArray();

    let volume24hBch = 0;
    let prev24hBch = 0;
    let volume30dBch = 0;
    let prev30dBch = 0;

    for (const tx of recent) {
      const v = extractBchVolume(tx);
      if (!v) continue;

      if (tx.createdAt >= last24Start) {
        volume24hBch += v;
      } else if (tx.createdAt >= prev24Start) {
        prev24hBch += v;
      }

      if (tx.createdAt >= last30Start) {
        volume30dBch += v;
      } else if (tx.createdAt >= prev30Start) {
        prev30dBch += v;
      }
    }

    const body: VolumeStatsResponse = {
      volume24hBch,
      prev24hBch,
      volume30dBch,
      prev30dBch,
    };

    return NextResponse.json(body);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to compute volume statistics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

