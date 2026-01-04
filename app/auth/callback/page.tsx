import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

export const dynamic = "force-dynamic";

export default function AuthCallbackPage() {
  return (
    <main style={{ padding: 16 }}>
      <Suspense fallback={<div>Signing you in…</div>}>
        <CallbackClient />
      </Suspense>
    </main>
  );
}
