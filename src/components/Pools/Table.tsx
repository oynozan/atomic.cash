"use client";

import { MoveHorizontal } from "lucide-react";

export default function PoolsTable() {
    return (
        <div className="flex flex-col gap-6">
            <PoolRow />
            <PoolRow />
            <PoolRow />
        </div>
    );
}

export function PoolRow() {
    return (
        <div className="rounded-[24px] border bg-popover p-6 cursor-pointer transition-all hover:bg-secondary/80">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="font-medium text-2xl">AUSD</span>
                    <MoveHorizontal className="size-6 text-muted-foreground" />
                    <span className="font-medium text-2xl">BCH</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="rounded-xl text-muted-foreground bg-accent py-2 px-3 font-semibold">
                        <span className="text-white">0.46%</span> APR
                    </div>
                </div>
            </div>
        </div>
    );
}
