"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type TargetRow = {
  target_id: number;
  catalog_no: string;
  description: string | null;
  start_date: string | null;
  last_imaged: string | null;
  total_integration_sec: number;
};

function fmtHMS(totalSec: number) {
  const sec = Math.max(0, Math.floor(totalSec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s
    .toString()
    .padStart(2, "0")}`;
}

export default function TargetsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = (sp.get("q") || "").trim();

  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(q);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      let query = supabase
        .from("v_target_catalog")
        .select("*")
        .order("last_imaged", { ascending: false, nullsFirst: false })
        .order("catalog_no", { ascending: true });

      // simple search on catalog_no
      if (q) query = query.ilike("catalog_no", `%${q}%`);

      const { data, error } = await query;
      if (!cancelled) {
        if (error) {
          console.error(error);
          setRows([]);
        } else {
          setRows((data as any) ?? []);
        }
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const onSearch = () => {
    const params = new URLSearchParams(sp.toString());
    if (search.trim()) params.set("q", search.trim());
    else params.delete("q");
    router.replace(`/targets?${params.toString()}`);
  };

  const body = useMemo(() => {
    if (loading) return <p>Loading…</p>;
    if (!rows.length) return <p>No targets yet.</p>;

    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Catalog No", "Description", "Start Date", "Last Imaged", "Total Integration"].map(
                (h) => (
                  <th key={h} style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.target_id}
                style={{ cursor: "pointer" }}
                onClick={() => router.push(`/targets/${r.target_id}`)}
              >
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.catalog_no}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.description ?? ""}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.start_date ?? ""}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{r.last_imaged ?? ""}</td>
                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{fmtHMS(r.total_integration_sec)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [loading, rows, router]);

  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1>Targets</h1>

      <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search catalog no (e.g., M31)"
          style={{ flex: 1, padding: 8 }}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />
        <button onClick={onSearch} style={{ padding: "8px 12px" }}>
          Search
        </button>
        <button onClick={() => router.push("/sessions/new")} style={{ padding: "8px 12px" }}>
          New Session
        </button>
      </div>

      {body}
    </main>
  );
}
