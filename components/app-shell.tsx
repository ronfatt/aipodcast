import Link from "next/link";
import { ReactNode } from "react";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth-server";
import { SignOutButton } from "@/components/sign-out-button";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/episodes/new", label: "New Episode" },
];

export async function AppShell({
  children,
  title,
  kicker,
}: {
  children: ReactNode;
  title: string;
  kicker: string;
}) {
  const user = await getCurrentUser();
  const authEnabled = isAuthEnabled();

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="panel rounded-[2rem] px-6 py-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-teal">{kicker}</p>
              <div>
                <h1 className="font-display text-4xl text-ink sm:text-5xl">{title}</h1>
                <p className="mt-2 max-w-2xl text-sm text-ink/70 sm:text-base">
                  Build a two-host podcast pipeline that turns topics and long-form notes into
                  editable scripts and publishable audio.
                </p>
              </div>
            </div>
            <nav className="flex flex-wrap gap-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm text-ink transition hover:-translate-y-0.5 hover:bg-white"
                >
                  {item.label}
                </Link>
              ))}
              {authEnabled ? (
                user ? (
                  <SignOutButton />
                ) : (
                  <Link
                    href="/login"
                    className="rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm text-ink transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    Login
                  </Link>
                )
              ) : null}
            </nav>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
