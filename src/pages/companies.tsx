import { useState, useEffect, useCallback } from "react";
import type { GetServerSideProps } from "next";
import type { ImageStyleCategory, VoiceProfile, BrandEngine } from "@/brand/engine";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
    Pencil, Trash2, Mic, FileText, Plus, ChevronDown, ChevronRight,
    Copy as CopyIcon, X, AlertCircle, CheckCircle2, Save, Sparkles, Search,
    Globe, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};

type Company = {
    id: string; name: string; tagline: string | null; mission: string | null;
    archetype: string | null; tone: string | null; target_audiences: string[] | null;
    photography_style: string | null; color_primary: string | null; color_secondary: string | null;
    avoid_phrases: string | null; image_style_categories: ImageStyleCategory[] | null;
    voice_profile: VoiceProfile | null; editorial_guidelines: string | null;
    seo_content_guidelines: string | null;
    reference_articles: string[] | null; evals: BrandEngine["evals"] | null;
    auto_humanize: boolean | null; include_toc: boolean | null; created_at: string;
};

type CompanyPrompt = { id: string; company_id: string; name: string; body: string; created_at: string; };

const EMPTY_FORM = {
    name: "", tagline: "", mission: "", archetype: "guide", tone: "confident, clear, modern",
    target_audiences: "", photography_style: "", color_primary: "#000000", color_secondary: "#FFFFFF",
    avoid_phrases: "", editorial_guidelines: "", seo_content_guidelines: "", reference_articles: [] as string[],
    useCustomStyles: false, image_style_categories: [] as ImageStyleCategory[], auto_humanize: true, include_toc: false,
};

