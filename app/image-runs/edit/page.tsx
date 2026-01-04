import { Suspense } from "react";
import EditRunClient from "./EditRunClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <Suspense fallback={<div>Loading image run…</div>}>
        <EditRunClient />
      </Suspense>
    </main>
  );
}
