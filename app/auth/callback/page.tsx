"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        // ── PKCE flow: ?code=... ──────────────────────────────────────
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!cancelled) {
            if (error) {
              console.error("PKCE exchange error:", error.message);
              router.replace("/login?error=auth");
            } else {
              await supabase.rpc("ensure_person");
              router.replace("/targets");
            }
          }
          return;
        }

        // ── Implicit flow: #access_token=...&refresh_token=... ────────
        const hash = window.location.hash ?? "";
        if (hash.includes("access_token=")) {
          const params = new URLSearchParams(hash.replace(/^#/, ""));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (!cancelled) {
              if (error) {
                console.error("Implicit flow error:", error.message);
                router.replace("/login?error=auth");
              } else {
                await supabase.rpc("ensure_person");
                router.replace("/targets");
              }
            }
            return;
          }
        }

        // ── Already have a session (re-visit of callback URL) ─────────
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          if (data.session) {
            router.replace("/targets");
          } else {
            router.replace("/login");
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        if (!cancelled) router.replace("/login");
      }
    }

    void handleCallback();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <main style={{ padding: 16 }}>
      <p style={{ opacity: 0.8 }}>Signing you in…</p>
    </main>
  );
}
