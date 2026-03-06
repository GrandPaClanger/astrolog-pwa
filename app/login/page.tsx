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
    <div className="min-h-screen flex items-center justify-center px-4 bg-astro-bg">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <svg width="64" height="64" viewBox="0 0 192 192">
            <rect width="192" height="192" rx="32" fill="#1e293b"/>
            <circle cx="35" cy="35" r="2.5" fill="#f1f5f9" opacity="0.8"/>
            <circle cx="158" cy="28" r="2" fill="#f1f5f9" opacity="0.6"/>
            <circle cx="168" cy="58" r="2" fill="#f1f5f9" opacity="0.5"/>
            <circle cx="22" cy="72" r="1.5" fill="#f1f5f9" opacity="0.6"/>
            <g transform="translate(94,84) rotate(-25)">
              <rect x="-50" y="-12" width="100" height="24" rx="8" fill="#3b82f6"/>
              <rect x="-68" y="-16" width="26" height="32" rx="7" fill="#2563eb"/>
              <rect x="50" y="-8" width="20" height="16" rx="5" fill="#1d4ed8"/>
            </g>
            <line x1="94" y1="110" x2="68" y2="155" stroke="#475569" strokeWidth="6" strokeLinecap="round"/>
            <line x1="94" y1="110" x2="120" y2="155" stroke="#475569" strokeWidth="6" strokeLinecap="round"/>
            <line x1="94" y1="110" x2="94" y2="155" stroke="#475569" strokeWidth="6" strokeLinecap="round"/>
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-center text-slate-100 mb-1">Astrolog</h1>
        <p className="text-sm text-slate-400 text-center mb-8">Astrophotography session log</p>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-100 mb-1 mt-0">Sign in</h2>
          <p className="text-sm text-slate-400 mb-4">Enter your email to receive a magic link.</p>

          <div className="form-field">
            <label className="label">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              placeholder="you@example.com"
              className="input"
            />
          </div>

          <button onClick={sendLink} className="btn-primary w-full justify-center mt-2">
            Send magic link
          </button>

          {msg && (
            <p className={`mt-3 text-sm ${msg.includes("sent") ? "text-green-400" : "text-red-400"}`}>
              {msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
