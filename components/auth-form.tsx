"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/auth-browser";

export function AuthForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (signInError) {
        throw signInError;
      }

      setMessage("Magic link sent. Check your email and come right back.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to send magic link.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel rounded-[2rem] p-8">
      <p className="text-sm uppercase tracking-[0.3em] text-coral">Sign In</p>
      <h2 className="mt-3 font-display text-4xl text-ink">Continue with magic link</h2>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink/68">
        We use Supabase Auth to keep each creator&apos;s episodes private. Enter your email and
        we&apos;ll send you a login link.
      </p>
      <label className="mt-6 grid gap-2 text-sm text-ink/70">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-[1rem] border border-ink/10 bg-white/80 px-4 py-3 text-ink outline-none"
          placeholder="you@example.com"
        />
      </label>
      {message ? (
        <p className="mt-4 rounded-[1rem] border border-teal/20 bg-teal/10 px-4 py-3 text-sm text-teal">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-[1rem] border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-parchment disabled:opacity-70"
      >
        {isSubmitting ? "Sending..." : "Send magic link"}
      </button>
    </form>
  );
}
