"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { DEFAULT_STAR_PARTY_ITEMS } from "@/lib/star-party-defaults";

export const dynamic = "force-dynamic";

type Item = {
  item_id: number;
  name: string;
  category: string;
  sub_category: string | null;
};

type Category = {
  slug: string;
  label: string;
};

type SubCategory = {
  sub_category_id: number;
  category_slug: string;
  name: string;
};

const NEW_SUB = "__new__";

const iStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.35)",
  color: "white",
  fontSize: 16,
  boxSizing: "border-box",
};

const lStyle: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.6,
  marginBottom: 4,
  display: "block",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export default function StarPartyItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("camping");
  const [subCatSelect, setSubCatSelect] = useState("");
  const [subCatNew, setSubCatNew] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLookups() {
    const [catRes, subRes] = await Promise.all([
      supabase.from("star_party_category").select("slug, label").order("sort_order"),
      supabase.from("star_party_sub_category").select("sub_category_id, category_slug, name").order("sort_order").order("name"),
    ]);
    setCategories((catRes.data as Category[]) ?? []);
    setSubCategories((subRes.data as SubCategory[]) ?? []);
  }

  async function loadItems() {
    const { data } = await supabase
      .from("star_party_item")
      .select("item_id, name, category, sub_category")
      .order("category")
      .order("sub_category", { nullsFirst: true })
      .order("name");
    setItems((data as Item[]) ?? []);
  }

  async function load() {
    setLoading(true);
    await Promise.all([loadLookups(), loadItems()]);
    setLoading(false);
  }

  async function initDefaults() {
    setInitializing(true);
    const { error: err } = await supabase.from("star_party_item").insert(
      DEFAULT_STAR_PARTY_ITEMS.map(d => ({
        name: d.name,
        category: d.category,
        sub_category: d.sub_category,
        sort_order: d.sort_order,
      }))
    );
    if (err) alert(err.message);
    await loadItems();
    setInitializing(false);
  }

  useEffect(() => { load(); }, []);

  // Sub-categories for the currently selected category
  const filteredSubCats = subCategories.filter(s => s.category_slug === category);

  function openNew() {
    setEditingId(null);
    setName("");
    setCategory(categories[0]?.slug ?? "camping");
    setSubCatSelect("");
    setSubCatNew("");
    setError(null);
    setShowForm(true);
  }

  function openEdit(item: Item) {
    setEditingId(item.item_id);
    setName(item.name);
    setCategory(item.category);
    const sub = item.sub_category ?? "";
    const exists = subCategories.some(s => s.category_slug === item.category && s.name === sub);
    setSubCatSelect(sub ? (exists ? sub : NEW_SUB) : "");
    setSubCatNew(exists || !sub ? "" : sub);
    setError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function handleCategoryChange(slug: string) {
    setCategory(slug);
    setSubCatSelect("");
    setSubCatNew("");
  }

  function resolvedSubCat(): string {
    if (subCatSelect === NEW_SUB) return subCatNew.trim();
    return subCatSelect;
  }

  async function onSave() {
    if (!name.trim()) { setError("Name is required."); return; }

    const finalSub = resolvedSubCat();

    // Prompt and insert new sub-category into the lookup table
    if (subCatSelect === NEW_SUB) {
      if (!finalSub) { setError("Please enter a name for the new sub-category."); return; }
      const confirmed = confirm(`"${finalSub}" is a new sub-category. Create it?`);
      if (!confirmed) return;

      const { error: subErr } = await supabase
        .from("star_party_sub_category")
        .insert({ category_slug: category, name: finalSub });
      if (subErr && subErr.code !== "23505") {
        // 23505 = unique violation (already exists) — safe to ignore
        setError(subErr.message);
        return;
      }
      // Refresh the sub-category list so it appears in the dropdown from now on
      await loadLookups();
    }

    setSaving(true);
    setError(null);
    const payload = { name: name.trim(), category, sub_category: finalSub || null };

    if (editingId !== null) {
      const { error: err } = await supabase.from("star_party_item").update(payload).eq("item_id", editingId);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from("star_party_item").insert(payload);
      if (err) { setError(err.message); setSaving(false); return; }
    }
    closeForm();
    await loadItems();
    setSaving(false);
  }

  async function onDelete(item: Item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    const { error: err } = await supabase.from("star_party_item").delete().eq("item_id", item.item_id);
    if (err) { alert(err.message); return; }
    await loadItems();
  }

  // Group items: category label → sub_category → items
  const catOrder = categories.map(c => c.slug);
  const grouped: Record<string, Record<string, Item[]>> = {};
  for (const item of items) {
    const cat = categories.find(c => c.slug === item.category)?.label ?? item.category;
    const sub = item.sub_category ?? "(No sub-category)";
    if (!grouped[cat]) grouped[cat] = {};
    if (!grouped[cat][sub]) grouped[cat][sub] = [];
    grouped[cat][sub].push(item);
  }
  const sortedCats = Object.keys(grouped).sort(
    (a, b) => catOrder.indexOf(categories.find(c => c.label === a)?.slug ?? "") -
              catOrder.indexOf(categories.find(c => c.label === b)?.slug ?? "")
  );

  const showNewInput = subCatSelect === NEW_SUB;

  return (
    <main style={{ padding: "16px", maxWidth: 600, margin: "0 auto", paddingBottom: 40 }}>
      <div style={{ marginBottom: 16 }}>
        <Link href="/star-party" style={{ fontSize: 13, opacity: 0.6, textDecoration: "none" }}>← Star Parties</Link>
      </div>

      <h1 style={{ marginBottom: 6 }}>Checklist Items</h1>
      <p style={{ opacity: 0.5, fontSize: 13, marginBottom: 20 }}>Manage the master list of items for your checklists</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          onClick={openNew}
          style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#3b82f6", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
        >
          + Add Item
        </button>
      </div>

      {showForm && (
        <div style={{ border: "1px solid rgba(255,255,255,0.18)", borderRadius: 12, padding: "20px 16px", marginBottom: 28, background: "rgba(255,255,255,0.03)" }}>
          <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: 16 }}>
            {editingId === null ? "New Item" : "Edit Item"}
          </h2>

          <div style={{ marginBottom: 14 }}>
            <label style={lStyle}>Name *</label>
            <input type="text" style={iStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sleeping Bag" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lStyle}>Category *</label>
            <select style={iStyle} value={category} onChange={e => handleCategoryChange(e.target.value)}>
              {categories.map(c => (
                <option key={c.slug} value={c.slug}>{c.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: showNewInput ? 8 : 14 }}>
            <label style={lStyle}>Sub-Category</label>
            <select
              style={iStyle}
              value={subCatSelect}
              onChange={e => { setSubCatSelect(e.target.value); if (e.target.value !== NEW_SUB) setSubCatNew(""); }}
            >
              <option value="">— None —</option>
              {filteredSubCats.map(s => (
                <option key={s.sub_category_id} value={s.name}>{s.name}</option>
              ))}
              <option value={NEW_SUB}>+ New sub-category…</option>
            </select>
          </div>

          {showNewInput && (
            <div style={{ marginBottom: 14 }}>
              <label style={lStyle}>New Sub-Category Name *</label>
              <input
                type="text"
                style={iStyle}
                value={subCatNew}
                onChange={e => setSubCatNew(e.target.value)}
                placeholder="e.g. Filters"
                autoFocus
              />
            </div>
          )}

          {error && <p style={{ color: "#f87171", fontSize: 14, margin: "8px 0" }}>{error}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={onSave} disabled={saving} style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: "#3b82f6", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={closeForm} disabled={saving} style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white", fontSize: 14, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ opacity: 0.6 }}>Loading…</p>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px", border: "1px dashed rgba(255,255,255,0.2)", borderRadius: 12 }}>
          <p style={{ opacity: 0.7, marginBottom: 16 }}>No items yet.</p>
          <button
            onClick={initDefaults}
            disabled={initializing}
            style={{ padding: "12px 20px", borderRadius: 8, border: "none", background: "#3b82f6", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            {initializing ? "Loading defaults…" : "Load Default Items from Spreadsheet"}
          </button>
        </div>
      ) : (
        sortedCats.map(cat => (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#93c5fd", letterSpacing: "0.06em", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
              {cat}
            </div>
            {Object.entries(grouped[cat]).sort(([a], [b]) => a.localeCompare(b)).map(([sub, subItems]) => (
              <div key={sub} style={{ marginBottom: 16 }}>
                {sub !== "(No sub-category)" && (
                  <div style={{ fontSize: 11, opacity: 0.5, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 6, paddingLeft: 4 }}>
                    {sub.toUpperCase()}
                  </div>
                )}
                {subItems.map(item => (
                  <div key={item.item_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: 14 }}>{item.name}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => openEdit(item)} style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "white", cursor: "pointer" }}>Edit</button>
                      <button onClick={() => onDelete(item)} style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: "1px solid rgba(248,113,113,0.3)", background: "transparent", color: "#f87171", cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))
      )}
    </main>
  );
}
