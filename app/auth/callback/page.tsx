"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    (async () => {
      // Supabase v2 magic link callback typically uses "code"
      const code = sp.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error(error);
          router.replace("/login?e=auth");
          return;
        }
      }

      router.replace("/targets");
    })();
  }, [router, sp]);

  return <main style={{ padding: 16 }}>Signing you in…</main>;
}