export default function CompaniesPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [expandedStyles, setExpandedStyles] = useState<Set<number>>(new Set());
    const [newRefUrl, setNewRefUrl] = useState("");
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // URL import state
    const [importUrl, setImportUrl] = useState("");
    const [importing, setImporting] = useState(false);
    const [importErr, setImportErr] = useState<string | null>(null);
    const [importSuccess, setImportSuccess] = useState(false);
    const [importNotes, setImportNotes] = useState<string | null>(null);

    // Composite image search state (keyed by style idx)
    type SearchImage = { title: string; imageUrl: string; thumbnailUrl: string; source: string; domain: string };
    const [csBgSearchQuery, setCsBgSearchQuery] = useState<Record<number, string>>({});
    const [csBgSearchResults, setCsBgSearchResults] = useState<Record<number, SearchImage[]>>({});
    const [csBgSearching, setCsBgSearching] = useState<Record<number, boolean>>({});
    const [csProductSearchQuery, setCsProductSearchQuery] = useState<Record<number, string>>({});
    const [csProductSearchResults, setCsProductSearchResults] = useState<Record<number, SearchImage[]>>({});
    const [csProductSearching, setCsProductSearching] = useState<Record<number, boolean>>({});

    async function onCsBgSearch(idx: number) {
        const q = csBgSearchQuery[idx]?.trim();
        if (!q) return;
        setCsBgSearching((prev) => ({ ...prev, [idx]: true }));
        try {
            const r = await fetch("/api/image-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, num: 8 }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Search failed");
            setCsBgSearchResults((prev) => ({ ...prev, [idx]: data.images ?? [] }));
        } catch { setCsBgSearchResults((prev) => ({ ...prev, [idx]: [] })); }
        finally { setCsBgSearching((prev) => ({ ...prev, [idx]: false })); }
    }

    async function onCsProductSearch(idx: number) {
        const q = csProductSearchQuery[idx]?.trim();
        if (!q) return;
        setCsProductSearching((prev) => ({ ...prev, [idx]: true }));
        try {
            const r = await fetch("/api/image-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: q, num: 8 }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Search failed");
            setCsProductSearchResults((prev) => ({ ...prev, [idx]: data.images ?? [] }));
        } catch { setCsProductSearchResults((prev) => ({ ...prev, [idx]: [] })); }
        finally { setCsProductSearching((prev) => ({ ...prev, [idx]: false })); }
    }

    // Voice
    const [voiceCompanyId, setVoiceCompanyId] = useState<string | null>(null);
    const [voiceInput, setVoiceInput] = useState("");
    const [analyzingVoice, setAnalyzingVoice] = useState(false);
    const [voiceErr, setVoiceErr] = useState<string | null>(null);
    const [pendingVoiceProfile, setPendingVoiceProfile] = useState<VoiceProfile | null>(null);
    const [savingVoice, setSavingVoice] = useState(false);
    const [voiceSaved, setVoiceSaved] = useState(false);
    const [editingVoiceProfile, setEditingVoiceProfile] = useState<VoiceProfile | null>(null);
    const [voiceDirty, setVoiceDirty] = useState(false);

    // Prompts
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
        setVoiceCompanyId(companyId); setVoiceInput(""); setVoiceErr(null); setPendingVoiceProfile(null); setVoiceSaved(false); setVoiceDirty(false);
        setEditingVoiceProfile(company?.voice_profile ? { ...company.voice_profile } : null);
    }
    function closeVoicePanel() { setVoiceCompanyId(null); setVoiceInput(""); setVoiceErr(null); setPendingVoiceProfile(null); setVoiceSaved(false); setEditingVoiceProfile(null); setVoiceDirty(false); }
    function updateVoiceField(key: keyof VoiceProfile, value: string | string[]) { setEditingVoiceProfile((prev) => prev ? { ...prev, [key]: value } : prev); setVoiceDirty(true); }

    function compileVoiceToPrompt(vp: VoiceProfile): string {
        const lines: string[] = [
            `# VOICE PROFILE — PRIORITY DIRECTIVE`,
            ``,
            `> The following voice attributes MUST take priority over all other style guidance.`,
            `> Match this voice exactly. Do not deviate.`,
            ``,
        ];
        if (vp.summary) lines.push(`## Voice Summary`, vp.summary, ``);
        if (vp.tone_descriptors.length > 0) lines.push(`## Tone`, `Be: ${vp.tone_descriptors.join(", ")}`, ``);
        if (vp.pov_and_person) lines.push(`## Point of View`, vp.pov_and_person, ``);
        if (vp.sentence_rhythm) lines.push(`## Sentence Rhythm`, vp.sentence_rhythm, ``);
        if (vp.paragraph_style) lines.push(`## Paragraph Style`, vp.paragraph_style, ``);
        if (vp.vocabulary_level) lines.push(`## Vocabulary`, vp.vocabulary_level, ``);
        if (vp.rhetorical_devices.length > 0) lines.push(`## Rhetorical Devices`, `Use: ${vp.rhetorical_devices.join(", ")}`, ``);
        if (vp.sample_phrases.length > 0) lines.push(`## Signature Phrases`, `Channel phrases like: ${vp.sample_phrases.map(p => `"${p}"`).join(", ")}`, ``);
        if (vp.structural_patterns.length > 0) lines.push(`## Structural Patterns`, vp.structural_patterns.join(", "), ``);
        if ((vp.structural_do ?? []).length > 0) lines.push(`## DO`, ...vp.structural_do!.map(s => `- ${s}`), ``);
        if ((vp.structural_dont ?? []).length > 0) lines.push(`## DON'T`, ...vp.structural_dont!.map(s => `- ${s}`), ``);
        if ((vp.specificity_rules ?? []).length > 0) lines.push(`## Specificity Rules`, ...vp.specificity_rules!.map(s => `- ${s}`), ``);
        if ((vp.length_rules ?? []).length > 0) lines.push(`## Length Rules`, ...vp.length_rules!.map(s => `- ${s}`), ``);
        if (vp.avoid.length > 0) lines.push(`## Patterns to Avoid`, `NEVER use: ${vp.avoid.join(", ")}`, ``);
        if ((vp.banned_phrases ?? []).length > 0) lines.push(`## Banned Phrases — NEVER use these`, ...vp.banned_phrases!.map(p => `- "${p}"`), ``);
        return lines.join("\n");
    }

    function generateVoicePromptTemplate() {
        if (!editingVoiceProfile || !voiceCompanyId) return;
        const body = compileVoiceToPrompt(editingVoiceProfile);
        const companyName = vc?.name ?? "Company";
        closeVoicePanel();
        // Open prompts panel with the generated prompt pre-filled
        setPromptCompanyId(voiceCompanyId);
        setPromptErr(null);
        setNewPromptName(`${companyName} — Voice Priority`);
        setNewPromptBody(body);
        setEditingPromptId(null);
        setLoadingPrompts(true);
        fetch(`/api/prompts?company_id=${voiceCompanyId}`).then(r => r.json()).then(data => { if (Array.isArray(data)) setPrompts(data); })
            .catch(() => setPromptErr("Failed to load prompts")).finally(() => setLoadingPrompts(false));
    }

    async function openPromptPanel(companyId: string) {
        setPromptCompanyId(companyId); setPromptErr(null); setNewPromptName(""); setNewPromptBody(""); setEditingPromptId(null); setLoadingPrompts(true);
        try { const r = await fetch(`/api/prompts?company_id=${companyId}`); const data = await r.json(); if (Array.isArray(data)) setPrompts(data); }
        catch { setPromptErr("Failed to load prompts"); } finally { setLoadingPrompts(false); }
    }
    function closePromptPanel() { setPromptCompanyId(null); setPrompts([]); setPromptErr(null); setEditingPromptId(null); }

    async function addPrompt() {
        if (!promptCompanyId || !newPromptName.trim() || !newPromptBody.trim()) return;
        setSavingPrompt(true); setPromptErr(null);
        try { const r = await fetch("/api/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company_id: promptCompanyId, name: newPromptName.trim(), body: newPromptBody.trim() }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Save failed"); setPrompts((prev) => [data, ...prev]); setNewPromptName(""); setNewPromptBody(""); }
        catch (e: any) { setPromptErr(e.message); } finally { setSavingPrompt(false); }
    }
    async function updatePrompt(id: string) {
        setSavingPrompt(true); setPromptErr(null);
        try { const r = await fetch(`/api/prompts/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editPromptName.trim(), body: editPromptBody.trim() }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Update failed"); setPrompts((prev) => prev.map((p) => (p.id === id ? data : p))); setEditingPromptId(null); }
        catch (e: any) { setPromptErr(e.message); } finally { setSavingPrompt(false); }
    }
    async function deletePrompt(id: string) { try { await fetch(`/api/prompts/${id}`, { method: "DELETE" }); setPrompts((prev) => prev.filter((p) => p.id !== id)); } catch { setPromptErr("Failed to delete prompt"); } }

    const fetchCompanies = useCallback(async () => {
        setLoading(true); setErr(null);
        try { const r = await fetch("/api/companies"); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Failed to fetch"); setCompanies(data); }
        catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    }, []);
    useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

    function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); setImportUrl(""); setImportErr(null); setImportSuccess(false); setImportNotes(null); }

    async function handleUrlImport() {
        if (!importUrl.trim()) return;
        setImporting(true); setImportErr(null); setImportSuccess(false); setImportNotes(null);
        try {
            const r = await fetch("/api/crawl-brand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: importUrl.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Import failed");
            const b = data.brand;
            const hasImageStyles = Array.isArray(b.image_style_categories) && b.image_style_categories.length > 0;
            setForm((prev) => ({
                ...prev,
                name: b.name || prev.name,
                tagline: b.tagline || prev.tagline,
                mission: b.mission || prev.mission,
                archetype: b.archetype || prev.archetype,
                tone: b.tone || prev.tone,
                target_audiences: b.target_audiences || prev.target_audiences,
                photography_style: b.photography_style || prev.photography_style,
                color_primary: b.color_primary || prev.color_primary,
                color_secondary: b.color_secondary || prev.color_secondary,
                avoid_phrases: b.avoid_phrases || prev.avoid_phrases,
                editorial_guidelines: b.editorial_guidelines || prev.editorial_guidelines,
                ...(hasImageStyles ? {
                    useCustomStyles: true,
                    image_style_categories: b.image_style_categories,
                } : {}),
            }));
            setImportSuccess(true);
            if (data.fallback) {
                setImportNotes(`⚠️ Website couldn't be crawled — all fields were pre-filled using AI knowledge of this brand. Review every field carefully. ${b.confidence_notes || ""}`);
            } else {
                setImportNotes(b.confidence_notes || null);
            }
        } catch (e: any) {
            setImportErr(e.message);
        } finally {
            setImporting(false);
        }
    }
    function openEdit(c: Company) {
        setEditingId(c.id);
        const hasCustomStyles = Array.isArray(c.image_style_categories) && c.image_style_categories.length > 0;
        setForm({
            name: c.name, tagline: c.tagline ?? "", mission: c.mission ?? "", archetype: c.archetype ?? "guide",
            tone: c.tone ?? "confident, clear, modern", target_audiences: (c.target_audiences ?? []).join(", "),
            photography_style: c.photography_style ?? "", color_primary: c.color_primary ?? "#000000",
            color_secondary: c.color_secondary ?? "#FFFFFF", avoid_phrases: c.avoid_phrases ?? "",
            editorial_guidelines: c.editorial_guidelines ?? "", seo_content_guidelines: c.seo_content_guidelines ?? "", reference_articles: c.reference_articles ?? [],
            useCustomStyles: hasCustomStyles, image_style_categories: hasCustomStyles ? c.image_style_categories! : [],
            auto_humanize: c.auto_humanize !== false,
            include_toc: c.include_toc === true,
        });
        setShowForm(true);
        // Scroll to top so the form is visible
        document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
    }
    function closeForm() { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }
    function setField(key: string, value: string) { setForm((prev) => ({ ...prev, [key]: value })); }

    async function handleSubmit() {
        if (!form.name.trim()) { alert("Company name is required"); return; }
        setSaving(true);
        try {
            const body = { ...form, target_audiences: form.target_audiences.split(",").map((s) => s.trim()).filter(Boolean), image_style_categories: form.useCustomStyles && form.image_style_categories.length > 0 ? form.image_style_categories : null };
            const { useCustomStyles, ...payload } = body;
            const url = editingId ? `/api/companies/${editingId}` : "/api/companies";
            const method = editingId ? "PUT" : "POST";
            const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const data = await r.json(); if (!r.ok) throw new Error(data.error || "Save failed");
            if (editingId) { setCompanies((prev) => prev.map((c) => (c.id === editingId ? data : c))); } else { setCompanies((prev) => [data, ...prev]); }
            closeForm();
        } catch (e: any) { alert(e.message); } finally { setSaving(false); }
    }

    async function deleteCompany(id: string) {
        setDeletingId(id);
        try { const r = await fetch(`/api/companies/${id}`, { method: "DELETE" }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Delete failed"); setCompanies((prev) => prev.filter((c) => c.id !== id)); setConfirmDeleteId(null); }
        catch (e: any) { alert(e.message); } finally { setDeletingId(null); }
    }

    const vc = voiceCompanyId ? companies.find((c) => c.id === voiceCompanyId) : null;
    const pc = promptCompanyId ? companies.find((c) => c.id === promptCompanyId) : null;

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-end">
                    <Button onClick={openCreate} className="gap-1.5"><Plus className="h-4 w-4" /> New Company</Button>
                </div>

                {loading && <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>}
                {err && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{err}</AlertDescription></Alert>}

                {/* Company Form */}
                {showForm && (
                    <Card>
                        <CardContent className="p-6 space-y-4">
                            <h2 className="text-lg font-semibold">{editingId ? "Edit Company" : "New Company"}</h2>

                            {/* URL Import Section — only for new companies */}
                            {!editingId && (
                                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Globe className="h-4 w-4 text-primary" />
                                        <Label className="text-sm font-semibold">Import from Website</Label>
                                        <span className="text-xs text-muted-foreground">— paste a URL and we'll extract brand info automatically</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            type="url"
                                            value={importUrl}
                                            onChange={(e) => setImportUrl(e.target.value)}
                                            placeholder="https://example.com"
                                            disabled={importing}
                                            onKeyDown={(e) => { if (e.key === "Enter" && importUrl.trim()) { e.preventDefault(); handleUrlImport(); } }}
                                        />
                                        <Button
                                            variant="outline"
                                            onClick={handleUrlImport}
                                            disabled={importing || !importUrl.trim()}
                                            className="gap-1.5 whitespace-nowrap"
                                        >
                                            {importing ? (
                                                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Scanning…</>
                                            ) : (
                                                <><Globe className="h-3.5 w-3.5" /> Scan Website</>
                                            )}
                                        </Button>
                                    </div>
                                    {importing && (
                                        <p className="text-xs text-muted-foreground animate-pulse">
                                            Crawling pages and analyzing brand signals… this takes 10–20 seconds.
                                        </p>
                                    )}
                                    {importErr && (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>{importErr}</AlertDescription>
                                        </Alert>
                                    )}
                                    {importSuccess && (
                                        <Alert className="border-success bg-success/5">
                                            <CheckCircle2 className="h-4 w-4 text-success" />
                                            <AlertDescription className="text-success">
                                                Brand data extracted! Review the fields below and edit as needed.
                                                {importNotes && (
                                                    <span className="block mt-1 text-xs text-muted-foreground font-normal">
                                                        <strong>AI notes:</strong> {importNotes}
                                                    </span>
                                                )}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5"><Label>Company Name *</Label><Input value={form.name} onChange={(e) => setField("name", e.target.value)} placeholder="Acme Corp" /></div>
                                <div className="space-y-1.5"><Label>Tagline</Label><Input value={form.tagline} onChange={(e) => setField("tagline", e.target.value)} placeholder="Building the future" /></div>
                            </div>

                            <div className="space-y-1.5"><Label>Mission</Label><Textarea value={form.mission} onChange={(e) => setField("mission", e.target.value)} placeholder="Our mission is to..." rows={2} /></div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Brand Archetype</Label>
                                    <select value={form.archetype} onChange={(e) => setField("archetype", e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
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
                                <div className="space-y-1.5"><Label>Tone (comma-separated)</Label><Input value={form.tone} onChange={(e) => setField("tone", e.target.value)} placeholder="empathetic, confident, modern" /></div>
                            </div>

                            <div className="space-y-1.5"><Label>Target Audiences (comma-separated)</Label><Input value={form.target_audiences} onChange={(e) => setField("target_audiences", e.target.value)} placeholder="developers, startups, enterprises" /></div>
                            <div className="space-y-1.5"><Label>Photography / Image Style</Label><Textarea value={form.photography_style} onChange={(e) => setField("photography_style", e.target.value)} placeholder="Clean, minimal tech photography..." rows={2} /></div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label>Primary Color</Label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={form.color_primary} onChange={(e) => setField("color_primary", e.target.value)} className="w-10 h-9 border-none cursor-pointer rounded" />
                                        <Input value={form.color_primary} onChange={(e) => setField("color_primary", e.target.value)} className="flex-1" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Secondary Color</Label>
                                    <div className="flex gap-2 items-center">
                                        <input type="color" value={form.color_secondary} onChange={(e) => setField("color_secondary", e.target.value)} className="w-10 h-9 border-none cursor-pointer rounded" />
                                        <Input value={form.color_secondary} onChange={(e) => setField("color_secondary", e.target.value)} className="flex-1" />
                                    </div>
                                </div>
                                <div className="space-y-1.5"><Label>Avoid Phrases</Label><Input value={form.avoid_phrases} onChange={(e) => setField("avoid_phrases", e.target.value)} placeholder="synergy, disrupt" /></div>
                            </div>

                            <details className="group border border-border rounded-lg">
                                <summary className="flex items-center justify-between cursor-pointer px-4 py-2.5 select-none hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                                        <Label className="cursor-pointer text-sm font-semibold">Editorial Guidelines</Label>
                                        {form.editorial_guidelines && <span className="text-xs text-muted-foreground">({form.editorial_guidelines.length} chars)</span>}
                                    </div>
                                </summary>
                                <div className="px-4 pb-4 pt-1 space-y-1.5">
                                    <Textarea value={form.editorial_guidelines} onChange={(e) => setField("editorial_guidelines", e.target.value)} placeholder="Company-specific voice, tone, citation rules..." rows={10} />
                                </div>
                            </details>

                            <details className="group border border-border rounded-lg">
                                <summary className="flex items-center justify-between cursor-pointer px-4 py-2.5 select-none hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                                        <Label className="cursor-pointer text-sm font-semibold">SEO Content Guidelines</Label>
                                        {form.seo_content_guidelines && <span className="text-xs text-muted-foreground">({form.seo_content_guidelines.length} chars)</span>}
                                    </div>
                                </summary>
                                <div className="px-4 pb-4 pt-1 space-y-1.5">
                                    <p className="text-xs text-muted-foreground">Company-specific SEO rules injected into every article prompt. Supplements the built-in SEO framework.</p>
                                    <Textarea value={form.seo_content_guidelines} onChange={(e) => setField("seo_content_guidelines", e.target.value)} placeholder="e.g. Target keywords must include city + service format. Always include a local comparison table. Minimum 3 external authority links per article..." rows={8} />
                                </div>
                            </details>

                            {/* Auto-Humanize & TOC */}
                            <Separator />
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={form.auto_humanize} onChange={(e) => setForm((prev) => ({ ...prev, auto_humanize: e.target.checked }))} className="h-4 w-4 rounded" />
                                <div>
                                    <div className="text-sm font-semibold">🧹 Auto-Humanize Generated Content</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">Automatically humanizes articles after generation. Adds ~30s.</div>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={form.include_toc} onChange={(e) => setForm((prev) => ({ ...prev, include_toc: e.target.checked }))} className="h-4 w-4 rounded" />
                                <div>
                                    <div className="text-sm font-semibold">📑 Include Table of Contents</div>
                                    <div className="text-xs text-muted-foreground mt-0.5">Generates a clickable TOC nav element at the top of each article.</div>
                                </div>
                            </label>

                            {/* Reference Articles */}
                            <Separator />
                            <div className="space-y-2">
                                <Label>Reference Articles</Label>
                                <p className="text-xs text-muted-foreground">Add URLs of gold-standard articles used as style references.</p>
                                {form.reference_articles.map((url, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-primary break-all">{url}</a>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => setForm((prev) => ({ ...prev, reference_articles: prev.reference_articles.filter((_, i) => i !== idx) }))}><X className="h-3 w-3" /></Button>
                                    </div>
                                ))}
                                <div className="flex gap-2">
                                    <Input type="url" value={newRefUrl} onChange={(e) => setNewRefUrl(e.target.value)} placeholder="https://example.com/blog/article" onKeyDown={(e) => { if (e.key === "Enter" && newRefUrl.trim()) { e.preventDefault(); setForm((prev) => ({ ...prev, reference_articles: [...prev.reference_articles, newRefUrl.trim()] })); setNewRefUrl(""); } }} />
                                    <Button variant="outline" size="sm" disabled={!newRefUrl.trim()} onClick={() => { if (newRefUrl.trim()) { setForm((prev) => ({ ...prev, reference_articles: [...prev.reference_articles, newRefUrl.trim()] })); setNewRefUrl(""); } }}>
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Add
                                    </Button>
                                </div>
                            </div>

                            {/* Image Style Categories */}
                            <Separator />
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <Label>Custom Image Styles</Label>
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input type="checkbox" checked={form.useCustomStyles} onChange={(e) => {
                                            const checked = e.target.checked;
                                            setForm((prev) => ({ ...prev, useCustomStyles: checked, image_style_categories: checked && prev.image_style_categories.length === 0 ? [{ id: "default", label: "Default", narrative: "", storytelling_cues: [], image_prompt_style: "" }] : prev.image_style_categories }));
                                        }} className="h-4 w-4 rounded" />
                                        Use custom styles
                                    </label>
                                </div>

                                {form.useCustomStyles && (
                                    <div className="space-y-2.5">
                                        {form.image_style_categories.map((cat, idx) => {
                                            const isExpanded = expandedStyles.has(idx);
                                            return (
                                                <Card key={idx}>
                                                    <div className="flex justify-between items-center px-4 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors select-none"
                                                        onClick={() => setExpandedStyles((prev) => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; })}>
                                                        <span className="text-sm font-medium flex items-center gap-1.5">
                                                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                            {cat.label || `Style #${idx + 1}`}
                                                            {cat.id && <span className="text-xs text-muted-foreground">({cat.id})</span>}
                                                            {cat.type === "composite" && <Badge variant="outline" className="text-[10px] h-4 gap-0.5">🧩 Composite</Badge>}
                                                        </span>
                                                        <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { const clone = { ...cat, label: `${cat.label} (Copy)`, id: `${cat.id}_copy_${Date.now()}`, storytelling_cues: [...cat.storytelling_cues] }; setForm((prev) => ({ ...prev, image_style_categories: [...prev.image_style_categories.slice(0, idx + 1), clone, ...prev.image_style_categories.slice(idx + 1)] })); }}>
                                                                <CopyIcon className="h-3 w-3 mr-1" /> Dup
                                                            </Button>
                                                            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setForm((prev) => ({ ...prev, image_style_categories: prev.image_style_categories.filter((_, i) => i !== idx) }))}>
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <CardContent className="pt-0 pb-4 px-4 space-y-3">
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <div className="space-y-1"><Label className="text-xs">Label *</Label><Input value={cat.label} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], label: e.target.value, id: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }} placeholder="e.g. Families" /></div>
                                                                <div className="space-y-1"><Label className="text-xs">ID</Label><Input value={cat.id} disabled className="bg-muted" /></div>
                                                            </div>
                                                            {/* Style Type */}
                                                            <div className="space-y-1">
                                                                <Label className="text-xs">Style Type</Label>
                                                                <div className="flex items-center gap-4">
                                                                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                                                        <input type="radio" name={`style-type-${idx}`} checked={cat.type !== "composite"} onChange={() => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], type: "prompt" }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }} />
                                                                        🎨 AI Prompt
                                                                    </label>
                                                                    <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                                                        <input type="radio" name={`style-type-${idx}`} checked={cat.type === "composite"} onChange={() => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], type: "composite" }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }} />
                                                                        🧩 Composite Blend
                                                                    </label>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1"><Label className="text-xs">Narrative</Label><Textarea value={cat.narrative} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], narrative: e.target.value }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }} placeholder="Context for this style..." rows={2} /></div>
                                                            <div className="space-y-1"><Label className="text-xs">Storytelling Cues</Label><Input value={cat.storytelling_cues.join(", ")} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], storytelling_cues: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }} placeholder="emphasizes warmth, collaboration" /></div>
                                                            <div className="space-y-1"><Label className="text-xs">Image Prompt Style</Label><Textarea value={cat.image_prompt_style} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], image_prompt_style: e.target.value }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }} placeholder="Detailed style direction..." rows={3} /></div>
                                                            {/* Composite Blend Fields */}
                                                            {cat.type === "composite" && (
                                                                <fieldset className="border border-border rounded-lg p-3.5 space-y-3 bg-muted/30">
                                                                    <legend className="text-xs font-semibold px-1.5">🧩 Composite Blend Defaults</legend>
                                                                    <div className="space-y-1">
                                                                        <Label className="text-xs">Default Background Prompt</Label>
                                                                        <Textarea value={cat.composite_bg_prompt ?? ""} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_bg_prompt: e.target.value }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }} placeholder="e.g. Modern kitchen countertop with soft natural lighting" rows={2} />
                                                                        <p className="text-[11px] text-muted-foreground">AI will generate a background from this prompt when no background image is provided.</p>
                                                                    </div>

                                                                    {/* Background Image — Search + URL */}
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-xs">Default Background Image</Label>
                                                                        <div className="flex gap-2">
                                                                            <Input placeholder="Search for background images..." value={csBgSearchQuery[idx] ?? ""} onChange={(e) => setCsBgSearchQuery((prev) => ({ ...prev, [idx]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onCsBgSearch(idx); } }} />
                                                                            <Button type="button" variant="outline" size="sm" onClick={() => onCsBgSearch(idx)} disabled={csBgSearching[idx] || !csBgSearchQuery[idx]?.trim()} className="whitespace-nowrap gap-1">
                                                                                <Search className="h-3.5 w-3.5" />
                                                                                {csBgSearching[idx] ? "…" : "Search"}
                                                                            </Button>
                                                                        </div>
                                                                        {(csBgSearchResults[idx]?.length ?? 0) > 0 && (
                                                                            <div className="grid grid-cols-4 gap-1.5">
                                                                                {csBgSearchResults[idx]!.map((img, i) => (
                                                                                    <button type="button" key={i} onClick={() => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_bg_image_url: img.imageUrl }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }}
                                                                                        className={cn("rounded-lg overflow-hidden border-2 transition-colors", cat.composite_bg_image_url === img.imageUrl ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50")}>
                                                                                        <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} loading="lazy" className="w-full aspect-[16/9] object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                                                        <div className="px-1 py-0.5 text-[10px] text-muted-foreground truncate">{img.title}</div>
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        {cat.composite_bg_image_url && (
                                                                            <div className="flex items-center gap-2 p-1.5 rounded-md bg-card border border-border">
                                                                                <img src={cat.composite_bg_image_url} alt="Selected background" className="w-16 h-10 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                                                <Input value={cat.composite_bg_image_url} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_bg_image_url: e.target.value }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }} className="text-xs flex-1 h-7" />
                                                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_bg_image_url: "" }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }}><X className="h-3 w-3" /></Button>
                                                                            </div>
                                                                        )}
                                                                        <p className="text-[11px] text-muted-foreground">Search or paste a URL — used instead of AI generation when set.</p>
                                                                    </div>

                                                                    {/* Product Image Search */}
                                                                    <div className="space-y-1.5">
                                                                        <Label className="text-xs">Default Product Search Query</Label>
                                                                        <div className="flex gap-2">
                                                                            <Input value={cat.composite_product_query ?? ""} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_product_query: e.target.value }; setForm((prev) => ({ ...prev, image_style_categories: nc })); }} placeholder="e.g. stainless steel blender product photo"
                                                                                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setCsProductSearchQuery((prev) => ({ ...prev, [idx]: cat.composite_product_query ?? "" })); setTimeout(() => onCsProductSearch(idx), 0); } }} />
                                                                            <Button type="button" variant="outline" size="sm" onClick={() => { setCsProductSearchQuery((prev) => ({ ...prev, [idx]: cat.composite_product_query ?? "" })); setTimeout(() => onCsProductSearch(idx), 0); }} disabled={csProductSearching[idx] || !(cat.composite_product_query?.trim())} className="whitespace-nowrap gap-1">
                                                                                <Search className="h-3.5 w-3.5" />
                                                                                {csProductSearching[idx] ? "…" : "Preview"}
                                                                            </Button>
                                                                        </div>
                                                                        {(csProductSearchResults[idx]?.length ?? 0) > 0 && (
                                                                            <div>
                                                                                <p className="text-[10px] text-muted-foreground mb-1">Preview — these are the products users will see when creating articles with this style:</p>
                                                                                <div className="grid grid-cols-4 gap-1.5">
                                                                                    {csProductSearchResults[idx]!.map((img, i) => (
                                                                                        <div key={i} className="rounded-lg overflow-hidden border border-border">
                                                                                            <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} loading="lazy" className="w-full aspect-square object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                                                            <div className="px-1 py-0.5 text-[10px] text-muted-foreground truncate">{img.title}</div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        <p className="text-[11px] text-muted-foreground">Pre-populates the product image search when creating articles.</p>
                                                                    </div>
                                                                </fieldset>
                                                            )}
                                                        </CardContent>
                                                    )}
                                                </Card>
                                            );
                                        })}
                                        <Button variant="outline" className="border-dashed gap-1" onClick={() => setForm((prev) => ({ ...prev, image_style_categories: [...prev.image_style_categories, { id: "", label: "", narrative: "", storytelling_cues: [], image_prompt_style: "" }] }))}>
                                            <Plus className="h-3.5 w-3.5" /> Add Style
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Form Actions */}
                            <div className="flex gap-2 justify-end pt-2">
                                <Button variant="outline" onClick={closeForm} disabled={saving}>Cancel</Button>
                                <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : editingId ? "Update Company" : "Create Company"}</Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Company List */}
                {!loading && companies.length === 0 && !showForm && (
                    <p className="text-muted-foreground">No companies yet. Click "New Company" to get started.</p>
                )}

                <div className="space-y-3">
                    {companies.map((c) => (
                        <Card key={c.id} className="overflow-visible">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg shrink-0 border border-border" style={{ backgroundColor: c.color_primary ?? "#000" }} />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold">{c.name}</h3>
                                        {c.tagline && <p className="text-sm text-muted-foreground italic">{c.tagline}</p>}
                                        <div className="flex gap-1.5 flex-wrap mt-1.5">
                                            {c.archetype && <Badge variant="secondary" className="text-xs">{c.archetype}</Badge>}
                                            {c.tone && <Badge variant="secondary" className="text-xs">{c.tone}</Badge>}
                                            {c.voice_profile && <Badge variant="outline" className="text-xs gap-1"><Mic className="h-3 w-3" /> Voice</Badge>}
                                            {c.auto_humanize !== false && <Badge variant="outline" className="text-xs text-success border-success/50">🧹 Auto</Badge>}
                                            <span className="text-xs text-muted-foreground self-center">{new Date(c.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 flex-wrap items-center justify-end relative z-10">
                                    <Button variant="outline" size="sm" onClick={() => openEdit(c)} className="gap-1"><Pencil className="h-3 w-3" /> Edit</Button>
                                    <Button variant="outline" size="sm" onClick={() => openVoicePanel(c.id)} className={cn("gap-1", c.voice_profile && "text-primary")}><Mic className="h-3 w-3" /> Voice</Button>
                                    <Button variant="outline" size="sm" onClick={() => openPromptPanel(c.id)} className="gap-1"><FileText className="h-3 w-3" /> Prompts</Button>
                                    {confirmDeleteId === c.id ? (
                                        <div className="flex gap-1">
                                            <Button variant="destructive" size="sm" onClick={() => deleteCompany(c.id)} disabled={deletingId === c.id}>{deletingId === c.id ? "…" : "Confirm"}</Button>
                                            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                                        </div>
                                    ) : (
                                        <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(c.id)} className="text-destructive hover:text-destructive gap-1"><Trash2 className="h-3 w-3" /></Button>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Voice Profile Sheet */}
                <Sheet open={!!voiceCompanyId} onOpenChange={(open) => { if (!open) closeVoicePanel(); }}>
                    <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>🎙️ Voice Profile — {vc?.name}</SheetTitle>
                        </SheetHeader>

                        {editingVoiceProfile && (
                            <div className="space-y-4 mt-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="text-sm font-medium text-primary">{vc?.voice_profile ? "✏️ Edit Voice Profile" : "📝 New Voice Profile"}</h4>
                                    <div className="flex gap-1.5">
                                        <Button size="sm" disabled={savingVoice || !voiceDirty} onClick={async () => {
                                            setSavingVoice(true); setVoiceErr(null);
                                            try { const r = await fetch(`/api/companies/${vc!.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice_profile: editingVoiceProfile }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Save failed"); setCompanies((prev) => prev.map((c) => c.id === vc!.id ? { ...c, voice_profile: editingVoiceProfile } : c)); setVoiceDirty(false); setVoiceSaved(true); setPendingVoiceProfile(null); setTimeout(() => setVoiceSaved(false), 3000); }
                                            catch (e: any) { setVoiceErr(e.message); } finally { setSavingVoice(false); }
                                        }} className="gap-1">
                                            <Save className="h-3 w-3" /> {savingVoice ? "Saving…" : "Save"}
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={generateVoicePromptTemplate} className="gap-1">
                                            <Sparkles className="h-3 w-3" /> Generate Prompt
                                        </Button>
                                        {vc?.voice_profile && (
                                            <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                                                try { await fetch(`/api/companies/${vc!.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voice_profile: null }) }); setCompanies((prev) => prev.map((c) => c.id === vc!.id ? { ...c, voice_profile: null } : c)); setEditingVoiceProfile(null); setVoiceDirty(false); } catch {}
                                            }}>Clear</Button>
                                        )}
                                    </div>
                                </div>
                                {voiceSaved && <Alert className="border-success bg-success/5"><CheckCircle2 className="h-4 w-4 text-success" /><AlertDescription className="text-success">Voice profile saved!</AlertDescription></Alert>}

                                {/* Voice & Tone */}
                                <fieldset className="border border-border rounded-lg p-3.5 space-y-2.5">
                                    <legend className="text-xs font-semibold px-1.5">Voice & Tone</legend>
                                    <div className="space-y-1"><Label className="text-xs">Summary</Label><Textarea value={editingVoiceProfile.summary} onChange={(e) => updateVoiceField("summary", e.target.value)} rows={2} className="text-xs" /></div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="space-y-1"><Label className="text-xs">Tone Descriptors</Label><Input value={editingVoiceProfile.tone_descriptors.join(", ")} onChange={(e) => updateVoiceField("tone_descriptors", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="text-xs" placeholder="direct, informative" /></div>
                                        <div className="space-y-1"><Label className="text-xs">POV & Person</Label><Input value={editingVoiceProfile.pov_and_person} onChange={(e) => updateVoiceField("pov_and_person", e.target.value)} className="text-xs" /></div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="space-y-1"><Label className="text-xs">Sentence Rhythm</Label><Textarea value={editingVoiceProfile.sentence_rhythm} onChange={(e) => updateVoiceField("sentence_rhythm", e.target.value)} rows={2} className="text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">Paragraph Style</Label><Textarea value={editingVoiceProfile.paragraph_style} onChange={(e) => updateVoiceField("paragraph_style", e.target.value)} rows={2} className="text-xs" /></div>
                                    </div>
                                    <div className="space-y-1"><Label className="text-xs">Vocabulary Level</Label><Textarea value={editingVoiceProfile.vocabulary_level} onChange={(e) => updateVoiceField("vocabulary_level", e.target.value)} rows={2} className="text-xs" /></div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="space-y-1"><Label className="text-xs">Rhetorical Devices</Label><Input value={editingVoiceProfile.rhetorical_devices.join(", ")} onChange={(e) => updateVoiceField("rhetorical_devices", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">Sample Phrases</Label><Input value={editingVoiceProfile.sample_phrases.join(", ")} onChange={(e) => updateVoiceField("sample_phrases", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="text-xs" /></div>
                                    </div>
                                    <div className="space-y-1"><Label className="text-xs">Patterns to Avoid</Label><Input value={editingVoiceProfile.avoid.join(", ")} onChange={(e) => updateVoiceField("avoid", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="text-xs" /></div>
                                </fieldset>

                                {/* Banned Phrases */}
                                <fieldset className="border border-border rounded-lg p-3.5 space-y-1">
                                    <legend className="text-xs font-semibold px-1.5">Banned Phrases</legend>
                                    <Textarea value={(editingVoiceProfile.banned_phrases ?? []).join("\n")} onChange={(e) => updateVoiceField("banned_phrases", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))} rows={4} placeholder="One phrase per line" className="text-xs font-mono" />
                                    <p className="text-[11px] text-muted-foreground">One phrase per line. Never appears in generated content.</p>
                                </fieldset>

                                {/* Structure */}
                                <fieldset className="border border-border rounded-lg p-3.5 space-y-2.5">
                                    <legend className="text-xs font-semibold px-1.5">Structure</legend>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="space-y-1"><Label className="text-xs">Structural Patterns</Label><Input value={editingVoiceProfile.structural_patterns.join(", ")} onChange={(e) => updateVoiceField("structural_patterns", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs text-success">✓ Do Use</Label><Input value={(editingVoiceProfile.structural_do ?? []).join(", ")} onChange={(e) => updateVoiceField("structural_do", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="text-xs" /></div>
                                    </div>
                                    <div className="space-y-1"><Label className="text-xs text-destructive">✗ Don't Use</Label><Input value={(editingVoiceProfile.structural_dont ?? []).join(", ")} onChange={(e) => updateVoiceField("structural_dont", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="text-xs" /></div>
                                </fieldset>

                                {/* Specificity */}
                                <fieldset className="border border-border rounded-lg p-3.5 space-y-2.5">
                                    <legend className="text-xs font-semibold px-1.5">Specificity & Length</legend>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        <div className="space-y-1"><Label className="text-xs">Specificity Rules</Label><Textarea value={(editingVoiceProfile.specificity_rules ?? []).join("\n")} onChange={(e) => updateVoiceField("specificity_rules", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))} rows={3} className="text-xs" /></div>
                                        <div className="space-y-1"><Label className="text-xs">Length Rules</Label><Textarea value={(editingVoiceProfile.length_rules ?? []).join("\n")} onChange={(e) => updateVoiceField("length_rules", e.target.value.split("\n").map(s => s.trim()).filter(Boolean))} rows={3} className="text-xs" /></div>
                                    </div>
                                </fieldset>
                            </div>
                        )}

                        {/* Analysis input */}
                        <div className="space-y-2 mt-6">
                            <Label className="text-sm">{vc?.voice_profile ? "Analyze a new article to update:" : "Paste sample article to analyze:"}</Label>
                            <Textarea value={voiceInput} onChange={(e) => setVoiceInput(e.target.value)} placeholder="Paste article text or HTML..." rows={10} />
                            <div className="flex gap-2 items-center">
                                <Button onClick={async () => {
                                    if (voiceInput.trim().length < 50) { setVoiceErr("Please paste at least 50 characters."); return; }
                                    setAnalyzingVoice(true); setVoiceErr(null);
                                    try { const r = await fetch("/api/analyze-voice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html: voiceInput.trim(), company_id: vc!.id }) }); const data = await r.json(); if (!r.ok) throw new Error(data.error || "Analysis failed"); setEditingVoiceProfile(data.voice_profile); setVoiceDirty(true); setVoiceInput(""); }
                                    catch (e: any) { setVoiceErr(e.message); } finally { setAnalyzingVoice(false); }
                                }} disabled={analyzingVoice || voiceInput.trim().length < 50} className="gap-1.5">
                                    <Mic className="h-4 w-4" /> {analyzingVoice ? "Analyzing…" : "Analyze Voice"}
                                </Button>
                                {analyzingVoice && <span className="text-xs text-muted-foreground">15-30 seconds…</span>}
                            </div>
                            {voiceErr && <p className="text-sm text-destructive">{voiceErr}</p>}
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Prompt Templates Sheet */}
                <Sheet open={!!promptCompanyId} onOpenChange={(open) => { if (!open) closePromptPanel(); }}>
                    <SheetContent className="w-[580px] sm:max-w-[580px] overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle>📝 Prompt Templates — {pc?.name}</SheetTitle>
                        </SheetHeader>
                        {promptErr && <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{promptErr}</AlertDescription></Alert>}

                        {/* Add */}
                        <Card className="mt-4">
                            <CardContent className="p-4 space-y-2">
                                <h4 className="text-sm font-medium">Add New Template</h4>
                                <Input placeholder="Template name" value={newPromptName} onChange={(e) => setNewPromptName(e.target.value)} />
                                <Textarea placeholder="Prompt template body…" value={newPromptBody} onChange={(e) => setNewPromptBody(e.target.value)} rows={8} className="font-mono text-xs max-h-64 overflow-y-auto" />
                                <div className="sticky bottom-0 bg-card pt-2">
                                    <Button variant="outline" onClick={addPrompt} disabled={savingPrompt || !newPromptName.trim() || !newPromptBody.trim()} className="gap-1 w-full">
                                        <Plus className="h-3.5 w-3.5" /> {savingPrompt ? "Saving…" : "Add Template"}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* List */}
                        <div className="space-y-3 mt-4">
                            {loadingPrompts ? <Skeleton className="h-20 w-full" /> : prompts.length === 0 ? (
                                <p className="text-sm text-muted-foreground italic">No templates yet.</p>
                            ) : prompts.map((p) => (
                                <Card key={p.id}>
                                    <CardContent className="p-3.5">
                                        {editingPromptId === p.id ? (
                                            <div className="space-y-2">
                                                <Input value={editPromptName} onChange={(e) => setEditPromptName(e.target.value)} className="font-semibold" />
                                                <Textarea value={editPromptBody} onChange={(e) => setEditPromptBody(e.target.value)} rows={10} className="font-mono text-xs" />
                                                <div className="flex gap-1.5">
                                                    <Button size="sm" onClick={() => updatePrompt(p.id)} disabled={savingPrompt} className="gap-1"><Save className="h-3 w-3" /> {savingPrompt ? "Saving…" : "Save"}</Button>
                                                    <Button variant="outline" size="sm" onClick={() => setEditingPromptId(null)}>Cancel</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-semibold text-sm">{p.name}</h4>
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditingPromptId(p.id); setEditPromptName(p.name); setEditPromptBody(p.body); }}>
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => deletePrompt(p.id)}>
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <pre className="whitespace-pre-wrap break-words text-xs text-muted-foreground bg-muted p-2.5 rounded-md max-h-48 overflow-y-auto">{p.body}</pre>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </SheetContent>
                </Sheet>
            </div>
        </AppLayout>
    );
}
