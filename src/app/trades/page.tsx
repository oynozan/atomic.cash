import TradesTable from "@/components/Trades/Table";
import StatsOverview from "@/components/Stats/Overview";
import TvlVolumeChart from "@/components/Stats/TvlVolumeChart";

export default function TradesPage() {
    return (
        <>
            <section className="w-full min-w-0 pt-28 sm:pt-36 lg:pt-44 pb-24 sm:pb-32 flex justify-center">
                <div className="home-container min-w-0">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-figtree font-bold mb-4">Trades</h1>
                    <div className="mb-5 overflow-x-auto min-w-0 -mx-1 px-1">
                        <TvlVolumeChart />
                    </div>
                    <StatsOverview />
                    <div className="mt-5 overflow-x-auto min-w-0 -mx-1 px-1">
                        <TradesTable />
                    </div>
                </div>
            </section>
        </>
    );
}
