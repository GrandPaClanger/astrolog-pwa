"use client";

import { useEffect, useState } from "react";

async function hardReload() {
  try {
    // unregister SW
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    // clear Cache Storage
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore
  } finally {
    // reload
    window.location.reload();
  }
}

export default function VersionGate() {
  const [remoteTag, setRemoteTag] = useState<string | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  const localTag = process.env.NEXT_PUBLIC_BUILD_TAG ?? "dev";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const j = (await res.json()) as { buildTag: string };
        setRemoteTag(j.buildTag);

        const seen = localStorage.getItem("seen_build_tag");
        if (seen && seen !== j.buildTag) setShowUpdate(true);

        localStorage.setItem("seen_build_tag", j.buildTag);
      } catch {
        setRemoteTag(null);
      }
    })();
  }, []);

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 12, opacity: 0.75, marginBottom: 10 }}>
      <span>Build (local): {localTag}</span>
      <span>Build (api): {remoteTag ?? "?"}</span>

      {showUpdate && (
        <button onClick={hardReload} style={{ padding: "4px 8px" }}>
          New version — refresh
        </button>
      )}

      <button onClick={hardReload} style={{ padding: "4px 8px" }}>
        Hard refresh
      </button>
    </div>
  );
}
