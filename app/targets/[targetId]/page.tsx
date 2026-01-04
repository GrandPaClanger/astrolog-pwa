"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Session = {
  session_id: number;
  session_date: string | null;
  notes: string | null;
  telescope_name?: string | null;
};

type ImageRun = {
  image_run_id: number;
  session_id: number;
  session_date: string | null;
  panel_name: string | null;
  notes: string | null;
};

type Target = {
  target_id: number;
  catalog_no: string;
  description: string | null;
};

export default function TargetDetailPage() {
  const { targetId } = useParams<{ targetId: string }>();
  const tid = Number(targetId);
  const router = useRouter();

  const [target, setTarget] = useState<Target | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [runs, setRuns] = useState<ImageRun[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
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
    setTarget(t.data as Target);

    const s = await supabase
      .from("session")
      .select("session_id,session_date,notes")
      .eq("target_id", tid)
      .order("session_date", { ascending: false, nullsFirst: false });

    if (s.error) alert(s.error.message);
    setSessions((s.data as any) ?? []);

    const sessIds = ((s.data as any) ?? []).map((x: any) => x.session_id);
    if (sessIds.length) {
      const r = await supabase
        .from("image_run")
        .select("image_run_id,session_id,session_date,panel_name,notes")
        .in("session_id", sessIds)
        .order("session_date", { ascending: false, nullsFirst: false });

      if (r.error) alert(r.error.message);
      setRuns((r.data as any) ?? []);
    } else {
      setRuns([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tid]);

  async function deleteTarget() {
    if (!target) return;
    const ok = confirm(`Delete target "${target.catalog_no}" AND all sessions/runs?`);
    if (!ok) return;

    const { error } = await supabase.from("target").delete().eq("target_id", tid);
    if (error) return alert(error.message);

    router.push("/targets");
  }

  async function deleteSession(sessionId: number) {
    const ok = confirm(`Delete this session AND all its image runs?`);
    if (!ok) return;

    const { error } = await supabase.from("session").delete().eq("session_id", sessionId);
    if (error) return alert(error.message);

    await load();
  }

  async function deleteRun(runId: number) {
    const ok = confirm(`Delete this image run?`);
    if (!ok) return;

    const { error } = await supabase.from("image_run").delete().eq("image_run_id", runId);
    if (error) return alert(error.message);

    await load();
  }

  if (loading) return <main style={{ padding: 16 }}>Loading…</main>;
  if (!target) return <main style={{ padding: 16 }}>Not found</main>;

  return (
    <main style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>{target.catalog_no}</h1>
          <div style={{ opacity: 0.8 }}>{target.description ?? ""}</div>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => router.push(`/targets/${tid}/edit`)}>Edit Target</button>
          <button onClick={deleteTarget}>Delete Target</button>
          <button onClick={() => router.push(`/sessions/new?target_id=${tid}`)}>New Session</button>
        </div>
      </div>

      <h2 style={{ marginTop: 18 }}>Sessions</h2>

      {!sessions.length && <p>No sessions yet.</p>}

      {sessions.map((s) => {
        const sessionRuns = runs.filter((r) => r.session_id === s.session_id);

        return (
          <div key={s.session_id} style={{ border: "1px solid #222", borderRadius: 10, padding: 12, marginTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  Session #{s.session_id} {s.session_date ? `— ${s.session_date}` : ""}
                </div>
                {s.notes && <div style={{ opacity: 0.85, marginTop: 4 }}>{s.notes}</div>}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => router.push(`/sessions/edit?session_id=${s.session_id}`)}>
                  Edit Session
                </button>
                <button onClick={() => router.push(`/sessions/new?target_id=${tid}&session_id=${s.session_id}`)}>
                  Add Image Run
                </button>
                <button onClick={() => deleteSession(s.session_id)}>
                  Delete Session
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <b>Image runs</b>
              {!sessionRuns.length && <div style={{ opacity: 0.8, marginTop: 6 }}>None yet.</div>}

              {sessionRuns.map((r) => (
                <div
                  key={r.image_run_id}
                  style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8, paddingTop: 8, borderTop: "1px solid #222" }}
                >
                  <div>
                    <div>
                      {r.session_date ?? ""} {r.panel_name ? `— ${r.panel_name}` : ""}
                    </div>
                    {r.notes && <div style={{ opacity: 0.85 }}>{r.notes}</div>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => router.push(`/image-runs/edit?image_run_id=${r.image_run_id}`)}>
                      Edit Run
                    </button>
                    <button onClick={() => deleteRun(r.image_run_id)}>
                      Delete Run
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </main>
  );
}
