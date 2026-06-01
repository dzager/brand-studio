import { useState, useRef, useCallback } from "react";
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
    Upload, Trash2,
} from "lucide-react";

/* ── Hover-to-enlarge thumbnail preview ── */
function ThumbnailPreview({ src, alt, className }: { src: string; alt: string; className?: string }) {
    const [show, setShow] = useState(false);
    const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const ref = useRef<HTMLDivElement>(null);

    const handleEnter = useCallback(() => {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        // Position popup to the right of the thumbnail; if too close to right edge, show to the left
        const spaceRight = window.innerWidth - rect.right;
        const popupW = 256;
        const left = spaceRight > popupW + 16 ? rect.right + 8 : rect.left - popupW - 8;
        // Vertically center on the thumbnail
        const top = Math.max(8, rect.top + rect.height / 2 - 128);
        setPos({ top, left });
        setShow(true);
    }, []);

    return (
        <div ref={ref} className={`relative ${className ?? ""}`} onMouseEnter={handleEnter} onMouseLeave={() => setShow(false)}>
            <img src={src} alt={alt} className="w-full h-full rounded-md object-cover border border-border shadow-sm" />
            {show && (
                <div
                    className="fixed z-[100] pointer-events-none"
                    style={{ top: pos.top, left: pos.left }}
                >
                    <div className="w-64 h-64 rounded-xl overflow-hidden border border-border shadow-xl bg-card ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
                        <img src={src} alt={alt} className="w-full h-full object-cover" />
                    </div>
                </div>
            )}
        </div>
    );
}

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
    const { runTask, runBatchTask } = useTaskRunner();
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
    const [autoSaving, setAutoSaving] = useState(false);
    const [autoSaved, setAutoSaved] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    /* ── Batch upload state ── */
    const [showBatchUpload, setShowBatchUpload] = useState(false);
    type BatchImageItem = {
        file: File;
        previewUrl: string;
        base64: string;
        thumbnailDataUri: string | null; // resized client-side
        status: "queued" | "analyzing" | "done" | "error";
        styleName: string;
        result: ImageStyleAnalysis | null;
        error: string | null;
    };
    const [batchItems, setBatchItems] = useState<BatchImageItem[]>([]);
    const [batchAnalyzing, setBatchAnalyzing] = useState(false);
    const [batchErr, setBatchErr] = useState<string | null>(null);
    const batchInputRef = useRef<HTMLInputElement>(null);
    const batchRunningRef = useRef(false);

    /** Persist image_style_categories to the database immediately */
    async function autoSaveStyles(newCategories: import("@/brand/engine").ImageStyleCategory[]) {
        const res = await fetch(`/api/companies/${company.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_style_categories: newCategories.length > 0 ? newCategories : null }),
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error || "Failed to save styles");
        }
    }

    function openBatchUpload() {
        setShowBatchUpload(true);
        // Don't reset items if a batch is currently running
        if (!batchRunningRef.current) {
            setBatchItems([]);
            setBatchAnalyzing(false);
            setBatchErr(null);
        }
    }
    function closeBatchUpload() {
        // Just hide the dialog — processing continues in background
        setShowBatchUpload(false);
    }

    /** Resize an image data URI to ~128px thumbnail using canvas */
    function resizeToThumbnail(dataUri: string): Promise<string> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 128;
                canvas.height = 128;
                const ctx = canvas.getContext("2d")!;
                // Cover-crop to square
                const size = Math.min(img.width, img.height);
                const sx = (img.width - size) / 2;
                const sy = (img.height - size) / 2;
                ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
                resolve(canvas.toDataURL("image/jpeg", 0.8));
            };
            img.onerror = () => resolve(dataUri);
            img.src = dataUri;
        });
    }

    async function handleBatchFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        const maxFiles = 20;
        const selected = Array.from(files).slice(0, maxFiles);
        const invalid = selected.filter(f => !f.type.startsWith("image/") || f.size > 10 * 1024 * 1024);
        if (invalid.length > 0) {
            setBatchErr(`${invalid.length} file(s) skipped — must be images under 10MB.`);
        }
        const valid = selected.filter(f => f.type.startsWith("image/") && f.size <= 10 * 1024 * 1024);
        if (valid.length === 0) return;

        // Read all files as base64 + create thumbnails
        const newItems: BatchImageItem[] = await Promise.all(
            valid.map(async (file) => {
                const dataUri = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target?.result as string);
                    reader.readAsDataURL(file);
                });
                const thumb = await resizeToThumbnail(dataUri);
                return {
                    file,
                    previewUrl: dataUri,
                    base64: dataUri,
                    thumbnailDataUri: thumb,
                    status: "queued" as const,
                    styleName: "",
                    result: null,
                    error: null,
                };
            })
        );

        // Append new items to existing batch
        setBatchItems(prev => [...prev, ...newItems].slice(0, maxFiles));
        // Reset the input so re-selecting the same files works
        if (batchInputRef.current) batchInputRef.current.value = "";

        // Auto-start processing the queue
        startBatchQueue(newItems);
    }

    function removeBatchItem(idx: number) {
        setBatchItems(prev => prev.filter((_, i) => i !== idx));
    }

    /**
     * Auto-save a single analyzed style to the database immediately.
     * This runs in the background as each item completes — no manual "Save" step.
     */
    async function autoSaveSingleStyle(result: ImageStyleAnalysis, thumbnailDataUri: string | null) {
        const name = result.style_name || "Extracted Style";
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
        const newStyle: import("@/brand/engine").ImageStyleCategory = {
            id,
            label: name,
            narrative: result.narrative,
            storytelling_cues: result.storytelling_cues,
            image_prompt_style: result.image_prompt_style,
            thumbnail_url: thumbnailDataUri ?? undefined,
        };

        // Update form state atomically
        let merged: import("@/brand/engine").ImageStyleCategory[] = [];
        setForm(prev => {
            merged = [...prev.image_style_categories, newStyle];
            return { ...prev, useCustomStyles: true, image_style_categories: merged };
        });
        // Auto-expand
        setExpandedStyles(prev => {
            const next = new Set(prev);
            next.add(merged.length - 1);
            return next;
        });

        // Persist to DB
        await autoSaveStyles(merged);
    }

    /**
     * Background queue processor: analyzes each queued image and auto-saves results.
     * Uses runBatchTask for task panel tracking. Safe to close the dialog while running.
     */
    async function startBatchQueue(newItems: BatchImageItem[]) {
        // If already running, the new items will be picked up via state — skip re-entry
        if (batchRunningRef.current) return;
        batchRunningRef.current = true;
        setBatchAnalyzing(true);
        setBatchErr(null);

        // Capture base64 data eagerly to avoid stale closure issues
        const itemPayloads = newItems.map((item, originalIdx) => ({
            base64: item.base64,
            thumbnailDataUri: item.thumbnailDataUri,
            fileName: item.file.name,
        }));

        // Use runBatchTask for background task panel integration
        await runBatchTask<{ style: ImageStyleAnalysis }>({
            type: "style-extract",
            label: `Batch style extraction (${itemPayloads.length} images)`,
            concurrency: 2,
            meta: { link: `/company?id=${company.id}&tab=visual`, linkLabel: "View in Visual" },
            items: itemPayloads.map((payload, i) => ({
                endpoint: "/api/analyze-image-style",
                body: { image_base64: payload.base64 },
                label: `Analyzing: ${payload.fileName}`,
            })),
            onItemComplete: async (index, data) => {
                const payload = itemPayloads[index];
                // Update the batch item status in UI
                setBatchItems(prev => {
                    // Find the matching queued/analyzing item by base64 (stable identity)
                    let found = false;
                    return prev.map(item => {
                        if (!found && item.base64 === payload.base64 && (item.status === "queued" || item.status === "analyzing")) {
                            found = true;
                            return {
                                ...item,
                                status: "done" as const,
                                result: data.style,
                                styleName: data.style.style_name || "",
                            };
                        }
                        return item;
                    });
                });

                // Auto-save this style immediately
                try {
                    await autoSaveSingleStyle(data.style, payload.thumbnailDataUri);
                } catch (e: any) {
                    console.error("Auto-save failed for batch item:", e);
                    // Don't fail the whole batch — just log it
                }
            },
            onItemError: (index, error) => {
                const payload = itemPayloads[index];
                setBatchItems(prev => {
                    let found = false;
                    return prev.map(item => {
                        if (!found && item.base64 === payload.base64 && (item.status === "queued" || item.status === "analyzing")) {
                            found = true;
                            return { ...item, status: "error" as const, error };
                        }
                        return item;
                    });
                });
            },
            onError: (error) => {
                setBatchErr(error);
            },
        });

        // Mark items as analyzing as they start (update UI for in-progress items)
        setBatchItems(prev => prev.map(item =>
            item.status === "queued" ? { ...item, status: "queued" as const } : item
        ));

        setBatchAnalyzing(false);
        batchRunningRef.current = false;
    }

    function openImageExtract() {
        setShowImageExtract(true); setExtractPreviewUrl(null); setExtractBase64(null);
        setExtracting(false); setExtractErr(null); setExtractResult(null); setExtractStyleName("");
        setExtractThumbnail(null); setGeneratingThumbnail(false); setAutoSaving(false); setAutoSaved(false);
    }
    function closeImageExtract() {
        setShowImageExtract(false); setExtractPreviewUrl(null); setExtractBase64(null);
        setExtracting(false); setExtractErr(null); setExtractResult(null); setExtractStyleName("");
        setExtractThumbnail(null); setGeneratingThumbnail(false); setAutoSaving(false); setAutoSaved(false);
    }
    /** Reset extraction state for uploading another image without closing the dialog */
    function resetForAnother() {
        setExtractPreviewUrl(null); setExtractBase64(null);
        setExtracting(false); setExtractErr(null); setExtractResult(null); setExtractStyleName("");
        setExtractThumbnail(null); setGeneratingThumbnail(false); setAutoSaving(false); setAutoSaved(false);
        if (imageInputRef.current) imageInputRef.current.value = "";
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
        setExtracting(true); setExtractErr(null); setExtractThumbnail(null); setAutoSaved(false);
        await runTask<{ style: ImageStyleAnalysis }>({
            type: "style-extract",
            label: "Extracting image style",
            endpoint: "/api/analyze-image-style",
            body: { image_base64: extractBase64 },
            onSuccess: async (data) => {
                setExtractResult(data.style); setExtractStyleName(data.style.style_name || "");

                // Use the uploaded image itself as the thumbnail (resized)
                let thumbnailUrl: string | undefined;
                if (extractBase64) {
                    try {
                        thumbnailUrl = await resizeToThumbnail(extractBase64);
                        setExtractThumbnail(thumbnailUrl);
                    } catch { /* thumbnail is non-critical */ }
                }

                // Build the style and auto-save to DB
                const styleName = data.style.style_name || "Extracted Style";
                const styleId = styleName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
                const ns: ImageStyleCategory = {
                    id: styleId,
                    label: styleName,
                    narrative: data.style.narrative,
                    storytelling_cues: data.style.storytelling_cues,
                    image_prompt_style: data.style.image_prompt_style,
                    thumbnail_url: thumbnailUrl,
                };

                // Update form state
                let merged: ImageStyleCategory[] = [];
                setForm(prev => {
                    merged = [...prev.image_style_categories, ns];
                    return { ...prev, useCustomStyles: true, image_style_categories: merged };
                });
                setExpandedStyles(prev => { const next = new Set(prev); next.add(merged.length - 1); return next; });

                // Persist to DB
                setAutoSaving(true);
                try {
                    // Need merged to be populated — setForm is async batched, so use computed value
                    await autoSaveStyles(merged);
                    setAutoSaved(true);
                } catch (e: any) {
                    setExtractErr(e.message || "Auto-save failed");
                } finally {
                    setAutoSaving(false);
                }
            },
            onError: (err) => { setExtractErr(err); },
        });
        setExtracting(false);
    }

    return (
        <div className="space-y-3">
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
                                                    <ThumbnailPreview src={cat.thumbnail_url} alt={cat.label} className="w-8 h-8 shrink-0" />
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
                                                        <ThumbnailPreview src={cat.thumbnail_url} alt={`${cat.label} preview`} className="w-16 h-16" />
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
                                                                meta: { link: `/company?id=${company.id}&tab=visual`, linkLabel: "View in Visual" },
                                                                onSuccess: (d) => { if (d.thumbnail_base64) { setForm(prev => { const nc = [...prev.image_style_categories]; nc[idx] = { ...nc[idx], thumbnail_url: `data:image/jpeg;base64,${d.thumbnail_base64}` }; return { ...prev, image_style_categories: nc }; }); } },
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
                                <div className="flex gap-2 flex-wrap">
                                    <Button variant="outline" className="border-dashed gap-1" onClick={() => setForm(prev => ({ ...prev, image_style_categories: [...prev.image_style_categories, { id: "", label: "", narrative: "", storytelling_cues: [], image_prompt_style: "" }] }))}><Plus className="h-3.5 w-3.5" /> Add Style</Button>
                                    <Button variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5" onClick={openImageExtract}><Camera className="h-3.5 w-3.5" /> Extract from Image</Button>
                                    <Button variant="outline" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5" onClick={openBatchUpload}><Upload className="h-3.5 w-3.5" /> Batch Upload</Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </Section>

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
                autoSaving={autoSaving}
                autoSaved={autoSaved}
                onFileSelect={handleImageFileSelect}
                onExtract={handleImageExtract}
                onUploadAnother={resetForAnother}
                onReplaceImage={() => { setExtractPreviewUrl(null); setExtractBase64(null); setExtractResult(null); setExtractErr(null); if (imageInputRef.current) imageInputRef.current.value = ""; }}
            />

            {/* Batch Image Upload Modal */}
            <BatchImageUploadDialog
                show={showBatchUpload}
                onClose={closeBatchUpload}
                batchInputRef={batchInputRef}
                items={batchItems}
                analyzing={batchAnalyzing}
                error={batchErr}
                onFileSelect={handleBatchFileSelect}
                onRemoveItem={removeBatchItem}
                onUpdateName={(idx, name) => setBatchItems(prev => prev.map((item, i) => i === idx ? { ...item, styleName: name } : item))}
                onUploadMore={() => { setBatchItems([]); setBatchErr(null); }}
            />
        </div>
    );
}

/* ── Image Extract Dialog (split out to reduce main component size) ── */
function ImageExtractDialog({ show, onClose, imageInputRef, extractPreviewUrl, extractBase64, extracting, extractErr, extractResult, extractStyleName, setExtractStyleName, extractThumbnail, generatingThumbnail, autoSaving, autoSaved, onFileSelect, onExtract, onUploadAnother, onReplaceImage }: {
    show: boolean; onClose: () => void;
    imageInputRef: React.RefObject<HTMLInputElement | null>;
    extractPreviewUrl: string | null; extractBase64: string | null;
    extracting: boolean; extractErr: string | null;
    extractResult: ImageStyleAnalysis | null;
    extractStyleName: string; setExtractStyleName: (v: string) => void;
    extractThumbnail: string | null; generatingThumbnail: boolean;
    autoSaving: boolean; autoSaved: boolean;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onExtract: () => void; onUploadAnother: () => void; onReplaceImage: () => void;
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
                                {!extractResult && <Button variant="secondary" size="sm" className="absolute top-2 right-2 h-7 gap-1 text-xs opacity-80 hover:opacity-100" onClick={onReplaceImage}><X className="h-3 w-3" /> Replace</Button>}
                            </div>
                            {!extractResult && <Button onClick={onExtract} disabled={extracting} className="w-full gap-2">{extracting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</>) : (<><Sparkles className="h-4 w-4" /> Analyze Visual Style</>)}</Button>}
                        </div>
                    )}
                </div>
                {extractErr && <Alert variant="destructive" className="mt-3"><AlertCircle className="h-4 w-4" /><AlertDescription>{extractErr}</AlertDescription></Alert>}
                {extractResult && (
                    <div className="mt-4 space-y-4">
                        {/* Auto-save status */}
                        {autoSaving && (
                            <Alert className="border-primary/30 bg-primary/5">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                <AlertDescription className="text-primary">Saving style to your brand…</AlertDescription>
                            </Alert>
                        )}
                        {autoSaved && (
                            <Alert className="border-success bg-success/5">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                <AlertDescription className="text-success">
                                    <strong>&ldquo;{extractStyleName}&rdquo;</strong> saved to your brand!
                                </AlertDescription>
                            </Alert>
                        )}
                        {!autoSaved && !autoSaving && (
                            <Alert className="border-primary/30 bg-primary/5">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <AlertDescription className="text-primary">Style extracted — saving…</AlertDescription>
                            </Alert>
                        )}
                        <div className="flex gap-4 items-start">
                            <div className="shrink-0">
                                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Preview</Label>
                                <div className="w-24 h-24 rounded-xl border border-border bg-muted/30 overflow-hidden shadow-sm">
                                    {extractPreviewUrl ? (
                                        <img src={extractPreviewUrl} alt="Style preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-muted-foreground"><Camera className="h-5 w-5" /><span className="text-[10px]">No preview</span></div>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <Label className="text-sm font-semibold">Style Name</Label>
                                <Input value={extractStyleName} disabled className="text-sm bg-muted" />
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
                        {/* Post-save actions: Upload Another or Done */}
                        <div className="flex justify-end gap-2 pt-2">
                            {autoSaved && (
                                <>
                                    <Button variant="outline" className="gap-1.5" onClick={onUploadAnother}>
                                        <ImagePlus className="h-4 w-4" /> Upload Another
                                    </Button>
                                    <Button onClick={onClose} className="gap-1.5">
                                        <CheckCircle2 className="h-4 w-4" /> Done
                                    </Button>
                                </>
                            )}
                            {!autoSaved && !autoSaving && (
                                <Button variant="outline" onClick={onClose}>Close</Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

/* ── Batch Image Upload Dialog ── */
type BatchImageItem = {
    file: File;
    previewUrl: string;
    base64: string;
    thumbnailDataUri: string | null;
    status: "queued" | "analyzing" | "done" | "error";
    styleName: string;
    result: ImageStyleAnalysis | null;
    error: string | null;
};

function BatchImageUploadDialog({ show, onClose, batchInputRef, items, analyzing, error, onFileSelect, onRemoveItem, onUpdateName, onUploadMore }: {
    show: boolean;
    onClose: () => void;
    batchInputRef: React.RefObject<HTMLInputElement | null>;
    items: BatchImageItem[];
    analyzing: boolean;
    error: string | null;
    onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveItem: (idx: number) => void;
    onUpdateName: (idx: number, name: string) => void;
    onUploadMore: () => void;
}) {
    const doneCount = items.filter(i => i.status === "done").length;
    const errorCount = items.filter(i => i.status === "error").length;
    const analyzingCount = items.filter(i => i.status === "analyzing").length;
    const queuedCount = items.filter(i => i.status === "queued").length;
    const allDone = items.length > 0 && queuedCount === 0 && analyzingCount === 0;

    return (
        <Dialog open={show} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        Batch Image Upload
                        {items.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] ml-1">{items.length} image{items.length !== 1 ? "s" : ""}</Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground mt-1">
                    Upload reference images — they&apos;ll be analyzed and saved automatically in the background. You can close this dialog while processing continues.
                </p>

                {/* Upload zone */}
                <div className="mt-4">
                    <input
                        ref={batchInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/jpg"
                        multiple
                        className="hidden"
                        onChange={onFileSelect}
                    />
                    <button
                        type="button"
                        onClick={() => batchInputRef.current?.click()}
                        className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-all p-6 flex flex-col items-center gap-2 cursor-pointer group"
                    >
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                            <ImagePlus className="h-6 w-6 text-primary" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium">{items.length > 0 ? "Add more images" : "Click to select images"}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">JPEG, PNG, or WebP — up to 20 images, 10MB each. Processing starts automatically.</p>
                        </div>
                    </button>
                </div>

                {error && (
                    <Alert variant="destructive" className="mt-3">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Image grid */}
                {items.length > 0 && (
                    <div className="mt-4 space-y-4">
                        {/* Progress bar */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">
                                    {analyzing
                                        ? `Processing… ${doneCount} of ${items.length} done${errorCount > 0 ? ` (${errorCount} failed)` : ""}${queuedCount > 0 ? ` · ${queuedCount} queued` : ""}`
                                        : allDone
                                            ? `All ${doneCount} style${doneCount !== 1 ? "s" : ""} saved${errorCount > 0 ? ` · ${errorCount} failed` : ""}`
                                            : `${items.length} image${items.length !== 1 ? "s" : ""} ready`}
                                </span>
                                {analyzing && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                {allDone && doneCount > 0 && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-500"
                                    style={{ width: `${items.length > 0 ? Math.round(((doneCount + errorCount) / items.length) * 100) : 0}%` }}
                                />
                            </div>
                            {analyzing && (
                                <p className="text-[11px] text-muted-foreground italic">
                                    Each style is auto-saved as it completes. You can close this dialog — processing continues in the background.
                                </p>
                            )}
                        </div>

                        {/* Grid of image cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {items.map((item, idx) => (
                                <div key={idx} className={`relative group rounded-xl border bg-card overflow-hidden transition-all ${
                                    item.status === "done" ? "border-success/40" : item.status === "error" ? "border-destructive/40" : "border-border"
                                }`}>
                                    {/* Image preview */}
                                    <div className="aspect-square relative bg-muted/30">
                                        <img src={item.previewUrl} alt={item.styleName || `Image ${idx + 1}`} className="w-full h-full object-cover" />
                                        {/* Status overlay */}
                                        {item.status === "analyzing" && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                                                    <span className="text-[10px] text-white/80">Analyzing…</span>
                                                </div>
                                            </div>
                                        )}
                                        {item.status === "queued" && analyzing && (
                                            <div className="absolute bottom-1.5 right-1.5">
                                                <Badge variant="secondary" className="text-[9px] h-4 bg-black/50 text-white border-0">Queued</Badge>
                                            </div>
                                        )}
                                        {item.status === "done" && (
                                            <div className="absolute top-1.5 right-1.5">
                                                <div className="w-6 h-6 rounded-full bg-success flex items-center justify-center shadow-sm">
                                                    <CheckCircle2 className="h-4 w-4 text-white" />
                                                </div>
                                            </div>
                                        )}
                                        {item.status === "error" && (
                                            <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                                                <div className="flex flex-col items-center gap-1 px-2 text-center">
                                                    <AlertCircle className="h-5 w-5 text-destructive" />
                                                    <span className="text-[10px] text-destructive leading-tight">{item.error || "Failed"}</span>
                                                </div>
                                            </div>
                                        )}
                                        {/* Remove button — only when not processing */}
                                        {item.status !== "analyzing" && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveItem(idx)}
                                                className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-black/60 hover:bg-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="h-3.5 w-3.5 text-white" />
                                            </button>
                                        )}
                                    </div>
                                    {/* Style name / status */}
                                    <div className="p-2">
                                        {item.status === "done" ? (
                                            <div className="space-y-0.5">
                                                <input
                                                    type="text"
                                                    value={item.styleName}
                                                    onChange={(e) => onUpdateName(idx, e.target.value)}
                                                    placeholder="Style name"
                                                    className="w-full text-xs bg-transparent border-0 border-b border-border/50 focus:border-primary focus:outline-none pb-0.5 placeholder:text-muted-foreground"
                                                />
                                                <span className="text-[9px] text-success flex items-center gap-0.5">
                                                    <CheckCircle2 className="h-2.5 w-2.5" /> Saved
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground truncate block">
                                                {item.status === "analyzing" ? "Analyzing…" : item.status === "error" ? "Failed" : item.file.name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Action buttons */}
                        <div className="flex justify-end gap-2 pt-2">
                            {allDone && doneCount > 0 && (
                                <Button variant="outline" className="gap-1.5" onClick={onUploadMore}>
                                    <ImagePlus className="h-4 w-4" /> Upload More
                                </Button>
                            )}
                            <Button onClick={onClose} variant={analyzing ? "outline" : "default"} className="gap-1.5">
                                {analyzing ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Close &amp; Continue in Background</>
                                ) : allDone ? (
                                    <><CheckCircle2 className="h-4 w-4" /> Done</>
                                ) : (
                                    "Close"
                                )}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
