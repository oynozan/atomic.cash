import SwapPanel from "@/components/Swap/Panel";

export default function Swap() {
    return (
        <>
            <section className="w-screen h-screen flex flex-col items-center justify-center">
                <div className="flex flex-col items-center gap-12 -mt-20">
                    <h1 className="text-7xl font-figtree font-semibold">
                        Swap <span className="text-primary">CashTokens</span> instantly
                    </h1>
                    <SwapPanel />
                </div>
            </section>
        </>
    );
}
