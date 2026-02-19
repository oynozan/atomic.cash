import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactCompiler: true,
    images: {
        qualities: [100, 80],
    },
    experimental: {
        useCache: true,
    },
};

export default nextConfig;
