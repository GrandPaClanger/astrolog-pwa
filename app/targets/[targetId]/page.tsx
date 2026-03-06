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

  // image_run_id -> seconds
  const runIntegrationSec = useMemo(() => {
    const m = new Map<number, number>();
    for (const rf of runFilters) {
      const id = rf.image_run_id;
      const sec = Number(rf.exposures ?? 0) * Number(rf.exposure_sec ?? 0);
      m.set(id, (m.get(id) ?? 0) + sec);
    }
    return m;
  }, [runFilters]);

  // session_id -> seconds
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

  if (loading) return <div className="page-wrapper">Loading…</div>;
  if (!target) return <div className="page-wrapper">Not found</div>;

  const runsBySession = new Map<number, ImageRunRow[]>();
  for (const r of runs) {
    const arr = runsBySession.get(r.session_id) ?? [];
    arr.push(r);
    runsBySession.set(r.session_id, arr);
  }

  return (
    <div className="page-wrapper">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1>{target.catalog_no}</h1>
          {target.description && <p className="text-slate-400 mt-1">{target.description}</p>}
          <p className="text-slate-300 mt-1">
            Total integration (all sessions): <span className="font-semibold text-slate-100">{fmtHMS(totalAllSessionsSec)}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => router.push("/targets")}>Home</button>
          <button className="btn-secondary" onClick={() => router.push(`/targets/${tid}/edit`)}>Edit Target</button>
          <button className="btn-danger" onClick={onDeleteTarget}>Delete Target</button>
          <button className="btn-secondary" onClick={() => router.push(`/sessions/new?target_id=${tid}`)}>New Session</button>
        </div>
      </div>

      <h2>Sessions</h2>

      {sessions.length === 0 ? (
        <div className="text-slate-400">No sessions yet.</div>
      ) : (
        <div className="flex flex-col gap-4">
          {sessions.map((s) => {
            const sessionSec = sessionIntegrationSec.get(s.session_id) ?? 0;
            const theseRuns = runsBySession.get(s.session_id) ?? [];

            return (
              <div key={s.session_id} className="card mb-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="font-semibold text-slate-100">
                      Session #{s.session_id} — {ukDate(s.session_date)}
                    </div>

                    <div className="text-sm text-slate-400 mt-1 space-y-0.5">
                      <div>Total integration: <span className="font-semibold text-slate-100">{fmtHMS(sessionSec)}</span></div>
                      <div>
                        {s.telescope?.name ? `Telescope: ${s.telescope.name}` : ""}
                        {s.mount?.name ? ` | Mount: ${s.mount.name}` : ""}
                        {s.camera?.name ? ` | Camera: ${s.camera.name}` : ""}
                        {s.location?.name ? ` | Location: ${s.location.name}` : ""}
                      </div>
                    </div>

                    {s.notes && <div className="text-sm text-slate-300 mt-2 italic">{s.notes}</div>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => router.push(`/sessions/edit?session_id=${s.session_id}`)}>Edit Session</button>
                    <button className="btn-secondary" onClick={() => router.push(`/sessions/new?session_id=${s.session_id}`)}>Add Image Run</button>
                    <button className="btn-danger" onClick={() => onDeleteSession(s.session_id)}>Delete Session</button>
                  </div>
                </div>

                <div className="font-semibold text-slate-300 text-sm mb-1">Image runs</div>

                {theseRuns.length === 0 ? (
                  <div className="text-slate-400 text-sm">No runs yet.</div>
                ) : (
                  <div>
                    {theseRuns.map((r) => {
                      const runSec = runIntegrationSec.get(r.image_run_id) ?? 0;

                      return (
                        <div
                          key={r.image_run_id}
                          className="flex justify-between items-center py-2 border-t border-slate-700/50"
                        >
                          <div className="flex gap-3 flex-wrap text-sm text-slate-300">
                            <div>
                              {ukDate(r.run_date)} — Panel {r.panel_no ?? "—"} — {r.panel_name ?? ""}
                            </div>
                            <div>
                              Integration: <span className="font-semibold text-slate-100">{fmtHMS(runSec)}</span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button className="btn-secondary" onClick={() => router.push(`/image-runs/edit?image_run_id=${r.image_run_id}`)}>
                              Edit Run
                            </button>
                            <button className="btn-danger" onClick={() => onDeleteRun(r.image_run_id)}>Delete Run</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
