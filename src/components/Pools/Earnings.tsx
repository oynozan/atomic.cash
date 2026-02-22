"use client";

import Image from "next/image";
import { Button } from "../ui/button";

export default function PoolEarnings() {
    return (
        <div id="earnings" className="rounded-[24px] border bg-secondary/80 p-6">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <p className="text-2xl font-medium">
                        <span className="text-primary">0</span> BCH{" "}
                    </p>
                    <Image src="/icons/bch.svg" alt="BCH" width={24} height={24} />
                </div>
                <Button>Collect Earnings</Button>
            </div>
            <div className="mt-12">
                <p className="text-sm text-muted-foreground">
                    Earnings are automatically added to your liquidity position, increasing your
                    share of the pool.
                </p>
                <p className="text-sm text-muted-foreground">
                    Learn more about{" "}
                    <a href="https://docs.atomic.cash" className="text-primary">
                        providing liquidity
                    </a>
                </p>
            </div>
        </div>
    );
}
