import WalletWrapper from "./Wallet";
import { Toaster } from "@/components/ui/sonner";

export default function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <WalletWrapper>
            {children}
            <Toaster richColors />
        </WalletWrapper>
    );
}
