import PortfolioActivityFull from "@/components/Portfolio/ActivityFull";
import PortfolioLayout from "@/components/Portfolio/Layout";

export default function PortfolioActivityPage() {
  return (
    <section className="w-screen pt-60 flex justify-center">
      <PortfolioLayout active="activity">
        <PortfolioActivityFull />
      </PortfolioLayout>
    </section>
  );
}

