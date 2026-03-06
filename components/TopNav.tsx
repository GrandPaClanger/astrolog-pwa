"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function TopNav() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    location.href = "/login";
  }

  return (
    <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/targets" className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
            <svg width="20" height="20" viewBox="0 0 192 192" className="shrink-0">
              <rect width="192" height="192" rx="28" fill="#0f172a"/>
              <g transform="translate(94,84) rotate(-25)">
                <rect x="-50" y="-12" width="100" height="24" rx="8" fill="#3b82f6"/>
                <rect x="-68" y="-16" width="26" height="32" rx="7" fill="#2563eb"/>
                <rect x="50" y="-8" width="20" height="16" rx="5" fill="#1d4ed8"/>
              </g>
              <line x1="94" y1="110" x2="68" y2="155" stroke="#475569" strokeWidth="6" strokeLinecap="round"/>
              <line x1="94" y1="110" x2="120" y2="155" stroke="#475569" strokeWidth="6" strokeLinecap="round"/>
              <line x1="94" y1="110" x2="94" y2="155" stroke="#475569" strokeWidth="6" strokeLinecap="round"/>
            </svg>
            Astrolog
          </Link>

          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link href="/targets" className="text-slate-400 hover:text-slate-100 transition-colors">
              Targets
            </Link>
            <Link href="/sessions/new" className="text-slate-400 hover:text-slate-100 transition-colors">
              New Session
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {email && (
            <span className="hidden md:block text-xs text-slate-500 truncate max-w-[200px]">{email}</span>
          )}
          <button onClick={signOut} className="btn-ghost text-xs px-3 py-1.5">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
