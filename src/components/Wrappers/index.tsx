import WalletWrapper from "./Wallet";
import SocketWrapper from "./Socket";
import { Toaster } from "@/components/ui/sonner";

export default function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <WalletWrapper>
            <SocketWrapper>
                {children}
                <Toaster richColors position="top-center" offset={140} />
            </SocketWrapper>
        </WalletWrapper>
    );
}
