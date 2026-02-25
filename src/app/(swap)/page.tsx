import SwapPanel from "@/components/Swap/Panel";

export default function Swap() {
    return (
        <section className="w-screen min-h-screen pt-44 pb-32 flex flex-col items-center">
            <div className="flex flex-col items-center gap-12">
                <h1 className="text-7xl font-figtree font-semibold text-center">
                    Swap <span className="text-primary">CashTokens</span> instantly
                </h1>
                <SwapPanel />
            </div>
        </section>
    );
}
