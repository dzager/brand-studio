import { useState, useEffect } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { IMAGE_STYLE_CATEGORIES, type ImageStyleCategory } from "@/brand/engine";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
    Sparkles, Eye, Search, RefreshCw, Copy, CheckCircle2,
    AlertCircle, AlertTriangle, X, Play, Download,
    Wand2, ShieldCheck, ImageIcon, Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} };
};

type ClaimReview = {
    claim: string;
    verdict: "accurate" | "unverifiable" | "misleading" | "inaccurate";
    explanation: string;
    suggested_edit?: string;
};

type FactCheckResult = {
    overall_verdict: "pass" | "needs_review" | "fail";
    confidence: number;
    summary: string;
    claims: ClaimReview[];
};

type SearchImage = {
    title: string;
    imageUrl: string;
    thumbnailUrl: string;
    source: string;
    domain: string;
    width?: number;
    height?: number;
};

type SearchVideo = {
    title: string;
    link: string;
    snippet: string;
    channel?: string;
    date?: string;
    duration?: string;
    imageUrl?: string;
};

type GalleryImage = {
    id: number;
    base64?: string;
    url?: string;
    prompt: string;
    label: string;
};

const VERDICT_COLORS: Record<string, string> = {
    pass: "#22c55e", needs_review: "#f59e0b", fail: "#ef4444",
    accurate: "#22c55e", unverifiable: "#a3a3a3", misleading: "#f59e0b", inaccurate: "#ef4444",
};

let _imgId = 0;

