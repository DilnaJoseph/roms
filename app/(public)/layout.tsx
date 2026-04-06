import Link from "next/link";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight hover:text-zinc-700"
          >
            ROMS
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-600">
            <Link href="/" className="hover:text-zinc-900">
              Order
            </Link>
            <Link href="/kitchen" className="hover:text-zinc-900">
              Kitchen
            </Link>
            <Link href="/staff" className="hover:text-zinc-900">
              Staff
            </Link>
            <Link href="/admin" className="hover:text-zinc-900">
              Admin
            </Link>
            <Link
              href="/login"
              className="font-medium text-amber-800 hover:text-amber-900"
            >
              Staff sign in
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
