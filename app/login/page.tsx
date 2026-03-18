"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  function getRedirectTo() {
    return typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;
  }

  async function signInWithGoogle() {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: getRedirectTo() },
    });
    if (error) {
      setMsg(error.message);
      setGoogleLoading(false);
    }
    // On success the browser redirects away — no further action needed
  }

  async function sendLink() {
    setMsg(null);
    const e = email.trim();
    if (!e) return setMsg("Enter your email.");

    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: getRedirectTo() },
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
          <h2 className="text-base font-semibold text-slate-100 mb-4 mt-0">Sign in</h2>

          {/* Google sign-in */}
          <button
            onClick={signInWithGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-slate-600 bg-white text-slate-900 font-medium text-sm hover:bg-slate-100 transition-colors disabled:opacity-60"
          >
            {/* Google logo SVG */}
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            {googleLoading ? "Redirecting…" : "Continue with Google"}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500">or</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* Magic link fallback */}
          <div className="form-field">
            <label className="label">Email — magic link</label>
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
