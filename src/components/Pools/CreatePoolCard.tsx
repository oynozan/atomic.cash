"use client";

import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function CreatePoolCard() {
    return (
        <Link
            href="/pools/create"
            className="block rounded-[24px] border bg-secondary/80 p-6 transition-all hover:bg-secondary"
        >
            <div className="flex flex-wrap items-center justify-between gap-4 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Plus className="size-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-xl font-semibold">Create Pool</p>
                        <p className="text-sm text-muted-foreground">
                            Create a new liquidity pool for any token
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">Get started</span>
                    <Image src="/icons/bch.svg" alt="" width={20} height={20} />
                </div>
            </div>
        </Link>
    );
}
