import { SignOutButton } from "@/components/auth/SignOutButton";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Admin dashboard
            </h1>
            <p className="text-xs text-zinc-500">
              ROMS — KPIs, analytics, MySQL (SRS §3.2 refresh)
            </p>
          </div>
          <SignOutButton className="rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800" />
        </div>
      </header>
      {children}
    </div>
  );
}
