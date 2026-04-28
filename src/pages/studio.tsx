import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
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
    Wand2, ShieldCheck, ImageIcon, Video, Layers, Scale,
    ExternalLink, ChevronDown, ChevronRight,
    FileText, Network, ArrowRight,
} from "lucide-react";
import type { ConsulResult, ConsulClaimReview } from "@/lib/consulPrompts";
import { cn } from "@/lib/utils";
import { useModelDefaults } from "@/hooks/useModelDefaults";

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
    disputed: "#8b5cf6",
};

const AGREEMENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
    full: { label: "Full Agreement", icon: "✓", color: "#22c55e" },
    partial: { label: "Partial Agreement", icon: "~", color: "#f59e0b" },
    split: { label: "Models Disagree", icon: "✗", color: "#ef4444" },
    single_source: { label: "Single Source", icon: "1", color: "#a3a3a3" },
};

let _imgId = 0;

export default function Home() {
    const router = useRouter();
    const { defaults } = useModelDefaults();

    // ── Creation Mode ───────────────────────────────────────────────
    const [mode, setMode] = useState<"single" | "cluster">("single");

    // ── Cluster Mode State ──────────────────────────────────────────
    const [clusterTopic, setClusterTopic] = useState("");
    const [clusterGenerating, setClusterGenerating] = useState(false);
    const [clusterResult, setClusterResult] = useState<any>(null);
    const [clusterErr, setClusterErr] = useState<string | null>(null);

    const [prompt, setPrompt] = useState("please make an image of a family in a major city");
    const [imageStyle, setImageStyle] = useState("default");
    const [model, setModel] = useState("");
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

    // Consul (deep multi-model) fact-check
    const [consulChecking, setConsulChecking] = useState(false);
    const [consulResult, setConsulResult] = useState<ConsulResult | null>(null);
    const [consulErr, setConsulErr] = useState<string | null>(null);
    const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set());
    const [applyingRewrite, setApplyingRewrite] = useState<number | null>(null);
    const [appliedRewrites, setAppliedRewrites] = useState<Set<number>>(new Set());

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

    // Composite state
    const [compositeProductImg, setCompositeProductImg] = useState<SearchImage | null>(null);
    const [compositeBgPrompt, setCompositeBgPrompt] = useState("");
    const [compositeGenerating, setCompositeGenerating] = useState(false);
    const [compositeResult, setCompositeResult] = useState<string | null>(null);
    const [compositeErr, setCompositeErr] = useState<string | null>(null);

    // Composite style state for create flow
    const [csProductQuery, setCsProductQuery] = useState("");
    const [csProductResults, setCsProductResults] = useState<SearchImage[]>([]);
    const [csProductSearching, setCsProductSearching] = useState(false);
    const [csProductUrl, setCsProductUrl] = useState<string | null>(null);
    const [csProductThumb, setCsProductThumb] = useState<string | null>(null);
    const [csBgPrompt, setCsBgPrompt] = useState("");
    const [csBgImageUrl, setCsBgImageUrl] = useState("");

    // Derived: is the currently selected style composite?
    const selectedStyleObj = activeStyles.find((s) => s.id === imageStyle);
    const isCompositeStyle = selectedStyleObj?.type === "composite";

    async function csProductSearch() {
        if (!csProductQuery.trim()) return;
        setCsProductSearching(true);
        try {
            const r = await fetch("/api/image-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: csProductQuery.trim(), num: 8 }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Search failed");
            setCsProductResults(data.images ?? []);
        } catch { setCsProductResults([]); }
        finally { setCsProductSearching(false); }
    }

    const { activeAccount, isAdmin } = useAuth();
    const isScopedMember = !isAdmin && !!activeAccount?.company_id;

    // Fetch companies + models
    useEffect(() => {
        fetch("/api/companies").then((r) => r.json()).then((data) => {
            if (Array.isArray(data)) {
                setCompanies(data);
                // Auto-select if member is scoped to one company
                if (data.length === 1 && !companyId) {
                    setCompanyId(data[0].id);
                }
            }
        }).catch(() => {});
        fetch("/api/models").then((r) => r.json()).then((data) => {
            if (data?.models && Array.isArray(data.models)) {
                setAvailableModels(data.models);
            }
        }).catch(() => {});
    }, []);

    // Initialize model from user's saved default once models are loaded
    useEffect(() => {
        if (availableModels.length === 0) return;
        const target = defaults.writing;
        if (availableModels.some((m) => m.id === target)) {
            setModel(target);
        } else {
            setModel(availableModels[0].id);
        }
    }, [availableModels, defaults.writing]);

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
        setConsulResult(null); setConsulErr(null); setExpandedClaims(new Set()); setAppliedRewrites(new Set());
        setGallery([]); setSelectedImgId(null); setCustomImagePrompt(""); setRefreshErr(null); setHumanized(false); setHumanizeErr(null);
        try {
            const payload: Record<string, unknown> = {
                creation_prompt: prompt,
                image_style: imageStyle,
                model,
                word_count: wordCount,
                company_id: companyId || undefined,
                image_model: defaults.imageGeneration,
                utility_model: defaults.utility,
            };
            // Add composite params if applicable
            if (isCompositeStyle && csProductUrl) {
                payload.composite_product_image_url = csProductUrl;
                if (csBgImageUrl.trim()) payload.composite_bg_image_url = csBgImageUrl.trim();
                if (csBgPrompt.trim()) payload.composite_bg_prompt = csBgPrompt.trim();
            }
            const r = await fetch("/api/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            const text = await r.text(); const data = text ? JSON.parse(text) : null;
            if (!r.ok) throw new Error(data?.error || `Request failed with status ${r.status}`);
            setResult(data);
            if (data?.image_base64) { const img: GalleryImage = { id: ++_imgId, base64: data.image_base64, prompt: data.image_prompt ?? "", label: "Original" }; setGallery([img]); setSelectedImgId(img.id); }
        } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    }

    async function onCreateCluster() {
        if (!companyId || !clusterTopic.trim()) return;
        setClusterGenerating(true); setClusterErr(null); setClusterResult(null);
        try {
            const r = await fetch("/api/clusters", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_id: companyId, topic: clusterTopic.trim(), model }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Strategy generation failed");
            setClusterResult(data);
        } catch (e: any) { setClusterErr(e.message); }
        finally { setClusterGenerating(false); }
    }

    async function onPreviewPrompt() {
        setPreviewing(true); setPreviewErr(null); setPreviewData(null); setPreviewCopied(null);
        try {
            const r = await fetch("/api/preview-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ creation_prompt: prompt, image_style: imageStyle, model, word_count: wordCount, company_id: companyId || undefined, image_model: defaults.imageGeneration, utility_model: defaults.utility }) });
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
            const payload: Record<string, unknown> = {
                base_prompt: result.image_prompt,
                custom_prompt: customImagePrompt.trim() || undefined,
                image_style: imageStyle,
                company_id: companyId || undefined,
            };
            // Add composite params for refresh
            if (isCompositeStyle && csProductUrl) {
                payload.composite_product_image_url = csProductUrl;
                payload.article_title = result.title;
                payload.article_excerpt = result.excerpt;
                if (csBgImageUrl.trim()) payload.composite_bg_image_url = csBgImageUrl.trim();
                if (csBgPrompt.trim()) payload.composite_bg_prompt = csBgPrompt.trim();
            }
            const r = await fetch("/api/regenerate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
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

    async function onConsulCheck() {
        if (!result) return;
        setConsulChecking(true); setConsulErr(null); setConsulResult(null); setExpandedClaims(new Set()); setAppliedRewrites(new Set());
        try {
            const r = await fetch("/api/fact-check-consul", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: result.title, excerpt: result.excerpt, html: result.html }) });
            const text = await r.text(); const data = text ? JSON.parse(text) : null;
            if (!r.ok) throw new Error(data?.error || `Consul check failed with status ${r.status}`);
            setConsulResult(data);
        } catch (e: any) { setConsulErr(e.message); } finally { setConsulChecking(false); }
    }

    function toggleClaimExpanded(index: number) {
        setExpandedClaims((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    }

    async function onApplyRewrite(claimIndex: number) {
        if (!result || !consulResult) return;
        const claim = consulResult.claims[claimIndex];
        if (!claim?.suggested_rewrite) return;
        setApplyingRewrite(claimIndex);
        try {
            const r = await fetch("/api/apply-rewrite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html: result.html, claim: claim.claim, suggested_rewrite: claim.suggested_rewrite }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Apply rewrite failed");
            setResult((prev: any) => ({ ...prev, html: data.html }));
            setAppliedRewrites((prev) => new Set(prev).add(claimIndex));
        } catch (e: any) { alert(`Rewrite failed: ${e.message}`); }
        finally { setApplyingRewrite(null); }
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

    const compositeRef = useRef<HTMLDivElement>(null);

    function startComposite(img: SearchImage) {
        setCompositeProductImg(img);
        setCompositeBgPrompt("");
        setCompositeResult(null);
        setCompositeErr(null);
        // Scroll to the composite panel after React renders it
        setTimeout(() => compositeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }

    async function onCompositeGenerate() {
        if (!compositeProductImg) return;
        setCompositeGenerating(true); setCompositeErr(null);
        try {
            const r = await fetch("/api/composite-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    product_image_url: compositeProductImg.imageUrl,
                    article_title: result?.title ?? compositeProductImg.title ?? "Product",
                    article_excerpt: result?.excerpt ?? "",
                    custom_bg_prompt: compositeBgPrompt.trim() || undefined,
                    image_style: imageStyle !== "default" ? imageStyle : undefined,
                    company_id: companyId || undefined,
                }),
            });
            const text = await r.text(); const data = text ? JSON.parse(text) : null;
            if (!r.ok) throw new Error(data?.error || "Composite generation failed");
            setCompositeResult(data.image_base64);
        } catch (e: any) { setCompositeErr(e.message); }
        finally { setCompositeGenerating(false); }
    }

    function useCompositeResult() {
        if (!compositeResult) return;
        const newImg: GalleryImage = {
            id: ++_imgId,
            base64: compositeResult,
            prompt: `Composite: ${compositeProductImg?.title ?? "product"}`,
            label: `Composite${gallery.length > 0 ? ` ${gallery.length + 1}` : ""}`,
        };
        setGallery((prev) => [...prev, newImg]);
        setSelectedImgId(newImg.id);
        setCompositeProductImg(null);
        setCompositeResult(null);
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
                <p className="text-muted-foreground">Create on-brand content from a single prompt — either a standalone article or an entire content cluster.</p>

                {/* Company Selector */}
                <div className="flex gap-3 items-center">
                    <Label htmlFor="company-select" className="whitespace-nowrap">Company</Label>
                    <select id="company-select" value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                        disabled={isScopedMember && companies.length === 1}
                        className={cn("flex-1 max-w-xs rounded-md border bg-background px-3 py-2 text-sm", companyId ? "border-input" : "border-warning", isScopedMember && companies.length === 1 && "opacity-70 cursor-not-allowed")}>
                        <option value="">— Select a company —</option>
                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {!companyId && companies.length > 0 && <Badge variant="outline" className="text-warning border-warning">Required</Badge>}
                    {companies.length === 0 && <Button variant="link" asChild size="sm"><Link href="/companies">Create a company first →</Link></Button>}
                </div>

                {/* ── Mode Selector ─────────────────────────────────────── */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        id="mode-single"
                        onClick={() => { setMode("single"); setClusterResult(null); setClusterErr(null); }}
                        className={cn(
                            "group relative flex items-center gap-2.5 rounded-lg border-2 px-3 py-2 text-left transition-all duration-200",
                            mode === "single"
                                ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                                : "border-border hover:border-primary/40 hover:bg-muted/50"
                        )}
                    >
                        <div className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                            mode === "single" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                        )}>
                            <FileText className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                            <div className="font-semibold text-sm leading-tight">Single Article</div>
                            <p className="text-[11px] text-muted-foreground leading-tight">One blog post with images & SEO</p>
                        </div>
                        {mode === "single" && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
                    </button>

                    <button
                        id="mode-cluster"
                        onClick={() => { setMode("cluster"); setResult(null); setErr(null); }}
                        className={cn(
                            "group relative flex items-center gap-2.5 rounded-lg border-2 px-3 py-2 text-left transition-all duration-200",
                            mode === "cluster"
                                ? "border-primary bg-primary/5 shadow-sm shadow-primary/10"
                                : "border-border hover:border-primary/40 hover:bg-muted/50"
                        )}
                    >
                        <div className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors",
                            mode === "cluster" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                        )}>
                            <Network className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                            <div className="font-semibold text-sm leading-tight">Content Cluster</div>
                            <p className="text-[11px] text-muted-foreground leading-tight">Pillar + supporting pages strategy</p>
                        </div>
                        {mode === "cluster" && <CheckCircle2 className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />}
                    </button>
                </div>

                {/* ═══════════ SINGLE ARTICLE MODE ═══════════ */}
                {mode === "single" && (<>

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
                            <select id="image-style" value={imageStyle} onChange={(e) => {
                                    const newStyleId = e.target.value;
                                    setImageStyle(newStyleId);
                                    // Wipe previous prompt context and results when switching styles
                                    setResult(null); setErr(null);
                                    setGallery([]); setSelectedImgId(null); setRefreshErr(null);
                                    setFactCheck(null); setFactCheckErr(null);
                                    setConsulResult(null); setConsulErr(null); setExpandedClaims(new Set());
                                    setHumanized(false); setHumanizeErr(null);
                                    setRecommendation(null); setRecommendErr(null);
                                    setPreviewData(null); setPreviewErr(null);
                                    setOverlapResults(null); setOverlapErr(null);
                                    const style = activeStyles.find((s) => s.id === newStyleId);
                                    if (style && newStyleId !== "default") {
                                        const parts: string[] = [];
                                        if (style.image_prompt_style) parts.push(style.image_prompt_style);
                                        else if (style.narrative) parts.push(style.narrative);
                                        if (style.storytelling_cues.length) parts.push(`Cues: ${style.storytelling_cues.join("; ")}`);
                                        setCustomImagePrompt(parts.join(". ").trim());
                                    } else {
                                        setCustomImagePrompt("");
                                    }
                                    // Reset composite state and pre-populate from style defaults
                                    setCsProductUrl(null); setCsProductThumb(null); setCsProductResults([]);
                                    if (style?.type === "composite") {
                                        setCsProductQuery(style.composite_product_query ?? "");
                                        setCsBgPrompt(style.composite_bg_prompt ?? "");
                                        setCsBgImageUrl(style.composite_bg_image_url ?? "");
                                    } else {
                                        setCsProductQuery(""); setCsBgPrompt(""); setCsBgImageUrl("");
                                    }
                                }}
                                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                {activeStyles.map((cat) => <option key={cat.id} value={cat.id}>{cat.type === "composite" ? `🧩 ${cat.label}` : cat.label}</option>)}
                            </select>
                            {activeStyles.length > 1 && (
                                <Button variant="secondary" size="sm" disabled={recommending || !prompt.trim()} onClick={async () => {
                                    setRecommending(true); setRecommendation(null); setRecommendErr(null);
                                    try {
                                        const r = await fetch("/api/recommend-style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt.trim(), styles: activeStyles }) });
                                        const data = await r.json(); if (!r.ok) throw new Error(data.error || "Recommendation failed");
                                        setRecommendation(data); setImageStyle(data.id);
                                        // Pre-fill prompt from recommended style's data
                                        const style = activeStyles.find((s) => s.id === data.id);
                                        if (style && data.id !== "default") {
                                            const parts: string[] = [];
                                            if (style.image_prompt_style) parts.push(style.image_prompt_style);
                                            else if (style.narrative) parts.push(style.narrative);
                                            if (style.storytelling_cues.length) parts.push(`Cues: ${style.storytelling_cues.join("; ")}`);
                                            setCustomImagePrompt(parts.join(". ").trim());
                                        } else {
                                            setCustomImagePrompt("");
                                        }
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
                                : <><option value="gpt-5.5">GPT-5.5</option><option value="gpt-5.4">GPT-5.4</option><option value="gpt-5.1">GPT-5.1</option><option value="gpt-4.1-mini">GPT-4.1 Mini</option></>}
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

                {/* Composite Blend Panel — shown when composite style selected */}
                {isCompositeStyle && (
                    <Card className="border-primary/20 bg-primary/5">
                        <CardContent className="pt-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-primary" />
                                <span className="text-sm font-semibold text-primary">🧩 Composite Blend</span>
                                {csProductUrl && <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-600">✓ Product selected</Badge>}
                            </div>
                            <div className="flex gap-2">
                                <Input placeholder={selectedStyleObj?.composite_product_query || "Search product image..."} value={csProductQuery} onChange={(e) => setCsProductQuery(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") csProductSearch(); }} className="text-sm" />
                                <Button variant="outline" size="sm" onClick={csProductSearch} disabled={csProductSearching || !csProductQuery.trim()} className="gap-1 whitespace-nowrap">
                                    <Search className="h-3.5 w-3.5" />
                                    {csProductSearching ? "…" : "Find Product"}
                                </Button>
                            </div>
                            {csProductResults.length > 0 && (
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                    {csProductResults.map((img, i) => (
                                        <button key={i} onClick={() => { setCsProductUrl(img.imageUrl); setCsProductThumb(img.thumbnailUrl || img.imageUrl); }}
                                            className={cn("rounded-lg overflow-hidden border-2 transition-all",
                                                csProductUrl === img.imageUrl ? "border-primary ring-2 ring-primary/30 scale-[1.02]" : "border-border hover:border-primary/50")}>
                                            <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} loading="lazy" className="w-full aspect-square object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                        </button>
                                    ))}
                                </div>
                            )}
                            {csProductUrl && csProductThumb && (
                                <div className="flex items-center gap-3 p-2 rounded-md bg-card border border-border">
                                    <img src={csProductThumb} alt="Selected product" className="w-12 h-12 object-contain rounded" />
                                    <span className="text-sm text-muted-foreground truncate flex-1">Product selected for compositing</span>
                                    <Button variant="ghost" size="sm" onClick={() => { setCsProductUrl(null); setCsProductThumb(null); }} className="text-destructive text-xs">Remove</Button>
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs">Background prompt</Label>
                                    <Input placeholder={selectedStyleObj?.composite_bg_prompt || "e.g. Modern kitchen countertop"} value={csBgPrompt} onChange={(e) => setCsBgPrompt(e.target.value)} className="text-sm" />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Background image URL</Label>
                                    <Input placeholder={selectedStyleObj?.composite_bg_image_url || "https://... (optional)"} value={csBgImageUrl} onChange={(e) => setCsBgImageUrl(e.target.value)} className="text-sm" />
                                </div>
                            </div>
                            {isCompositeStyle && !csProductUrl && (
                                <p className="text-xs text-muted-foreground italic">ℹ️ Select a product image above. If none is selected, the article will use standard AI image generation.</p>
                            )}
                        </CardContent>
                    </Card>
                )}

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

                        {/* Fact Check — Quick + Consul */}
                        <div className="flex items-center gap-3 flex-wrap">
                            <Button variant="outline" onClick={onFactCheck} disabled={factChecking || consulChecking} className="gap-1.5">
                                {factChecking ? <><RefreshCw className="h-4 w-4 animate-spin" /> Quick checking…</> : factCheck ? <><ShieldCheck className="h-4 w-4" /> Re-check (Quick)</> : <><ShieldCheck className="h-4 w-4" /> Quick Check</>}
                            </Button>
                            <Button variant="outline" onClick={onConsulCheck} disabled={consulChecking || factChecking} className="gap-1.5 border-primary/30">
                                {consulChecking ? <><RefreshCw className="h-4 w-4 animate-spin" /> Consulting…</> : consulResult ? <><Scale className="h-4 w-4" /> Re-check (Consul)</> : <><Scale className="h-4 w-4" /> Deep Consul</>}
                            </Button>
                            {factCheck && (
                                <Badge style={{ backgroundColor: VERDICT_COLORS[factCheck.overall_verdict] }} className="text-white">
                                    {factCheck.overall_verdict === "pass" ? "✓ Pass" : factCheck.overall_verdict === "needs_review" ? "⚠ Needs Review" : "✗ Fail"}
                                </Badge>
                            )}
                            {factCheck && <span className="text-sm text-muted-foreground">Confidence: {Math.round(factCheck.confidence * 100)}%</span>}
                        </div>
                        {factCheckErr && <p className="text-sm text-destructive">{factCheckErr}</p>}
                        {consulErr && <p className="text-sm text-destructive">{consulErr}</p>}

                        {/* Quick Check Results (existing) */}
                        {factCheck && (
                            <Card>
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Check (Single Model)</span>
                                    </div>
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

                        {/* Consul Results (multi-model) */}
                        {consulResult && (
                            <Card className="border-primary/20">
                                <CardContent className="p-4 space-y-4">
                                    {/* Header with model status */}
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <div className="flex items-center gap-2">
                                            <Scale className="h-4 w-4 text-primary" />
                                            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Fact-Check Consul</span>
                                            <Badge style={{ backgroundColor: VERDICT_COLORS[consulResult.overall_verdict] }} className="text-white ml-2">
                                                {consulResult.overall_verdict === "pass" ? "✓ Pass" : consulResult.overall_verdict === "needs_review" ? "⚠ Needs Review" : "✗ Fail"}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">Confidence: {Math.round(consulResult.overall_confidence * 100)}%</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn("h-2 w-2 rounded-full", consulResult.models_used.gemini.status === "success" ? "bg-green-500" : "bg-red-500")} />
                                                <span className="text-[11px] text-muted-foreground">Gemini</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn("h-2 w-2 rounded-full", consulResult.models_used.grok.status === "success" ? "bg-green-500" : "bg-red-500")} />
                                                <span className="text-[11px] text-muted-foreground">Grok</span>
                                            </div>
                                        </div>
                                    </div>

                                    {consulResult.summary && <p className="text-sm leading-relaxed">{consulResult.summary}</p>}

                                    <h4 className="text-sm font-medium">Claims Reviewed ({consulResult.claims.length})</h4>

                                    {consulResult.claims.map((claim, i) => {
                                        const agr = AGREEMENT_LABELS[claim.agreement] ?? AGREEMENT_LABELS.single_source;
                                        const isExpanded = expandedClaims.has(i);
                                        return (
                                            <div key={i} className="p-3 rounded-md border" style={{ borderColor: `${VERDICT_COLORS[claim.consensus_verdict]}33`, backgroundColor: `${VERDICT_COLORS[claim.consensus_verdict]}08` }}>
                                                {/* Verdict + Agreement row */}
                                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                    <Badge className="text-[11px] uppercase" style={{ color: VERDICT_COLORS[claim.consensus_verdict], backgroundColor: `${VERDICT_COLORS[claim.consensus_verdict]}18` }}>
                                                        {claim.consensus_verdict}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-[10px] gap-1" style={{ borderColor: agr.color, color: agr.color }}>
                                                        {agr.icon} {agr.label}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                                        {Math.round(claim.confidence * 100)}% confidence
                                                    </span>
                                                </div>

                                                <p className="text-sm font-medium">&ldquo;{claim.claim}&rdquo;</p>
                                                <p className="text-sm text-muted-foreground mt-1">{claim.explanation}</p>

                                                {/* Per-model verdicts (collapsed by default) */}
                                                {(claim.gemini_explanation || claim.grok_explanation) && claim.agreement !== "full" && (
                                                    <div className="mt-2">
                                                        <button onClick={() => toggleClaimExpanded(i)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                                                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                            {isExpanded ? "Hide" : "Show"} individual model reasoning
                                                        </button>
                                                        {isExpanded && (
                                                            <div className="mt-2 space-y-2">
                                                                {claim.gemini_explanation && (
                                                                    <div className="p-2 rounded border border-border bg-card">
                                                                        <div className="flex items-center gap-1.5 mb-1">
                                                                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                                                                            <span className="text-[11px] font-semibold">Gemini</span>
                                                                            {claim.gemini_verdict && (
                                                                                <Badge className="text-[9px] uppercase ml-1" style={{ color: VERDICT_COLORS[claim.gemini_verdict], backgroundColor: `${VERDICT_COLORS[claim.gemini_verdict]}18` }}>
                                                                                    {claim.gemini_verdict}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">{claim.gemini_explanation}</p>
                                                                    </div>
                                                                )}
                                                                {claim.grok_explanation && (
                                                                    <div className="p-2 rounded border border-border bg-card">
                                                                        <div className="flex items-center gap-1.5 mb-1">
                                                                            <span className="h-2 w-2 rounded-full bg-orange-500" />
                                                                            <span className="text-[11px] font-semibold">Grok</span>
                                                                            {claim.grok_verdict && (
                                                                                <Badge className="text-[9px] uppercase ml-1" style={{ color: VERDICT_COLORS[claim.grok_verdict], backgroundColor: `${VERDICT_COLORS[claim.grok_verdict]}18` }}>
                                                                                    {claim.grok_verdict}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-xs text-muted-foreground">{claim.grok_explanation}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Sources */}
                                                {claim.sources.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {claim.sources.map((src, si) => (
                                                            <a key={si} href={src.url} target="_blank" rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline px-1.5 py-0.5 rounded bg-primary/5 border border-primary/10">
                                                                <ExternalLink className="h-2.5 w-2.5" />
                                                                {src.title ? src.title.slice(0, 40) : new URL(src.url).hostname}
                                                                <span className="text-muted-foreground">({src.from})</span>
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Suggested rewrite + Apply button */}
                                                {claim.suggested_rewrite && (
                                                    <div className="mt-2 p-2 bg-card border border-dashed border-border rounded-md">
                                                        <p className="text-sm">✏️ <strong>Suggested rewrite:</strong> {claim.suggested_rewrite}</p>
                                                        <Button variant="outline" size="sm" className={cn("mt-2 gap-1.5 text-xs h-7", appliedRewrites.has(i) && "border-success text-success")}
                                                            disabled={applyingRewrite === i || appliedRewrites.has(i)}
                                                            onClick={() => onApplyRewrite(i)}>
                                                            {applyingRewrite === i ? <><RefreshCw className="h-3 w-3 animate-spin" /> Applying…</> : appliedRewrites.has(i) ? <><CheckCircle2 className="h-3 w-3" /> Applied</> : <><Wand2 className="h-3 w-3" /> Apply Rewrite</>}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        )}
                    </section>
                )}

                </>)}

                {/* ═══════════ CLUSTER MODE ═══════════ */}
                {mode === "cluster" && (
                    <section className="space-y-5">
                        {/* Cluster Topic */}
                        <div className="space-y-2">
                            <Label className="text-sm font-medium">Cluster Topic</Label>
                            <p className="text-xs text-muted-foreground">Describe the broad topic for your content cluster. AI will design a pillar page, supporting articles, and long-tail pages with keyword targets and interlinking.</p>
                            <Textarea
                                value={clusterTopic}
                                onChange={(e) => setClusterTopic(e.target.value)}
                                rows={3}
                                placeholder="e.g., dental implant options, costs, and recovery for patients in 2026..."
                                className="text-base"
                            />
                        </div>

                        {/* Cluster Controls */}
                        <div className="flex gap-3 items-center flex-wrap">
                            <div className="space-y-1">
                                <Label htmlFor="cluster-model" className="text-xs">Model</Label>
                                <select id="cluster-model" value={model} onChange={(e) => setModel(e.target.value)}
                                    className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    {availableModels.length > 0 ? availableModels.map((m) => <option key={m.id} value={m.id}>{m.label}{m.provider !== "openai" ? ` (${m.provider})` : ""}</option>)
                                        : <><option value="gpt-5.5">GPT-5.5</option><option value="gpt-5.4">GPT-5.4</option><option value="gpt-4.1-mini">GPT-4.1 Mini</option></>}
                                </select>
                            </div>
                        </div>

                        {/* Generate Button */}
                        <div className="flex gap-2.5 items-center">
                            <Button onClick={onCreateCluster} disabled={clusterGenerating || !companyId || clusterTopic.trim().length < 5} size="lg" className="gap-1.5">
                                {clusterGenerating ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating Strategy…</> : <><Network className="h-4 w-4" /> Generate Cluster Strategy</>}
                            </Button>
                        </div>

                        {/* Cluster Error */}
                        {clusterErr && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{clusterErr}</AlertDescription></Alert>}

                        {/* Cluster Result */}
                        {clusterResult && (
                            <Card className="border-primary/20 overflow-hidden">
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Network className="h-5 w-5 text-primary" />
                                            <h3 className="font-semibold text-lg">{clusterResult.strategy?.cluster_name || clusterResult.name || "Cluster Strategy"}</h3>
                                        </div>
                                        <Badge className="bg-green-500/10 text-green-600 border-green-500/30">✓ Strategy Created</Badge>
                                    </div>

                                    {/* Strategy Summary */}
                                    <div className="grid grid-cols-3 gap-3">
                                        {clusterResult.strategy?.pillar && (
                                            <div className="rounded-lg border border-border bg-muted/30 p-3">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <Badge variant="outline" className="text-[10px] h-5 border-primary/50 text-primary">P</Badge>
                                                    <span className="text-xs font-medium text-muted-foreground">Pillar</span>
                                                </div>
                                                <p className="text-sm font-medium leading-tight">{clusterResult.strategy.pillar.title}</p>
                                                <p className="text-xs text-muted-foreground mt-1">{clusterResult.strategy.pillar.keyword}</p>
                                            </div>
                                        )}
                                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Badge variant="outline" className="text-[10px] h-5 border-blue-500/50 text-blue-600">S</Badge>
                                                <span className="text-xs font-medium text-muted-foreground">Supporting</span>
                                            </div>
                                            <p className="text-2xl font-bold">{clusterResult.strategy?.supporting?.length ?? 0}</p>
                                            <p className="text-xs text-muted-foreground">articles planned</p>
                                        </div>
                                        <div className="rounded-lg border border-border bg-muted/30 p-3">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Badge variant="outline" className="text-[10px] h-5 border-amber-500/50 text-amber-600">L</Badge>
                                                <span className="text-xs font-medium text-muted-foreground">Long Tail</span>
                                            </div>
                                            <p className="text-2xl font-bold">{clusterResult.strategy?.long_tail?.length ?? 0}</p>
                                            <p className="text-xs text-muted-foreground">articles planned</p>
                                        </div>
                                    </div>

                                    {/* Page List */}
                                    <div className="space-y-1.5">
                                        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">All Planned Pages</h4>
                                        {clusterResult.strategy?.pillar && (
                                            <div className="flex items-center gap-2 p-2 rounded-md border border-border bg-card text-sm">
                                                <Badge variant="outline" className="text-[10px] shrink-0 border-primary/50 text-primary">Pillar</Badge>
                                                <span className="font-medium truncate">{clusterResult.strategy.pillar.title}</span>
                                                <span className="text-xs text-muted-foreground ml-auto shrink-0">/{clusterResult.strategy.pillar.slug}</span>
                                            </div>
                                        )}
                                        {(clusterResult.strategy?.supporting ?? []).map((p: any, i: number) => (
                                            <div key={`s-${i}`} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card text-sm">
                                                <Badge variant="outline" className="text-[10px] shrink-0 border-blue-500/50 text-blue-600">S</Badge>
                                                <span className="truncate">{p.title}</span>
                                                <span className="text-xs text-muted-foreground ml-auto shrink-0">/{p.slug}</span>
                                            </div>
                                        ))}
                                        {(clusterResult.strategy?.long_tail ?? []).map((p: any, i: number) => (
                                            <div key={`l-${i}`} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card text-sm">
                                                <Badge variant="outline" className="text-[10px] shrink-0 border-amber-500/50 text-amber-600">L</Badge>
                                                <span className="truncate">{p.title}</span>
                                                <span className="text-xs text-muted-foreground ml-auto shrink-0">/{p.slug}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Overlap Warnings */}
                                    {clusterResult.overlap_warnings && (
                                        <>
                                            {clusterResult.overlap_warnings.intra_cluster?.length > 0 && (
                                                <Alert className="border-amber-500/30 bg-amber-500/5">
                                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                    <AlertDescription>
                                                        <p className="font-semibold text-sm text-amber-600">{clusterResult.overlap_warnings.intra_cluster.length} intra-cluster overlap{clusterResult.overlap_warnings.intra_cluster.length !== 1 ? "s" : ""} detected</p>
                                                        <div className="mt-1 space-y-0.5">
                                                            {clusterResult.overlap_warnings.intra_cluster.slice(0, 5).map((w: any, i: number) => (
                                                                <p key={i} className="text-xs text-muted-foreground">"{w.slug_a}" ↔ "{w.slug_b}" ({Math.round(w.similarity * 100)}%)</p>
                                                            ))}
                                                        </div>
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                            {clusterResult.overlap_warnings.existing_content?.length > 0 && (
                                                <Alert className="border-amber-500/30 bg-amber-500/5">
                                                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                                                    <AlertDescription>
                                                        <p className="font-semibold text-sm text-amber-600">{clusterResult.overlap_warnings.existing_content.length} overlap{clusterResult.overlap_warnings.existing_content.length !== 1 ? "s" : ""} with existing articles</p>
                                                        <div className="mt-1 space-y-0.5">
                                                            {clusterResult.overlap_warnings.existing_content.slice(0, 5).map((w: any, i: number) => (
                                                                <p key={i} className="text-xs text-muted-foreground">"{w.planned_slug}" ↔ "{w.existing_title}" ({Math.round(w.similarity * 100)}%)</p>
                                                            ))}
                                                        </div>
                                                    </AlertDescription>
                                                </Alert>
                                            )}
                                        </>
                                    )}

                                    {/* CTA to manage in Articles */}
                                    <div className="flex gap-2 pt-2">
                                        <Button onClick={() => router.push(`/articles?cluster=${clusterResult.id}`)} className="gap-1.5">
                                            <ArrowRight className="h-4 w-4" /> Open in Content Architecture
                                        </Button>
                                        <Button variant="outline" onClick={() => { setClusterResult(null); setClusterTopic(""); }}>
                                            Create Another
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </section>
                )}

                {/* ====== Image Search (hidden) ====== */}
                {false && (
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
                                            <button onClick={() => startComposite(img)} className="text-primary font-medium flex items-center gap-1"><Layers className="h-3 w-3" /> Composite</button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* Composite Panel */}
                    {compositeProductImg && (
                        <Card ref={compositeRef} className="mt-4 overflow-hidden">
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <Layers className="h-4 w-4" /> Composite Image
                                    </h4>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCompositeProductImg(null); setCompositeResult(null); }}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Product preview */}
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1.5">Product Image</p>
                                        <div className="rounded-lg overflow-hidden border border-border bg-muted aspect-[4/3]">
                                            <img src={compositeProductImg?.thumbnailUrl || compositeProductImg?.imageUrl} alt={compositeProductImg?.title} className="w-full h-full object-contain" />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 truncate">{compositeProductImg?.title}</p>
                                    </div>

                                    {/* Result preview */}
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1.5">
                                            {compositeResult ? "Result" : "Background will be AI-generated"}
                                        </p>
                                        {compositeResult ? (
                                            <div className="rounded-lg overflow-hidden border border-primary/30 bg-muted aspect-[4/3]">
                                                <img src={`data:image/png;base64,${compositeResult}`} alt="Composite result" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="rounded-lg border border-dashed border-border bg-muted/50 aspect-[4/3] flex items-center justify-center">
                                                <span className="text-xs text-muted-foreground">Preview will appear here</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Background prompt + actions */}
                                <div className="flex gap-2 items-stretch flex-wrap">
                                    <Input
                                        placeholder="Optional: describe the background (e.g. 'modern kitchen countertop')…"
                                        value={compositeBgPrompt}
                                        onChange={(e) => setCompositeBgPrompt(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter" && !compositeGenerating) onCompositeGenerate(); }}
                                        className="flex-1 min-w-[200px]"
                                    />
                                    <Button
                                        onClick={onCompositeGenerate}
                                        disabled={compositeGenerating}
                                        className="gap-1.5 whitespace-nowrap"
                                    >
                                        {compositeGenerating
                                            ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating…</>
                                            : <><Layers className="h-4 w-4" /> {compositeResult ? "Regenerate" : "Generate Composite"}</>}
                                    </Button>
                                    {compositeResult && (
                                        <Button variant="outline" onClick={useCompositeResult} className="gap-1.5 whitespace-nowrap">
                                            <CheckCircle2 className="h-4 w-4" /> Use in Article
                                        </Button>
                                    )}
                                </div>
                                {compositeErr && <p className="text-sm text-destructive">{compositeErr}</p>}
                            </CardContent>
                        </Card>
                    )}
                </section>
                )}

                {/* ====== YouTube Search (hidden) ====== */}
                {false && (
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
                )}

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
