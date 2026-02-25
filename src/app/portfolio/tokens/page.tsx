import PortfolioTable from "@/components/Portfolio/Table";
import PortfolioLayout from "@/components/Portfolio/Layout";

export default function PortfolioTokensPage() {
  return (
    <section className="w-screen pt-44 pb-32 flex justify-center">
      <PortfolioLayout active="tokens">
        <PortfolioTable showViewAllLink={false} />
      </PortfolioLayout>
    </section>
  );
}

