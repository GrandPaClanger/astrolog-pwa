"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Target = { target_id: number; catalog_no: string; description: string | null };
type Telescope = { telescope_id: number; name: string };
type FilterOpt = { filter_id: number; name: string };

type FilterLine = {
  filter_id: number | null;
  exposures: number;
  exposure_sec: number;
  gain: number | null;
  camera_offset: number | null;
  bin: number | null;
  notes: string | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Display only (keep DB as ISO)
function formatUkDate(iso: string | null | undefined) {
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

export default function NewSessionPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const targetIdParam = Number(sp.get("target_id") || 0);
  const existingSessionId = sp.get("session_id") ? Number(sp.get("session_id")) : null;

  const [targets, setTargets] = useState<Target[]>([]);
  const [telescopes, setTelescopes] = useState<Telescope[]>([]);
  const [filters, setFilters] = useState<FilterOpt[]>([]);

  const [targetId, setTargetId] = useState<number>(targetIdParam || 0);

  // New session header fields (only used when creating a new session)
  const [sessionDate, setSessionDate] = useState<string>(todayIso());
  const [telescopeId, setTelescopeId] = useState<number | null>(null);
  const [sessionNotes, setSessionNotes] = useState<string>("");

  // Image run fields (always used)
  const [runDate, setRunDate] = useState<string>(todayIso());
  const [panelNo, setPanelNo] = useState<number | null>(1);
  const [panelName, setPanelName] = useState<string>("Panel 1");
  const [runNotes, setRunNotes] = useState<string>("");

  const [lines, setLines] = useState<FilterLine[]>([
    { filter_id: null, exposures: 10, exposure_sec: 180, gain: null, camera_offset: null, bin: null, notes: null },
  ]);

  useEffect(() => {
    (async () => {
      const [t, tel, f] = await Promise.all([
        supabase.from("target").select("target_id,catalog_no,description").order("catalog_no"),
        supabase.from("telescope").select("telescope_id,name").order("name"),
        supabase.from("filter").select("filter_id,name").order("name"),
      ]);

      if (!t.error) setTargets((t.data as any) ?? []);
      if (!tel.error) setTelescopes((tel.data as any) ?? []);
      if (!f.error) setFilters((f.data as any) ?? []);

      // If adding run to an existing session, load its target_id (so we always navigate back correctly)
      if (existingSessionId) {
        const s = await supabase.from("session").select("target_id,session_date").eq("session_id", existingSessionId).single();
        if (!s.error) {
          const sid = (s.data as any).target_id as number;
          setTargetId(sid);
          const sd = (s.data as any).session_date as string | null;
          if (sd) {
            // sensible default: run date follows the session date
            setRunDate(sd);
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSec = useMemo(
    () => lines.reduce((sum, l) => sum + Number(l.exposures || 0) * Number(l.exposure_sec || 0), 0),
    [lines]
  );

  function addLineCopyPrev() {
    setLines((prev) => {
      const last = prev[prev.length - 1];
      return [...prev, { ...last }];
    });
  }

  function removeLine(idx: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }

  async function save() {
    if (!targetId) return alert("Pick a target.");

    // validate filter lines
    for (const l of lines) {
      if (!l.filter_id) return alert("Each filter line needs a filter selected.");
    }

    let session_id: number;

    if (existingSessionId) {
      session_id = existingSessionId;
    } else {
      const ins = await supabase
        .from("session")
        .insert({
          target_id: targetId,
          session_date: sessionDate || null,
          telescope_id: telescopeId,
          notes: sessionNotes || null,
        })
        .select("session_id")
        .single();

      if (ins.error) return alert(ins.error.message);
      session_id = (ins.data as any).session_id;
    }

    const runIns = await supabase
      .from("image_run")
      .insert({
        session_id,
        run_date: runDate || null,
        panel_no: panelNo,
        panel_name: panelName || null,
        notes: runNotes || null,
      })
      .select("image_run_id")
      .single();

    if (runIns.error) return alert(runIns.error.message);
    const image_run_id = (runIns.data as any).image_run_id;

    const payload = lines.map((l) => ({
      image_run_id,
      filter_id: l.filter_id,
      exposures: Number(l.exposures || 0),
      exposure_sec: Number(l.exposure_sec || 0),
      gain: l.gain,
      camera_offset: l.camera_offset,
      bin: l.bin,
      notes: l.notes,
    }));

    const rf = await supabase.from("run_filter").insert(payload);
    if (rf.error) return alert(rf.error.message);

    router.push(`/targets/${targetId}`);
    router.refresh();
  }

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1>{existingSessionId ? "Add Image Run" : "New Session"}</h1>

      <label>Target</label>
      <select
        value={targetId}
        disabled={!!existingSessionId}
        onChange={(e) => setTargetId(Number(e.target.value))}
        style={{ width: "100%", margin: "6px 0 12px" }}
      >
        <option value={0}>Select…</option>
        {targets.map((t) => (
          <option key={t.target_id} value={t.target_id}>
            {t.catalog_no} {t.description ? `— ${t.description}` : ""}
          </option>
        ))}
      </select>

      {!existingSessionId && (
        <>
          <label>Session date</label>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={{ width: "100%", margin: "6px 0 4px" }}
          />
          <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 12 }}>
            {formatUkDate(sessionDate)}
          </div>

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
          <textarea
            value={sessionNotes}
            onChange={(e) => setSessionNotes(e.target.value)}
            rows={3}
            style={{ width: "100%", margin: "6px 0 12px" }}
          />
        </>
      )}

      <h2>Image Run</h2>

      <label>Run date</label>
      <input
        type="date"
        value={runDate}
        onChange={(e) => setRunDate(e.target.value)}
        style={{ width: "100%", margin: "6px 0 4px" }}
      />
      <div style={{ opacity: 0.75, fontSize: 12, marginBottom: 12 }}>
        {formatUkDate(runDate)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12 }}>
        <div>
          <label>Panel no</label>
          <input
            type="number"
            value={panelNo ?? ""}
            onChange={(e) => setPanelNo(e.target.value === "" ? null : Number(e.target.value))}
            style={{ width: "100%", margin: "6px 0 12px" }}
          />
        </div>
        <div>
          <label>Panel name</label>
          <input
            value={panelName}
            onChange={(e) => setPanelName(e.target.value)}
            style={{ width: "100%", margin: "6px 0 12px" }}
          />
        </div>
      </div>

      <label>Run Notes</label>
      <textarea
        value={runNotes}
        onChange={(e) => setRunNotes(e.target.value)}
        rows={3}
        style={{ width: "100%", margin: "6px 0 12px" }}
      />

      <h2>Filters</h2>
      <div style={{ margin: "6px 0 10px", opacity: 0.85 }}>
        Total integration: <b>{fmtHMS(totalSec)}</b>
      </div>

      <div style={{ overflowX: "auto" }}>
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <tr key={idx}>
                <td>
                  <select
                    value={l.filter_id ?? ""}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : null;
                      setLines((p) => p.map((x, i) => (i === idx ? { ...x, filter_id: v } : x)));
                    }}
                  >
                    <option value="">—</option>
                    {filters.map((f) => (
                      <option key={f.filter_id} value={f.filter_id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td>
                  <input
                    type="number"
                    value={l.exposures}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLines((p) => p.map((x, i) => (i === idx ? { ...x, exposures: v } : x)));
                    }}
                    style={{ width: 110 }}
                  />
                </td>

                <td>
                  <input
                    type="number"
                    value={l.exposure_sec}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLines((p) => p.map((x, i) => (i === idx ? { ...x, exposure_sec: v } : x)));
                    }}
                    style={{ width: 130 }}
                  />
                </td>

                <td>
                  <input
                    type="number"
                    value={l.gain ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setLines((p) => p.map((x, i) => (i === idx ? { ...x, gain: v } : x)));
                    }}
                    style={{ width: 72 }}
                  />
                </td>

                <td>
                  <input
                    type="number"
                    value={l.camera_offset ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setLines((p) => p.map((x, i) => (i === idx ? { ...x, camera_offset: v } : x)));
                    }}
                    style={{ width: 72 }}
                  />
                </td>

                <td>
                  <input
                    type="number"
                    value={l.bin ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      setLines((p) => p.map((x, i) => (i === idx ? { ...x, bin: v } : x)));
                    }}
                    style={{ width: 56 }}
                  />
                </td>

                <td>
                  <input
                    value={l.notes ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((p) => p.map((x, i) => (i === idx ? { ...x, notes: v || null } : x)));
                    }}
                    style={{ width: 220 }}
                  />
                </td>

                <td>
                  <button onClick={() => removeLine(idx)} style={{ padding: "4px 8px" }}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={addLineCopyPrev}>Add filter line</button>
        <button onClick={save}>Save</button>
        <button onClick={() => router.back()}>Cancel</button>
      </div>
    </main>
  );
}
