"use client";

import { useState } from "react";
import PortfolioLayout from "@/components/Portfolio/Layout";
import PortfolioTable from "@/components/Portfolio/Table";
import PortfolioActivityFull from "@/components/Portfolio/ActivityFull";

export default function Portfolio() {
    const [tab, setTab] = useState<"tokens" | "activity">("tokens");

    return (
        <section className="w-screen pt-44 pb-32 flex justify-center">
            <PortfolioLayout active={tab} onChangeTab={setTab}>
                <div className="space-y-4 min-h-[320px]">
                    {tab === "tokens" ? (
                        <PortfolioTable showViewAllLink={false} />
                    ) : (
                        <PortfolioActivityFull />
                    )}
                </div>
            </PortfolioLayout>
        </section>
    );
}
