import { useState, useEffect, useRef } from "react";

import { useTaskRunner } from "@/hooks/useTaskRunner";
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
    FileText, Network, ArrowRight, Settings, Check,
} from "lucide-react";
import type { ConsulResult, ConsulClaimReview } from "@/lib/consulPrompts";
import { cn } from "@/lib/utils";
import { useModelDefaults } from "@/hooks/useModelDefaults";
import ModelBakeoff from "@/components/ui/ModelBakeoff";
import ContentWizard from "@/components/layout/ContentWizard";

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

/** Return a company-contextual placeholder for the cluster topic input */
function getClusterPlaceholder(companyName?: string): string {
    if (!companyName) return "e.g., product benefits, comparisons, and buying guides for your audience in 2026...";
    const lower = companyName.toLowerCase();
    if (lower.includes("dental") || lower.includes("abramson") || lower.includes("amato"))
        return `e.g., dental implant options, costs, and recovery for patients in 2026...`;
    if (lower.includes("trovatrip") || lower.includes("travel") || lower.includes("trip"))
        return `e.g., group travel planning tips, retreat destinations, and trip leader strategies for 2026...`;
    if (lower.includes("certivo") || lower.includes("compliance") || lower.includes("cert"))
        return `e.g., compliance certification workflows, audit readiness, and regulatory frameworks for 2026...`;
    if (lower.includes("civenne"))
        return `e.g., luxury fashion trends, sustainable style, and seasonal collection guides for 2026...`;
    if (lower.includes("gumshoe") || lower.includes("legal") || lower.includes("law") || lower.includes("greencard"))
        return `e.g., immigration visa options, green card timelines, and legal process guides for 2026...`;
    if (lower.includes("health") || lower.includes("wellness"))
        return `e.g., holistic wellness routines, nutrition strategies, and preventive health guides for 2026...`;
    if (lower.includes("patchbay") || lower.includes("tech") || lower.includes("software"))
        return `e.g., API integration patterns, developer workflow tools, and platform architecture guides for 2026...`;
    if (lower.includes("pioneer") || lower.includes("labs") || lower.includes("startup") || lower.includes("venture"))
        return `e.g., startup fundraising strategies, product-market fit frameworks, and venture studio insights for 2026...`;
    if (lower.includes("potato"))
        return `e.g., creative branding strategies, product storytelling, and audience engagement guides for 2026...`;
    if (lower.includes("boundless"))
        return `e.g., global hiring compliance, remote workforce management, and international expansion strategies for 2026...`;
    return `e.g., key topics, strategies, and guides relevant to ${companyName} for 2026...`;
}

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

    const [prompt, setPrompt] = useState("");
    const [suggestedPrompt, setSuggestedPrompt] = useState("");
    const [companyErr, setCompanyErr] = useState(false);
    const [imageStyle, setImageStyle] = useState("default");
    const [model, setModel] = useState("");
    const [availableModels, setAvailableModels] = useState<{ id: string; label: string; provider: string }[]>([]);
    const [wordCount, setWordCount] = useState("1800-2400");
    const [companyId, setCompanyId] = useState<string>("");
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
    const [companiesLoaded, setCompaniesLoaded] = useState(false);
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
    const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);

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
        }).catch(() => {}).finally(() => setCompaniesLoaded(true));
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
            // Auto-select the company's preferred model (saved from bake-off)
            if (data?.preferred_model && typeof data.preferred_model === "string" && availableModels.some(m => m.id === data.preferred_model)) {
                setModel(data.preferred_model);
            }
            // Build a smart suggested prompt from company context
            const name = data?.name || "";
            const tagline = data?.tagline || "";
            const mission = data?.mission || "";
            const audiences = Array.isArray(data?.target_audiences) ? data.target_audiences.filter(Boolean) : [];
            const audience = audiences[0] || "";
            if (tagline || mission) {
                const context = tagline || mission;
                const forAudience = audience ? ` for ${audience}` : "";
                setSuggestedPrompt(
                    `Write an in-depth article about ${context.toLowerCase().replace(/\.$/, '')}${forAudience}. Include practical tips, current trends, and actionable takeaways.`
                );
            } else if (name) {
                setSuggestedPrompt(
                    `Write a comprehensive guide about what ${name} does and why it matters${audience ? ` for ${audience}` : ''}. Cover key benefits, common challenges, and expert recommendations.`
                );
            }
        }).catch(() => { setActiveStyles(IMAGE_STYLE_CATEGORIES); setImageStyle("default"); });
    }, [companyId]);

    useEffect(() => {
        setCompanyPrompts([]); setActiveTemplateId(null);
        if (!companyId) return;
        fetch(`/api/prompts?company_id=${companyId}`).then((r) => r.json()).then((data) => { if (Array.isArray(data)) setCompanyPrompts(data); }).catch(() => {});
    }, [companyId]);

    const { runTask } = useTaskRunner();

    async function onCreate() {
        setLoading(true); setErr(null); setResult(null); setFactCheck(null); setFactCheckErr(null);
        setConsulResult(null); setConsulErr(null); setExpandedClaims(new Set()); setAppliedRewrites(new Set());
        setGallery([]); setSelectedImgId(null); setCustomImagePrompt(""); setRefreshErr(null); setHumanized(false); setHumanizeErr(null);
        // Build the creation prompt — prepend voice prompt if one is active
        let finalPrompt = prompt;
        if (activeVoiceId) {
            const voiceBody = companyPrompts.find((p) => p.id === activeVoiceId)?.body;
            if (voiceBody) {
                finalPrompt = `${voiceBody}\n\n---\n\n${prompt}`;
            }
        }
        const payload: Record<string, unknown> = {
            creation_prompt: finalPrompt,
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
        // Navigate immediately — activity panel tracks progress
        setLoading(false);
        router.push(`/articles`);

        runTask({
            type: "article",
            label: prompt.trim().slice(0, 60) || "New article",
            endpoint: "/api/create",
            body: payload,
            meta: { companyId },
            onSuccess: (data: any) => {
                window.dispatchEvent(new Event("article-created"));
            },
            onError: () => { /* handled by task panel */ },
        });
    }

    async function onCreateCluster() {
        if (!companyId || !clusterTopic.trim()) return;
        const topic = clusterTopic.trim();
        // Navigate immediately — activity panel tracks progress
        setClusterGenerating(false);
        router.push(`/articles`);

        runTask({
            type: "cluster-strategy",
            label: `Strategy: ${topic.slice(0, 50)}`,
            endpoint: "/api/clusters",
            body: { company_id: companyId, topic, model },
            meta: { companyId },
            onSuccess: (data: any) => {
                if (data?.id) {
                    window.dispatchEvent(new CustomEvent("cluster-created", { detail: { id: data.id } }));
                }
            },
            onError: () => { /* handled by task panel */ },
        });
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
        await runTask({
            type: "fact-check",
            label: `Fact-check: ${(result.title || "").slice(0, 40)}`,
            endpoint: "/api/fact-check",
            body: { title: result.title, excerpt: result.excerpt, html: result.html },
            onSuccess: (data: any) => { setFactCheck(data); setFactChecking(false); },
            onError: (errMsg) => { setFactCheckErr(errMsg); setFactChecking(false); },
        });
    }

    async function onConsulCheck() {
        if (!result) return;
        setConsulChecking(true); setConsulErr(null); setConsulResult(null); setExpandedClaims(new Set()); setAppliedRewrites(new Set());
        await runTask({
            type: "consul-check",
            label: `Deep check: ${(result.title || "").slice(0, 40)}`,
            endpoint: "/api/fact-check-consul",
            body: { title: result.title, excerpt: result.excerpt, html: result.html },
            onSuccess: (data: any) => { setConsulResult(data); setConsulChecking(false); },
            onError: (errMsg) => { setConsulErr(errMsg); setConsulChecking(false); },
        });
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
        await runTask({
            type: "humanize",
            label: `Humanize: ${(result.title || "").slice(0, 40)}`,
            endpoint: "/api/humanize",
            body: { title: result.title, excerpt: result.excerpt, html: result.html },
            onSuccess: (data: any) => {
                setResult((prev: any) => ({ ...prev, title: data.title ?? prev.title, excerpt: data.excerpt ?? prev.excerpt, html: data.html ?? prev.html }));
                setHumanized(true);
                setHumanizing(false);
            },
            onError: (errMsg) => { setHumanizeErr(errMsg); setHumanizing(false); },
        });
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
            <div className="space-y-5">
                {/* ── Creation Wizard ─────────────────────────────── */}
                <ContentWizard
                    companies={companies}
                    companiesLoaded={companiesLoaded}
                    companyId={companyId}
                    setCompanyId={(id) => { setCompanyId(id); setCompanyErr(false); }}
                    isScopedMember={isScopedMember}
                    mode={mode}
                    setMode={(m) => { setMode(m); if (m === "cluster") { setResult(null); setErr(null); } else { setClusterResult(null); setClusterErr(null); } }}
                    prompt={prompt}
                    setPrompt={(p) => { setPrompt(p); setActiveTemplateId(null); }}
                    suggestedPrompt={suggestedPrompt}
                    companyPrompts={companyPrompts}
                    activeTemplateId={activeTemplateId}
                    setActiveTemplateId={setActiveTemplateId}
                    activeVoiceId={activeVoiceId}
                    setActiveVoiceId={setActiveVoiceId}
                    clusterTopic={clusterTopic}
                    setClusterTopic={setClusterTopic}
                    getClusterPlaceholder={getClusterPlaceholder}
                    imageStyle={imageStyle}
                    setImageStyle={setImageStyle}
                    activeStyles={activeStyles}
                    model={model}
                    setModel={setModel}
                    availableModels={availableModels}
                    wordCount={wordCount}
                    setWordCount={setWordCount}
                    isCompositeStyle={isCompositeStyle}
                    selectedStyleObj={selectedStyleObj}
                    csProductQuery={csProductQuery}
                    setCsProductQuery={setCsProductQuery}
                    csProductResults={csProductResults}
                    csProductSearching={csProductSearching}
                    csProductSearch={csProductSearch}
                    csProductUrl={csProductUrl}
                    setCsProductUrl={setCsProductUrl}
                    csProductThumb={csProductThumb}
                    setCsProductThumb={setCsProductThumb}
                    csBgPrompt={csBgPrompt}
                    setCsBgPrompt={setCsBgPrompt}
                    csBgImageUrl={csBgImageUrl}
                    setCsBgImageUrl={setCsBgImageUrl}
                    recommending={recommending}
                    recommendation={recommendation}
                    onRecommendStyle={async () => {
                        setRecommending(true); setRecommendation(null); setRecommendErr(null);
                        try {
                            const r = await fetch("/api/recommend-style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt.trim(), styles: activeStyles }) });
                            const data = await r.json(); if (!r.ok) throw new Error(data.error || "Recommendation failed");
                            setRecommendation(data); setImageStyle(data.id);
                        } catch (e: any) { setRecommendErr(e.message); } finally { setRecommending(false); }
                    }}
                    loading={loading}
                    clusterGenerating={clusterGenerating}
                    onCreate={() => { if (!companyId) { setCompanyErr(true); return; } onCreate(); }}
                    onCreateCluster={onCreateCluster}
                    onPreviewPrompt={onPreviewPrompt}
                    previewing={previewing}
                    onBakeoffModelSelected={(mid) => { if (availableModels.some(m => m.id === mid)) setModel(mid); }}
                />

                {/* Errors */}
                {err && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{err}</AlertDescription></Alert>}
                {clusterErr && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{clusterErr}</AlertDescription></Alert>}

                {/* ====== Cluster Result ====== */}
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
                            {clusterResult.overlap_warnings && (<>
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
                            </>)}
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
                        <Input placeholder={companyId ? `e.g. popular topics about ${companies.find(c => c.id === companyId)?.name || "your brand"}` : "e.g. best tips and strategies for your audience"} value={ytQuery} onChange={(e) => setYtQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onSearchYouTube(); }} />
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
