import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import type { ImageStyleCategory, VoiceProfile, BrandEngine } from "@/brand/engine";

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};

type Company = {
    id: string;
    name: string;
    tagline: string | null;
    mission: string | null;
    archetype: string | null;
    tone: string | null;
    target_audiences: string[] | null;
    photography_style: string | null;
    color_primary: string | null;
    color_secondary: string | null;
    avoid_phrases: string | null;
    image_style_categories: ImageStyleCategory[] | null;
    voice_profile: VoiceProfile | null;
    editorial_guidelines: string | null;
    reference_articles: string[] | null;
    evals: BrandEngine["evals"] | null;
    auto_humanize: boolean | null;
    created_at: string;
};

type CompanyPrompt = {
    id: string;
    company_id: string;
    name: string;
    body: string;
    created_at: string;
};

const EMPTY_FORM = {
    name: "",
    tagline: "",
    mission: "",
    archetype: "guide",
    tone: "confident, clear, modern",
    target_audiences: "",
    photography_style: "",
    color_primary: "#000000",
    color_secondary: "#FFFFFF",
    avoid_phrases: "",
    editorial_guidelines: "",
    reference_articles: [] as string[],
    useCustomStyles: false,
    image_style_categories: [] as ImageStyleCategory[],
    auto_humanize: true,
};

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [expandedStyles, setExpandedStyles] = useState<Set<number>>(new Set());
    const [newRefUrl, setNewRefUrl] = useState("");

    // Delete
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Voice analysis
    const [voiceCompanyId, setVoiceCompanyId] = useState<string | null>(null);
    const [voiceInput, setVoiceInput] = useState("");
    const [analyzingVoice, setAnalyzingVoice] = useState(false);
    const [voiceErr, setVoiceErr] = useState<string | null>(null);
    const [pendingVoiceProfile, setPendingVoiceProfile] = useState<VoiceProfile | null>(null);
    const [savingVoice, setSavingVoice] = useState(false);
    const [voiceSaved, setVoiceSaved] = useState(false);
    const [editingVoiceProfile, setEditingVoiceProfile] = useState<VoiceProfile | null>(null);
    const [voiceDirty, setVoiceDirty] = useState(false);

    // Prompt templates
    const [promptCompanyId, setPromptCompanyId] = useState<string | null>(null);
    const [prompts, setPrompts] = useState<CompanyPrompt[]>([]);
    const [loadingPrompts, setLoadingPrompts] = useState(false);
    const [newPromptName, setNewPromptName] = useState("");
    const [newPromptBody, setNewPromptBody] = useState("");
    const [savingPrompt, setSavingPrompt] = useState(false);
    const [promptErr, setPromptErr] = useState<string | null>(null);
    const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
    const [editPromptName, setEditPromptName] = useState("");
    const [editPromptBody, setEditPromptBody] = useState("");

    function openVoicePanel(companyId: string) {
        const company = companies.find((c) => c.id === companyId);
        setVoiceCompanyId(companyId);
        setVoiceInput("");
        setVoiceErr(null);
        setPendingVoiceProfile(null);
        setVoiceSaved(false);
        setVoiceDirty(false);
        if (company?.voice_profile) {
            setEditingVoiceProfile({ ...company.voice_profile });
        } else {
            setEditingVoiceProfile(null);
        }
    }

    function closeVoicePanel() {
        setVoiceCompanyId(null);
        setVoiceInput("");
        setVoiceErr(null);
        setPendingVoiceProfile(null);
        setVoiceSaved(false);
        setEditingVoiceProfile(null);
        setVoiceDirty(false);
    }

    function updateVoiceField(key: keyof VoiceProfile, value: string | string[]) {
        setEditingVoiceProfile((prev) => prev ? { ...prev, [key]: value } : prev);
        setVoiceDirty(true);
    }

    // Prompt panel functions
    async function openPromptPanel(companyId: string) {
        setPromptCompanyId(companyId);
        setPromptErr(null);
        setNewPromptName("");
        setNewPromptBody("");
        setEditingPromptId(null);
        setLoadingPrompts(true);
        try {
            const r = await fetch(`/api/prompts?company_id=${companyId}`);
            const data = await r.json();
            if (Array.isArray(data)) setPrompts(data);
        } catch {
            setPromptErr("Failed to load prompts");
        } finally {
            setLoadingPrompts(false);
        }
    }

    function closePromptPanel() {
        setPromptCompanyId(null);
        setPrompts([]);
        setPromptErr(null);
        setEditingPromptId(null);
    }

    async function addPrompt() {
        if (!promptCompanyId || !newPromptName.trim() || !newPromptBody.trim()) return;
        setSavingPrompt(true);
        setPromptErr(null);
        try {
            const r = await fetch("/api/prompts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_id: promptCompanyId, name: newPromptName.trim(), body: newPromptBody.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            setPrompts((prev) => [data, ...prev]);
            setNewPromptName("");
            setNewPromptBody("");
        } catch (e: any) {
            setPromptErr(e.message);
        } finally {
            setSavingPrompt(false);
        }
    }

    async function updatePrompt(id: string) {
        setSavingPrompt(true);
        setPromptErr(null);
        try {
            const r = await fetch(`/api/prompts/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editPromptName.trim(), body: editPromptBody.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Update failed");
            setPrompts((prev) => prev.map((p) => (p.id === id ? data : p)));
            setEditingPromptId(null);
        } catch (e: any) {
            setPromptErr(e.message);
        } finally {
            setSavingPrompt(false);
        }
    }

    async function deletePrompt(id: string) {
        try {
            await fetch(`/api/prompts/${id}`, { method: "DELETE" });
            setPrompts((prev) => prev.filter((p) => p.id !== id));
        } catch {
            setPromptErr("Failed to delete prompt");
        }
    }

    const fetchCompanies = useCallback(async () => {
        setLoading(true);
        setErr(null);
        try {
            const r = await fetch("/api/companies");
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to fetch");
            setCompanies(data);
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    function openCreate() {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setShowForm(true);
    }

    function openEdit(c: Company) {
        setEditingId(c.id);
        const hasCustomStyles = Array.isArray(c.image_style_categories) && c.image_style_categories.length > 0;
        setForm({
            name: c.name,
            tagline: c.tagline ?? "",
            mission: c.mission ?? "",
            archetype: c.archetype ?? "guide",
            tone: c.tone ?? "confident, clear, modern",
            target_audiences: (c.target_audiences ?? []).join(", "),
            photography_style: c.photography_style ?? "",
            color_primary: c.color_primary ?? "#000000",
            color_secondary: c.color_secondary ?? "#FFFFFF",
            avoid_phrases: c.avoid_phrases ?? "",
            editorial_guidelines: c.editorial_guidelines ?? "",
            reference_articles: c.reference_articles ?? [],
            useCustomStyles: hasCustomStyles,
            image_style_categories: hasCustomStyles ? c.image_style_categories! : [],
            auto_humanize: c.auto_humanize !== false,
        });
        setShowForm(true);
    }

    function closeForm() {
        setShowForm(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
    }

    function setField(key: string, value: string) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSubmit() {
        if (!form.name.trim()) {
            alert("Company name is required");
            return;
        }
        setSaving(true);
        try {
            const body = {
                ...form,
                target_audiences: form.target_audiences
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                image_style_categories: form.useCustomStyles && form.image_style_categories.length > 0
                    ? form.image_style_categories
                    : null,
            };
            // Remove UI-only field before sending
            const { useCustomStyles, ...payload } = body;

            const url = editingId ? `/api/companies/${editingId}` : "/api/companies";
            const method = editingId ? "PUT" : "POST";

            const r = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");

            if (editingId) {
                setCompanies((prev) =>
                    prev.map((c) => (c.id === editingId ? data : c))
                );
            } else {
                setCompanies((prev) => [data, ...prev]);
            }
            closeForm();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    }

    async function deleteCompany(id: string) {
        setDeletingId(id);
        try {
            const r = await fetch(`/api/companies/${id}`, { method: "DELETE" });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Delete failed");
            setCompanies((prev) => prev.filter((c) => c.id !== id));
            setConfirmDeleteId(null);
        } catch (e: any) {
            alert(e.message);
        } finally {
            setDeletingId(null);
        }
    }

    const inputStyle = {
        width: "100%",
        padding: "8px 12px",
        fontSize: 14,
        borderRadius: 6,
        border: "1px solid #ccc",
        boxSizing: "border-box" as const,
    };

    const labelStyle = {
        display: "block" as const,
        fontSize: 13,
        fontWeight: 500 as const,
        marginBottom: 4,
        color: "#333",
    };

    return (
        <main style={{ margin: "40px auto", padding: "16px 40px", fontFamily: "system-ui" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h1 style={{ margin: 0 }}>Companies</h1>
                <div style={{ display: "flex", gap: 8 }}>
                    <Link
                        href="/"
                        style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: "#fff",
                            textDecoration: "none",
                            color: "#333",
                        }}
                    >
                        ← Studio
                    </Link>
                    <button
                        onClick={openCreate}
                        style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: "1px solid #FDB72A",
                            background: "#FDB72A",
                            color: "#191F1D",
                            cursor: "pointer",
                        }}
                    >
                        + New Company
                    </button>
                </div>
            </div>

            {loading && <p style={{ color: "#888" }}>Loading…</p>}
            {err && <p style={{ color: "crimson" }}>{err}</p>}

            {/* Company Form */}
            {showForm && (
                <div
                    style={{
                        border: "1px solid #e5e5e5",
                        borderRadius: 10,
                        padding: 24,
                        marginBottom: 24,
                        background: "#fafafa",
                    }}
                >
                    <h2 style={{ margin: "0 0 20px", fontSize: 18 }}>
                        {editingId ? "Edit Company" : "New Company"}
                    </h2>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                            <label style={labelStyle}>Company Name *</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => setField("name", e.target.value)}
                                placeholder="Acme Corp"
                                style={inputStyle}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>Tagline</label>
                            <input
                                type="text"
                                value={form.tagline}
                                onChange={(e) => setField("tagline", e.target.value)}
                                placeholder="Building the future"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <label style={labelStyle}>Mission</label>
                        <textarea
                            value={form.mission}
                            onChange={(e) => setField("mission", e.target.value)}
                            placeholder="Our mission is to..."
                            rows={2}
                            style={{ ...inputStyle, resize: "vertical" as const }}
                        />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                        <div>
                            <label style={labelStyle}>Brand Archetype</label>
                            <select
                                value={form.archetype}
                                onChange={(e) => setField("archetype", e.target.value)}
                                style={inputStyle}
                            >
                                <option value="pathfinder">Pathfinder (guide & support)</option>
                                <option value="innovator">Innovator (bold & forward-thinking)</option>
                                <option value="caregiver">Caregiver (warm & nurturing)</option>
                                <option value="sage">Sage (expert & trusted)</option>
                                <option value="creator">Creator (imaginative & expressive)</option>
                                <option value="hero">Hero (bold & empowering)</option>
                                <option value="explorer">Explorer (adventurous & free)</option>
                                <option value="rebel">Rebel (disruptive & edgy)</option>
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>Tone (comma-separated)</label>
                            <input
                                type="text"
                                value={form.tone}
                                onChange={(e) => setField("tone", e.target.value)}
                                placeholder="empathetic, confident, modern"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <label style={labelStyle}>Target Audiences (comma-separated)</label>
                        <input
                            type="text"
                            value={form.target_audiences}
                            onChange={(e) => setField("target_audiences", e.target.value)}
                            placeholder="developers, startups, enterprises"
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <label style={labelStyle}>Photography / Image Style</label>
                        <textarea
                            value={form.photography_style}
                            onChange={(e) => setField("photography_style", e.target.value)}
                            placeholder="Clean, minimal tech photography with natural lighting..."
                            rows={2}
                            style={{ ...inputStyle, resize: "vertical" as const }}
                        />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16 }}>
                        <div>
                            <label style={labelStyle}>Primary Color</label>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input
                                    type="color"
                                    value={form.color_primary}
                                    onChange={(e) => setField("color_primary", e.target.value)}
                                    style={{ width: 40, height: 36, border: "none", cursor: "pointer" }}
                                />
                                <input
                                    type="text"
                                    value={form.color_primary}
                                    onChange={(e) => setField("color_primary", e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Secondary Color</label>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input
                                    type="color"
                                    value={form.color_secondary}
                                    onChange={(e) => setField("color_secondary", e.target.value)}
                                    style={{ width: 40, height: 36, border: "none", cursor: "pointer" }}
                                />
                                <input
                                    type="text"
                                    value={form.color_secondary}
                                    onChange={(e) => setField("color_secondary", e.target.value)}
                                    style={{ ...inputStyle, flex: 1 }}
                                />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Avoid Phrases</label>
                            <input
                                type="text"
                                value={form.avoid_phrases}
                                onChange={(e) => setField("avoid_phrases", e.target.value)}
                                placeholder="synergy, disrupt"
                                style={inputStyle}
                            />
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                            <label style={labelStyle}>Editorial Guidelines</label>
                            <textarea
                                value={form.editorial_guidelines}
                                onChange={(e) => setField("editorial_guidelines", e.target.value)}
                                placeholder="Company-specific voice, tone, citation rules, drafting rules, gold-standard examples..."
                                rows={10}
                                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                            />
                        </div>
                    </div>

                    {/* Auto-Humanize Toggle */}
                    <div style={{ marginTop: 20, borderTop: "1px solid #e5e5e5", paddingTop: 16 }}>
                        <label style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            cursor: "pointer",
                            fontSize: 14,
                        }}>
                            <input
                                type="checkbox"
                                checked={form.auto_humanize}
                                onChange={(e) => setForm((prev) => ({ ...prev, auto_humanize: e.target.checked }))}
                                style={{ width: 18, height: 18, cursor: "pointer" }}
                            />
                            <div>
                                <div style={{ fontWeight: 600, color: "#333" }}>
                                    🧹 Auto-Humanize Generated Content
                                </div>
                                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                                    When enabled, articles are automatically run through the humanizer after generation to strip AI writing patterns,
                                    improve first-sentence quality, and match brand voice. Adds ~30s to generation time.
                                </div>
                            </div>
                        </label>
                    </div>

                    {/* Reference Articles */}
                    <div style={{ marginTop: 20, borderTop: "1px solid #e5e5e5", paddingTop: 16 }}>
                        <label style={{ ...labelStyle, marginBottom: 8 }}>Reference Articles</label>
                        <p style={{ fontSize: 12, color: "#888", margin: "0 0 10px" }}>
                            Add URLs of gold-standard articles. Their content is auto-fetched and used as style references when generating new articles.
                        </p>
                        {form.reference_articles.map((url, idx) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ flex: 1, fontSize: 13, color: "#3b82f6", wordBreak: "break-all" }}
                                >
                                    {url}
                                </a>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setForm((prev) => ({
                                            ...prev,
                                            reference_articles: prev.reference_articles.filter((_, i) => i !== idx),
                                        }));
                                    }}
                                    style={{
                                        padding: "2px 6px",
                                        fontSize: 12,
                                        border: "1px solid #ddd",
                                        borderRadius: 4,
                                        background: "#fff",
                                        color: "#ef4444",
                                        cursor: "pointer",
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                            <input
                                type="url"
                                value={newRefUrl}
                                onChange={(e) => setNewRefUrl(e.target.value)}
                                placeholder="https://example.com/blog/example-article"
                                style={{ ...inputStyle, flex: 1 }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && newRefUrl.trim()) {
                                        e.preventDefault();
                                        setForm((prev) => ({
                                            ...prev,
                                            reference_articles: [...prev.reference_articles, newRefUrl.trim()],
                                        }));
                                        setNewRefUrl("");
                                    }
                                }}
                            />
                            <button
                                type="button"
                                disabled={!newRefUrl.trim()}
                                onClick={() => {
                                    if (newRefUrl.trim()) {
                                        setForm((prev) => ({
                                            ...prev,
                                            reference_articles: [...prev.reference_articles, newRefUrl.trim()],
                                        }));
                                        setNewRefUrl("");
                                    }
                                }}
                                style={{
                                    padding: "6px 14px",
                                    fontSize: 13,
                                    borderRadius: 6,
                                    border: "1px solid #ccc",
                                    background: newRefUrl.trim() ? "#f0fdf4" : "#fafafa",
                                    color: newRefUrl.trim() ? "#16a34a" : "#999",
                                    cursor: newRefUrl.trim() ? "pointer" : "not-allowed",
                                    fontWeight: 500,
                                }}
                            >
                                + Add
                            </button>
                        </div>
                    </div>

                    {/* Image Style Categories */}
                    <div style={{ marginTop: 20, borderTop: "1px solid #e5e5e5", paddingTop: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Custom Image Styles</label>
                            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                                <input
                                    type="checkbox"
                                    checked={form.useCustomStyles}
                                    onChange={(e) => {
                                        const checked = e.target.checked;
                                        setForm((prev) => ({
                                            ...prev,
                                            useCustomStyles: checked,
                                            image_style_categories: checked && prev.image_style_categories.length === 0
                                                ? [{ id: "default", label: "Default", narrative: "", storytelling_cues: [], image_prompt_style: "" }]
                                                : prev.image_style_categories,
                                        }));
                                    }}
                                />
                                Use custom styles instead of global defaults
                            </label>
                        </div>

                        {form.useCustomStyles && (
                            <div>
                                {form.image_style_categories.map((cat, idx) => {
                                    const isCollapsed = !expandedStyles.has(idx);
                                    return (
                                    <div
                                        key={idx}
                                        style={{
                                            border: "1px solid #ddd",
                                            borderRadius: 8,
                                            marginBottom: 10,
                                            background: "#fff",
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "10px 14px",
                                                cursor: "pointer",
                                                background: isCollapsed ? "#fafafa" : "#fff",
                                                borderBottom: isCollapsed ? "none" : "1px solid #eee",
                                                userSelect: "none" as const,
                                            }}
                                            onClick={() => {
                                                setExpandedStyles((prev: Set<number>) => {
                                                    const next = new Set(prev);
                                                    if (next.has(idx)) next.delete(idx);
                                                    else next.add(idx);
                                                    return next;
                                                });
                                            }}
                                        >
                                            <span style={{ fontSize: 13, fontWeight: 600, color: "#555", display: "flex", alignItems: "center", gap: 6 }}>
                                                <span style={{ transition: "transform 0.2s", transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", display: "inline-block" }}>▾</span>
                                                {cat.label || `Style #${idx + 1}`}
                                                <span style={{ fontWeight: 400, color: "#aaa", fontSize: 11 }}>{cat.id ? `(${cat.id})` : ""}</span>
                                            </span>
                                            <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const clone = { ...cat, label: `${cat.label} (Copy)`, id: `${cat.id}_copy_${Date.now()}`, storytelling_cues: [...cat.storytelling_cues] };
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            image_style_categories: [
                                                                ...prev.image_style_categories.slice(0, idx + 1),
                                                                clone,
                                                                ...prev.image_style_categories.slice(idx + 1),
                                                            ],
                                                        }));
                                                    }}
                                                    style={{
                                                        padding: "2px 8px",
                                                        fontSize: 11,
                                                        borderRadius: 4,
                                                        border: "1px solid #ddd",
                                                        background: "#fff",
                                                        color: "#3b82f6",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Duplicate
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            image_style_categories: prev.image_style_categories.filter((_, i) => i !== idx),
                                                        }));
                                                    }}
                                                    style={{
                                                        padding: "2px 8px",
                                                        fontSize: 11,
                                                        borderRadius: 4,
                                                        border: "1px solid #ddd",
                                                        background: "#fff",
                                                        color: "#ef4444",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>

                                        {!isCollapsed && (
                                        <div style={{ padding: 14 }}>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                            <div>
                                                <label style={labelStyle}>Label *</label>
                                                <input
                                                    type="text"
                                                    value={cat.label}
                                                    onChange={(e) => {
                                                        const newCats = [...form.image_style_categories];
                                                        newCats[idx] = {
                                                            ...newCats[idx],
                                                            label: e.target.value,
                                                            id: e.target.value
                                                                .toLowerCase()
                                                                .replace(/[^a-z0-9]+/g, "_")
                                                                .replace(/^_|_$/g, ""),
                                                        };
                                                        setForm((prev) => ({ ...prev, image_style_categories: newCats }));
                                                    }}
                                                    placeholder="e.g. Families, Products"
                                                    style={inputStyle}
                                                />
                                            </div>
                                            <div>
                                                <label style={labelStyle}>ID</label>
                                                <input
                                                    type="text"
                                                    value={cat.id}
                                                    disabled
                                                    style={{ ...inputStyle, background: "#f5f5f5", color: "#999" }}
                                                />
                                            </div>
                                        </div>

                                        <div style={{ marginTop: 8 }}>
                                            <label style={labelStyle}>Narrative</label>
                                            <textarea
                                                value={cat.narrative}
                                                onChange={(e) => {
                                                    const newCats = [...form.image_style_categories];
                                                    newCats[idx] = { ...newCats[idx], narrative: e.target.value };
                                                    setForm((prev) => ({ ...prev, image_style_categories: newCats }));
                                                }}
                                                placeholder="Context for this style category..."
                                                rows={2}
                                                style={{ ...inputStyle, resize: "vertical" as const }}
                                            />
                                        </div>

                                        <div style={{ marginTop: 8 }}>
                                            <label style={labelStyle}>Storytelling Cues (comma-separated)</label>
                                            <input
                                                type="text"
                                                value={cat.storytelling_cues.join(", ")}
                                                onChange={(e) => {
                                                    const newCats = [...form.image_style_categories];
                                                    newCats[idx] = {
                                                        ...newCats[idx],
                                                        storytelling_cues: e.target.value
                                                            .split(",")
                                                            .map((s) => s.trim())
                                                            .filter(Boolean),
                                                    };
                                                    setForm((prev) => ({ ...prev, image_style_categories: newCats }));
                                                }}
                                                placeholder="emphasizes warmth, shows collaboration"
                                                style={inputStyle}
                                            />
                                        </div>

                                        <div style={{ marginTop: 8 }}>
                                            <label style={labelStyle}>Image Prompt Style</label>
                                            <textarea
                                                value={cat.image_prompt_style}
                                                onChange={(e) => {
                                                    const newCats = [...form.image_style_categories];
                                                    newCats[idx] = { ...newCats[idx], image_prompt_style: e.target.value };
                                                    setForm((prev) => ({ ...prev, image_style_categories: newCats }));
                                                }}
                                                placeholder="Detailed style direction for image generation..."
                                                rows={3}
                                                style={{ ...inputStyle, resize: "vertical" as const }}
                                            />
                                        </div>
                                        </div>
                                        )}
                                    </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => {
                                        setForm((prev) => ({
                                            ...prev,
                                            image_style_categories: [
                                                ...prev.image_style_categories,
                                                { id: "", label: "", narrative: "", storytelling_cues: [], image_prompt_style: "" },
                                            ],
                                        }));
                                    }}
                                    style={{
                                        padding: "6px 14px",
                                        fontSize: 13,
                                        borderRadius: 6,
                                        border: "1px dashed #ccc",
                                        background: "#fafafa",
                                        cursor: "pointer",
                                        color: "#555",
                                    }}
                                >
                                    + Add Style
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
                        <button
                            onClick={closeForm}
                            disabled={saving}
                            style={{
                                padding: "8px 16px",
                                fontSize: 13,
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                background: "#fff",
                                cursor: "pointer",
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            style={{
                                padding: "8px 20px",
                                fontSize: 13,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: "1px solid #FDB72A",
                                background: "#FDB72A",
                                color: "#191F1D",
                                cursor: saving ? "wait" : "pointer",
                            }}
                        >
                            {saving ? "Saving…" : editingId ? "Update Company" : "Create Company"}
                        </button>
                    </div>
                </div>
            )}

            {/* Company List */}
            {!loading && companies.length === 0 && !showForm && (
                <p style={{ color: "#888", fontSize: 15 }}>
                    No companies yet. Click &quot;+ New Company&quot; to get started.
                </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {companies.map((c) => (
                    <div
                        key={c.id}
                        style={{
                            border: "1px solid #e5e5e5",
                            borderRadius: 10,
                            padding: 16,
                            background: "#fff",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 16,
                        }}
                    >
                        {/* Color swatch */}
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,
                                flexShrink: 0,
                                background: `linear-gradient(135deg, ${c.color_primary ?? "#000"}, ${c.color_secondary ?? "#fff"})`,
                                border: "1px solid #e5e5e5",
                            }}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>{c.name}</h3>
                            {c.tagline && (
                                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#666", fontStyle: "italic" }}>
                                    {c.tagline}
                                </p>
                            )}
                            <div style={{ display: "flex", gap: 8, fontSize: 12, color: "#999", flexWrap: "wrap" }}>
                                {c.archetype && (
                                    <span style={{ padding: "1px 6px", borderRadius: 4, background: "#f0f0f0" }}>
                                        {c.archetype}
                                    </span>
                                )}
                                {c.tone && (
                                    <span style={{ padding: "1px 6px", borderRadius: 4, background: "#f0f0f0" }}>
                                        {c.tone}
                                    </span>
                                )}
                                {c.voice_profile && (
                                    <span style={{ padding: "1px 6px", borderRadius: 4, background: "#e0f2fe", color: "#0284c7" }}>
                                        🎙️ Voice Profile
                                    </span>
                                )}
                                {c.auto_humanize !== false && (
                                    <span style={{ padding: "1px 6px", borderRadius: 4, background: "#f0fdf4", color: "#16a34a" }}>
                                        🧹 Auto-Humanize
                                    </span>
                                )}
                                <span>
                                    {new Date(c.created_at).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                                onClick={() => openEdit(c)}
                                style={{
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    fontWeight: 500,
                                    borderRadius: 5,
                                    border: "1px solid #ddd",
                                    background: "#fff",
                                    cursor: "pointer",
                                }}
                            >
                                ✏️ Edit
                            </button>
                            <button
                                onClick={() => openVoicePanel(c.id)}
                                style={{
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    fontWeight: 500,
                                    borderRadius: 5,
                                    border: "1px solid #ddd",
                                    background: c.voice_profile ? "#f0f9ff" : "#fff",
                                    cursor: "pointer",
                                    color: c.voice_profile ? "#0284c7" : undefined,
                                }}
                            >
                                🎙️ Voice
                            </button>
                            <button
                                onClick={() => openPromptPanel(c.id)}
                                style={{
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    fontWeight: 500,
                                    borderRadius: 5,
                                    border: "1px solid #ddd",
                                    background: "#fff",
                                    cursor: "pointer",
                                }}
                            >
                                📝 Prompts
                            </button>
                            {confirmDeleteId === c.id ? (
                                <div style={{ display: "flex", gap: 4 }}>
                                    <button
                                        onClick={() => deleteCompany(c.id)}
                                        disabled={deletingId === c.id}
                                        style={{
                                            padding: "6px 10px",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            borderRadius: 5,
                                            border: "1px solid #ef4444",
                                            background: "#fef2f2",
                                            color: "#ef4444",
                                            cursor: deletingId === c.id ? "wait" : "pointer",
                                        }}
                                    >
                                        {deletingId === c.id ? "…" : "Confirm"}
                                    </button>
                                    <button
                                        onClick={() => setConfirmDeleteId(null)}
                                        style={{
                                            padding: "6px 10px",
                                            fontSize: 12,
                                            borderRadius: 5,
                                            border: "1px solid #ddd",
                                            background: "#fff",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setConfirmDeleteId(c.id)}
                                    style={{
                                        padding: "6px 12px",
                                        fontSize: 12,
                                        fontWeight: 500,
                                        borderRadius: 5,
                                        border: "1px solid #ddd",
                                        background: "#fff",
                                        cursor: "pointer",
                                        color: "#ef4444",
                                    }}
                                >
                                    🗑 Delete
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Voice Profile Panel */}
            {voiceCompanyId && (() => {
                const vc = companies.find((c) => c.id === voiceCompanyId);
                if (!vc) return null;
                return (
                    <div
                        style={{
                            position: "fixed",
                            top: 0,
                            right: 0,
                            width: 520,
                            height: "100vh",
                            background: "#fff",
                            borderLeft: "1px solid #e5e5e5",
                            boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
                            overflowY: "auto",
                            zIndex: 1000,
                            padding: 24,
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ margin: 0, fontSize: 18 }}>🎙️ Voice Profile — {vc.name}</h2>
                            <button
                                onClick={closeVoicePanel}
                                style={{ padding: "4px 10px", fontSize: 13, borderRadius: 5, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                            >
                                ✕ Close
                            </button>
                        </div>

                        {/* Editable voice profile form */}
                        {editingVoiceProfile && (
                            <div style={{ marginBottom: 20 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                    <h4 style={{ margin: 0, fontSize: 14, color: "#0284c7" }}>
                                        {vc.voice_profile ? "✏️ Edit Voice Profile" : "📝 New Voice Profile"}
                                    </h4>
                                    <div style={{ display: "flex", gap: 6 }}>
                                        <button
                                            onClick={async () => {
                                                setSavingVoice(true);
                                                setVoiceErr(null);
                                                try {
                                                    const r = await fetch(`/api/companies/${vc.id}`, {
                                                        method: "PUT",
                                                        headers: { "Content-Type": "application/json" },
                                                        body: JSON.stringify({ voice_profile: editingVoiceProfile }),
                                                    });
                                                    const data = await r.json();
                                                    if (!r.ok) throw new Error(data.error || "Save failed");
                                                    setCompanies((prev) =>
                                                        prev.map((c) => c.id === vc.id ? { ...c, voice_profile: editingVoiceProfile } : c)
                                                    );
                                                    setVoiceDirty(false);
                                                    setVoiceSaved(true);
                                                    setPendingVoiceProfile(null);
                                                    setTimeout(() => setVoiceSaved(false), 3000);
                                                } catch (e: any) {
                                                    setVoiceErr(e.message);
                                                } finally {
                                                    setSavingVoice(false);
                                                }
                                            }}
                                            disabled={savingVoice || !voiceDirty}
                                            style={{
                                                padding: "5px 14px", fontSize: 12, fontWeight: 600, borderRadius: 5,
                                                border: voiceDirty ? "1px solid #FDB72A" : "1px solid #ddd",
                                                background: voiceDirty ? "#FDB72A" : "#f5f5f5",
                                                color: voiceDirty ? "#191F1D" : "#999",
                                                cursor: savingVoice ? "wait" : voiceDirty ? "pointer" : "default",
                                            }}
                                        >
                                            {savingVoice ? "Saving…" : "💾 Save Changes"}
                                        </button>
                                        {vc.voice_profile && (
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await fetch(`/api/companies/${vc.id}`, {
                                                            method: "PUT",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ voice_profile: null }),
                                                        });
                                                        setCompanies((prev) =>
                                                            prev.map((c) => c.id === vc.id ? { ...c, voice_profile: null } : c)
                                                        );
                                                        setEditingVoiceProfile(null);
                                                        setVoiceDirty(false);
                                                    } catch { }
                                                }}
                                                style={{ padding: "5px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ddd", background: "#fff", cursor: "pointer", color: "#ef4444" }}
                                            >
                                                Clear Profile
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {voiceSaved && (
                                    <p style={{ color: "#16a34a", fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>✓ Voice profile saved! It will now influence future article generation.</p>
                                )}

                                {/* Voice & Tone Section */}
                                <fieldset style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 14, marginBottom: 14 }}>
                                    <legend style={{ fontSize: 13, fontWeight: 600, color: "#333", padding: "0 6px" }}>Voice & Tone</legend>

                                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Summary</label>
                                    <textarea
                                        value={editingVoiceProfile.summary}
                                        onChange={(e) => updateVoiceField("summary", e.target.value)}
                                        rows={2}
                                        style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical", marginBottom: 10 }}
                                    />

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Tone Descriptors</label>
                                            <input
                                                type="text"
                                                value={editingVoiceProfile.tone_descriptors.join(", ")}
                                                onChange={(e) => updateVoiceField("tone_descriptors", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                                                placeholder="e.g. direct, informative, serious"
                                                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>POV & Person</label>
                                            <input
                                                type="text"
                                                value={editingVoiceProfile.pov_and_person}
                                                onChange={(e) => updateVoiceField("pov_and_person", e.target.value)}
                                                placeholder="e.g. Third person, limited second-person"
                                                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box" }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Sentence Rhythm</label>
                                            <textarea
                                                value={editingVoiceProfile.sentence_rhythm}
                                                onChange={(e) => updateVoiceField("sentence_rhythm", e.target.value)}
                                                rows={2}
                                                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Paragraph Style</label>
                                            <textarea
                                                value={editingVoiceProfile.paragraph_style}
                                                onChange={(e) => updateVoiceField("paragraph_style", e.target.value)}
                                                rows={2}
                                                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }}
                                            />
                                        </div>
                                    </div>

                                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Vocabulary Level</label>
                                    <textarea
                                        value={editingVoiceProfile.vocabulary_level}
                                        onChange={(e) => updateVoiceField("vocabulary_level", e.target.value)}
                                        rows={2}
                                        style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical", marginBottom: 10 }}
                                    />

                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Rhetorical Devices</label>
                                            <input
                                                type="text"
                                                value={editingVoiceProfile.rhetorical_devices.join(", ")}
                                                onChange={(e) => updateVoiceField("rhetorical_devices", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                                                placeholder="e.g. direct address, analogies"
                                                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Sample Phrases</label>
                                            <input
                                                type="text"
                                                value={editingVoiceProfile.sample_phrases.join(", ")}
                                                onChange={(e) => updateVoiceField("sample_phrases", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                                                placeholder="Comma-separated phrases"
                                                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box" }}
                                            />
                                        </div>
                                    </div>

                                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Patterns to Avoid</label>
                                    <input
                                        type="text"
                                        value={editingVoiceProfile.avoid.join(", ")}
                                        onChange={(e) => updateVoiceField("avoid", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                                        placeholder="e.g. passive voice, motivational language"
                                        style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box" }}
                                    />
                                </fieldset>

                                {/* Banned Phrases */}
                                <fieldset style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 14, marginBottom: 14 }}>
                                    <legend style={{ fontSize: 13, fontWeight: 600, color: "#333", padding: "0 6px" }}>Banned Phrases</legend>
                                    <textarea
                                        value={(editingVoiceProfile.banned_phrases ?? []).join("\n")}
                                        onChange={(e) => updateVoiceField("banned_phrases", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                                        rows={4}
                                        placeholder="One phrase per line, e.g.\nYou're not alone\nNavigate the process\nLet's dive in"
                                        style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }}
                                    />
                                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#888" }}>One phrase per line. These will never appear in generated content.</p>
                                </fieldset>

                                {/* Structure */}
                                <fieldset style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 14, marginBottom: 14 }}>
                                    <legend style={{ fontSize: 13, fontWeight: 600, color: "#333", padding: "0 6px" }}>Structure</legend>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Structural Patterns</label>
                                            <input
                                                type="text"
                                                value={editingVoiceProfile.structural_patterns.join(", ")}
                                                onChange={(e) => updateVoiceField("structural_patterns", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                                                placeholder="e.g. strong hook, numbered steps"
                                                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#16a34a", marginBottom: 4 }}>✓ Do Use</label>
                                            <input
                                                type="text"
                                                value={(editingVoiceProfile.structural_do ?? []).join(", ")}
                                                onChange={(e) => updateVoiceField("structural_do", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                                                placeholder="e.g. Before You Start, checklists, timelines"
                                                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box" }}
                                            />
                                        </div>
                                    </div>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#ef4444", marginBottom: 4 }}>✗ Don't Use</label>
                                    <input
                                        type="text"
                                        value={(editingVoiceProfile.structural_dont ?? []).join(", ")}
                                        onChange={(e) => updateVoiceField("structural_dont", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                                        placeholder="e.g. padded intros, redundant summaries, rhetorical questions"
                                        style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box" }}
                                    />
                                </fieldset>

                                {/* Specificity & Length */}
                                <fieldset style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 14, marginBottom: 14 }}>
                                    <legend style={{ fontSize: 13, fontWeight: 600, color: "#333", padding: "0 6px" }}>Specificity & Length</legend>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                        <div>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Specificity Rules</label>
                                            <textarea
                                                value={(editingVoiceProfile.specificity_rules ?? []).join("\n")}
                                                onChange={(e) => updateVoiceField("specificity_rules", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                                                rows={3}
                                                placeholder="One rule per line\ne.g. Preserve exact dates\nCite form numbers"
                                                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#555", marginBottom: 4 }}>Length Rules</label>
                                            <textarea
                                                value={(editingVoiceProfile.length_rules ?? []).join("\n")}
                                                onChange={(e) => updateVoiceField("length_rules", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))}
                                                rows={3}
                                                placeholder="One rule per line\ne.g. No transitional filler\nGet to substance in 2-3 sentences"
                                                style={{ width: "100%", padding: "6px 10px", fontSize: 12, borderRadius: 5, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }}
                                            />
                                        </div>
                                    </div>
                                </fieldset>
                            </div>
                        )}


                        {/* Analysis input */}
                        <div>
                            <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "#333" }}>
                                {vc.voice_profile ? "Analyze a new article to update the voice profile:" : "Paste a sample article to analyze its voice:"}
                            </label>
                            <textarea
                                value={voiceInput}
                                onChange={(e) => setVoiceInput(e.target.value)}
                                placeholder="Paste the full text or HTML of a blog article that represents the desired writing voice..."
                                rows={10}
                                style={{ width: "100%", padding: "10px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }}
                            />
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
                                <button
                                    onClick={async () => {
                                        if (!voiceInput.trim() || voiceInput.trim().length < 50) {
                                            setVoiceErr("Please paste at least 50 characters of article content.");
                                            return;
                                        }
                                        setAnalyzingVoice(true);
                                        setVoiceErr(null);
                                        try {
                                            const r = await fetch("/api/analyze-voice", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ html: voiceInput.trim(), company_id: vc.id }),
                                            });
                                            const data = await r.json();
                                            if (!r.ok) throw new Error(data.error || "Analysis failed");
                                            setEditingVoiceProfile(data.voice_profile);
                                            setVoiceDirty(true);
                                            setVoiceInput("");
                                        } catch (e: any) {
                                            setVoiceErr(e.message);
                                        } finally {
                                            setAnalyzingVoice(false);
                                        }
                                    }}
                                    disabled={analyzingVoice || voiceInput.trim().length < 50}
                                    style={{
                                        padding: "8px 18px",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        borderRadius: 6,
                                        border: "1px solid #FDB72A",
                                        background: "#FDB72A",
                                        color: "#191F1D",
                                        cursor: analyzingVoice ? "wait" : "pointer",
                                    }}
                                >
                                    {analyzingVoice ? "Analyzing…" : "🎙️ Analyze Voice"}
                                </button>
                                {analyzingVoice && (
                                    <span style={{ fontSize: 12, color: "#888" }}>This may take 15-30 seconds…</span>
                                )}
                            </div>
                            {voiceErr && (
                                <p style={{ color: "crimson", fontSize: 12, marginTop: 6 }}>{voiceErr}</p>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Overlay backdrop */}
            {voiceCompanyId && (
                <div
                    onClick={closeVoicePanel}
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 520,
                        bottom: 0,
                        background: "rgba(0,0,0,0.15)",
                        zIndex: 999,
                    }}
                />
            )}

            {/* Prompt Templates Panel */}
            {promptCompanyId && (() => {
                const pc = companies.find((c) => c.id === promptCompanyId);
                if (!pc) return null;
                return (
                    <div
                        style={{
                            position: "fixed",
                            top: 0,
                            right: 0,
                            width: 580,
                            height: "100vh",
                            background: "#fff",
                            borderLeft: "1px solid #e5e5e5",
                            boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
                            overflowY: "auto",
                            zIndex: 1000,
                            padding: 24,
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                            <h2 style={{ margin: 0, fontSize: 18 }}>📝 Prompt Templates — {pc.name}</h2>
                            <button
                                onClick={closePromptPanel}
                                style={{ padding: "4px 10px", fontSize: 13, borderRadius: 5, border: "1px solid #ddd", background: "#fff", cursor: "pointer" }}
                            >
                                ✕ Close
                            </button>
                        </div>

                        {promptErr && (
                            <p style={{ color: "crimson", fontSize: 13, margin: "8px 0" }}>{promptErr}</p>
                        )}

                        {/* Add new prompt */}
                        <div style={{ marginBottom: 24, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e5e5e5" }}>
                            <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "#555" }}>Add New Prompt Template</h4>
                            <input
                                type="text"
                                placeholder="Template name (e.g. Gear, Review, Tutorial)"
                                value={newPromptName}
                                onChange={(e) => setNewPromptName(e.target.value)}
                                style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    fontSize: 14,
                                    borderRadius: 6,
                                    border: "1px solid #ccc",
                                    marginBottom: 8,
                                    boxSizing: "border-box",
                                }}
                            />
                            <textarea
                                placeholder="Prompt template body… Use [PLACEHOLDERS] for variable parts."
                                value={newPromptBody}
                                onChange={(e) => setNewPromptBody(e.target.value)}
                                rows={8}
                                style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    fontSize: 13,
                                    fontFamily: "monospace",
                                    borderRadius: 6,
                                    border: "1px solid #ccc",
                                    marginBottom: 8,
                                    boxSizing: "border-box",
                                    resize: "vertical",
                                }}
                            />
                            <button
                                onClick={addPrompt}
                                disabled={savingPrompt || !newPromptName.trim() || !newPromptBody.trim()}
                                style={{
                                    padding: "8px 16px",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    borderRadius: 6,
                                    border: "1px solid #22c55e",
                                    background: "#f0fdf4",
                                    color: "#16a34a",
                                    cursor: savingPrompt ? "wait" : "pointer",
                                }}
                            >
                                {savingPrompt ? "Saving…" : "+ Add Template"}
                            </button>
                        </div>

                        {/* Existing prompts */}
                        {loadingPrompts ? (
                            <p style={{ color: "#888", fontSize: 13 }}>Loading prompts…</p>
                        ) : prompts.length === 0 ? (
                            <p style={{ color: "#999", fontSize: 13, fontStyle: "italic" }}>No prompt templates yet. Add one above.</p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {prompts.map((p) => (
                                    <div
                                        key={p.id}
                                        style={{
                                            padding: 14,
                                            border: "1px solid #e5e5e5",
                                            borderRadius: 8,
                                            background: "#fff",
                                        }}
                                    >
                                        {editingPromptId === p.id ? (
                                            <div>
                                                <input
                                                    type="text"
                                                    value={editPromptName}
                                                    onChange={(e) => setEditPromptName(e.target.value)}
                                                    style={{
                                                        width: "100%",
                                                        padding: "6px 10px",
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        borderRadius: 5,
                                                        border: "1px solid #ccc",
                                                        marginBottom: 8,
                                                        boxSizing: "border-box",
                                                    }}
                                                />
                                                <textarea
                                                    value={editPromptBody}
                                                    onChange={(e) => setEditPromptBody(e.target.value)}
                                                    rows={10}
                                                    style={{
                                                        width: "100%",
                                                        padding: "6px 10px",
                                                        fontSize: 13,
                                                        fontFamily: "monospace",
                                                        borderRadius: 5,
                                                        border: "1px solid #ccc",
                                                        marginBottom: 8,
                                                        boxSizing: "border-box",
                                                        resize: "vertical",
                                                    }}
                                                />
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button
                                                        onClick={() => updatePrompt(p.id)}
                                                        disabled={savingPrompt}
                                                        style={{
                                                            padding: "6px 12px",
                                                            fontSize: 12,
                                                            fontWeight: 500,
                                                            borderRadius: 5,
                                                            border: "1px solid #22c55e",
                                                            background: "#f0fdf4",
                                                            color: "#16a34a",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        {savingPrompt ? "Saving…" : "💾 Save"}
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingPromptId(null)}
                                                        style={{
                                                            padding: "6px 12px",
                                                            fontSize: 12,
                                                            borderRadius: 5,
                                                            border: "1px solid #ddd",
                                                            background: "#fff",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{p.name}</h4>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button
                                                            onClick={() => {
                                                                setEditingPromptId(p.id);
                                                                setEditPromptName(p.name);
                                                                setEditPromptBody(p.body);
                                                            }}
                                                            style={{
                                                                padding: "4px 10px",
                                                                fontSize: 11,
                                                                borderRadius: 5,
                                                                border: "1px solid #ddd",
                                                                background: "#fff",
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            ✏️ Edit
                                                        </button>
                                                        <button
                                                            onClick={() => deletePrompt(p.id)}
                                                            style={{
                                                                padding: "4px 10px",
                                                                fontSize: 11,
                                                                borderRadius: 5,
                                                                border: "1px solid #ddd",
                                                                background: "#fff",
                                                                cursor: "pointer",
                                                                color: "#ef4444",
                                                            }}
                                                        >
                                                            🗑 Delete
                                                        </button>
                                                    </div>
                                                </div>
                                                <pre
                                                    style={{
                                                        margin: 0,
                                                        padding: 10,
                                                        background: "#f8fafc",
                                                        borderRadius: 6,
                                                        fontSize: 12,
                                                        fontFamily: "monospace",
                                                        whiteSpace: "pre-wrap",
                                                        wordBreak: "break-word",
                                                        maxHeight: 200,
                                                        overflowY: "auto",
                                                        color: "#555",
                                                        border: "1px solid #eee",
                                                    }}
                                                >
                                                    {p.body}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}
            {promptCompanyId && (
                <div
                    onClick={closePromptPanel}
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 580,
                        bottom: 0,
                        background: "rgba(0,0,0,0.15)",
                        zIndex: 999,
                    }}
                />
            )}
        </main>
    );
}
