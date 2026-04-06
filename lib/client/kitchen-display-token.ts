/**
 * Browser copy of `ROMS_KITCHEN_TOKEN` for wall displays (must match server env).
 */
export function getBrowserKitchenDisplayToken(): string | undefined {
  const t = process.env.NEXT_PUBLIC_ROMS_KITCHEN_TOKEN?.trim();
  return t || undefined;
}
