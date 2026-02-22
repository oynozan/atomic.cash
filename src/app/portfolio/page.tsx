import PortfolioTable from "@/components/Portfolio/Table";

export default function Portfolio() {
    return (
        <section className="w-screen pt-60 flex justify-center">
            <div className="home-container">
                <h1 className="text-4xl font-figtree font-bold mb-6">Portfolio</h1>
                <PortfolioTable />
            </div>
        </section>
    );
}
