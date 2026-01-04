"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type TargetRow = {
  target_id: number;
  catalog_no: string;
  description: string | null;
};

type SessionRow = {
  session_id: number;
  session_date: string | null;
  notes: string | null;
  telescope_id: number | null;
  mount_id: number | null;
  camera_id: number | null;
  location_id: number | null;
  telescope?: { name: string } | null;
  mount?: { name: string } | null;
  camera?: { name: string } | null;
  location?: { name: string } | null;
};

type ImageRunRow = {
  image_run_id: number;
  session_id: number;
  run_date: string | null;
  panel_no: number | null;
  panel_name: string | null;
};

type RunFilterRow = {
  image_run_id: number;
  exposures: number | null;
  exposure_sec: number | null;
};

function ukDate(iso: string | null | undefined) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC" }).format(dt); // DD/MM/YYYY
}

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
  const tid = Number(targetId);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<TargetRow | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [runs, setRuns] = useState<ImageRunRow[]>([]);
  const [runFilters, setRunFilters] = useState<RunFilterRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);

      const t = await supabase
        .from("target")
        .select("target_id,catalog_no,description")
        .eq("target_id", tid)
        .single();

      if (t.error) {
        alert(t.error.message);
        setLoading(false);
        return;
      }
      setTarget(t.data as any);

      const s = await supabase
        .from("session")
        .select(
          `
          session_id,
          session_date,
          notes,
          telescope_id,
          mount_id,
          camera_id,
          location_id,
          telescope:telescope_id ( name ),
          mount:mount_id ( name ),
          camera:camera_id ( name ),
          location:location_id ( name )
        `
        )
        .eq("target_id", tid)
        .order("session_date", { ascending: false });

      if (s.error) {
        alert(s.error.message);
        setLoading(false);
        return;
      }

      const sess = ((s.data as any) ?? []) as SessionRow[];
      setSessions(sess);

      const sessionIds = sess.map((x) => x.session_id);
      if (sessionIds.length === 0) {
        setRuns([]);
        setRunFilters([]);
        setLoading(false);
        return;
      }

      const r = await supabase
        .from("image_run")
        .select("image_run_id,session_id,run_date,panel_no,panel_name")
        .in("session_id", sessionIds)
        .order("run_date", { ascending: false })
        .order("image_run_id", { ascending: false });

      if (r.error) {
        alert(r.error.message);
        setLoading(false);
        return;
      }

      const runRows = ((r.data as any) ?? []) as ImageRunRow[];
      setRuns(runRows);

      const runIds = runRows.map((x) => x.image_run_id);
      if (runIds.length === 0) {
        setRunFilters([]);
        setLoading(false);
        return;
      }

      const rf = await supabase
        .from("run_filter")
        .select("image_run_id,exposures,exposure_sec")
        .in("image_run_id", runIds);

      if (rf.error) {
        alert(rf.error.message);
        setLoading(false);
        return;
      }

      setRunFilters(((rf.data as any) ?? []) as RunFilterRow[]);
      setLoading(false);
    })();
  }, [tid]);

  const runIntegrationSec = useMemo(() => {
    const m = new Map<number, number>();
    for (const rf of runFilters) {
      const id = rf.image_run_id;
      const sec = Number(rf.exposures ?? 0) * Number(rf.exposure_sec ?? 0);
      m.set(id, (m.get(id) ?? 0) + sec);
    }
    return m;
  }, [runFilters]);

  const sessionIntegrationSec = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of runs) {
      const sec = runIntegrationSec.get(r.image_run_id) ?? 0;
      m.set(r.session_id, (m.get(r.session_id) ?? 0) + sec);
    }
    return m;
  }, [runs, runIntegrationSec]);

  const totalAllSessionsSec = useMemo(() => {
    let sum = 0;
    for (const s of sessions) sum += sessionIntegrationSec.get(s.session_id) ?? 0;
    return sum;
  }, [sessions, sessionIntegrationSec]);

  async function onDeleteTarget() {
    if (!target) return;
    const ok = confirm(`Delete target "${target.catalog_no}" AND all its sessions/runs?`);
    if (!ok) return;

    const { error } = await supabase.from("target").delete().eq("target_id", target.target_id);
    if (error) return alert(error.message);

    router.push("/targets");
    router.refresh();
  }

  async function onDeleteSession(sessionId: number) {
    const ok = confirm(`Delete session #${sessionId} AND its image runs?`);
    if (!ok) return;

    const { error } = await supabase.from("session").delete().eq("session_id", sessionId);
    if (error) return alert(error.message);

    router.refresh();
  }

  async function onDeleteRun(imageRunId: number) {
    const ok = confirm(`Delete image run #${imageRunId}?`);
    if (!ok) return;

    const { error } = await supabase.from("image_run").delete().eq("image_run_id", imageRunId);
    if (error) return alert(error.message);

    router.refresh();
  }

  if (loading) return <main style={{ padding: 16 }}>Loading…</main>;
  if (!target) return <main style={{ padding: 16 }}>Not found</main>;

  const runsBySession = new Map<number, ImageRunRow[]>();
  for (const r of runs) {
    const arr = runsBySession.get(r.session_id) ?? [];
    arr.push(r);
    runsBySession.set(r.session_id, arr);
  }

  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start" }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>{target.catalog_no}</h1>
          {target.description && <div style={{ opacity: 0.85, marginBottom: 10 }}>{target.description}</div>}
          <div style={{ opacity: 0.85 }}>
            Total integration (all sessions): <b>{fmtHMS(totalAllSessionsSec)}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => router.push(`/targets/${tid}/edit`)}>Edit Target</button>
          <button onClick={onDeleteTarget}>Delete Target</button>
          <button onClick={() => router.push(`/sessions/new?target_id=${tid}`)}>New Session</button>
        </div>
      </div>

      <h2 style={{ marginTop: 22 }}>Sessions</h2>

      {sessions.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No sessions yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sessions.map((s) => {
            const sessionSec = sessionIntegrationSec.get(s.session_id) ?? 0;
            const theseRuns = runsBySession.get(s.session_id) ?? [];

            return (
              <div
                key={s.session_id}
                style={{
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      Session #{s.session_id} — {ukDate(s.session_date)}
                    </div>

                    <div style={{ opacity: 0.85, marginTop: 6 }}>
                      Total integration: <b>{fmtHMS(sessionSec)}</b>
                    </div>

                    <div style={{ opacity: 0.85, marginTop: 6 }}>
                      {s.telescope?.name ? `Telescope: ${s.telescope.name}` : ""}
                      {s.mount?.name ? ` | Mount: ${s.mount.name}` : ""}
                      {s.camera?.name ? ` | Camera: ${s.camera.name}` : ""}
                      {s.location?.name ? ` | Location: ${s.location.name}` : ""}
                    </div>

                    {s.notes && <div style={{ marginTop: 8, opacity: 0.9 }}>{s.notes}</div>}
                  </div>

                  <div style={{ display: "flex", gap: 10, height: "fit-content" }}>
                    <button onClick={() => router.push(`/sessions/edit?session_id=${s.session_id}`)}>Edit Session</button>
                    <button onClick={() => router.push(`/sessions/new?session_id=${s.session_id}`)}>Add Image Run</button>
                    <button onClick={() => onDeleteSession(s.session_id)}>Delete Session</button>
                  </div>
                </div>

                <div style={{ marginTop: 10, opacity: 0.9, fontWeight: 600 }}>Image runs</div>

                {theseRuns.length === 0 ? (
                  <div style={{ opacity: 0.75, marginTop: 6 }}>No runs yet.</div>
                ) : (
                  <div style={{ marginTop: 6 }}>
                    {theseRuns.map((r) => (
                      <div
                        key={r.image_run_id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 12,
                          padding: "8px 0",
                          borderTop: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <div>
                          {ukDate(r.run_date)} — Panel {r.panel_no ?? "—"} — {r.panel_name ?? ""}
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                          <button onClick={() => router.push(`/image-runs/edit?image_run_id=${r.image_run_id}`)}>
                            Edit Run
                          </button>
                          <button onClick={() => onDeleteRun(r.image_run_id)}>Delete Run</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
