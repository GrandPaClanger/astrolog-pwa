"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
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

// ISO date/timestamp -> DD/MM/YYYY (display only)
function ukDate(iso: string | null | undefined) {
  if (!iso) return "";
  const iso10 = iso.includes("T") ? iso.slice(0, 10) : iso; // handle timestamps
  const [y, m, d] = iso10.split("-").map(Number);
  if (!y || !m || !d) return iso10; // fallback if unexpected format
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC" }).format(dt);
}

export default function TargetsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const q = (sp.get("q") || "").trim();

  const [rows, setRows] = useState<TargetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(q);

  async function loadTargets(queryText: string) {
    setLoading(true);

    let query = supabase
      .from("v_target_catalog")
      .select("*")
      .order("start_date", { ascending: true, nullsFirst: false })
      .order("catalog_no", { ascending: true });

    if (queryText) query = query.ilike("catalog_no", `%${queryText}%`);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data as any) ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!cancelled) await loadTargets(q);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onSearch = () => {
    const params = new URLSearchParams(sp.toString());

    if (search.trim()) params.set("q", search.trim());
    else params.delete("q");

    const qs = params.toString();
    router.replace(qs ? `/targets?${qs}` : `/targets`);
  };

  async function onDelete(targetId: number, label: string) {
    const ok = confirm(`Delete target "${label}" AND all its sessions/panels?`);
    if (!ok) return;

    const { error } = await supabase.from("target").delete().eq("target_id", targetId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadTargets(q);
  }

  const body = useMemo(() => {
    if (loading) return <p>Loading…</p>;
    if (!rows.length) return <p>No targets yet.</p>;

    return (
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Catalog No", "Description", "Start Date", "Last Imaged", "Total Integration", "Actions"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: 8,
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  {h}
                </th>
              ))}
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

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{ukDate(r.start_date)}</td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{ukDate(r.last_imaged)}</td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{fmtHMS(r.total_integration_sec)}</td>

                <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      style={{ padding: "6px 10px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/targets/${r.target_id}/edit`);
                      }}
                    >
                      Edit
                    </button>

                    <button
                      style={{ padding: "6px 10px" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(r.target_id, r.catalog_no);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: 10, opacity: 0.8 }}>
          Delete will also remove child sessions/panels (DB cascade required).
        </p>
      </div>
    );
  }, [loading, rows, q, router]);

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

        <button style={{ padding: "8px 12px" }} onClick={onSearch}>
          Search
        </button>

        <button style={{ padding: "8px 12px" }} onClick={() => router.push("/sessions/new")}>
          New Session
        </button>

        <Link href="/maintenance" style={{ padding: "8px 12px", display: "inline-block" }}>
          Maintenance
        </Link>
      </div>

      {body}
    </main>
  );
}
