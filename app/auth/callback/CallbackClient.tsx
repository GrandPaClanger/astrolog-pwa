"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CallbackClient() {
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    (async () => {
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

  return <div>Signing you in…</div>;
}
