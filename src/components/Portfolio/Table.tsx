import Image from "next/image";

export default function PortfolioTable() {
    return (
        <div className="w-full rounded-[24px] border">
            <div className="border-b flex items-center w-full py-3 px-5 bg-secondary/80 rounded-t-[24px]">
                <div className="flex items-center gap-2 w-30">
                    <Image src="/icons/bch.svg" alt="Bitcoin Cash" width={24} height={24} />
                    <span className="font-medium">BCH</span>
                </div>
                <div>
                    <span className="text-muted-foreground">Bitcoin Cash</span>
                </div>
                <div className="flex-1 flex items-center justify-end">
                    <span className="text-xl font-mono">0.00</span>
                </div>
            </div>
            <div className="w-full flex items-center py-3 px-5 bg-popover rounded-b-[24px]">
                <div className="flex items-center gap-2 w-30">
                    <span className="font-medium ml-8">AUSD</span>
                </div>
                <div>
                    <span className="text-muted-foreground">Atomic USD</span>
                </div>
                <div className="flex-1 flex items-center justify-end">
                    <span className="text-xl font-mono">0.00</span>
                </div>
            </div>
        </div>
    );
}
