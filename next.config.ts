import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import { execSync } from "child_process";

// ビルド時にGit情報を取得
function getGitInfo() {
  try {
    const commitHash = execSync("git rev-parse --short HEAD").toString().trim();
    const branch = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
    const commitDate = execSync("git log -1 --format=%ci").toString().trim();
    return { commitHash, branch, commitDate };
  } catch {
    return { commitHash: "unknown", branch: "unknown", commitDate: "unknown" };
  }
}

const gitInfo = getGitInfo();
const buildDate = new Date().toISOString();

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
  // ビルド情報を環境変数として注入
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: gitInfo.commitHash,
    NEXT_PUBLIC_BUILD_BRANCH: gitInfo.branch,
    NEXT_PUBLIC_BUILD_DATE: buildDate,
  },
  // Use a separate distDir for tests to avoid lock conflicts with the main dev server
  distDir: process.env.APP_ENV === "test" ? ".next-test" : ".next",
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
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/*.db",
          "**/*.db-journal",
          "**/*.db-wal",
          "**/*.db-shm"
        ],
      };
    }
    return config;
  },
};

export default pwaConfig(nextConfig);
