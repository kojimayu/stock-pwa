import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === "development", // PWA disabled in dev to prevent infinite recompile
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  logging: {
    fetches: {
      fullUrl: true,
    },
    // @ts-ignore - incomingRequests is a valid option in Next.js 15+ but might not be in types yet
    incomingRequests: {
      ignore: [/\/api\/health/],
    },
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: ["**/node_modules/**", "**/.git/**", "**/*.db", "**/*.db-journal"],
      };
    }
    return config;
  },
};

export default pwaConfig(nextConfig);
