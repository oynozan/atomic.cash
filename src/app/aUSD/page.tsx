import Link from "next/link";
import {
    Shield,
    Coins,
    ArrowRightLeft,
    Lock,
    TrendingUp,
    Zap,
    ChevronRight,
    FlaskConical,
    FileSearch,
    Rocket,
    CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
    {
        icon: Lock,
        title: "BCH Collateral",
        description:
            "Lock BCH as collateral to mint aUSD. Your collateral stays on-chain at all times — no bridges, no custodians.",
    },
    {
        icon: Shield,
        title: "Over-Collateralized",
        description:
            "Every aUSD in circulation is backed by BCH worth significantly more than $1.00, absorbing price volatility.",
    },
    {
        icon: TrendingUp,
        title: "Capped to $1",
        description:
            "Protocol mechanics and on-chain arbitrage keep aUSD from trading above its $1.00 target. The cap is enforced by design.",
    },
    {
        icon: ArrowRightLeft,
        title: "Built on Atomic Cash",
        description:
            "aUSD liquidity lives natively inside Atomic Cash pools. Swap, route, and track aUSD the same way as any other CashToken.",
    },
    {
        icon: Coins,
        title: "Earn by Providing Liquidity",
        description:
            "Once live, providing aUSD liquidity in Atomic Cash pools earns you a share of the 0.3% swap fee.",
    },
    {
        icon: Zap,
        title: "Instant on Bitcoin Cash",
        description:
            "Powered by BCH's low fees and fast confirmation times. Minting, repaying, and swapping cost fractions of a cent.",
    },
];

const howItWorks = [
    {
        step: "01",
        title: "Deposit BCH",
        description:
            "Lock BCH in a collateral contract. The amount you deposit determines how much aUSD you are allowed to mint.",
    },
    {
        step: "02",
        title: "Mint aUSD",
        description:
            "Borrow aUSD against your collateral. Positions must stay above the minimum collateral ratio to remain healthy.",
    },
    {
        step: "03",
        title: "Use or Trade aUSD",
        description:
            "Spend, swap, or provide liquidity with aUSD. Its value is designed to stay pegged around $1.00 at all times.",
    },
    {
        step: "04",
        title: "Repay and Reclaim",
        description:
            "Burn aUSD to close your position and reclaim your BCH collateral, minus any accrued fees.",
    },
];

const roadmapPhases = [
    {
        icon: FlaskConical,
        phase: "Phase 1",
        title: "Research & Design",
        description: "Contract design, collateral ratio modeling, and stability mechanism specification.",
        status: "active" as const,
    },
    {
        icon: FileSearch,
        phase: "Phase 2",
        title: "Testnet Launch",
        description: "Deploy contracts on BCH testnet, run simulations, and gather community feedback.",
        status: "upcoming" as const,
    },
    {
        icon: Shield,
        phase: "Phase 3",
        title: "Audit",
        description: "Independent security review of all smart contracts and protocol parameters.",
        status: "upcoming" as const,
    },
    {
        icon: Rocket,
        phase: "Phase 4",
        title: "Mainnet",
        description: "Launch aUSD on Bitcoin Cash mainnet and integrate fully with Atomic Cash pools.",
        status: "upcoming" as const,
    },
];

