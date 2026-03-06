"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      router.replace(data.session ? "/targets" : "/login");
    });
  }, [router]);

  return (
    <main style={{ padding: 16 }}>
      <p style={{ opacity: 0.8 }}>Loading…</p>
    </main>
  );
}
