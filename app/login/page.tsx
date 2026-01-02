"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function sendLink() {
    setStatus(null);
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) setStatus(error.message);
    else setStatus("Magic link sent. Check your email.");
  }

  return (
    <div className="card">
      <h1>Login</h1>
      <p className="small">Enter your email to receive a magic link.</p>
      <div className="row">
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ minWidth: 280 }}
        />
        <button onClick={sendLink} disabled={!email}>
          Send link
        </button>
      </div>
      {status ? <p className="small">{status}</p> : null}
    </div>
  );
}
