import path from "node:path";
import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the project root (there is another package-lock.json in the home folder)
  outputFileTracingRoot: path.dirname(fileURLToPath(import.meta.url)),
  // libSQL has a native driver; keep it out of the server bundle
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    serverActions: { bodySizeLimit: "4mb" }, // photos are resized in the browser before upload
  },
};
export default nextConfig;