export default function Home() {
    const [prompt, setPrompt] = useState("please make an image of a family in a major city");
    const [imageStyle, setImageStyle] = useState("default");
    const [model, setModel] = useState("gpt-4.1-nano");
    const [availableModels, setAvailableModels] = useState<{ id: string; label: string; provider: string }[]>([]);
    const [wordCount, setWordCount] = useState("1500-2500");
    const [companyId, setCompanyId] = useState<string>("");
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [err, setErr] = useState<string | null>(null);

    const [factChecking, setFactChecking] = useState(false);
    const [factCheck, setFactCheck] = useState<FactCheckResult | null>(null);
    const [factCheckErr, setFactCheckErr] = useState<string | null>(null);

    const [gallery, setGallery] = useState<GalleryImage[]>([]);
    const [selectedImgId, setSelectedImgId] = useState<number | null>(null);
    const [customImagePrompt, setCustomImagePrompt] = useState("");
    const [refreshingImage, setRefreshingImage] = useState(false);
    const [refreshErr, setRefreshErr] = useState<string | null>(null);

    const [humanizing, setHumanizing] = useState(false);
    const [humanized, setHumanized] = useState(false);
    const [humanizeErr, setHumanizeErr] = useState<string | null>(null);

    const [activeStyles, setActiveStyles] = useState<ImageStyleCategory[]>(IMAGE_STYLE_CATEGORIES);
    const [recommending, setRecommending] = useState(false);
    const [recommendation, setRecommendation] = useState<{ id: string; label: string; reason: string } | null>(null);
    const [recommendErr, setRecommendErr] = useState<string | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchImage[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchErr, setSearchErr] = useState<string | null>(null);

    const [ytQuery, setYtQuery] = useState("");
    const [ytResults, setYtResults] = useState<SearchVideo[]>([]);
    const [ytSearching, setYtSearching] = useState(false);
    const [ytErr, setYtErr] = useState<string | null>(null);

    const [companyPrompts, setCompanyPrompts] = useState<{ id: string; name: string; body: string }[]>([]);
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

    const [previewing, setPreviewing] = useState(false);
    const [previewData, setPreviewData] = useState<{ system: string; user: string; image_system: string; image_user: string; model: string; estimated_tokens?: number } | null>(null);
    const [previewErr, setPreviewErr] = useState<string | null>(null);
    const [previewCopied, setPreviewCopied] = useState<string | null>(null);

    const [checkingOverlap, setCheckingOverlap] = useState(false);
    const [overlapResults, setOverlapResults] = useState<{ id: string; title: string; slug: string; similarity: number; cluster_id: string | null }[] | null>(null);
    const [overlapErr, setOverlapErr] = useState<string | null>(null);

    // Fetch companies + models
    useEffect(() => {
        fetch("/api/companies").then((r) => r.json()).then((data) => { if (Array.isArray(data)) setCompanies(data); }).catch(() => {});
        fetch("/api/models").then((r) => r.json()).then((data) => {
            if (data?.models && Array.isArray(data.models)) {
                setAvailableModels(data.models);
                if (data.models.length > 0 && !data.models.some((m: any) => m.id === model)) setModel(data.models[0].id);
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (!companyId) { setActiveStyles(IMAGE_STYLE_CATEGORIES); setImageStyle("default"); return; }
        fetch(`/api/companies/${companyId}`).then((r) => r.json()).then((data) => {
            if (data?.image_style_categories && Array.isArray(data.image_style_categories) && data.image_style_categories.length > 0) {
                setActiveStyles(data.image_style_categories);
            } else { setActiveStyles(IMAGE_STYLE_CATEGORIES); }
            setImageStyle("default");
        }).catch(() => { setActiveStyles(IMAGE_STYLE_CATEGORIES); setImageStyle("default"); });
    }, [companyId]);

    useEffect(() => {
        setCompanyPrompts([]); setActiveTemplateId(null);
        if (!companyId) return;
        fetch(`/api/prompts?company_id=${companyId}`).then((r) => r.json()).then((data) => { if (Array.isArray(data)) setCompanyPrompts(data); }).catch(() => {});
    }, [companyId]);

    async function onCreate() {
        setLoading(true); setErr(null); setResult(null); setFactCheck(null); setFactCheckErr(null);
        setGallery([]); setSelectedImgId(null); setCustomImagePrompt(""); setRefreshErr(null); setHumanized(false); setHumanizeErr(null);
        try {
            const r = await fetch("/api/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_prompt: prompt, image_style: imageStyle, model, word_count: wordCount, company_id: companyId || undefined }) });
            const text = await r.text(); const data = text ? JSON.parse(text) : null;
            if (!r.ok) throw new Error(data?.error || `Request failed with status ${r.status}`);
            setResult(data);
            if (data?.image_base64) { const img: GalleryImage = { id: ++_imgId, base64: data.image_base64, prompt: data.image_prompt ?? "", label: "Original" }; setGallery([img]); setSelectedImgId(img.id); }
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    }

    async function onPreviewPrompt() {
        setPreviewing(true); setPreviewErr(null); setPreviewData(null); setPreviewCopied(null);
        try {
            const r = await fetch("/api/preview-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_prompt: prompt, image_style: imageStyle, model, word_count: wordCount, company_id: companyId || undefined }) });
            const data = await r.json(); if (!r.ok) throw new Error(data?.error || `Preview failed (${r.status})`);
            setPreviewData(data);
        } catch (e: any) { setPreviewErr(e.message); } finally { setPreviewing(false); }
    }

    function copyPreviewSection(label: string, text: string) {
        navigator.clipboard.writeText(text).then(() => { setPreviewCopied(label); setTimeout(() => setPreviewCopied(null), 2000); });
    }

    async function onCheckOverlap() {
        if (!prompt.trim() || !companyId) return;
        setCheckingOverlap(true); setOverlapErr(null); setOverlapResults(null);
        try {
            const r = await fetch("/api/similarity", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company_id: companyId, text: prompt.trim(), threshold: 0.75 }) });
            const data = await r.json(); if (!r.ok) throw new Error(data.error || "Overlap check failed");
            setOverlapResults(data.results ?? []);
        } catch (e: any) { setOverlapErr(e.message); } finally { setCheckingOverlap(false); }
    }

    async function onRefreshImage() {
        if (!result?.image_prompt) return;
        setRefreshingImage(true); setRefreshErr(null);
        try {
            const r = await fetch("/api/regenerate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base_prompt: result.image_prompt, custom_prompt: customImagePrompt.trim() || undefined, image_style: imageStyle, company_id: companyId || undefined }) });
            const text = await r.text(); const data = text ? JSON.parse(text) : null;
            if (!r.ok) throw new Error(data?.error || `Regeneration failed with status ${r.status}`);
            const newImg: GalleryImage = { id: ++_imgId, base64: data.image_base64, prompt: data.final_prompt ?? result.image_prompt, label: customImagePrompt.trim() ? `Variation: ${customImagePrompt.trim().slice(0, 40)}${customImagePrompt.trim().length > 40 ? "…" : ""}` : `Variation ${gallery.length + 1}` };
            setGallery((prev) => [...prev, newImg]); setSelectedImgId(newImg.id);
        } catch (e: any) { setRefreshErr(e.message); } finally { setRefreshingImage(false); }
    }

    async function onFactCheck() {
        if (!result) return;
        setFactChecking(true); setFactCheckErr(null); setFactCheck(null);
        try {
            const r = await fetch("/api/fact-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: result.title, excerpt: result.excerpt, html: result.html }) });
            const text = await r.text(); const data = text ? JSON.parse(text) : null;
            if (!r.ok) throw new Error(data?.error || `Fact-check failed with status ${r.status}`);
            setFactCheck(data);
        } catch (e: any) { setFactCheckErr(e.message); } finally { setFactChecking(false); }
    }

    async function onHumanize() {
        if (!result) return;
        setHumanizing(true); setHumanizeErr(null);
        try {
            const r = await fetch("/api/humanize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: result.title, excerpt: result.excerpt, html: result.html }) });
            const text = await r.text(); const data = text ? JSON.parse(text) : null;
            if (!r.ok) throw new Error(data?.error || `Humanize failed with status ${r.status}`);
            setResult((prev: any) => ({ ...prev, title: data.title ?? prev.title, excerpt: data.excerpt ?? prev.excerpt, html: data.html ?? prev.html }));
            setHumanized(true);
        } catch (e: any) { setHumanizeErr(e.message); } finally { setHumanizing(false); }
    }

    async function onSearchImages() {
        if (!searchQuery.trim()) return;
        setSearching(true); setSearchErr(null);
        try {
            const r = await fetch("/api/image-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searchQuery.trim(), num: 12 }) });
            const text = await r.text(); const data = text ? JSON.parse(text) : null;
            if (!r.ok) throw new Error(data?.error || `Search failed (${r.status})`);
            setSearchResults(data.images ?? []);
        } catch (e: any) { setSearchErr(e.message); } finally { setSearching(false); }
    }

    function selectSearchImage(img: SearchImage) {
        const newImg: GalleryImage = { id: ++_imgId, url: img.imageUrl, prompt: `Web search: ${img.title}`, label: img.title.slice(0, 40) || "Web Image" };
        setGallery((prev) => [...prev, newImg]); setSelectedImgId(newImg.id);
    }

    async function onSearchYouTube() {
        if (!ytQuery.trim()) return;
        setYtSearching(true); setYtErr(null);
        try {
            const r = await fetch("/api/youtube-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: ytQuery.trim(), num: 12 }) });
            const text = await r.text(); const data = text ? JSON.parse(text) : null;
            if (!r.ok) throw new Error(data?.error || `YouTube search failed (${r.status})`);
            setYtResults(data.videos ?? []);
        } catch (e: any) { setYtErr(e.message); } finally { setYtSearching(false); }
    }

    const selectedImage = gallery.find((img) => img.id === selectedImgId) ?? null;
    const selectedSrc = selectedImage ? selectedImage.base64 ? `data:image/png;base64,${selectedImage.base64}` : selectedImage.url ?? null : null;

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Description */}
                <p className="text-muted-foreground">Create on-brand blog posts + images from a single prompt.</p>

                {/* Company Selector */}
                <div className="flex gap-3 items-center">
                    <Label htmlFor="company-select" className="whitespace-nowrap">Company</Label>
                    <select id="company-select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                        className={cn("flex-1 max-w-xs rounded-md border bg-background px-3 py-2 text-sm", companyId ? "border-input" : "border-warning")}>
                        <option value="">— Select a company —</option>
                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {!companyId && companies.length > 0 && <Badge variant="outline" className="text-warning border-warning">Required</Badge>}
                    {companies.length === 0 && <Button variant="link" asChild size="sm"><Link href="/companies">Create a company first →</Link></Button>}
                </div>

                {/* Prompt Templates */}
                {companyPrompts.length > 0 && (
                    <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">Prompt Templates</Label>
                        <div className="flex gap-2 flex-wrap">
                            {companyPrompts.map((t) => (
                                <Button key={t.id} variant={activeTemplateId === t.id ? "default" : "outline"} size="sm" className="rounded-full gap-1"
                                    onClick={() => { setPrompt(t.body); setActiveTemplateId(t.id); }}>
                                    📝 {t.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main Prompt */}
                <Textarea value={prompt} onChange={(e) => { setPrompt(e.target.value); setActiveTemplateId(null); }} rows={3} placeholder="Describe the article you want to create..." className="text-base" />

                {/* Controls Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Image Style */}
                    <div className="space-y-1">
                        <Label htmlFor="image-style" className="text-xs">Image Style</Label>
                        <div className="flex gap-2 items-center">
                            <select id="image-style" value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}
                                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                {activeStyles.map((cat) => <option key={cat.id} value={cat.id}>{cat.label}</option>)}
                            </select>
                            {activeStyles.length > 1 && (
                                <Button variant="secondary" size="sm" disabled={recommending || !prompt.trim()} onClick={async () => {
                                    setRecommending(true); setRecommendation(null); setRecommendErr(null);
                                    try {
                                        const r = await fetch("/api/recommend-style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt.trim(), styles: activeStyles }) });
                                        const data = await r.json(); if (!r.ok) throw new Error(data.error || "Recommendation failed");
                                        setRecommendation(data); setImageStyle(data.id);
                                    } catch (e: any) { setRecommendErr(e.message); } finally { setRecommending(false); }
                                }} className="gap-1 whitespace-nowrap">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {recommending ? "…" : "Recommend"}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Model */}
                    <div className="space-y-1">
                        <Label htmlFor="model-select" className="text-xs">Model</Label>
                        <select id="model-select" value={model} onChange={(e) => setModel(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            {availableModels.length > 0 ? availableModels.map((m) => <option key={m.id} value={m.id}>{m.label}{m.provider !== "openai" ? ` (${m.provider})` : ""}</option>)
                                : <><option value="gpt-4.1-nano">GPT-4.1 Nano</option><option value="gpt-5.1">GPT-5.1</option></>}
                        </select>
                    </div>

                    {/* Length */}
                    <div className="space-y-1">
                        <Label htmlFor="word-count" className="text-xs">Length</Label>
                        <select id="word-count" value={wordCount} onChange={(e) => setWordCount(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            <option value="300-500">Short (300–500)</option>
                            <option value="800-1200">Medium (800–1,200)</option>
                            <option value="1500-2500">Long (1,500–2,500)</option>
                            <option value="2500-4000">Deep Dive (2,500–4,000)</option>
                            <option value="">No limit</option>
                        </select>
                    </div>
                </div>

                {/* Recommendation */}
                {recommendation && (
                    <Alert className="border-primary/30 bg-primary/5">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <AlertDescription className="flex items-center justify-between">
                            <span><strong>{recommendation.label}</strong> — {recommendation.reason}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setRecommendation(null)}><X className="h-3.5 w-3.5" /></Button>
                        </AlertDescription>
                    </Alert>
                )}
                {recommendErr && <p className="text-sm text-destructive">{recommendErr}</p>}

                {/* Action Buttons */}
                <div className="flex gap-2.5 items-center flex-wrap">
                    <Button onClick={onCreate} disabled={loading || !companyId} size="lg" className="gap-1.5">
                        {loading ? <><RefreshCw className="h-4 w-4 animate-spin" /> Creating…</> : "Create"}
                    </Button>
                    <Button variant="outline" onClick={onPreviewPrompt} disabled={previewing || loading || !companyId || prompt.trim().length < 5} className="gap-1.5">
                        <Eye className="h-4 w-4" /> {previewing ? "Loading…" : "Preview Prompt"}
                    </Button>
                    <Button variant="outline" onClick={onCheckOverlap} disabled={checkingOverlap || loading || !companyId || prompt.trim().length < 5} className="gap-1.5">
                        <Search className="h-4 w-4" /> {checkingOverlap ? "Checking…" : "Check Overlap"}
                    </Button>
                </div>

                {/* Overlap Results */}
                {overlapErr && <p className="text-sm text-destructive">{overlapErr}</p>}
                {overlapResults !== null && (
                    <Alert variant={overlapResults.length > 0 ? "default" : "default"} className={overlapResults.length > 0 ? "border-warning bg-warning/5" : "border-success bg-success/5"}>
                        {overlapResults.length === 0 ? (
                            <AlertDescription className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-success font-medium">
                                    <CheckCircle2 className="h-4 w-4" /> No significant overlap found. This topic looks fresh!
                                </span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOverlapResults(null)}><X className="h-3.5 w-3.5" /></Button>
                            </AlertDescription>
                        ) : (
                            <>
                                <AlertDescription>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="font-semibold text-warning flex items-center gap-2">
                                            <AlertTriangle className="h-4 w-4" />
                                            {overlapResults.length} similar article{overlapResults.length !== 1 ? "s" : ""} found
                                        </span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOverlapResults(null)}><X className="h-3.5 w-3.5" /></Button>
                                    </div>
                                    <div className="space-y-1.5">
                                        {overlapResults.map((r) => {
                                            const pct = Math.round(r.similarity * 100);
                                            return (
                                                <div key={r.id} className="flex items-center gap-2 p-2 rounded-md bg-card border border-border text-sm">
                                                    <Badge variant={pct >= 92 ? "destructive" : "secondary"} className="text-xs font-bold shrink-0">{pct}%</Badge>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium truncate">{r.title}</div>
                                                        <div className="text-xs text-muted-foreground">/{r.slug}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">You can still create this article — these are advisory warnings only.</p>
                                </AlertDescription>
                            </>
                        )}
                    </Alert>
                )}

                {err && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{err}</AlertDescription></Alert>}

                {/* ====== Result ====== */}
                {result && (
                    <section className="space-y-6 mt-6">
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight">{result.title}</h2>
                            <p className="text-muted-foreground italic mt-1">{result.excerpt}</p>
                        </div>

                        {/* Image */}
                        {selectedSrc && (
                            <div>
                                <img src={selectedSrc} alt={result.title} className="w-full rounded-xl" />
                                <details className="mt-2 group">
                                    <summary className="cursor-pointer text-xs text-muted-foreground">Image prompt</summary>
                                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground mt-1 p-3 bg-muted rounded-md">{selectedImage?.prompt ?? result.image_prompt}</pre>
                                </details>
                            </div>
                        )}

                        {/* Image Refresh */}
                        <div className="flex gap-2 items-stretch flex-wrap">
                            <Input placeholder="Optional: add extra image direction…" value={customImagePrompt} onChange={(e) => setCustomImagePrompt(e.target.value)} className="flex-1 min-w-[200px]" />
                            <Button variant="outline" onClick={onRefreshImage} disabled={refreshingImage || !result?.image_prompt} className="gap-1.5 whitespace-nowrap">
                                <RefreshCw className={cn("h-4 w-4", refreshingImage && "animate-spin")} />
                                {refreshingImage ? "Generating…" : "Refresh Image"}
                            </Button>
                        </div>
                        {refreshErr && <p className="text-sm text-destructive">{refreshErr}</p>}

                        {/* Gallery */}
                        {gallery.length > 1 && (
                            <div>
                                <h4 className="text-xs font-medium text-muted-foreground mb-2">Image Gallery ({gallery.length})</h4>
                                <div className="flex gap-2.5 overflow-x-auto pb-2">
                                    {gallery.map((img) => (
                                        <button key={img.id} onClick={() => setSelectedImgId(img.id)}
                                            className={cn("shrink-0 w-28 rounded-lg overflow-hidden border-2 transition-colors",
                                                img.id === selectedImgId ? "border-primary" : "border-border hover:border-primary/50")}>
                                            <img src={img.base64 ? `data:image/png;base64,${img.base64}` : img.url ?? ""} alt={img.label} className="w-full h-20 object-cover" />
                                            <div className="px-1.5 py-1 text-[11px] text-center text-muted-foreground truncate">{img.label}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* SEO */}
                        <details className="group">
                            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">📊 SEO</summary>
                            <pre className="whitespace-pre-wrap text-xs mt-1 p-3 bg-muted rounded-md">{JSON.stringify(result.seo, null, 2)}</pre>
                        </details>

                        <Separator />

                        {/* Article Content */}
                        <div dangerouslySetInnerHTML={{ __html: result.html }} className="prose prose-sm dark:prose-invert max-w-none" />

                        <Separator />

                        {/* Humanize */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <Button variant="outline" onClick={onHumanize} disabled={humanizing || humanized}
                                className={cn("gap-1.5", humanized && "border-success text-success")}>
                                {humanizing ? <><RefreshCw className="h-4 w-4 animate-spin" /> Humanizing…</> : humanized ? <><CheckCircle2 className="h-4 w-4" /> Humanized</> : <><Wand2 className="h-4 w-4" /> Humanize</>}
                            </Button>
                            {humanized && <span className="text-sm text-success">Title, excerpt, and body rewritten</span>}
                        </div>
                        {humanizeErr && <p className="text-sm text-destructive">{humanizeErr}</p>}

                        <Separator />

                        {/* Fact Check */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <Button variant="outline" onClick={onFactCheck} disabled={factChecking} className="gap-1.5">
                                {factChecking ? <><RefreshCw className="h-4 w-4 animate-spin" /> Fact-checking…</> : factCheck ? <><ShieldCheck className="h-4 w-4" /> Re-check</> : <><ShieldCheck className="h-4 w-4" /> Fact-Check</>}
                            </Button>
                            {factCheck && (
                                <Badge style={{ backgroundColor: VERDICT_COLORS[factCheck.overall_verdict] }} className="text-white">
                                    {factCheck.overall_verdict === "pass" ? "✓ Pass" : factCheck.overall_verdict === "needs_review" ? "⚠ Needs Review" : "✗ Fail"}
                                </Badge>
                            )}
                            {factCheck && <span className="text-sm text-muted-foreground">Confidence: {Math.round(factCheck.confidence * 100)}%</span>}
                        </div>
                        {factCheckErr && <p className="text-sm text-destructive">{factCheckErr}</p>}

                        {factCheck && (
                            <Card>
                                <CardContent className="p-4 space-y-3">
                                    {factCheck.summary && <p className="text-sm leading-relaxed">{factCheck.summary}</p>}
                                    <h4 className="text-sm font-medium">Claims Reviewed ({factCheck.claims.length})</h4>
                                    {factCheck.claims.map((claim, i) => (
                                        <div key={i} className="p-3 rounded-md border" style={{ borderColor: `${VERDICT_COLORS[claim.verdict]}33`, backgroundColor: `${VERDICT_COLORS[claim.verdict]}08` }}>
                                            <Badge className="text-[11px] uppercase mb-1.5" style={{ color: VERDICT_COLORS[claim.verdict], backgroundColor: `${VERDICT_COLORS[claim.verdict]}18` }}>
                                                {claim.verdict}
                                            </Badge>
                                            <p className="text-sm font-medium">&ldquo;{claim.claim}&rdquo;</p>
                                            <p className="text-sm text-muted-foreground mt-1">{claim.explanation}</p>
                                            {claim.suggested_edit && (
                                                <p className="mt-2 text-sm p-2 bg-card border border-dashed border-border rounded-md">
                                                    ✏️ <strong>Suggested edit:</strong> {claim.suggested_edit}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        )}
                    </section>
                )}

                {/* ====== Image Search ====== */}
                <section className="space-y-4 mt-8">
                    <Separator />
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2"><Search className="h-5 w-5" /> Image Search</h2>
                        <p className="text-sm text-muted-foreground mt-1">Search the web for product photos, stock images, or any visual asset.</p>
                    </div>
                    <div className="flex gap-2">
                        <Input placeholder="e.g. Fender Stratocaster red guitar" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onSearchImages(); }} />
                        <Button variant="outline" onClick={onSearchImages} disabled={searching || !searchQuery.trim()} className="gap-1.5 whitespace-nowrap">
                            <Search className="h-4 w-4" /> {searching ? "Searching…" : "Search"}
                        </Button>
                    </div>
                    {searchErr && <p className="text-sm text-destructive">{searchErr}</p>}
                    {searchResults.length > 0 && (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
                            {searchResults.map((img, i) => (
                                <Card key={i} className="overflow-hidden">
                                    <div onClick={() => selectSearchImage(img)} className="cursor-pointer bg-muted aspect-[4/3] overflow-hidden">
                                        <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} loading="lazy" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                    </div>
                                    <CardContent className="p-2.5 space-y-1">
                                        <div className="text-xs font-medium truncate">{img.title}</div>
                                        <div className="text-[11px] text-muted-foreground">{img.domain}{img.width && img.height ? ` · ${img.width}×${img.height}` : ""}</div>
                                        <div className="flex gap-3 text-xs">
                                            <a href={`/api/image-proxy?url=${encodeURIComponent(img.imageUrl)}`} download className="text-primary font-medium flex items-center gap-1"><Download className="h-3 w-3" /> Download</a>
                                            <button onClick={() => selectSearchImage(img)} className="text-primary font-medium">▲ Use</button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>

                {/* ====== YouTube Search ====== */}
                <section className="space-y-4 mt-8">
                    <Separator />
                    <div>
                        <h2 className="text-lg font-semibold flex items-center gap-2"><Video className="h-5 w-5" /> YouTube Search</h2>
                        <p className="text-sm text-muted-foreground mt-1">Search YouTube for relevant videos, tutorials, and media.</p>
                    </div>
                    <div className="flex gap-2">
                        <Input placeholder="e.g. best dental implant options for seniors" value={ytQuery} onChange={(e) => setYtQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onSearchYouTube(); }} />
                        <Button variant="outline" onClick={onSearchYouTube} disabled={ytSearching || !ytQuery.trim()} className="gap-1.5 whitespace-nowrap">
                            <Play className="h-4 w-4" /> {ytSearching ? "Searching…" : "Search"}
                        </Button>
                    </div>
                    {ytErr && <p className="text-sm text-destructive">{ytErr}</p>}
                    {ytResults.length > 0 && (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
                            {ytResults.map((vid, i) => (
                                <a key={i} href={vid.link} target="_blank" rel="noopener noreferrer" className="no-underline">
                                    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                                        <div className="relative bg-black aspect-video overflow-hidden">
                                            {vid.imageUrl && <img src={vid.imageUrl} alt={vid.title} loading="lazy" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                                            {vid.duration && (
                                                <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded">{vid.duration}</span>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-70 pointer-events-none">
                                                <svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.5)"/><polygon points="18,14 36,24 18,34" fill="#fff"/></svg>
                                            </div>
                                        </div>
                                        <CardContent className="p-2.5 space-y-0.5">
                                            <div className="text-sm font-semibold line-clamp-2 leading-tight">{vid.title}</div>
                                            {vid.channel && <div className="text-xs text-muted-foreground font-medium">{vid.channel}</div>}
                                            {vid.date && <div className="text-[11px] text-muted-foreground">{vid.date}</div>}
                                            {vid.snippet && <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{vid.snippet}</div>}
                                        </CardContent>
                                    </Card>
                                </a>
                            ))}
                        </div>
                    )}
                </section>

                {/* ====== Prompt Preview Dialog ====== */}
                <Dialog open={!!previewData} onOpenChange={(open) => { if (!open) setPreviewData(null); }}>
                    <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        <DialogHeader>
                            <DialogTitle>Prompt Preview</DialogTitle>
                            {previewData && (
                                <div className="flex gap-4 text-sm text-muted-foreground">
                                    <span>Model: <strong>{previewData.model}</strong></span>
                                    {previewData.estimated_tokens && <span>≈ <strong>{previewData.estimated_tokens.toLocaleString()}</strong> tokens</span>}
                                </div>
                            )}
                        </DialogHeader>
                        {previewData && (
                            <div className="overflow-auto flex-1 space-y-5 py-2">
                                {/* System Prompt */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs uppercase tracking-wider text-primary font-semibold">System Prompt</h4>
                                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => copyPreviewSection("system", previewData.system)}>
                                            {previewCopied === "system" ? <><CheckCircle2 className="h-3 w-3 text-success" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                                        </Button>
                                    </div>
                                    <pre className="whitespace-pre-wrap break-words bg-primary/5 border border-primary/20 rounded-lg p-4 text-xs leading-relaxed max-h-96 overflow-auto">
                                        {previewData.system}
                                    </pre>
                                </div>

                                {/* User Prompt */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs uppercase tracking-wider text-success font-semibold">User Prompt</h4>
                                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => copyPreviewSection("user", previewData.user)}>
                                            {previewCopied === "user" ? <><CheckCircle2 className="h-3 w-3 text-success" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                                        </Button>
                                    </div>
                                    <pre className="whitespace-pre-wrap break-words bg-success/5 border border-success/20 rounded-lg p-4 text-xs leading-relaxed max-h-96 overflow-auto">
                                        {previewData.user}
                                    </pre>
                                </div>

                                {/* Image Prompt */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-xs uppercase tracking-wider text-warning font-semibold">Image Prompt</h4>
                                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => copyPreviewSection("image", `${previewData.image_system}\n\n${previewData.image_user}`)}>
                                            {previewCopied === "image" ? <><CheckCircle2 className="h-3 w-3 text-success" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
                                        </Button>
                                    </div>
                                    <pre className="whitespace-pre-wrap break-words bg-warning/5 border border-warning/20 rounded-lg p-4 text-xs leading-relaxed max-h-72 overflow-auto">
                                        {previewData.image_system}{"\n\n"}{previewData.image_user}
                                    </pre>
                                </div>
                            </div>
                        )}
                        {previewData && (
                            <DialogFooter>
                                <Button variant="outline" onClick={() => copyPreviewSection("all", `=== ARTICLE SYSTEM PROMPT ===\n\n${previewData.system}\n\n=== ARTICLE USER PROMPT ===\n\n${previewData.user}\n\n=== IMAGE PROMPT ===\n\n${previewData.image_system}\n\n${previewData.image_user}`)}
                                    className={cn("gap-1", previewCopied === "all" && "text-success border-success")}>
                                    {previewCopied === "all" ? <><CheckCircle2 className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy All</>}
                                </Button>
                                <Button variant="outline" onClick={() => setPreviewData(null)}>Close</Button>
                            </DialogFooter>
                        )}
                    </DialogContent>
                </Dialog>
                {previewErr && <p className="text-sm text-destructive mt-2">Preview failed: {previewErr}</p>}
            </div>
        </AppLayout>
    );
}
