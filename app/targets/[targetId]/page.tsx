"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SessionRow = {
  session_id: number;
  session_date: string | null;
  started_at: string | null;
  ended_at: string | null;
  telescope_name: string | null;
  mount_name: string | null;
  camera_name: string | null;
  location_name: string | null;
  total_integration_sec: number;
  notes: string | null;
};

type RunRow = {
  image_run_id: number;
  session_id: number;
  run_date: string;
  panel_no: number | null;
  panel_name: string;
  total_panel_sec: number;
  notes: string | null;
};

type FilterLineRow = {
  run_filter_id: number;
  image_run_id: number;
  exposures: number;
  exposure_sec: number;
  filter_id: number;
  notes: string | null;
  filter: { name: string } | null;
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

export default function TargetDetailPage() {
  const { targetId } = useParams<{ targetId: string }>();
  const router = useRouter();

  const [target, setTarget] = useState<any>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [lines, setLines] = useState<FilterLineRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const tid = Number(targetId);

      const tRes = await supabase.from("target").select("*").eq("target_id", tid).single();
      if (tRes.error) console.error(tRes.error);

      const sRes = await supabase
        .from("v_session_totals")
        .select("*")
        .eq("target_id", tid)
        .order("session_date", { ascending: false, nullsFirst: false })
        .order("started_at", { ascending: false, nullsFirst: false });

      if (sRes.error) console.error(sRes.error);

      const sessionIds = (sRes.data ?? []).map((s: any) => s.session_id);

      let rData: any[] = [];
      if (sessionIds.length) {
        const rRes = await supabase
          .from("v_image_run_totals")
          .select("*")
          .in("session_id", sessionIds)
          .order("run_date", { ascending: false })
          .order("panel_no", { ascending: true });

        if (rRes.error) console.error(rRes.error);
        rData = (rRes.data as any[]) ?? [];
      }

      const runIds = rData.map((r) => r.image_run_id);

      let lData: any[] = [];
      if (runIds.length) {
        const lRes = await supabase
          .from("run_filter")
          .select("run_filter_id,image_run_id,exposures,exposure_sec,filter_id,notes,filter(name)")
          .in("image_run_id", runIds)
          .order("filter_id", { ascending: true });

        if (lRes.error) console.error(lRes.error);
        lData = (lRes.data as any[]) ?? [];
      }

      if (!cancelled) {
        setTarget(tRes.data ?? null);
        setSessions((sRes.data as any) ?? []);
        setRuns((rData as any) ?? []);
        setLines((lData as any) ?? []);
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  const runsBySession = useMemo(() => {
    const map = new Map<number, RunRow[]>();
    for (const r of runs) {
      const arr = map.get(r.session_id) ?? [];
      arr.push(r);
      map.set(r.session_id, arr);
    }
    return map;
  }, [runs]);

  const linesByRun = useMemo(() => {
    const map = new Map<number, FilterLineRow[]>();
    for (const l of lines) {
      const arr = map.get(l.image_run_id) ?? [];
      arr.push(l);
      map.set(l.image_run_id, arr);
    }
    return map;
  }, [lines]);

  if (loading) return <main style={{ padding: 16 }}>Loading…</main>;
  if (!target) return <main style={{ padding: 16 }}>Target not found.</main>;

  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <button onClick={() => router.push("/targets")} style={{ marginBottom: 12 }}>
        ← Back
      </button>

      <h1>
        {target.catalog_no} {target.description ? `— ${target.description}` : ""}
      </h1>

      <div style={{ margin: "8px 0 16px" }}>
        <button onClick={() => router.push(`/sessions/new?target_id=${target.target_id}`)}>
          New session for this target
        </button>
      </div>

      {!sessions.length ? (
        <p>No sessions yet.</p>
      ) : (
        sessions.map((s) => {
          const sruns = runsBySession.get(s.session_id) ?? [];
          return (
            <section
              key={s.session_id}
              style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}
            >
              <h2 style={{ margin: 0 }}>
                Session {s.session_date ?? (s.started_at ? s.started_at.slice(0, 10) : "")}
              </h2>

              <p style={{ margin: "6px 0" }}>
                <strong>Telescope:</strong> {s.telescope_name ?? "—"} &nbsp;|&nbsp;
                <strong>Mount:</strong> {s.mount_name ?? "—"} &nbsp;|&nbsp;
                <strong>Camera:</strong> {s.camera_name ?? "—"} &nbsp;|&nbsp;
                <strong>Location:</strong> {s.location_name ?? "—"}
              </p>

              <p style={{ margin: "6px 0" }}>
                <strong>Total integration:</strong> {fmtHMS(s.total_integration_sec)}
              </p>

              {s.notes ? <p style={{ margin: "6px 0" }}>{s.notes}</p> : null}

              {sruns.map((r) => {
                const rlines = linesByRun.get(r.image_run_id) ?? [];
                return (
                  <div
                    key={r.image_run_id}
                    style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #ddd" }}
                  >
                    <h3 style={{ margin: "0 0 6px" }}>
                      {r.run_date} — {r.panel_name}
                    </h3>

                    <p style={{ margin: "6px 0" }}>
                      <strong>Panel integration:</strong> {fmtHMS(r.total_panel_sec)}
                    </p>

                    {rlines.length ? (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr>
                              {["Filter", "Exposures", "Exposure (sec)", "Filter Total"].map((h) => (
                                <th key={h} style={{ textAlign: "left", padding: 6, borderBottom: "1px solid #eee" }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rlines.map((l) => (
                              <tr key={l.run_filter_id}>
                                <td style={{ padding: 6, borderBottom: "1px solid #f3f3f3" }}>
                                  {l.filter?.name ?? "—"}
                                </td>
                                <td style={{ padding: 6, borderBottom: "1px solid #f3f3f3" }}>{l.exposures}</td>
                                <td style={{ padding: 6, borderBottom: "1px solid #f3f3f3" }}>{l.exposure_sec}</td>
                                <td style={{ padding: 6, borderBottom: "1px solid #f3f3f3" }}>
                                  {fmtHMS(l.exposures * l.exposure_sec)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p>No filter lines.</p>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })
      )}
    </main>
  );
}
