import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    /**
     * This folder sits inside a git repository rooted at the home directory,
     * so Turbopack's automatic root detection walks too far up and ignores
     * package-lock.json. Pin the root to this project.
     */
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
