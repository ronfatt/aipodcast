import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser, isAuthEnabled } from "@/lib/auth-server";

export default async function LoginPage() {
  if (!isAuthEnabled()) {
    redirect("/dashboard");
  }

  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="panel rounded-[2rem] px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-teal">AIPodcast Studio</p>
              <h1 className="mt-2 font-display text-5xl text-ink">Creator login</h1>
            </div>
            <Link
              href="/"
              className="rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm text-ink"
            >
              Back home
            </Link>
          </div>
        </header>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <AuthForm />
          <div className="panel rounded-[2rem] p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-coral">Why login</p>
            <ul className="mt-5 space-y-4 text-sm leading-7 text-ink/72">
              <li className="rounded-[1.25rem] border border-ink/8 bg-white/70 px-4 py-3">
                Episodes are isolated per creator once Supabase Auth is enabled.
              </li>
              <li className="rounded-[1.25rem] border border-ink/8 bg-white/70 px-4 py-3">
                Audio renders and publishing packages stay connected to the right owner.
              </li>
              <li className="rounded-[1.25rem] border border-ink/8 bg-white/70 px-4 py-3">
                This is the base we need before inviting more users onto the platform.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
