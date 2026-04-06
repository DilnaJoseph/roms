import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  /** Monorepo: stop Next from treating the parent `dbms-docs` folder as the app root (wrong .env / tracing). */
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
