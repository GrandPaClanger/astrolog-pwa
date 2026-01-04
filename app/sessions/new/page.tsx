"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Target = { target_id: number; catalog_no: string; description: string | null };
type Telescope = { telescope_id: number; name: string };

type FilterLine = {
  filter_name: string;
  exposures: number;
  exposure_sec: number;
  gain: number | null;
  camera_offset: number | null;
  bin: number | null;
  notes: string | null;
};

export default function NewSessionPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const targetIdParam = Number(sp.get("target_id") || 0);
  const existingSessionId = sp.get("session_id") ? Number(sp.get("session_id")) : null;

  const [targets, setTargets] = useState<Target[]>([]);
  const [telescopes, setTelescopes] = useState<Telescope[]>([]);

  const [targetId, setTargetId] = useState<number>(targetIdParam || 0);

  // Session header fields (only used when creating a new session)
  const [telescopeId, setTelescopeId] = useState<number | null>(null);
  const [sessionNotes, setSessionNotes] = useState<string>("");

  // Image run fields (always used)
  const [runDate, setRunDate] = useState<string>("");
  const [panelName, setPanelName] = useState<string>("Panel 1");
  const [runNotes, setRunNotes] = useState<string>("");

  const [lines, setLines] = useState<FilterLine[]>([
    { filter_name: "H", exposures: 10, exposure_sec: 180, gain: null, camera_offset: null, bin: null, notes: null },
  ]);

  useEffect(() => {
    (async () => {
      const t = await supabase.from("target").select("target_id,catalog_no,description").order("catalog_no");
      if (!t.error) setTargets((t.data as any) ?? []);

      const tel = await supabase.from("telescope").select("telescope_id,name").order("name");
      if (!tel.error) setTelescopes((tel.data as any) ?? []);
    })();
  }, []);

  function addLineCopyPrev() {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, { ...last }];
    });
  }

  async function save() {
    if (!targetId) return alert("Pick a target.");

    let session_id: number;

    if (existingSessionId) {
      // ADD IMAGE RUN to existing session
      session_id = existingSessionId;
    } else {
      // CREATE NEW session header
      const ins = await supabase
        .from("session")
        .insert({
          target_id: targetId,
          telescope_id: telescopeId,
          notes: sessionNotes || null,
          session_start: runDate ? `${runDate}T00:00:00` : null,
        })
        .select("session_id")
        .single();

      if (ins.error) return alert(ins.error.message);
      session_id = (ins.data as any).session_id;
    }

    // Create image run
    const runIns = await supabase
      .from("image_run")
      .insert({
        session_id,
        session_date: runDate || null,
        panel_name: panelName || null,
        notes: runNotes || null,
      })
      .select("image_run_id")
      .single();

    if (runIns.error) return alert(runIns.error.message);
    const image_run_id = (runIns.data as any).image_run_id;

    // Insert filter lines
    const payload = lines.map((l) => ({
      image_run_id,
      filter_name: l.filter_name,
      exposures: l.exposures,
      exposure_sec: l.exposure_sec,
      gain: l.gain,
      camera_offset: l.camera_offset,
      bin: l.bin,
      notes: l.notes,
    }));

    const f = await supabase.from("run_filter").insert(payload);
    if (f.error) return alert(f.error.message);

    router.push(`/targets/${targetId}`);
    router.refresh();
  }

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1>{existingSessionId ? "Add Image Run" : "New Session"}</h1>

      <label>Target</label>
      <select value={targetId} onChange={(e) => setTargetId(Number(e.target.value))} style={{ width: "100%", margin: "6px 0 12px" }}>
        <option value={0}>Select…</option>
        {targets.map((t) => (
          <option key={t.target_id} value={t.target_id}>
            {t.catalog_no}
          </option>
        ))}
      </select>

      {!existingSessionId && (
        <>
          <label>Telescope</label>
          <select
            value={telescopeId ?? ""}
            onChange={(e) => setTelescopeId(e.target.value ? Number(e.target.value) : null)}
            style={{ width: "100%", margin: "6px 0 12px" }}
          >
            <option value="">Select…</option>
            {telescopes.map((t) => (
              <option key={t.telescope_id} value={t.telescope_id}>
                {t.name}
              </option>
            ))}
          </select>

          <label>Session Notes</label>
          <textarea value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} rows={3} style={{ width: "100%", margin: "6px 0 12px" }} />
        </>
      )}

      <h2>Image Run</h2>

      <label>Date</label>
      <input value={runDate} onChange={(e) => setRunDate(e.target.value)} placeholder="YYYY-MM-DD" style={{ width: "100%", margin: "6px 0 12px" }} />

      <label>Panel</label>
      <input value={panelName} onChange={(e) => setPanelName(e.target.value)} style={{ width: "100%", margin: "6px 0 12px" }} />

      <label>Run Notes</label>
      <textarea value={runNotes} onChange={(e) => setRunNotes(e.target.value)} rows={3} style={{ width: "100%", margin: "6px 0 12px" }} />

      <h2>Filters</h2>
      <table>
        <thead>
          <tr>
            <th>Filter</th>
            <th>Exposures</th>
            <th>Exposure (sec)</th>
            <th>Gain</th>
            <th>Offset</th>
            <th>Bin</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, idx) => (
            <tr key={idx}>
              <td><input value={l.filter_name} onChange={(e) => {
                const v = e.target.value;
                setLines(p => p.map((x,i)=> i===idx ? { ...x, filter_name: v } : x));
              }} /></td>
              <td><input type="number" value={l.exposures} onChange={(e) => {
                const v = Number(e.target.value);
                setLines(p => p.map((x,i)=> i===idx ? { ...x, exposures: v } : x));
              }} /></td>
              <td><input type="number" value={l.exposure_sec} onChange={(e) => {
                const v = Number(e.target.value);
                setLines(p => p.map((x,i)=> i===idx ? { ...x, exposure_sec: v } : x));
              }} /></td>
              <td><input type="number" value={l.gain ?? ""} onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                setLines(p => p.map((x,i)=> i===idx ? { ...x, gain: v } : x));
              }} /></td>
              <td><input type="number" value={l.camera_offset ?? ""} onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                setLines(p => p.map((x,i)=> i===idx ? { ...x, camera_offset: v } : x));
              }} /></td>
              <td><input type="number" value={l.bin ?? ""} onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                setLines(p => p.map((x,i)=> i===idx ? { ...x, bin: v } : x));
              }} /></td>
              <td><input value={l.notes ?? ""} onChange={(e) => {
                const v = e.target.value;
                setLines(p => p.map((x,i)=> i===idx ? { ...x, notes: v || null } : x));
              }} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={addLineCopyPrev}>Add filter line</button>
        <button onClick={save}>Save</button>
        <button onClick={() => router.back()}>Cancel</button>
      </div>
    </main>
  );
}
