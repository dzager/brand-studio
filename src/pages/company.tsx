import { useState, useEffect, useRef } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import type { ImageStyleCategory, VoiceProfile } from "@/brand/engine";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    ChevronDown, ChevronRight, AlertCircle, Mic, FileText,
    Palette, Eye, BookOpen, Search as SearchIcon, Settings2,
    Layers, Copy as CopyIcon, CheckCircle2, Save, X, Plus, Trash2,
    Camera, ImagePlus, Loader2, Sparkles, Cpu,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const getServerSideProps: GetServerSideProps = async () => {
    return { props: {} };
};

type CompanyPrompt = { id: string; company_id: string; name: string; body: string; created_at: string };

type CompanyData = {
    id: string; name: string; tagline: string | null; mission: string | null;
    archetype: string | null; tone: string | null; target_audiences: string[] | null;
    photography_style: string | null; color_primary: string | null; color_secondary: string | null;
    avoid_phrases: string | null; image_style_categories: ImageStyleCategory[] | null;
    voice_profile: VoiceProfile | null; editorial_guidelines: string | null;
    seo_content_guidelines: string | null; reference_articles: string[] | null;
    auto_humanize: boolean | null; include_toc: boolean | null; created_at: string;
    prompts: CompanyPrompt[];
};

/* ── Collapsible Section ─────────────────────────────────────────── */
function Section({ title, icon: Icon, badge, defaultOpen, children }: {
    title: string; icon: React.ElementType; badge?: React.ReactNode;
    defaultOpen?: boolean; children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen ?? false);
    return (
        <Card>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
            >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {title}
                    {badge}
                </span>
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {open && (
                <CardContent className="pt-0 pb-5 px-5 border-t border-border">
                    {children}
                </CardContent>
            )}
        </Card>
    );
}

/* ── Field components (read-only / editable) ─────────────────────── */
function Field({ label, value, mono, editing, onChange, rows }: {
    label: string; value?: string | null; mono?: boolean;
    editing?: boolean; onChange?: (v: string) => void; rows?: number;
}) {
    if (!editing && !value) return null;
    return (
        <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            {editing ? (
                rows ? <Textarea value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} rows={rows} className="text-sm" />
                    : <Input value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} className="text-sm" />
            ) : (
                <div className={cn("text-sm leading-relaxed", mono && "font-mono text-xs bg-muted rounded-md p-2.5 whitespace-pre-wrap")}>{value}</div>
            )}
        </div>
    );
}

