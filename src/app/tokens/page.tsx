import TokensTable from "@/components/Tokens/Table";

export default function TokensPage() {
    return (
        <section className="w-full min-w-0 pt-28 sm:pt-36 lg:pt-44 pb-24 sm:pb-32 flex justify-center">
            <div className="home-container min-w-0">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-figtree font-bold mb-4">Tokens</h1>
                <div className="overflow-x-auto min-w-0 -mx-1 px-1">
                    <TokensTable />
                </div>
            </div>
        </section>
    );
}
