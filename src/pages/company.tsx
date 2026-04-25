import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
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
    Layers, Copy as CopyIcon, CheckCircle2, Pencil, Save, X,
} from "lucide-react";
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
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
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
    }));

    function startEdit() {
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
        });
        setEditing(true); setSaveErr(null); setSaved(false);
    }

    function cancelEdit() { setEditing(false); setSaveErr(null); }

    async function handleSave() {
        setSaving(true); setSaveErr(null);
        try {
            const payload = { ...form, target_audiences: form.target_audiences };
            const r = await fetch(`/api/companies/${company.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 3000);
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

    const vp = company.voice_profile;
    const styles = company.image_style_categories;
    const hasStyles = Array.isArray(styles) && styles.length > 0;

    return (
        <div className="space-y-3">
            {/* Edit / Save bar */}
            <div className="flex items-center gap-2">
                {!editing && (
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                )}
                {editing && (
                    <>
                        <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
                            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={cancelEdit} disabled={saving}>
                            <X className="h-3.5 w-3.5" /> Cancel
                        </Button>
                    </>
                )}
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

            {/* Image Styles (read-only — managed via Companies page) */}
            <Section
                title="Image Styles"
                icon={Layers}
                badge={hasStyles ? <Badge variant="secondary" className="text-[10px] ml-1">{styles!.length}</Badge> : <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Default</Badge>}
            >
                <div className="space-y-3 pt-3">
                    {!hasStyles && <p className="text-sm text-muted-foreground italic">Using default image styles. No custom styles configured.</p>}
                    {hasStyles && styles!.map((cat, idx) => (
                        <ImageStyleCard key={idx} style={cat} />
                    ))}
                </div>
            </Section>

            {/* Voice Profile (read-only — managed via Companies page) */}
            <Section
                title="Voice Profile"
                icon={Mic}
                badge={vp ? <Badge variant="outline" className="text-[10px] ml-1 text-primary border-primary/50">Active</Badge> : <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Not Set</Badge>}
            >
                <div className="space-y-4 pt-3">
                    {!vp && <p className="text-sm text-muted-foreground italic">No voice profile configured yet.</p>}
                    {vp && (
                        <>
                            <Field label="Summary" value={vp.summary} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FieldList label="Tone Descriptors" items={vp.tone_descriptors} />
                                <Field label="POV & Person" value={vp.pov_and_person} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Sentence Rhythm" value={vp.sentence_rhythm} />
                                <Field label="Paragraph Style" value={vp.paragraph_style} />
                            </div>
                            <Field label="Vocabulary Level" value={vp.vocabulary_level} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FieldList label="Rhetorical Devices" items={vp.rhetorical_devices} />
                                <FieldList label="Sample Phrases" items={vp.sample_phrases} />
                            </div>
                            <FieldList label="Structural Patterns" items={vp.structural_patterns} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FieldList label="✓ Do Use" items={vp.structural_do} />
                                <FieldList label="✗ Don't Use" items={vp.structural_dont} />
                            </div>
                            <FieldList label="Specificity Rules" items={vp.specificity_rules} />
                            <FieldList label="Length Rules" items={vp.length_rules} />
                            <FieldList label="Patterns to Avoid" items={vp.avoid} />
                            {(vp.banned_phrases?.length ?? 0) > 0 && (
                                <div className="space-y-1">
                                    <div className="text-xs font-medium text-destructive">Banned Phrases</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {vp.banned_phrases!.map((p, i) => <Badge key={i} variant="destructive" className="text-xs font-normal">&ldquo;{p}&rdquo;</Badge>)}
                                    </div>
                                </div>
                            )}
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
                    {company.reference_articles && company.reference_articles.length > 0 && (
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Reference Articles</div>
                            <div className="space-y-1">
                                {company.reference_articles.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary truncate hover:underline">{url}</a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </Section>
        </div>
    );
}

/* ── Image Style Card ────────────────────────────────────────────── */
function ImageStyleCard({ style: cat }: { style: ImageStyleCategory }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <Card className="bg-muted/20">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center justify-between w-full px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
            >
                <span className="text-sm font-medium flex items-center gap-1.5">
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    {cat.label || "Untitled Style"}
                    <span className="text-xs text-muted-foreground">({cat.id})</span>
                    {cat.type === "composite" && <Badge variant="outline" className="text-[10px] h-4 gap-0.5">🧩 Composite</Badge>}
                </span>
            </button>
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
    const { activeAccount } = useAuth();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [mode, setMode] = useState<"single" | "multi" | null>(null);
    const [company, setCompany] = useState<CompanyData | null>(null);
    const [companies, setCompanies] = useState<CompanyData[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
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
    }, [activeAccount]);

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
