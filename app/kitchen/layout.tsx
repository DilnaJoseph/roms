export default function KitchenLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /* Background / theme controlled by `page.tsx` for high-contrast kitchen mode (SRS U5). */
  return <>{children}</>;
}
