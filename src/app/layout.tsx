import type { Metadata } from "next";
import { Figtree, Manrope } from "next/font/google";

import Nav from "@/components/Nav";
import Header from "@/components/Header";
import Wrapper from "@/components/Wrappers";

import "./globals.css";

const manrope = Manrope({
    variable: "--font-manrope",
    subsets: ["latin"],
    display: "swap",
    weight: ["300", "400", "500", "600", "700", "800"],
});

const figtree = Figtree({
    variable: "--font-figtree",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Atomic Cash - Instant Swaps on Bitcoin Cash",
    description:
        "Atomic Cash is a decentralized exchange on Bitcoin Cash. Experience seamless trading at instant.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${manrope.variable} ${figtree.variable} antialiased`}>
                <Wrapper>
                    <Header />
                    <main>{children}</main>
                    <Nav />
                </Wrapper>
            </body>
        </html>
    );
}
