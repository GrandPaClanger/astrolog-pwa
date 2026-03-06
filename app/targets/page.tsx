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
    if (loading) return <p className="text-slate-400 py-4">Loading…</p>;
    if (!rows.length) return <p className="text-slate-400 py-4">No targets yet.</p>;

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-700">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Catalog No", "Description", "Start Date", "Last Imaged", "Total Integration", "Actions"].map((h) => (
                <th key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr
                key={r.target_id}
                className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                onClick={() => router.push(`/targets/${r.target_id}`)}
              >
                <td className="font-medium text-blue-400">{r.catalog_no}</td>

                <td className="text-slate-300">{r.description ?? ""}</td>

                <td className="text-slate-400 text-sm">{ukDate(r.start_date)}</td>

                <td className="text-slate-400 text-sm">{ukDate(r.last_imaged)}</td>

                <td><span className="badge-slate">{fmtHMS(r.total_integration_sec)}</span></td>

                <td>
                  <div className="flex gap-2">
                    <button
                      className="btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/targets/${r.target_id}/edit`);
                      }}
                    >
                      Edit
                    </button>

                    <button
                      className="btn-danger text-xs px-2 py-1"
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

        <p className="text-slate-400 py-4 px-4">
          Delete will also remove child sessions/panels (DB cascade required).
        </p>
      </div>
    );
  }, [loading, rows, q, router]);

  return (
    <div className="page-wrapper">
      <h1>Targets</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search catalog no (e.g., M31)"
          className="input flex-1 min-w-[200px]"
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
        />

        <button className="btn-secondary" onClick={onSearch}>
          Search
        </button>

        <button className="btn-primary" onClick={() => router.push("/sessions/new")}>
          New Session
        </button>

        <Link href="/maintenance" className="btn-ghost">
          Maintenance
        </Link>
      </div>

      {body}
    </div>
  );
}
