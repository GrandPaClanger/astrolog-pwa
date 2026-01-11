"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
export const dynamic = "force-dynamic";


export default function AuthCallbackPage() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    void (async () => {
      // 1) Newer PKCE flow: /auth/callback?code=...
      const code = sp.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        router.replace(error ? "/login" : "/targets");
        return;
      }

      // 2) Older implicit flow: /auth/callback#access_token=...&refresh_token=...
      const hash = window.location.hash || "";
      if (hash.includes("access_token=")) {
        const params = new URLSearchParams(hash.replace(/^#/, ""));
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          router.replace(error ? "/login" : "/targets");
          return;
        }
      }

      // Fallback
      router.replace("/login");
    })();
  }, [router, sp]);

  return <main style={{ padding: 16 }}>Signing you in…</main>;
}
