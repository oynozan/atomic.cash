import PortfolioTable from "@/components/Portfolio/Table";
import PortfolioActivity from "@/components/Portfolio/Activity";

export default function Portfolio() {
  return (
    <section className="w-screen pt-60 flex justify-center">
      <div className="home-container">
        <h1 className="text-4xl font-figtree font-bold mb-6">Portfolio</h1>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <PortfolioTable />
          <PortfolioActivity />
        </div>
      </div>
    </section>
  );
}
