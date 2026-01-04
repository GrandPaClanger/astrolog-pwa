"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type TargetAny = Record<string, any>;

export default function EditTargetPage() {
  const { targetId } = useParams<{ targetId: string }>();
  const tid = Number(targetId);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<TargetAny | null>(null);

  const hasNotes = row && Object.prototype.hasOwnProperty.call(row, "notes");

  useEffect(() => {
    (async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from("target")
        .select("*")
        .eq("target_id", tid)
        .single();

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      setRow(data as TargetAny);
      setLoading(false);
    })();
  }, [tid]);

  async function onSave() {
    if (!row) return;

    const patch: Record<string, any> = {
      catalog_no: (row.catalog_no ?? "").trim(),
      description: row.description ?? null,
    };

    // only send notes if the column actually exists in this DB
    if (hasNotes) patch.notes = row.notes ?? null;

    if (!patch.catalog_no) return alert("Catalog No is required.");

    setSaving(true);

    const { error } = await supabase.from("target").update(patch).eq("target_id", tid);

    setSaving(false);
    if (error) return alert(error.message);

    router.push(`/targets/${tid}`);
    router.refresh();
  }

  if (loading) return <main style={{ padding: 16 }}>Loading…</main>;
  if (!row) return <main style={{ padding: 16 }}>Not found</main>;

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0 }}>Edit Target</h1>

      {/* Grid layout: 2 columns, then notes full width */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1fr) minmax(300px, 2fr)",
          gap: 14,
          alignItems: "start",
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Catalog No</label>
          <input
            value={row.catalog_no ?? ""}
            onChange={(e) => setRow({ ...row, catalog_no: e.target.value })}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: 6 }}>Description</label>
          <input
            value={row.description ?? ""}
            onChange={(e) => setRow({ ...row, description: e.target.value || null })}
            style={{ width: "100%", padding: 10 }}
          />
        </div>

        {hasNotes && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", marginBottom: 6 }}>Notes</label>
            <textarea
              value={row.notes ?? ""}
              onChange={(e) => setRow({ ...row, notes: e.target.value || null })}
              rows={6}
              style={{ width: "100%", padding: 10 }}
            />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button onClick={onSave} disabled={saving} style={{ padding: "8px 12px" }}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button onClick={() => router.back()} disabled={saving} style={{ padding: "8px 12px" }}>
          Cancel
        </button>
      </div>
    </main>
  );
}
