"use client";

import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="text-sm text-stone-700">
        Sent. Check <strong>{email}</strong> — click the link to finish signing
        in.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full border-2 border-stone-200 rounded-lg px-3 py-2.5 text-base"
        autoComplete="email"
      />
      <button
        type="submit"
        disabled={status === "sending" || !email.trim()}
        className="w-full font-semibold py-2.5 rounded-lg bg-[var(--color-tl-green-mid)] text-white disabled:opacity-40"
      >
        {status === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </form>
  );
}
