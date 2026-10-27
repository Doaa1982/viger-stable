import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the project root (there is another package-lock.json in the home folder)
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  experimental: {
    serverActions: { bodySizeLimit: "10mb" }, // allows photo uploads for Smart Scan / gait analysis
  },
};
export default nextConfig;
