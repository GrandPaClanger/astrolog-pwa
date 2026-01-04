"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function sendLink() {
    setMsg(null);
    const e = email.trim();
    if (!e) return setMsg("Enter your email.");

    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/callback`
        : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) return setMsg(error.message);
    setMsg("Magic link sent. Check your inbox.");
  }

  return (
    <main style={{ padding: 16, maxWidth: 520, margin: "0 auto" }}>
      <h1>Login</h1>
      <p style={{ opacity: 0.8 }}>Enter your email to receive a magic link.</p>

      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        style={{ width: "100%", marginTop: 8 }}
      />
      <div style={{ marginTop: 10 }}>
        <button onClick={sendLink}>Send magic link</button>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
    </main>
  );
}
