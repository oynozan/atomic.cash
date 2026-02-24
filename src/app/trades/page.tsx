import TradesTable from "@/components/Trades/Table";
import StatsOverview from "@/components/Stats/Overview";

export default function TradesPage() {
  return (
    <>
      <section className="w-screen pt-44 pb-32 flex justify-center">
        <div className="home-container">
          <h1 className="text-4xl font-figtree font-bold mb-4">Trades</h1>
          <StatsOverview />
          <div className="mt-5">
            <TradesTable />
          </div>
        </div>
      </section>
    </>
  );
}