export default function AUSDPage() {
    return (
        <section className="w-screen pt-36 pb-30 flex justify-center">
            <div className="home-container px-6 flex flex-col gap-24">

                <div className="relative flex flex-col items-center text-center gap-6 pt-8">
                    {/* Glow backdrop */}
                    <div
                        className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[520px] h-[320px] rounded-full opacity-20 blur-3xl"
                        style={{ background: "radial-gradient(ellipse, #ffae00 0%, transparent 70%)" }}
                    />

                    <span className="relative z-10 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-sm font-medium text-gold">
                        <span className="size-1.5 rounded-full bg-gold animate-pulse" />
                        Coming Soon
                    </span>

                    <h1 className="relative z-10 font-figtree font-bold text-6xl leading-tight tracking-tight max-w-3xl">
                        Bitcoin Cash&apos;s{" "}
                        <span className="text-gold">Native Stablecoin</span>
                    </h1>

                    <p className="relative z-10 text-muted-foreground text-lg max-w-xl leading-relaxed">
                        aUSD is a BCH-collateralized stablecoin built on top of Atomic Cash.
                        Lock BCH, mint aUSD, and keep the peg — all on-chain and non-custodial.
                    </p>

                    <div className="relative z-10 flex items-center gap-3">
                        <Link href="/pools">
                            <Button size="lg" className="rounded-full px-7 bg-gold text-black font-semibold hover:bg-gold/90">
                                Explore Atomic Cash
                                <ChevronRight className="size-4" />
                            </Button>
                        </Link>
                        <Link href="https://docs.atomic.cash/roadmap" target="_blank">
                            <Button size="lg" variant="outline" className="rounded-full px-7">
                                Read the Roadmap
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "Target Price", value: "$1.00", sub: "USD peg" },
                        { label: "Collateral", value: "BCH", sub: "Native Bitcoin Cash" },
                        { label: "Model", value: "Lending", sub: "Over-collateralized" },
                        { label: "Integration", value: "Atomic Cash", sub: "AMM + routing" },
                    ].map(({ label, value, sub }) => (
                        <div
                            key={label}
                            className="rounded-[24px] border bg-popover px-5 py-5 flex flex-col gap-1"
                        >
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <span className="text-2xl font-semibold font-figtree text-gold">{value}</span>
                            <span className="text-xs text-muted-foreground">{sub}</span>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-2">
                        <h2 className="font-figtree font-bold text-3xl">How aUSD works</h2>
                        <p className="text-muted-foreground text-base max-w-lg">
                            aUSD uses a lending-style protocol to issue dollar-pegged tokens backed entirely by BCH.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {howItWorks.map(({ step, title, description }) => (
                            <div
                                key={step}
                                className="rounded-[24px] border bg-secondary/60 p-6 flex flex-col gap-4"
                            >
                                <span className="text-3xl font-figtree font-bold text-gold/40 leading-none">
                                    {step}
                                </span>
                                <div className="flex flex-col gap-1.5">
                                    <p className="font-semibold text-base">{title}</p>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-2">
                        <h2 className="font-figtree font-bold text-3xl">Protocol properties</h2>
                        <p className="text-muted-foreground text-base max-w-lg">
                            aUSD is designed from first principles to be safe, transparent, and native to Bitcoin Cash.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {features.map(({ icon: Icon, title, description }) => (
                            <div
                                key={title}
                                className="rounded-[24px] border bg-popover p-6 flex flex-col gap-4 transition-colors hover:bg-secondary/60"
                            >
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/10">
                                    <Icon className="size-5 text-gold" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <p className="font-semibold text-base">{title}</p>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="rounded-[32px] border bg-secondary/40 p-10 flex flex-col md:flex-row gap-10">
                    <div className="flex-1 flex flex-col gap-5">
                        <h2 className="font-figtree font-bold text-3xl leading-snug">
                            Why BCH as collateral?
                        </h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Using BCH as the sole collateral asset is a deliberate design choice. It removes dependence
                            on external custodians, bridged assets, or off-chain oracles for collateral valuation — keeping
                            the entire system trustless and native to Bitcoin Cash.
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            BCH holders who want liquidity no longer need to sell. By locking BCH and minting aUSD, they
                            retain their BCH exposure while accessing dollar-denominated value for everyday use or DeFi.
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            The health of aUSD is directly tied to the BCH ecosystem. A stronger BCH means more stable,
                            capital-efficient collateral for everyone using the protocol.
                        </p>
                    </div>
                    <div className="flex-1 flex flex-col gap-4 justify-center items-end">
                        {[
                            { label: "No bridged or wrapped assets", desc: "Collateral is native BCH, settled on-chain." },
                            { label: "BCH holders keep their exposure", desc: "Borrow against BCH without selling it." },
                            { label: "Trustless price discovery", desc: "Atomic Cash pools provide on-chain BCH/USD pricing." },
                            { label: "Ecosystem alignment", desc: "Protocol growth directly benefits BCH holders." },
                        ].map(({ label, desc }) => (
                            <div key={label} className="flex flex-row-reverse items-start gap-3">
                                <CheckCircle2 className="size-5 text-primary mt-0.5 shrink-0" />
                                <div className="text-end">
                                    <p className="font-medium text-sm">{label}</p>
                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-2">
                        <h2 className="font-figtree font-bold text-3xl">Stability mechanisms</h2>
                        <p className="text-muted-foreground text-base max-w-lg">
                            aUSD&apos;s $1.00 peg is enforced through multiple layers working together.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        <div className="rounded-[24px] border bg-popover p-6 flex flex-col gap-3">
                            <p className="font-semibold">Over-collateralization</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Positions must maintain a collateral ratio well above 100%. If BCH drops in value,
                                positions must be topped up or partially repaid before they become undercollateralized.
                            </p>
                        </div>
                        <div className="rounded-[24px] border bg-popover p-6 flex flex-col gap-3">
                            <p className="font-semibold">Liquidation thresholds</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                Positions that fall below the safety threshold become eligible for liquidation.
                                Liquidators repay debt and receive the collateral at a discount, keeping the system solvent.
                            </p>
                        </div>
                        <div className="rounded-[24px] border bg-popover p-6 flex flex-col gap-3">
                            <p className="font-semibold">On-chain arbitrage</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                If aUSD trades above $1.00 in Atomic Cash pools, anyone can mint new aUSD cheaply and sell
                                it for instant profit, pushing the price back toward the cap.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-2">
                        <h2 className="font-figtree font-bold text-3xl">Launch roadmap</h2>
                        <p className="text-muted-foreground text-base max-w-lg">
                            aUSD will be released in phases to ensure the protocol is safe and well-tested before mainnet.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {roadmapPhases.map(({ icon: Icon, phase, title, description, status }) => (
                            <div
                                key={phase}
                                className={[
                                    "rounded-[24px] border p-6 flex flex-col gap-4",
                                    status === "active"
                                        ? "bg-gold/10 border-gold/30"
                                        : "bg-popover",
                                ].join(" ")}
                            >
                                <div className="flex items-center justify-between">
                                    <div
                                        className={[
                                            "flex h-11 w-11 items-center justify-center rounded-xl",
                                            status === "active" ? "bg-gold/20" : "bg-secondary",
                                        ].join(" ")}
                                    >
                                        <Icon
                                            className={[
                                                "size-5",
                                                status === "active" ? "text-gold" : "text-muted-foreground",
                                            ].join(" ")}
                                        />
                                    </div>
                                    {status === "active" && (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gold rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5">
                                            <span className="size-1.5 rounded-full bg-gold animate-pulse" />
                                            Active
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">{phase}</span>
                                    <p className="font-semibold text-base">{title}</p>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative rounded-[32px] border border-gold/20 bg-gold/5 p-12 flex flex-col items-center text-center gap-6 overflow-hidden">
                    <div
                        className="pointer-events-none absolute inset-0 opacity-10 blur-3xl"
                        style={{ background: "radial-gradient(ellipse at center, #ffae00 0%, transparent 70%)" }}
                    />
                    <h2 className="relative z-10 font-figtree font-bold text-4xl">
                        aUSD is coming to Bitcoin Cash
                    </h2>
                    <p className="relative z-10 text-muted-foreground text-lg max-w-md">
                        In the meantime, start trading on Atomic Cash and provide liquidity to earn fees today.
                    </p>
                    <div className="relative z-10 flex items-center gap-3">
                        <Link href="/">
                            <Button size="lg" className="rounded-full px-7 bg-gold text-black font-semibold hover:bg-gold/90">
                                Start Swapping
                                <ChevronRight className="size-4" />
                            </Button>
                        </Link>
                        <Link href="https://docs.atomic.cash/whitepaper" target="_blank">
                            <Button size="lg" variant="outline" className="rounded-full px-7 border-gold/30 text-gold hover:bg-gold/10 hover:text-gold">
                                Read Whitepaper
                            </Button>
                        </Link>
                    </div>
                </div>

            </div>
        </section>
    );
}
