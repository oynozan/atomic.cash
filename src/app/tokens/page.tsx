import TokensTable from "@/components/Tokens/Table";

export default function TokensPage() {
  return (
    <section className="w-screen pt-44 pb-32 flex justify-center">
      <div className="home-container">
        <h1 className="text-4xl font-figtree font-bold mb-4">Tokens</h1>
        <TokensTable />
      </div>
    </section>
  );
}

