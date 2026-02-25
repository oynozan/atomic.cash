import PoolsTable from "@/components/Pools/Table";
import CreatePoolCard from "@/components/Pools/CreatePoolCard";
import { ManagePoolsLink } from "@/components/Pools/ManageLink";

export default function Pools() {
    return (
        <section className="w-full min-w-0 pt-28 sm:pt-36 lg:pt-44 pb-24 sm:pb-32 flex justify-center">
            <div className="home-container min-w-0">
                <CreatePoolCard />
                <div className="mt-12 mb-6 flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-figtree font-bold">Pools</h1>
                    <ManagePoolsLink />
                </div>
                <div className="overflow-x-auto min-w-0 -mx-1 px-1">
                    <PoolsTable />
                </div>
            </div>
        </section>
    );
}
