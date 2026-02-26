import { NextResponse } from "next/server";
import { getAllPools } from "@/dapp/queries/registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/pools
 * Returns registered pools (from MongoDB registry + on-chain data) with
 * token-level pagination applied server-side.
 *
 * Query parameters:
 * - page: 1-based page index (default: 1)
 * - pageSize: number of token categories per page (default: 10, max: 100)
 */
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const pageParam = url.searchParams.get("page");
        const pageSizeParam = url.searchParams.get("pageSize");

        let page = Number(pageParam) || 1;
        let pageSize = Number(pageSizeParam) || 10;

        if (!Number.isFinite(page) || page < 1) page = 1;
        if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 10;
        if (pageSize > 100) pageSize = 100;

        const result = await getAllPools();

        // Group pools by token category so pagination is token-centric,
        // matching the UI which shows one row per token pair.
        const groups = new Map<
            string,
            {
                tokenCategory: string;
                tokenSymbol?: string;
                tokenName?: string;
                tokenIconUrl?: string;
                totalBch: number;
                totalToken: number;
                pools: (typeof result.pools)[number][];
            }
        >();

        for (const pool of result.pools) {
            const existing = groups.get(pool.tokenCategory);
            if (existing) {
                existing.totalBch += pool.bchReserve;
                existing.totalToken += pool.tokenReserve;
                existing.pools.push(pool);
            } else {
                groups.set(pool.tokenCategory, {
                    tokenCategory: pool.tokenCategory,
                    tokenSymbol: pool.tokenSymbol,
                    tokenName: pool.tokenName,
                    tokenIconUrl: pool.tokenIconUrl,
                    totalBch: pool.bchReserve,
                    totalToken: pool.tokenReserve,
                    pools: [pool],
                });
            }
        }

        const grouped = Array.from(groups.values()).sort((a, b) => b.totalBch - a.totalBch);
        const totalTokenCategories = grouped.length;
        const totalPages =
            totalTokenCategories === 0 ? 1 : Math.max(1, Math.ceil(totalTokenCategories / pageSize));

        if (page > totalPages) {
            page = totalPages;
        }

        const startIndex = (page - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalTokenCategories);
        const pageGroups = grouped.slice(startIndex, endIndex);

        const pagePools: typeof result.pools = [];
        for (const g of pageGroups) {
            pagePools.push(...g.pools);
        }

        return NextResponse.json({
            totalPools: result.totalPools,
            totalBchLiquidity: result.totalBchLiquidity,
            tokenCounts: Object.fromEntries(result.tokenCounts),
            totalTokenCategories,
            page,
            pageSize,
            totalPages,
            pools: pagePools,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch pools";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
