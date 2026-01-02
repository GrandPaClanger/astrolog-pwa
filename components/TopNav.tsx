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
    <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <div className="row" style={{ alignItems: "center" }}>
        <strong>astrolog-pwa</strong>
        <Link href="/targets">Targets</Link>
        <Link href="/sessions/new">New Session</Link>
      </div>
      <div className="row" style={{ alignItems: "center" }}>
        {email ? <span className="small">{email}</span> : null}
        <button onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
