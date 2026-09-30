"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ObjectCatalogSearch from "@/app/components/ObjectCatalogSearch";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type FutureTarget = {
  future_target_id: number;
  catalog_no: string;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type FutureTargetForm = {
  catalog_no: string;
  description: string;
  notes: string;
};

const EMPTY_FORM: FutureTargetForm = {
  catalog_no: "",
  description: "",
  notes: "",
};

function todayIso() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ukDate(iso: string | null | undefined) {
  if (!iso) return "";
  const iso10 = iso.includes("T") ? iso.slice(0, 10) : iso;
  const [y, m, d] = iso10.split("-").map(Number);
  if (!y || !m || !d) return iso10;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC" }).format(dt);
}

function normalizeCatalogNo(value: string) {
  return value.trim().toLowerCase();
}

export default function FutureTargetsPage() {
  const router = useRouter();
  const formRef = useRef<HTMLDivElement | null>(null);

  const [rows, setRows] = useState<FutureTarget[]>([]);
  const [form, setForm] = useState<FutureTargetForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  async function loadTargets() {
    setLoading(true);
    const { data, error } = await supabase
      .from("future_target")
      .select("future_target_id,catalog_no,description,notes,created_at,updated_at")
      .is("session_id", null)
      .order("catalog_no", { ascending: true });

    if (error) {
      alert(error.message);
      setRows([]);
    } else {
      setRows((data as FutureTarget[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTargets();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      return (
        row.catalog_no.toLowerCase().includes(q) ||
        (row.description ?? "").toLowerCase().includes(q) ||
        (row.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  function updateForm(patch: Partial<FutureTargetForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function editTarget(row: FutureTarget) {
    setEditingId(row.future_target_id);
    setForm({
      catalog_no: row.catalog_no,
      description: row.description ?? "",
      notes: row.notes ?? "",
    });
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function payload() {
    const catalogNo = form.catalog_no.trim();
    if (!catalogNo) throw new Error("Catalog number is required.");

    return {
      catalog_no: catalogNo,
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
    };
  }

  async function saveTarget() {
    if (saving) return;

    try {
      const next = payload();
      setSaving(true);

      const query = editingId
        ? supabase.from("future_target").update(next).eq("future_target_id", editingId)
        : supabase.from("future_target").insert(next);

      const { error } = await query;
      if (error) throw new Error(error.message);

      resetForm();
      await loadTargets();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTarget(row: FutureTarget) {
    if (!confirm(`Delete future target "${row.catalog_no}"?`)) return;

    const previous = rows;
    setDeletingId(row.future_target_id);
    setRows((items) => items.filter((item) => item.future_target_id !== row.future_target_id));

    const { error } = await supabase
      .from("future_target")
      .delete()
      .eq("future_target_id", row.future_target_id);

    if (error) {
      setRows(previous);
      alert(error.message);
    }

    if (editingId === row.future_target_id) resetForm();
    setDeletingId(null);
  }

  async function findActualTarget(catalogNo: string) {
    const { data, error } = await supabase
      .from("target")
      .select("target_id")
      .eq("catalog_no_norm", normalizeCatalogNo(catalogNo))
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data ? Number((data as any).target_id) : null;
  }

  async function ensureActualTarget(row: FutureTarget) {
    const existingTargetId = await findActualTarget(row.catalog_no);
    if (existingTargetId) return existingTargetId;

    const { data, error } = await supabase
      .from("target")
      .insert({
        catalog_no: row.catalog_no,
        description: row.description,
        notes: row.notes,
      })
      .select("target_id")
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        const targetIdAfterRace = await findActualTarget(row.catalog_no);
        if (targetIdAfterRace) return targetIdAfterRace;
      }
      throw new Error(error.message);
    }

    return Number((data as any).target_id);
  }

  async function createSession(row: FutureTarget) {
    if (promotingId) return;

    try {
      setPromotingId(row.future_target_id);

      const targetId = await ensureActualTarget(row);
      const { data, error } = await supabase
        .from("session")
        .insert({
          target_id: targetId,
          session_date: todayIso(),
          notes: row.notes,
        })
        .select("session_id")
        .single();

      if (error) throw new Error(error.message);
      const sessionId = Number((data as any).session_id);

      const removal = await supabase
        .from("future_target")
        .delete()
        .eq("future_target_id", row.future_target_id);

      if (removal.error) throw new Error(removal.error.message);

      setRows((items) => items.filter((item) => item.future_target_id !== row.future_target_id));

      router.push(`/sessions/edit?session_id=${sessionId}`);
      router.refresh();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setPromotingId(null);
    }
  }

  function renderRows(title: string, sectionRows: FutureTarget[]) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="m-0">{title}</h2>
          <span className="badge-slate">
            {sectionRows.length} target{sectionRows.length !== 1 ? "s" : ""}
          </span>
        </div>

        {sectionRows.length === 0 ? (
          <p className="text-slate-400 py-2">No targets here yet.</p>
        ) : (
          <div className="grid gap-3">
            {sectionRows.map((row) => (
              <div key={row.future_target_id} className="card">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-lg font-semibold text-blue-300">{row.catalog_no}</div>
                    </div>

                    {row.description && <p className="text-slate-300 mt-1">{row.description}</p>}
                    {row.notes && <p className="text-sm text-slate-400 mt-2 whitespace-pre-wrap">{row.notes}</p>}

                    <div className="flex flex-wrap gap-2 mt-3 text-xs text-slate-500">
                      <span>Added {ukDate(row.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      className="btn-primary"
                      onClick={() => createSession(row)}
                      disabled={promotingId === row.future_target_id}
                    >
                      {promotingId === row.future_target_id ? "Creating..." : "Create Session"}
                    </button>
                    <button className="btn-secondary" onClick={() => editTarget(row)} disabled={saving}>
                      Edit
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => deleteTarget(row)}
                      disabled={deletingId === row.future_target_id}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <h1>Future Targets</h1>
          <p className="text-slate-400">Possible targets to image later, separate from acquired targets.</p>
        </div>
        <Link className="btn-secondary" href="/targets">
          Actual Targets
        </Link>
      </div>

      <div ref={formRef} className="card mb-6" style={{ scrollMarginTop: 72 }}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="m-0">{editingId ? "Edit Future Target" : "Add Future Target"}</h2>
          {editingId && (
            <button className="btn-ghost" onClick={resetForm} disabled={saving}>
              Cancel Edit
            </button>
          )}
        </div>

        <div className="form-field">
          <ObjectCatalogSearch
            valueCatalogNo={form.catalog_no}
            valueDescription={form.description}
            onPick={(item) => updateForm({ catalog_no: item.catalog_no, description: item.description })}
            placeholder="Search object catalog..."
          />
        </div>

        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "minmax(180px, 1fr) minmax(260px, 2fr)" }}>
          <div>
            <label>Catalog Number</label>
            <input
              className="input"
              value={form.catalog_no}
              onChange={(e) => updateForm({ catalog_no: e.target.value })}
              placeholder="M31"
            />
          </div>

          <div>
            <label>Description</label>
            <input
              className="input"
              value={form.description}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder="Andromeda Galaxy"
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label>Notes</label>
            <textarea
              className="input"
              rows={5}
              value={form.notes}
              onChange={(e) => updateForm({ notes: e.target.value })}
              placeholder="Framing ideas, filters, moon phase, season..."
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end">
          <button className="btn-primary" onClick={saveTarget} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save Future Target" : "Add Future Target"}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <input
          className="input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search future targets..."
        />
      </div>

      {loading ? (
        <p className="text-slate-400 py-4">Loading...</p>
      ) : (
        <>
          {renderRows("To Image", filteredRows)}
        </>
      )}
    </div>
  );
}
