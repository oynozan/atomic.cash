import PortfolioTable from "@/components/Portfolio/Table";
import PortfolioActivity from "@/components/Portfolio/Activity";
import PortfolioLayout from "@/components/Portfolio/Layout";

export default function Portfolio() {
  return (
    <section className="w-screen pt-60 flex justify-center">
      <PortfolioLayout active="overview">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <PortfolioTable />
          <PortfolioActivity />
        </div>
      </PortfolioLayout>
    </section>
  );
}
