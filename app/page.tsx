"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setIsAuthed(!!data.session);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.location.href = isAuthed ? "/targets" : "/login";
  }, [ready, isAuthed]);

  return (
    <main style={{ padding: 16 }}>
      <div style={{ opacity: 0.8 }}>Loading…</div>
      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.6 }}>
        Build: {process.env.NEXT_PUBLIC_BUILD_TAG ?? "dev"}
      </div>
    </main>
  );
}
