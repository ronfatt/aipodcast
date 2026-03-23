"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/auth-browser";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm text-ink transition hover:-translate-y-0.5 hover:bg-white"
    >
      Sign out
    </button>
  );
}
