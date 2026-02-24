import PoolsTable from "@/components/Pools/Table";
import CreatePoolCard from "@/components/Pools/CreatePoolCard";
import { ManagePoolsLink } from "@/components/Pools/ManageLink";

export default function Pools() {
  return (
    <section className="w-screen pt-60 flex justify-center">
      <div className="home-container">
        <CreatePoolCard />
        <div className="mt-12 mb-6 flex items-center justify-between gap-4">
          <h1 className="text-4xl font-figtree font-bold">Pools</h1>
          <ManagePoolsLink />
        </div>
        <PoolsTable />
      </div>
    </section>
  );
}
