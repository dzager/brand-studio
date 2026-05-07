import { useState, useRef } from "react";
import { useTaskRunner } from "@/hooks/useTaskRunner";
import type { ImageStyleCategory } from "@/brand/engine";
import type { TabProps } from "./types";
import { Section, Field, FieldList, isLightColor } from "./shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Palette, Layers, ChevronDown, ChevronRight, AlertCircle,
    Plus, X, Camera, ImagePlus, Loader2, Sparkles, CheckCircle2,
} from "lucide-react";

type ImageStyleAnalysis = {
    style_name: string;
    image_prompt_style: string;
    narrative: string;
    storytelling_cues: string[];
    analysis: {
        color_palette: string; dominant_colors: string[]; tone_mood: string;
        subject_matter: string; photo_style_type: string; lens_characteristics: string;
        film_quality: string; contrast: string; hue_temperature: string;
        lighting: string; composition: string; depth_of_field: string;
        texture_grain: string; saturation: string; post_processing: string;
        era_aesthetic: string;
    };
};

export function VisualStyleTab({ company, form, setForm, setField, editing }: TabProps) {
    const { runTask } = useTaskRunner();
    const [expandedStyles, setExpandedStyles] = useState<Set<number>>(new Set());
    const [showImageExtract, setShowImageExtract] = useState(false);
    const [extractPreviewUrl, setExtractPreviewUrl] = useState<string | null>(null);
    const [extractBase64, setExtractBase64] = useState<string | null>(null);
    const [extracting, setExtracting] = useState(false);
    const [extractErr, setExtractErr] = useState<string | null>(null);
    const [extractResult, setExtractResult] = useState<ImageStyleAnalysis | null>(null);
    const [extractStyleName, setExtractStyleName] = useState("");
    const [extractThumbnail, setExtractThumbnail] = useState<string | null>(null);
    const [generatingThumbnail, setGeneratingThumbnail] = useState(false);
    const [generatingThumbIdx, setGeneratingThumbIdx] = useState<number | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    function openImageExtract() {
        setShowImageExtract(true); setExtractPreviewUrl(null); setExtractBase64(null);
        setExtracting(false); setExtractErr(null); setExtractResult(null); setExtractStyleName("");
        setExtractThumbnail(null); setGeneratingThumbnail(false);
    }
    function closeImageExtract() {
        setShowImageExtract(false); setExtractPreviewUrl(null); setExtractBase64(null);
        setExtracting(false); setExtractErr(null); setExtractResult(null); setExtractStyleName("");
        setExtractThumbnail(null); setGeneratingThumbnail(false);
    }
    function handleImageFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { setExtractErr("Please select an image file."); return; }
        if (file.size > 10 * 1024 * 1024) { setExtractErr("Image must be under 10MB."); return; }
        setExtractErr(null); setExtractResult(null);
        const reader = new FileReader();
        reader.onload = (ev) => { const d = ev.target?.result as string; setExtractPreviewUrl(d); setExtractBase64(d); };
        reader.readAsDataURL(file);
    }
    async function handleImageExtract() {
        if (!extractBase64) return;
        setExtracting(true); setExtractErr(null); setExtractThumbnail(null);
        const result = await runTask<{ style: ImageStyleAnalysis }>({
            type: "style-extract",
            label: "Extracting image style",
            endpoint: "/api/analyze-image-style",
            body: { image_base64: extractBase64 },
            onSuccess: (data) => {
                setExtractResult(data.style); setExtractStyleName(data.style.style_name || "");
                if (data.style.image_prompt_style) {
                    setGeneratingThumbnail(true);
                    runTask<{ thumbnail_base64: string }>({
                        type: "thumbnail",
                        label: `Thumbnail: ${data.style.style_name || "extracted style"}`,
                        endpoint: "/api/generate-style-thumbnail",
                        body: { image_prompt_style: data.style.image_prompt_style, style_name: data.style.style_name },
                        onSuccess: (d2) => { if (d2.thumbnail_base64) setExtractThumbnail(`data:image/jpeg;base64,${d2.thumbnail_base64}`); },
                    }).finally(() => setGeneratingThumbnail(false));
                }
            },
            onError: (err) => { setExtractErr(err); },
        });
        setExtracting(false);
    }
    function addExtractedStyle() {
        if (!extractResult) return;
        const name = extractStyleName.trim() || extractResult.style_name;
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        const ns: ImageStyleCategory = { id, label: name, narrative: extractResult.narrative, storytelling_cues: extractResult.storytelling_cues, image_prompt_style: extractResult.image_prompt_style, thumbnail_url: extractThumbnail ?? undefined };
        setForm(prev => ({ ...prev, useCustomStyles: true, image_style_categories: [...prev.image_style_categories, ns] }));
        setExpandedStyles(prev => { const next = new Set(prev); next.add(form.image_style_categories.length); return next; });
        closeImageExtract();
    }

    return (
        <div className="space-y-3">
            <Section title="Colors & Visual Style" icon={Palette} defaultOpen badge={<Badge variant="secondary" className="text-[10px] ml-1">{form.brand_colors.length}</Badge>}>
                <div className="space-y-4 pt-3">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Brand Palette</Label>
                            {editing && <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-dashed" onClick={() => setForm(prev => ({ ...prev, brand_colors: [...prev.brand_colors, { name: "", hex: "#888888" }] }))}><Plus className="h-3 w-3" /> Add Color</Button>}
                        </div>
                        <div className="flex gap-0.5 rounded-lg overflow-hidden border border-border shadow-sm h-8">
                            {form.brand_colors.map((c, i) => (
                                <div key={i} className="flex-1 relative group" style={{ backgroundColor: c.hex }} title={`${c.name || 'Unnamed'}: ${c.hex}`}>
                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: isLightColor(c.hex) ? '#000' : '#fff' }}>{c.name || c.hex}</span>
                                </div>
                            ))}
                            {form.brand_colors.length === 0 && <div className="flex-1 bg-muted flex items-center justify-center text-xs text-muted-foreground">No colors</div>}
                        </div>
                        {editing && (
                            <div className="space-y-2">
                                {form.brand_colors.map((c, idx) => (
                                    <div key={idx} className="flex items-center gap-2 group">
                                        <div className="relative"><div className="w-9 h-9 rounded-lg border border-border shadow-sm cursor-pointer overflow-hidden" style={{ backgroundColor: c.hex }}><input type="color" value={c.hex} onChange={(e) => { const nc = [...form.brand_colors]; nc[idx] = { ...nc[idx], hex: e.target.value }; setForm(prev => ({ ...prev, brand_colors: nc })); }} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" /></div></div>
                                        <Input value={c.name} onChange={(e) => { const nc = [...form.brand_colors]; nc[idx] = { ...nc[idx], name: e.target.value }; setForm(prev => ({ ...prev, brand_colors: nc })); }} placeholder={idx === 0 ? "Primary" : idx === 1 ? "Secondary" : "Color name"} className="w-28 text-xs h-9" />
                                        <Input value={c.hex} onChange={(e) => { const nc = [...form.brand_colors]; nc[idx] = { ...nc[idx], hex: e.target.value }; setForm(prev => ({ ...prev, brand_colors: nc })); }} className="w-24 text-xs font-mono h-9" placeholder="#000000" />
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={() => setForm(prev => ({ ...prev, brand_colors: prev.brand_colors.filter((_, i) => i !== idx) }))}><X className="h-3 w-3" /></Button>
                                    </div>
                                ))}
                            </div>
                        )}
                        {!editing && (
                            <div className="flex flex-wrap gap-3">
                                {(company.brand_colors && company.brand_colors.length > 0 ? company.brand_colors : [
                                    { name: "Primary", hex: company.color_primary ?? "#000000" },
                                    { name: "Secondary", hex: company.color_secondary ?? "#FFFFFF" },
                                ]).map((c, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg border border-border shadow-sm" style={{ backgroundColor: c.hex }} />
                                        <div><div className="text-xs font-medium">{c.name}</div><code className="text-[10px] text-muted-foreground">{c.hex}</code></div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <Field label="Photography / Image Style" value={editing ? form.photography_style : company.photography_style} editing={editing} onChange={v => setField("photography_style", v)} rows={3} />
                </div>
            </Section>

            <Section title="Image Styles" icon={Layers} badge={(() => { const s = form.image_style_categories; const h = Array.isArray(s) && s.length > 0; return h ? <Badge variant="secondary" className="text-[10px] ml-1">{s.length}</Badge> : <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Default</Badge>; })()}>
                <div className="space-y-3 pt-3">
                    {editing && (
                        <>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                                <input type="checkbox" checked={form.useCustomStyles} onChange={(e) => { const ch = e.target.checked; setForm(prev => ({ ...prev, useCustomStyles: ch, image_style_categories: ch && prev.image_style_categories.length === 0 ? [{ id: "default", label: "Default", narrative: "", storytelling_cues: [], image_prompt_style: "" }] : prev.image_style_categories })); }} className="h-4 w-4 rounded" />
                                Use custom styles
                            </label>
                            {form.useCustomStyles && form.image_style_categories.map((cat, idx) => {
                                const isExp = expandedStyles.has(idx);
                                return (
                                    <Card key={idx} className="bg-muted/20">
                                        <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setExpandedStyles(prev => { const n = new Set(prev); if (n.has(idx)) n.delete(idx); else n.add(idx); return n; })}>
                                            <span className="text-sm font-medium flex items-center gap-2">
                                                {cat.thumbnail_url ? (
                                                    <img src={cat.thumbnail_url} alt={cat.label} className="w-8 h-8 rounded-md object-cover border border-border shadow-sm shrink-0" />
                                                ) : (
                                                    isExp ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                                )}
                                                {cat.label || `Style #${idx + 1}`}
                                                {cat.id && <span className="text-xs text-muted-foreground">({cat.id})</span>}
                                                {cat.type === "composite" && <Badge variant="outline" className="text-[10px] h-4 gap-0.5">🧩 Composite</Badge>}
                                            </span>
                                            <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, image_style_categories: prev.image_style_categories.filter((_, i) => i !== idx) })); }}><X className="h-3 w-3" /></Button>
                                        </div>
                                        {isExp && (
                                            <CardContent className="pt-0 pb-4 px-4 space-y-3 border-t border-border">
                                                {/* Thumbnail preview + generate */}
                                                <div className="pt-2 flex items-end gap-3">
                                                    {cat.thumbnail_url ? (
                                                        <img src={cat.thumbnail_url} alt={`${cat.label} preview`} className="w-16 h-16 rounded-lg object-cover border border-border shadow-sm" />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center"><Camera className="h-4 w-4 text-muted-foreground" /></div>
                                                    )}
                                                    <div className="flex gap-1.5">
                                                        <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={generatingThumbIdx === idx || !cat.image_prompt_style} onClick={(e) => {
                                                            e.stopPropagation();
                                                            setGeneratingThumbIdx(idx);
                                                            runTask<{ thumbnail_base64: string }>({
                                                                type: "thumbnail",
                                                                label: `Thumbnail: ${cat.label}`,
                                                                endpoint: "/api/generate-style-thumbnail",
                                                                body: { image_prompt_style: cat.image_prompt_style, style_name: cat.label },
                                                                onSuccess: (d) => { if (d.thumbnail_base64) { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], thumbnail_url: `data:image/jpeg;base64,${d.thumbnail_base64}` }; setForm(prev => ({ ...prev, image_style_categories: nc })); } },
                                                            }).finally(() => setGeneratingThumbIdx(null));
                                                        }}>
                                                            {generatingThumbIdx === idx ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</> : <><Sparkles className="h-3 w-3" /> {cat.thumbnail_url ? "Regenerate" : "Generate"} Thumbnail</>}
                                                        </Button>
                                                        {cat.thumbnail_url && <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], thumbnail_url: undefined }; setForm(prev => ({ ...prev, image_style_categories: nc })); }}>Remove</Button>}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1"><Label className="text-xs">Label *</Label><Input value={cat.label} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], label: e.target.value, id: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} placeholder="e.g. Families" /></div>
                                                    <div className="space-y-1"><Label className="text-xs">ID</Label><Input value={cat.id} disabled className="bg-muted" /></div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Style Type</Label>
                                                    <div className="flex items-center gap-4">
                                                        <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name={`st-${idx}`} checked={cat.type !== "composite"} onChange={() => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], type: "prompt" }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} /> 🎨 AI Prompt</label>
                                                        <label className="flex items-center gap-1.5 text-sm cursor-pointer"><input type="radio" name={`st-${idx}`} checked={cat.type === "composite"} onChange={() => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], type: "composite" }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} /> 🧩 Composite Blend</label>
                                                    </div>
                                                </div>
                                                <div className="space-y-1"><Label className="text-xs">Narrative</Label><Textarea value={cat.narrative} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], narrative: e.target.value }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} rows={2} /></div>
                                                <div className="space-y-1"><Label className="text-xs">Storytelling Cues</Label><Input value={cat.storytelling_cues.join(", ")} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], storytelling_cues: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} /></div>
                                                <div className="space-y-1"><Label className="text-xs">Image Prompt Style</Label><Textarea value={cat.image_prompt_style} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], image_prompt_style: e.target.value }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} rows={3} /></div>
                                                {cat.type === "composite" && (
                                                    <fieldset className="border border-border rounded-lg p-3.5 space-y-3 bg-muted/30">
                                                        <legend className="text-xs font-semibold px-1.5">🧩 Composite Blend Defaults</legend>
                                                        <div className="space-y-1"><Label className="text-xs">Background Prompt</Label><Textarea value={cat.composite_bg_prompt ?? ""} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_bg_prompt: e.target.value }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} rows={2} /></div>
                                                        <div className="space-y-1"><Label className="text-xs">Product Search Query</Label><Input value={cat.composite_product_query ?? ""} onChange={(e) => { const nc = [...form.image_style_categories]; nc[idx] = { ...nc[idx], composite_product_query: e.target.value }; setForm(prev => ({ ...prev, image_style_categories: nc })); }} /></div>
                                                        {cat.composite_bg_image_url && (
                                                            <div className="flex items-center gap-2 p-1.5 rounded-md bg-card border border-border">
                                                                <img src={cat.composite_bg_image_url} alt="BG" className="w-16 h-10 object-cover rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
                                    <Button variant="outline" className="border-dashed gap-1" onClick={() => setForm(prev => ({ ...prev, image_style_categories: [...prev.image_style_categories, { id: "", label: "", narrative: "", storytelling_cues: [], image_prompt_style: "" }] }))}><Plus className="h-3.5 w-3.5" /> Add Style</Button>
                                    <Button variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5" onClick={openImageExtract}><Camera className="h-3.5 w-3.5" /> Extract from Image</Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Section>

            {/* Image Style Extraction Modal */}
            <ImageExtractDialog
                show={showImageExtract}
                onClose={closeImageExtract}
                imageInputRef={imageInputRef}
                extractPreviewUrl={extractPreviewUrl}
                extractBase64={extractBase64}
                extracting={extracting}
                extractErr={extractErr}
                extractResult={extractResult}
                extractStyleName={extractStyleName}
                setExtractStyleName={setExtractStyleName}
                extractThumbnail={extractThumbnail}
                generatingThumbnail={generatingThumbnail}
                onRegenerateThumbnail={() => {
                    if (!extractResult?.image_prompt_style) return;
                    setGeneratingThumbnail(true); setExtractThumbnail(null);
                    runTask<{ thumbnail_base64: string }>({
                        type: "thumbnail",
                        label: `Thumbnail: ${extractStyleName || extractResult.style_name}`,
                        endpoint: "/api/generate-style-thumbnail",
                        body: { image_prompt_style: extractResult.image_prompt_style, style_name: extractStyleName || extractResult.style_name },
                        onSuccess: (d2) => { if (d2.thumbnail_base64) setExtractThumbnail(`data:image/jpeg;base64,${d2.thumbnail_base64}`); },
                    }).finally(() => setGeneratingThumbnail(false));
                }}
                onFileSelect={handleImageFileSelect}
                onExtract={handleImageExtract}
                onAdd={addExtractedStyle}
                onReplaceImage={() => { setExtractPreviewUrl(null); setExtractBase64(null); setExtractResult(null); setExtractErr(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}
            />
        </div>
    );
}

/* ── Image Extract Dialog (split out to reduce main component size) ── */
function ImageExtractDialog({ show, onClose, imageInputRef, extractPreviewUrl, extractBase64, extracting, extractErr, extractResult, extractStyleName, setExtractStyleName, extractThumbnail, generatingThumbnail, onRegenerateThumbnail, onFileSelect, onExtract, onAdd, onReplaceImage }: {
    show: boolean; onClose: () => void;
    imageInputRef: React.RefObject<HTMLInputElement | null>;
    extractPreviewUrl: string | null; extractBase64: string | null;
    extracting: boolean; extractErr: string | null;
    extractResult: ImageStyleAnalysis | null;
    extractStyleName: string; setExtractStyleName: (v: string) => void;
    extractThumbnail: string | null; generatingThumbnail: boolean;
    onRegenerateThumbnail: () => void;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExtract: () => void; onAdd: () => void; onReplaceImage: () => void;
}) {
    return (
        <Dialog open={show} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5 text-primary" /> Extract Style from Image</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground mt-1">Upload a reference image and our AI art director will analyze its visual characteristics to create a reusable image style prompt.</p>
                <div className="mt-4">
                    <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/jpg" className="hidden" onChange={onFileSelect} />
                    {!extractPreviewUrl ? (
                        <button type="button" onClick={() => imageInputRef.current?.click()} className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-all p-10 flex flex-col items-center gap-3 cursor-pointer group">
                            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors"><ImagePlus className="h-7 w-7 text-primary" /></div>
                            <div className="text-center"><p className="text-sm font-medium">Click to upload a reference image</p><p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, or WebP — up to 10MB</p></div>
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <div className="relative rounded-xl overflow-hidden border border-border bg-black/5">
                                <img src={extractPreviewUrl} alt="Uploaded reference" className="w-full max-h-72 object-contain" />
                                <Button variant="secondary" size="sm" className="absolute top-2 right-2 h-7 gap-1 text-xs opacity-80 hover:opacity-100" onClick={onReplaceImage}><X className="h-3 w-3" /> Replace</Button>
                            </div>
                            {!extractResult && <Button onClick={onExtract} disabled={extracting} className="w-full gap-2">{extracting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>) : (<><Sparkles className="h-4 w-4" /> Analyze Visual Style</>)}</Button>}
                        </div>
                    )}
                </div>
                {extractErr && <Alert variant="destructive" className="mt-3"><AlertCircle className="h-4 w-4" /><AlertDescription>{extractErr}</AlertDescription></Alert>}
                {extractResult && (
                    <div className="mt-4 space-y-4">
                        <Alert className="border-success bg-success/5"><CheckCircle2 className="h-4 w-4 text-success" /><AlertDescription className="text-success">Style extracted! Review below and add it.</AlertDescription></Alert>
                        <div className="flex gap-4 items-start">
                            <div className="shrink-0">
                                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Preview</Label>
                                <div className="w-24 h-24 rounded-xl border border-border bg-muted/30 overflow-hidden shadow-sm">
                                    {extractThumbnail ? (
                                        <img src={extractThumbnail} alt="Style preview" className="w-full h-full object-cover" />
                                    ) : generatingThumbnail ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-1.5"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="text-[10px] text-muted-foreground">Generating…</span></div>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground"><Camera className="h-5 w-5" /><span className="text-[10px]">No preview</span></div>
                                    )}
                                </div>
                                {!generatingThumbnail && (
                                    <button type="button" onClick={onRegenerateThumbnail} className="mt-1.5 text-[10px] text-primary hover:underline cursor-pointer">
                                        {extractThumbnail ? "↻ Regenerate" : "⟳ Generate preview"}
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <Label className="text-sm font-semibold">Style Name</Label>
                                <Input value={extractStyleName} onChange={(e) => setExtractStyleName(e.target.value)} placeholder="e.g. Warm Editorial Glow" className="text-sm" />
                            </div>
                        </div>
                        <fieldset className="border border-border rounded-lg p-3.5 space-y-3">
                            <legend className="text-xs font-semibold px-1.5">🎨 Visual Analysis</legend>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                                {(Object.entries({ "Photo Style": extractResult.analysis.photo_style_type, "Color Palette": extractResult.analysis.color_palette, "Tone / Mood": extractResult.analysis.tone_mood, "Lighting": extractResult.analysis.lighting, "Lens": extractResult.analysis.lens_characteristics, "Film Quality": extractResult.analysis.film_quality, "Contrast": extractResult.analysis.contrast, "Hue / Temp": extractResult.analysis.hue_temperature, "Composition": extractResult.analysis.composition, "DoF": extractResult.analysis.depth_of_field, "Texture": extractResult.analysis.texture_grain, "Saturation": extractResult.analysis.saturation, "Post Processing": extractResult.analysis.post_processing, "Era": extractResult.analysis.era_aesthetic, "Subject": extractResult.analysis.subject_matter }) as [string, string][]).map(([l, v]) => (
                                    <div key={l} className="space-y-0.5"><span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{l}</span><p className="text-xs leading-snug">{v}</p></div>
                                ))}
                            </div>
                            {extractResult.analysis.dominant_colors?.length > 0 && (
                                <div className="space-y-1">
                                    <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Dominant Colors</span>
                                    <div className="flex flex-wrap gap-1.5">{extractResult.analysis.dominant_colors.map((color, i) => { const hm = color.match(/#[0-9a-fA-F]{6}/); return <Badge key={i} variant="secondary" className="gap-1.5 text-xs font-normal">{hm && <span className="inline-block w-3 h-3 rounded-full border border-border" style={{ backgroundColor: hm[0] }} />}{color}</Badge>; })}</div>
                                </div>
                            )}
                        </fieldset>
                        <fieldset className="border border-border rounded-lg p-3.5 space-y-1.5"><legend className="text-xs font-semibold px-1.5">📝 Prompt Style</legend><pre className="whitespace-pre-wrap break-words text-xs bg-muted p-3 rounded-md max-h-48 overflow-y-auto leading-relaxed">{extractResult.image_prompt_style}</pre></fieldset>
                        {extractResult.storytelling_cues?.length > 0 && <div className="space-y-1"><Label className="text-xs">Storytelling Cues</Label><div className="flex flex-wrap gap-1.5">{extractResult.storytelling_cues.map((c, i) => <Badge key={i} variant="outline" className="text-xs font-normal">{c}</Badge>)}</div></div>}
                        <div className="space-y-1"><Label className="text-xs">Narrative</Label><p className="text-xs text-muted-foreground leading-relaxed">{extractResult.narrative}</p></div>
                        <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={onAdd} className="gap-1.5"><Plus className="h-4 w-4" /> Add Style</Button></div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
