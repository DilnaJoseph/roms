import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

let loaded = false;

/**
 * Ensure `.env` / `.env.local` from the **roms** app root are on `process.env`
 * before Prisma / `isDatabaseConfigured()` run. Fixes monorepo setups where Next.js
 * infers a parent folder as the workspace root and skips `roms/.env.local`.
 */
export function loadRomsEnv(): void {
  if (loaded) return;
  loaded = true;
  const romsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  dotenv.config({ path: path.join(romsRoot, ".env"), quiet: true });
  dotenv.config({
    path: path.join(romsRoot, ".env.local"),
    override: true,
    quiet: true,
  });
}
