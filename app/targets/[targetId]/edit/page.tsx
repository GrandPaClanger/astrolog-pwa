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

  if (loading) return <div className="page-wrapper">Loading…</div>;
  if (!row) return <div className="page-wrapper">Not found</div>;

  return (
    <div className="page-wrapper max-w-3xl">
      <h1>Edit Target</h1>

      {/* Grid layout: 2 columns, then notes full width */}
      <div
        className="grid gap-4 mb-4"
        style={{ gridTemplateColumns: "minmax(220px, 1fr) minmax(300px, 2fr)" }}
      >
        <div>
          <label>Catalog No</label>
          <input
            className="input w-full"
            value={row.catalog_no ?? ""}
            onChange={(e) => setRow({ ...row, catalog_no: e.target.value })}
          />
        </div>

        <div>
          <label>Description</label>
          <input
            className="input w-full"
            value={row.description ?? ""}
            onChange={(e) => setRow({ ...row, description: e.target.value || null })}
          />
        </div>

        {hasNotes && (
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Notes</label>
            <textarea
              className="input"
              value={row.notes ?? ""}
              onChange={(e) => setRow({ ...row, notes: e.target.value || null })}
              rows={6}
            />
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <button className="btn-primary" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn-ghost" onClick={() => router.back()} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
