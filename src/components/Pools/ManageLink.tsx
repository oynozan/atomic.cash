"use client";

import Link from "next/link";
import { useWalletSession } from "@/components/Wrappers/Wallet";
import { Button } from "@/components/ui/button";

export function ManagePoolsLink() {
    const { isConnected } = useWalletSession();

    if (!isConnected) return null;

    return (
        <Link href="/pools/manage">
            <Button variant="outline" size="sm">
                My Liquidity Pools
            </Button>
        </Link>
    );
}
