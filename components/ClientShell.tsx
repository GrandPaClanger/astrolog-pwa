"use client";

import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { TopNav } from "@/components/TopNav";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isPublic =
    pathname === "/login" ||
    pathname?.startsWith("/auth/");

  if (isPublic) return <>{children}</>;

  return (
    <AuthGate>
      <TopNav />
      {children}
    </AuthGate>
  );
}
