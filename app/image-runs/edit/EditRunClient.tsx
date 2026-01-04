"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type RunRow = {
  image_run_id: number;
  session_id: number;
  run_date: string | null;
  panel_no: number | null;
  panel_name: string | null;
  notes: string | null;
};

export default function EditRunClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const runId = Number(sp.get("image_run_id") || 0);

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<RunRow | null>(null);
  const [targetId, setTargetId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (!runId) return;

      const r = await supabase
        .from("image_run")
        .select("image_run_id,session_id,run_date,panel_no,panel_name,notes")
        .eq("image_run_id", runId)
        .single();

      if (r.error) {
        alert(r.error.message);
        setLoading(false);
        return;
      }
      const rr = r.data as RunRow;
      setRow(rr);

      // get target_id via session
      const s = await supabase
        .from("session")
        .select("target_id")
        .eq("session_id", rr.session_id)
        .single();

      if (!s.error) setTargetId((s.data as any).target_id);

      setLoading(false);
    })();
  }, [runId]);

  async function save() {
    if (!row) return;

    const { error } = await supabase
      .from("image_run")
      .update({
        run_date: row.run_date,
        panel_no: row.panel_no,
        panel_name: row.panel_name,
        notes: row.notes,
      })
      .eq("image_run_id", row.image_run_id);

    if (error) return alert(error.message);

    if (targetId) router.push(`/targets/${targetId}`);
    else router.back();
    router.refresh();
  }

  if (loading) return <div>Loading…</div>;
  if (!row) return <div>Not found</div>;

  return (
    <>
      <h1>Edit Image Run #{row.image_run_id}</h1>

      <label>Run date</label>
      <input
        value={row.run_date ?? ""}
        onChange={(e) => setRow({ ...row, run_date: e.target.value || null })}
        placeholder="YYYY-MM-DD"
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <label>Panel no</label>
      <input
        type="number"
        value={row.panel_no ?? ""}
        onChange={(e) =>
          setRow({ ...row, panel_no: e.target.value === "" ? null : Number(e.target.value) })
        }
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <label>Panel name</label>
      <input
        value={row.panel_name ?? ""}
        onChange={(e) => setRow({ ...row, panel_name: e.target.value || null })}
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <label>Notes</label>
      <textarea
        value={row.notes ?? ""}
        onChange={(e) => setRow({ ...row, notes: e.target.value || null })}
        rows={6}
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save}>Save</button>
        <button onClick={() => router.back()}>Cancel</button>
      </div>
    </>
  );
}