function FieldList({ label, items, editing, onChange, placeholder }: {
    label: string; items?: string[] | null;
    editing?: boolean; onChange?: (v: string[]) => void; placeholder?: string;
}) {
    if (!editing && (!items || items.length === 0)) return null;
    return (
        <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            {editing ? (
                <Input value={(items ?? []).join(", ")} onChange={(e) => onChange?.(e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder={placeholder ?? "comma-separated"} className="text-sm" />
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {items!.map((item, i) => <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>)}
                </div>
            )}
        </div>
    );
}

/* ── Company Card (used for both single and multi mode) ──────────── */
function CompanyBrand({ company, onSaved }: { company: CompanyData; onSaved?: (c: CompanyData) => void }) {
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [editing, setEditing] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [newRefUrl, setNewRefUrl] = useState("");
    const [expandedStyles, setExpandedStyles] = useState<Set<number>>(new Set());
    const hasCustomStyles = Array.isArray(company.image_style_categories) && company.image_style_categories.length > 0;
    const defaultVP: VoiceProfile = { summary: "", tone_descriptors: [], sentence_rhythm: "", paragraph_style: "", vocabulary_level: "", rhetorical_devices: [], structural_patterns: [], pov_and_person: "", sample_phrases: [], avoid: [], banned_phrases: [], structural_do: [], structural_dont: [], specificity_rules: [], length_rules: [] };
    const [form, setForm] = useState(() => ({
        name: company.name, tagline: company.tagline ?? "", mission: company.mission ?? "",
        archetype: company.archetype ?? "guide", tone: company.tone ?? "",
        target_audiences: company.target_audiences ?? [],
        photography_style: company.photography_style ?? "",
        color_primary: company.color_primary ?? "#000000", color_secondary: company.color_secondary ?? "#FFFFFF",
        avoid_phrases: company.avoid_phrases ?? "",
        editorial_guidelines: company.editorial_guidelines ?? "",
        seo_content_guidelines: company.seo_content_guidelines ?? "",
        auto_humanize: company.auto_humanize !== false, include_toc: company.include_toc === true,
        reference_articles: company.reference_articles ?? [] as string[],
        useCustomStyles: hasCustomStyles,
        image_style_categories: hasCustomStyles ? company.image_style_categories! : [] as ImageStyleCategory[],
        voice_profile: company.voice_profile ? { ...company.voice_profile } : null as VoiceProfile | null,
    }));

    // Image Style Extraction state
    type ImageStyleAnalysis = {
        style_name: string;
        image_prompt_style: string;
        narrative: string;
        storytelling_cues: string[];
        analysis: {
            color_palette: string;
            dominant_colors: string[];
            tone_mood: string;
            subject_matter: string;
            photo_style_type: string;
            lens_characteristics: string;
            film_quality: string;
            contrast: string;
            hue_temperature: string;
            lighting: string;
            composition: string;
            depth_of_field: string;
            texture_grain: string;
            saturation: string;
            post_processing: string;
            era_aesthetic: string;
        };
    };
    const [showImageExtract, setShowImageExtract] = useState(false);
    const [extractPreviewUrl, setExtractPreviewUrl] = useState<string | null>(null);
    const [extractBase64, setExtractBase64] = useState<string | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [extractErr, setExtractErr] = useState<string | null>(null);
    const [extractResult, setExtractResult] = useState<ImageStyleAnalysis | null>(null);
    const [extractStyleName, setExtractStyleName] = useState("");
    const imageInputRef = useRef<HTMLInputElement>(null);

    function openImageExtract() {
        setShowImageExtract(true); setExtractPreviewUrl(null); setExtractBase64(null);
        setExtracting(false); setExtractErr(null); setExtractResult(null); setExtractStyleName("");
    }
    function closeImageExtract() {
        setShowImageExtract(false); setExtractPreviewUrl(null); setExtractBase64(null);
        setExtracting(false); setExtractErr(null); setExtractResult(null); setExtractStyleName("");
    }
    function handleImageFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { setExtractErr("Please select an image file (JPEG, PNG, WebP)."); return; }
        if (file.size > 10 * 1024 * 1024) { setExtractErr("Image must be under 10MB."); return; }
        setExtractErr(null); setExtractResult(null);
        const reader = new FileReader();
        reader.onload = (ev) => { const dataUrl = ev.target?.result as string; setExtractPreviewUrl(dataUrl); setExtractBase64(dataUrl); };
        reader.readAsDataURL(file);
    }
    async function handleImageExtract() {
        if (!extractBase64) return;
        setExtracting(true); setExtractErr(null);
        try {
            const r = await fetch("/api/analyze-image-style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_base64: extractBase64 }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Analysis failed");
            setExtractResult(data.style); setExtractStyleName(data.style.style_name || "");
        } catch (e: any) { setExtractErr(e.message); }
        finally { setExtracting(false); }
    }
    function addExtractedStyle() {
        if (!extractResult) return;
        const name = extractStyleName.trim() || extractResult.style_name;
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        const newStyle: ImageStyleCategory = { id, label: name, narrative: extractResult.narrative, storytelling_cues: extractResult.storytelling_cues, image_prompt_style: extractResult.image_prompt_style };
        setForm(prev => ({ ...prev, useCustomStyles: true, image_style_categories: [...prev.image_style_categories, newStyle] }));
        setExpandedStyles(prev => { const next = new Set(prev); next.add(form.image_style_categories.length); return next; });
        closeImageExtract();
    }

    function startEdit() {
        const hcs = Array.isArray(company.image_style_categories) && company.image_style_categories.length > 0;
        setForm({
            name: company.name, tagline: company.tagline ?? "", mission: company.mission ?? "",
            archetype: company.archetype ?? "guide", tone: company.tone ?? "",
            target_audiences: company.target_audiences ?? [],
            photography_style: company.photography_style ?? "",
            color_primary: company.color_primary ?? "#000000", color_secondary: company.color_secondary ?? "#FFFFFF",
            avoid_phrases: company.avoid_phrases ?? "",
            editorial_guidelines: company.editorial_guidelines ?? "",
            seo_content_guidelines: company.seo_content_guidelines ?? "",
            auto_humanize: company.auto_humanize !== false, include_toc: company.include_toc === true,
            reference_articles: company.reference_articles ?? [],
            useCustomStyles: hcs,
            image_style_categories: hcs ? company.image_style_categories! : [],
            voice_profile: company.voice_profile ? { ...company.voice_profile } : null,
        });
        setEditing(true); setSaveErr(null); setSaved(false); setNewRefUrl("");
    }

    function cancelEdit() {
        // Reset form to company data
        const hcs = Array.isArray(company.image_style_categories) && company.image_style_categories.length > 0;
        setForm({
            name: company.name, tagline: company.tagline ?? "", mission: company.mission ?? "",
            archetype: company.archetype ?? "guide", tone: company.tone ?? "",
            target_audiences: company.target_audiences ?? [],
            photography_style: company.photography_style ?? "",
            color_primary: company.color_primary ?? "#000000", color_secondary: company.color_secondary ?? "#FFFFFF",
            avoid_phrases: company.avoid_phrases ?? "",
            editorial_guidelines: company.editorial_guidelines ?? "",
            seo_content_guidelines: company.seo_content_guidelines ?? "",
            auto_humanize: company.auto_humanize !== false, include_toc: company.include_toc === true,
            reference_articles: company.reference_articles ?? [],
            useCustomStyles: hcs,
            image_style_categories: hcs ? company.image_style_categories! : [],
            voice_profile: company.voice_profile ? { ...company.voice_profile } : null,
        });
        setSaveErr(null); setSaved(false);
    }

    async function handleSave() {
        setSaving(true); setSaveErr(null);
        try {
            const { useCustomStyles, ...rest } = form;
            const payload = {
                ...rest,
                target_audiences: form.target_audiences,
                image_style_categories: useCustomStyles && form.image_style_categories.length > 0 ? form.image_style_categories : null,
            };
            const r = await fetch(`/api/companies/${company.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            setSaved(true); setTimeout(() => setSaved(false), 3000);
            if (onSaved) onSaved({ ...data, prompts: company.prompts });
        } catch (e: any) { setSaveErr(e.message); }
        finally { setSaving(false); }
    }

    function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
        setForm(prev => ({ ...prev, [key]: value }));
    }

    function copyToClipboard(text: string, id: string) {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    }



    return (
        <div className="space-y-3">
            {/* Save bar */}
            <div className="flex items-center gap-2">
                <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
                    <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save Changes"}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={cancelEdit} disabled={saving}>
                    <X className="h-3.5 w-3.5" /> Reset
                </Button>
                {saved && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>}
                {saveErr && <span className="text-xs text-destructive">{saveErr}</span>}
            </div>

            {/* Identity */}
            <Section title="Identity" icon={Eye} defaultOpen>
                <div className="space-y-4 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Company Name" value={editing ? form.name : company.name} editing={editing} onChange={v => setField("name", v)} />
                        <Field label="Tagline" value={editing ? form.tagline : company.tagline} editing={editing} onChange={v => setField("tagline", v)} />
                    </div>
                    <Field label="Mission" value={editing ? form.mission : company.mission} editing={editing} onChange={v => setField("mission", v)} rows={3} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Archetype" value={editing ? form.archetype : (company.archetype ?? "guide")} editing={editing} onChange={v => setField("archetype", v)} />
                        <Field label="Tone" value={editing ? form.tone : company.tone} editing={editing} onChange={v => setField("tone", v)} />
                    </div>
                    <FieldList label="Target Audiences" items={editing ? form.target_audiences : company.target_audiences} editing={editing} onChange={v => setField("target_audiences", v)} />
                </div>
            </Section>

            {/* Colors & Visual */}
            <Section title="Colors & Visual Style" icon={Palette}>
                <div className="space-y-4 pt-3">
                    <div className="flex gap-6 items-start">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Primary</Label>
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-lg border border-border shadow-sm" style={{ backgroundColor: (editing ? form.color_primary : company.color_primary) ?? "#000" }} />
                                {editing ? <Input value={form.color_primary} onChange={e => setField("color_primary", e.target.value)} className="w-28 text-xs" /> : <code className="text-xs text-muted-foreground">{company.color_primary ?? "#000000"}</code>}
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-muted-foreground">Secondary</Label>
                            <div className="flex items-center gap-2">
                                <div className="w-10 h-10 rounded-lg border border-border shadow-sm" style={{ backgroundColor: (editing ? form.color_secondary : company.color_secondary) ?? "#FFF" }} />
                                {editing ? <Input value={form.color_secondary} onChange={e => setField("color_secondary", e.target.value)} className="w-28 text-xs" /> : <code className="text-xs text-muted-foreground">{company.color_secondary ?? "#FFFFFF"}</code>}
                            </div>
                        </div>
                    </div>
                    <Field label="Photography / Image Style" value={editing ? form.photography_style : company.photography_style} editing={editing} onChange={v => setField("photography_style", v)} rows={3} />
                </div>
            </Section>

            {/* Image Styles */}
            <Section
                title="Image Styles"
                icon={Layers}
                badge={(() => {
                    const s = form.image_style_categories;
                    const h = Array.isArray(s) && s.length > 0;
                    return h ? <Badge variant="secondary" className="text-[10px] ml-1">{s!.length}</Badge> : <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Default</Badge>;
                })()}
            >
                <div className="space-y-3 pt-3">
                    {editing ? (
                        <>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={form.useCustomStyles} onChange={(e) => {
                                    const checked = e.target.checked;
                                    setForm(prev => ({ ...prev, useCustomStyles: checked, image_style_categories: checked && prev.image_style_categories.length === 0 ? [{ id: "default", label: "Default", narrative: "", storytelling_cues: [], image_prompt_style: "" }] : prev.image_style_categories }));
                                }} className="h-4 w-4 rounded" />
                                Use custom styles
                            </label>
                            {form.useCustomStyles && form.image_style_categories.map((cat, idx) => {
                                const isExpanded = expandedStyles.has(idx);
                                return (
                                    <Card key={idx} className="bg-muted/20">
                                        <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setExpandedStyles(prev => { const next = new Set(prev); if (next.has(idx)) next.delete(idx); else next.add(idx); return next; })}>
                                            <span className="text-sm font-medium flex items-center gap-1.5">
                                                {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                {cat.label || `Style #${idx + 1}`}
                                                {cat.id && <span className="text-xs text-muted-foreground">({cat.id})</span>}
                                                {cat.type === "composite" && <Badge variant="outline" className="text-[10px] h-4 gap-0.5">🧩 Composite</Badge>}
                                            </span>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, image_style_categories: prev.image_style_categories.filter((_, i) => i !== idx) })); }}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        {isExpanded && (
                                            <CardContent className="pt-0 pb-4 px-4 space-y-3 border-t border-border">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1"><Label className="text-xs">Label *</Label><Input value={cat.label} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], label: e.target.value, id: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} placeholder="e.g. Families" /></div>
                                                    <div className="space-y-1"><Label className="text-xs">ID</Label><Input value={cat.id} disabled className="bg-muted" /></div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Style Type</Label>
                                                    <div className="flex items-center gap-4">
                                                        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                                            <input type="radio" name={`style-type-${idx}`} checked={cat.type !== "composite"} onChange={() => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], type: "prompt" }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} />
                                                            🎨 AI Prompt
                                                        </label>
                                                        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                                            <input type="radio" name={`style-type-${idx}`} checked={cat.type === "composite"} onChange={() => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], type: "composite" }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} />
                                                            🧩 Composite Blend
                                                        </label>
                                                    </div>
                                                </div>
                                                <div className="space-y-1"><Label className="text-xs">Narrative</Label><Textarea value={cat.narrative} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], narrative: e.target.value }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} placeholder="Context for this style..." rows={2} /></div>
                                                <div className="space-y-1"><Label className="text-xs">Storytelling Cues</Label><Input value={cat.storytelling_cues.join(", ")} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], storytelling_cues: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} placeholder="emphasizes warmth, collaboration" /></div>
                                                <div className="space-y-1"><Label className="text-xs">Image Prompt Style</Label><Textarea value={cat.image_prompt_style} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], image_prompt_style: e.target.value }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} placeholder="Detailed style direction..." rows={3} /></div>
                                                {cat.type === "composite" && (
                                                    <fieldset className="border border-border rounded-lg p-3.5 space-y-3 bg-muted/30">
                                                        <legend className="text-xs font-semibold px-1.5">🧩 Composite Blend Defaults</legend>
                                                        <div className="space-y-1"><Label className="text-xs">Default Background Prompt</Label><Textarea value={cat.composite_bg_prompt ?? ""} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_bg_prompt: e.target.value }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} placeholder="e.g. Modern kitchen countertop with soft natural lighting" rows={2} /></div>
                                                        <div className="space-y-1"><Label className="text-xs">Default Product Search Query</Label><Input value={cat.composite_product_query ?? ""} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_product_query: e.target.value }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} placeholder="e.g. stainless steel blender product photo" /></div>
                                                        {cat.composite_bg_image_url && (
                                                            <div className="flex items-center gap-2 p-1.5 rounded-md bg-card border border-border">
                                                                <img src={cat.composite_bg_image_url} alt="Background" className="w-16 h-10 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                                                <Input value={cat.composite_bg_image_url} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_bg_image_url: e.target.value }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} className="text-xs flex-1 h-7" />
                                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_bg_image_url: "" }; setForm(prev => ({ ...prev, image_style_categories: nc })); }}><X className="h-3 w-3" /></Button>
                                                            </div>
                                                        )}
                                                    </fieldset>
                                                )}
                                            </CardContent>
                                        )}
                                    </Card>
                                );
                            })}
                            {form.useCustomStyles && (
                                <div className="flex gap-2">
                                    <Button variant="outline" className="border-dashed gap-1" onClick={() => setForm(prev => ({ ...prev, image_style_categories: [...prev.image_style_categories, { id: "", label: "", narrative: "", storytelling_cues: [], image_prompt_style: "" }] }))}>
                                        <Plus className="h-3.5 w-3.5" /> Add Style
                                    </Button>
                                    <Button variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5" onClick={openImageExtract}>
                                        <Camera className="h-3.5 w-3.5" /> Extract from Image
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            </Section>

            {/* Voice Profile */}
            <Section
                title="Voice Profile"
                icon={Mic}
                badge={form.voice_profile ? <Badge variant="outline" className="text-[10px] ml-1 text-primary border-primary/50">Active</Badge> : <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Not Set</Badge>}
            >
                <div className="space-y-4 pt-3">
                    {!form.voice_profile ? (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground italic">No voice profile configured yet.</p>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setForm(prev => ({ ...prev, voice_profile: defaultVP }))}>
                                <Plus className="h-3.5 w-3.5" /> Create Voice Profile
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Field label="Summary" value={form.voice_profile.summary} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, summary: v } : prev.voice_profile }))} rows={3} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FieldList label="Tone Descriptors" items={form.voice_profile.tone_descriptors} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, tone_descriptors: v } : prev.voice_profile }))} />
                                <Field label="POV & Person" value={form.voice_profile.pov_and_person} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, pov_and_person: v } : prev.voice_profile }))} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Sentence Rhythm" value={form.voice_profile.sentence_rhythm} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, sentence_rhythm: v } : prev.voice_profile }))} rows={2} />
                                <Field label="Paragraph Style" value={form.voice_profile.paragraph_style} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, paragraph_style: v } : prev.voice_profile }))} rows={2} />
                            </div>
                            <Field label="Vocabulary Level" value={form.voice_profile.vocabulary_level} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, vocabulary_level: v } : prev.voice_profile }))} rows={2} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FieldList label="Rhetorical Devices" items={form.voice_profile.rhetorical_devices} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, rhetorical_devices: v } : prev.voice_profile }))} />
                                <FieldList label="Sample Phrases" items={form.voice_profile.sample_phrases} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, sample_phrases: v } : prev.voice_profile }))} />
                            </div>
                            <FieldList label="Structural Patterns" items={form.voice_profile.structural_patterns} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, structural_patterns: v } : prev.voice_profile }))} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FieldList label="✓ Do Use" items={form.voice_profile.structural_do} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, structural_do: v } : prev.voice_profile }))} />
                                <FieldList label="✗ Don't Use" items={form.voice_profile.structural_dont} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, structural_dont: v } : prev.voice_profile }))} />
                            </div>
                            <FieldList label="Specificity Rules" items={form.voice_profile.specificity_rules} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, specificity_rules: v } : prev.voice_profile }))} />
                            <FieldList label="Length Rules" items={form.voice_profile.length_rules} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, length_rules: v } : prev.voice_profile }))} />
                            <FieldList label="Patterns to Avoid" items={form.voice_profile.avoid} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, avoid: v } : prev.voice_profile }))} />
                            <FieldList label="Banned Phrases" items={form.voice_profile.banned_phrases} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, banned_phrases: v } : prev.voice_profile }))} placeholder="comma-separated banned phrases" />
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setForm(prev => ({ ...prev, voice_profile: null }))}>
                                <Trash2 className="h-3.5 w-3.5" /> Remove Voice Profile
                            </Button>
                        </>
                    )}
                </div>
            </Section>

            {/* Editorial Guidelines */}
            <Section
                title="Editorial Guidelines"
                icon={BookOpen}
                badge={(editing ? form.editorial_guidelines : company.editorial_guidelines) ? <Badge variant="secondary" className="text-[10px] ml-1">{(editing ? form.editorial_guidelines : company.editorial_guidelines)!.length} chars</Badge> : undefined}
            >
                <div className="pt-3">
                    {editing ? (
                        <Textarea value={form.editorial_guidelines} onChange={e => setField("editorial_guidelines", e.target.value)} rows={12} className="text-xs font-mono" />
                    ) : company.editorial_guidelines ? (
                        <div className="relative">
                            <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-muted rounded-md p-4 max-h-96 overflow-y-auto">{company.editorial_guidelines}</pre>
                            <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-7 text-xs gap-1" onClick={() => copyToClipboard(company.editorial_guidelines!, "editorial")}>
                                {copiedId === "editorial" ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><CopyIcon className="h-3 w-3" /> Copy</>}
                            </Button>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No editorial guidelines configured.</p>
                    )}
                </div>
            </Section>

            {/* SEO Content Guidelines */}
            <Section
                title="SEO Content Guidelines"
                icon={SearchIcon}
                badge={(editing ? form.seo_content_guidelines : company.seo_content_guidelines) ? <Badge variant="secondary" className="text-[10px] ml-1">{(editing ? form.seo_content_guidelines : company.seo_content_guidelines)!.length} chars</Badge> : undefined}
            >
                <div className="pt-3">
                    {editing ? (
                        <Textarea value={form.seo_content_guidelines} onChange={e => setField("seo_content_guidelines", e.target.value)} rows={12} className="text-xs font-mono" />
                    ) : company.seo_content_guidelines ? (
                        <div className="relative">
                            <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-muted rounded-md p-4 max-h-96 overflow-y-auto">{company.seo_content_guidelines}</pre>
                            <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-7 text-xs gap-1" onClick={() => copyToClipboard(company.seo_content_guidelines!, "seo")}>
                                {copiedId === "seo" ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><CopyIcon className="h-3 w-3" /> Copy</>}
                            </Button>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">No SEO content guidelines configured.</p>
                    )}
                </div>
            </Section>

            {/* Prompt Templates (read-only) */}
            <Section
                title="Prompt Templates"
                icon={FileText}
                badge={company.prompts?.length > 0 ? <Badge variant="secondary" className="text-[10px] ml-1">{company.prompts.length}</Badge> : undefined}
            >
                <div className="space-y-3 pt-3">
                    {(!company.prompts || company.prompts.length === 0) && (
                        <p className="text-sm text-muted-foreground italic">No prompt templates configured.</p>
                    )}
                    {company.prompts?.map((p) => (
                        <Card key={p.id} className="bg-muted/30">
                            <CardContent className="p-3.5">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">{p.name}</span>
                                    <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => copyToClipboard(p.body, p.id)}>
                                        {copiedId === p.id ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><CopyIcon className="h-3 w-3" /> Copy</>}
                                    </Button>
                                </div>
                                <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono bg-background rounded-md p-2.5 max-h-48 overflow-y-auto">{p.body}</pre>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </Section>

            {/* Content Settings */}
            <Section title="Content Settings" icon={Settings2}>
                <div className="space-y-3 pt-3">
                    <button type="button" onClick={() => editing && setField("auto_humanize", !form.auto_humanize)} className={cn("flex items-center gap-3 w-full text-left", editing && "cursor-pointer hover:bg-muted/50 rounded-md p-1 -m-1")}>
                        <div className={cn("w-3 h-3 rounded-full", (editing ? form.auto_humanize : company.auto_humanize !== false) ? "bg-green-500" : "bg-muted-foreground/30")} />
                        <div>
                            <div className="text-sm font-medium">🧹 Auto-Humanize</div>
                            <div className="text-xs text-muted-foreground">{(editing ? form.auto_humanize : company.auto_humanize !== false) ? "Enabled" : "Disabled"}{editing ? " — click to toggle" : ""}</div>
                        </div>
                    </button>
                    <button type="button" onClick={() => editing && setField("include_toc", !form.include_toc)} className={cn("flex items-center gap-3 w-full text-left", editing && "cursor-pointer hover:bg-muted/50 rounded-md p-1 -m-1")}>
                        <div className={cn("w-3 h-3 rounded-full", (editing ? form.include_toc : company.include_toc === true) ? "bg-green-500" : "bg-muted-foreground/30")} />
                        <div>
                            <div className="text-sm font-medium">📑 Table of Contents</div>
                            <div className="text-xs text-muted-foreground">{(editing ? form.include_toc : company.include_toc === true) ? "Enabled" : "Disabled"}{editing ? " — click to toggle" : ""}</div>
                        </div>
                    </button>
                    <Field label="Avoid Phrases" value={editing ? form.avoid_phrases : company.avoid_phrases} editing={editing} onChange={v => setField("avoid_phrases", v)} rows={2} />
                    {editing ? (
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">Reference Articles</Label>
                            <p className="text-xs text-muted-foreground">Add URLs of gold-standard articles used as style references.</p>
                            {form.reference_articles.map((url, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-primary break-all">{url}</a>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => setForm(prev => ({ ...prev, reference_articles: prev.reference_articles.filter((_, i) => i !== idx) }))}><X className="h-3 w-3" /></Button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <Input type="url" value={newRefUrl} onChange={(e) => setNewRefUrl(e.target.value)} placeholder="https://example.com/blog/article" onKeyDown={(e) => { if (e.key === "Enter" && newRefUrl.trim()) { e.preventDefault(); setForm(prev => ({ ...prev, reference_articles: [...prev.reference_articles, newRefUrl.trim()] })); setNewRefUrl(""); } }} />
                                <Button variant="outline" size="sm" disabled={!newRefUrl.trim()} onClick={() => { if (newRefUrl.trim()) { setForm(prev => ({ ...prev, reference_articles: [...prev.reference_articles, newRefUrl.trim()] })); setNewRefUrl(""); } }}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                                </Button>
                            </div>
                        </div>
                    ) : company.reference_articles && company.reference_articles.length > 0 ? (
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Reference Articles</div>
                            <div className="space-y-1">
                                {company.reference_articles.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary truncate hover:underline">{url}</a>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Section>

            {/* Prompt Engine (compiled system + user prompts) */}
            <PromptEngineSection companyId={company.id} />

            {/* Image Style Extraction Modal */}
            <Dialog open={showImageExtract} onOpenChange={(open) => { if (!open) closeImageExtract(); }}>
                <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Camera className="h-5 w-5 text-primary" />
                            Extract Style from Image
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground mt-1">
                        Upload a reference image and our AI art director will analyze its visual characteristics — color palette, tone, lighting, lens, film quality, contrast, and more — to create a reusable image style prompt.
                    </p>
                    <div className="mt-4">
                        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/jpg" className="hidden" onChange={handleImageFileSelect} />
                        {!extractPreviewUrl ? (
                            <button type="button" onClick={() => imageInputRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-all p-10 flex flex-col items-center gap-3 cursor-pointer group">
                                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <ImagePlus className="h-7 w-7 text-primary" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium">Click to upload a reference image</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, or WebP — up to 10MB</p>
                                </div>
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <div className="relative rounded-xl overflow-hidden border border-border bg-black/5">
                                    <img src={extractPreviewUrl} alt="Uploaded reference" className="w-full max-h-72 object-contain" />
                                    <Button variant="secondary" size="sm" className="absolute top-2 right-2 h-7 gap-1 text-xs opacity-80 hover:opacity-100" onClick={() => { setExtractPreviewUrl(null); setExtractBase64(null); setExtractResult(null); setExtractErr(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}>
                                        <X className="h-3 w-3" /> Replace
                                    </Button>
                                </div>
                                {!extractResult && (
                                    <Button onClick={handleImageExtract} disabled={extracting} className="w-full gap-2">
                                        {extracting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Analyzing image — this takes 15–30 seconds…</>) : (<><Sparkles className="h-4 w-4" /> Analyze Visual Style</>)}
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                    {extractErr && (
                        <Alert variant="destructive" className="mt-3">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{extractErr}</AlertDescription>
                        </Alert>
                    )}
                    {extractResult && (
                        <div className="mt-4 space-y-4">
                            <Alert className="border-success bg-success/5">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                <AlertDescription className="text-success">Style extracted successfully! Review the details below and add it to your company.</AlertDescription>
                            </Alert>
                            <div className="space-y-1.5">
                                <Label className="text-sm font-semibold">Style Name</Label>
                                <Input value={extractStyleName} onChange={(e) => setExtractStyleName(e.target.value)} placeholder="e.g. Warm Editorial Glow" className="text-sm" />
                            </div>
                            <fieldset className="border border-border rounded-lg p-3.5 space-y-3">
                                <legend className="text-xs font-semibold px-1.5">🎨 Visual Analysis</legend>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                    {([
                                        ["Photo Style", extractResult.analysis.photo_style_type],
                                        ["Color Palette", extractResult.analysis.color_palette],
                                        ["Tone / Mood", extractResult.analysis.tone_mood],
                                        ["Lighting", extractResult.analysis.lighting],
                                        ["Lens", extractResult.analysis.lens_characteristics],
                                        ["Film Quality", extractResult.analysis.film_quality],
                                        ["Contrast", extractResult.analysis.contrast],
                                        ["Hue / Temperature", extractResult.analysis.hue_temperature],
                                        ["Composition", extractResult.analysis.composition],
                                        ["Depth of Field", extractResult.analysis.depth_of_field],
                                        ["Texture / Grain", extractResult.analysis.texture_grain],
                                        ["Saturation", extractResult.analysis.saturation],
                                        ["Post Processing", extractResult.analysis.post_processing],
                                        ["Era / Aesthetic", extractResult.analysis.era_aesthetic],
                                        ["Subject", extractResult.analysis.subject_matter],
                                    ] as [string, string][]).map(([label, value]) => (
                                        <div key={label} className="space-y-0.5">
                                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
                                            <p className="text-xs leading-snug">{value}</p>
                                        </div>
                                    ))}
                                </div>
                                {extractResult.analysis.dominant_colors?.length > 0 && (
                                    <div className="space-y-1">
                                        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Dominant Colors</span>
                                        <div className="flex flex-wrap gap-1.5">
                                            {extractResult.analysis.dominant_colors.map((color, i) => {
                                                const hexMatch = color.match(/#[0-9a-fA-F]{6}/);
                                                return (
                                                    <Badge key={i} variant="secondary" className="gap-1.5 text-xs font-normal">
                                                        {hexMatch && <span className="inline-block w-3 h-3 rounded-full border border-border" style={{ backgroundColor: hexMatch[0] }} />}
                                                        {color}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </fieldset>
                            <fieldset className="border border-border rounded-lg p-3.5 space-y-1.5">
                                <legend className="text-xs font-semibold px-1.5">📝 Generated Image Prompt Style</legend>
                                <p className="text-xs text-muted-foreground">This prompt will be used to replicate this visual style in AI-generated images:</p>
                                <pre className="whitespace-pre-wrap break-words text-xs bg-muted p-3 rounded-md max-h-48 overflow-y-auto leading-relaxed">{extractResult.image_prompt_style}</pre>
                            </fieldset>
                            {extractResult.storytelling_cues?.length > 0 && (
                                <div className="space-y-1">
                                    <Label className="text-xs">Storytelling Cues</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {extractResult.storytelling_cues.map((cue, i) => <Badge key={i} variant="outline" className="text-xs font-normal">{cue}</Badge>)}
                                    </div>
                                </div>
                            )}
                            <div className="space-y-1">
                                <Label className="text-xs">Narrative</Label>
                                <p className="text-xs text-muted-foreground leading-relaxed">{extractResult.narrative}</p>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="outline" onClick={closeImageExtract}>Cancel</Button>
                                <Button onClick={addExtractedStyle} className="gap-1.5"><Plus className="h-4 w-4" /> Add Style to Company</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* ── Prompt Engine Section (lazy-loaded compiled prompts) ────────── */
function PromptEngineSection({ companyId }: { companyId: string }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"system" | "user">("system");
    const loaded = useRef(false);

    function copyToClipboard(text: string, id: string) {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    }

    function handleToggle() {
        const willOpen = !open;
        setOpen(willOpen);
        if (willOpen && !loaded.current) {
            setLoading(true);
            setError(null);
            fetch(`/api/companies/${companyId}/prompt-engine`)
                .then((r) => r.json())
                .then((data) => {
                    if (data.error) throw new Error(data.error);
                    setSystemPrompt(data.system_prompt);
                    setUserPrompt(data.user_prompt_template);
                    loaded.current = true;
                })
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
        }
    }

    // Rough token estimate
    const estimateTokens = (text: string) => Math.ceil(text.length / 4);
    const systemTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;
    const userTokens = userPrompt ? estimateTokens(userPrompt) : 0;

    return (
        <Card>
            <button
                onClick={handleToggle}
                className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
            >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    Prompt Engine
                    <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Base</Badge>
                </span>
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {open && (
                <CardContent className="pt-0 pb-5 px-5 border-t border-border">
                    <div className="space-y-4 pt-3">
                        {/* Info */}
                        <div className="flex items-start gap-2.5 rounded-md bg-muted/40 border border-border p-3">
                            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="text-xs text-muted-foreground leading-relaxed">
                                <p>This is the <strong>compiled prompt</strong> sent to the LLM for this company. It combines the <strong>base prompt</strong> (editable in <strong>Settings → Prompts</strong>) with this company's editorial guidelines, SEO guidelines, and voice profile layered on top.</p>
                                <p className="mt-1.5">Company-level settings always take priority over the base prompt.</p>
                            </div>
                        </div>

                        {loading && (
                            <div className="flex items-center gap-2 justify-center py-8">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Compiling prompts…</span>
                            </div>
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {systemPrompt && userPrompt && (
                            <>
                                {/* Token summary */}
                                <div className="flex gap-4 text-xs text-muted-foreground">
                                    <span>System: ~{systemTokens.toLocaleString()} tokens</span>
                                    <span>User: ~{userTokens.toLocaleString()} tokens</span>
                                    <span className="font-medium text-foreground">Total: ~{(systemTokens + userTokens).toLocaleString()} tokens</span>
                                </div>

                                {/* Tab toggle */}
                                <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                                    <button
                                        onClick={() => setActiveTab("system")}
                                        className={cn(
                                            "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                            activeTab === "system"
                                                ? "bg-background shadow-sm text-foreground"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        System Prompt
                                    </button>
                                    <button
                                        onClick={() => setActiveTab("user")}
                                        className={cn(
                                            "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                                            activeTab === "user"
                                                ? "bg-background shadow-sm text-foreground"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        User Prompt Template
                                    </button>
                                </div>

                                {/* Prompt content */}
                                <div className="relative">
                                    <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-muted rounded-md p-4 max-h-[500px] overflow-y-auto font-mono">{activeTab === "system" ? systemPrompt : userPrompt}</pre>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute top-2 right-2 h-7 text-xs gap-1"
                                        onClick={() =>
                                            copyToClipboard(
                                                activeTab === "system" ? systemPrompt : userPrompt,
                                                activeTab
                                            )
                                        }
                                    >
                                        {copiedId === activeTab ? (
                                            <><CheckCircle2 className="h-3 w-3" /> Copied</>
                                        ) : (
                                            <><CopyIcon className="h-3 w-3" /> Copy</>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

/* ── Image Style Card ────────────────────────────────────────────── */
function ImageStyleCard({ style: cat, onDelete }: { style: ImageStyleCategory; onDelete?: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    return (
        <Card className="bg-muted/20">
            <div className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1.5 text-sm font-medium text-left flex-1 min-w-0"
                >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    {cat.label || "Untitled Style"}
                    <span className="text-xs text-muted-foreground">({cat.id})</span>
                    {cat.type === "composite" && <Badge variant="outline" className="text-[10px] h-4 gap-0.5">🧩 Composite</Badge>}
                </button>
                {onDelete && (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                        {confirmDelete ? (
                            <>
                                <Button variant="destructive" size="sm" className="h-6 text-[11px] px-2" onClick={onDelete}>Delete</Button>
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                            </>
                        ) : (
                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
            {expanded && (
                <CardContent className="pt-0 pb-3 px-4 space-y-2.5 border-t border-border">
                    <Field label="Narrative" value={cat.narrative} />
                    <FieldList label="Storytelling Cues" items={cat.storytelling_cues} />
                    <Field label="Image Prompt Style" value={cat.image_prompt_style} mono />
                    {cat.type === "composite" && (
                        <fieldset className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                            <legend className="text-xs font-semibold px-1.5">🧩 Composite Defaults</legend>
                            <Field label="Background Prompt" value={cat.composite_bg_prompt} />
                            <Field label="Product Search Query" value={cat.composite_product_query} />
                            {cat.composite_bg_image_url && (
                                <div className="space-y-1">
                                    <div className="text-xs font-medium text-muted-foreground">Background Image</div>
                                    <img src={cat.composite_bg_image_url} alt="Background" className="w-32 h-20 object-cover rounded-md border border-border" />
                                </div>
                            )}
                        </fieldset>
                    )}
                </CardContent>
            )}
        </Card>
    );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function CompanyPage() {
    const router = useRouter();
    const { activeAccount } = useAuth();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [mode, setMode] = useState<"single" | "multi" | null>(null);
    const [company, setCompany] = useState<CompanyData | null>(null);
    const [companies, setCompanies] = useState<CompanyData[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Direct company ID from query param (e.g. /company?id=xxx)
    const directId = router.query.id as string | undefined;

    useEffect(() => {
        // If a direct company ID is provided, load it directly
        if (directId) {
            setLoading(true); setErr(null);
            Promise.all([
                fetch(`/api/companies/${directId}`).then(r => r.json()),
                fetch(`/api/prompts?company_id=${directId}`).then(r => r.json()).catch(() => []),
            ])
                .then(([companyData, promptsData]) => {
                    if (companyData.error) throw new Error(companyData.error);
                    setMode("single");
                    setCompany({ ...companyData, prompts: Array.isArray(promptsData) ? promptsData : [] });
                })
                .catch((e) => setErr(e.message))
                .finally(() => setLoading(false));
            return;
        }

        if (!activeAccount) return;
        setLoading(true); setErr(null);
        const url = `/api/account/company?account_id=${activeAccount.account_id}`;
        fetch(url)
            .then((r) => r.json())
            .then((data) => {
                if (data.error) throw new Error(data.error);
                if (data.mode === "single") {
                    setMode("single");
                    setCompany(data.company);
                } else if (data.mode === "multi") {
                    setMode("multi");
                    setCompanies(data.companies || []);
                    if (data.companies?.length === 1) {
                        setSelectedId(data.companies[0].id);
                    }
                }
            })
            .catch((e) => setErr(e.message))
            .finally(() => setLoading(false));
    }, [activeAccount, directId]);

    const activeCompany = mode === "single" ? company : companies.find((c) => c.id === selectedId) ?? null;

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                {activeCompany && (
                    <div className="flex items-center gap-4">
                        <div
                            className="w-12 h-12 rounded-lg shrink-0 border border-border shadow-sm"
                            style={{ backgroundColor: activeCompany.color_primary ?? "#000" }}
                        />
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">{activeCompany.name}</h2>
                            {activeCompany.tagline && <p className="text-sm text-muted-foreground italic">{activeCompany.tagline}</p>}
                        </div>
                    </div>
                )}

                {/* Multi-company selector */}
                {mode === "multi" && companies.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                        {companies.map((c) => (
                            <Button
                                key={c.id}
                                variant={selectedId === c.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedId(c.id)}
                                className="gap-2"
                            >
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.color_primary ?? "#000" }} />
                                {c.name}
                            </Button>
                        ))}
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                )}

                {/* Error */}
                {err && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{err}</AlertDescription>
                    </Alert>
                )}

                {/* Empty states */}
                {!loading && !err && mode === "multi" && companies.length === 0 && (
                    <p className="text-muted-foreground">No companies found for this account.</p>
                )}
                {!loading && !err && mode === "single" && !company && (
                    <p className="text-muted-foreground">No company linked to your account.</p>
                )}

                {/* Company brand view */}
                {!loading && activeCompany && <CompanyBrand company={activeCompany} onSaved={(updated) => {
                    if (mode === "single") setCompany(updated);
                    else setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
                }} />}
            </div>
        </AppLayout>
    );
}
