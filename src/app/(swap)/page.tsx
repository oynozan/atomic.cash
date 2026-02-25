import SwapPanel from "@/components/Swap/Panel";

export default function Swap() {
    return (
        <section className="w-full min-h-screen pt-28 sm:pt-36 lg:pt-44 pb-28 sm:pb-32 flex flex-col items-center px-4 sm:px-6 min-w-0">
            <div className="flex flex-col items-center gap-8 sm:gap-12 w-full max-w-[600px]">
                <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-7xl font-figtree font-semibold text-center leading-tight">
                    Swap <span className="text-primary block sm:inline">CashTokens</span> instantly
                </h1>
                <SwapPanel />
            </div>
        </section>
    );
}
