import PortfolioLayout from "@/components/Portfolio/Layout";
import PortfolioTable from "@/components/Portfolio/Table";

export default function Portfolio() {
  return (
    <section className="w-screen pt-44 pb-32 flex justify-center">
      <PortfolioLayout active="tokens">
        <PortfolioTable showViewAllLink={false} />
      </PortfolioLayout>
    </section>
  );
}
