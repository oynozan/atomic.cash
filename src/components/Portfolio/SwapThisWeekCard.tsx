"use client";

function formatBch(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

export default function SwapThisWeekCard({
  swapsThisWeek,
  swappedThisWeekBch,
}: {
  swapsThisWeek: number;
  swappedThisWeekBch: number;
}) {
  return (
    <div className="rounded-[24px] border bg-popover px-5 py-4 flex flex-col gap-4 min-w-0 shrink-0">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">
            Swaps this week
          </div>
          <div className="text-xl font-semibold text-foreground">
            {swapsThisWeek}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground mb-1">
            Swapped this week
          </div>
          <div className="text-xl font-semibold text-foreground">
            {formatBch(swappedThisWeekBch)} BCH
          </div>
        </div>
      </div>
    </div>
  );
}
