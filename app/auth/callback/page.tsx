"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  useEffect(() => {
    (async () => {
      // This will parse the URL for tokens (detectSessionInUrl=true)
      await supabase.auth.getSession();
      window.location.href = "/targets";
    })();
  }, []);

  return <p>Signing you in…</p>;
}
