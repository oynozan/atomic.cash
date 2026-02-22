import PoolsTable from "@/components/Pools/Table";
import PoolEarnings from "@/components/Pools/Earnings";

export default function Pools() {
    return (
        <section className="w-screen pt-60 flex justify-center">
            <div className="home-container">
                <PoolEarnings />
                <h1 className="text-4xl font-figtree font-bold mb-6 mt-12">Pools</h1>
                <PoolsTable />
            </div>
        </section>
    );
}
