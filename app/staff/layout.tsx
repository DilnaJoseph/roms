import { SignOutButton } from "@/components/auth/SignOutButton";

export default function StaffLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Staff dashboard</h1>
          <p className="text-xs text-slate-500">
            Front-of-house — SRS U7, U8 (monitor, complete, flag)
          </p>
        </div>
        <SignOutButton className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50" />
      </header>
      {children}
    </div>
  );
}
