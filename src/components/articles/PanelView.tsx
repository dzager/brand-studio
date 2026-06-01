// PanelView.tsx — Article detail pane for improving content
// Shows similarity analysis, SEO data, article content, and all action buttons

import { useState, useRef, useEffect } from "react";
import ArticleEditor, { type ArticleEditorHandle } from "@/components/articles/ArticleEditor";

import { useTaskRunner } from "@/hooks/useTaskRunner";
import { useTaskStore } from "@/lib/taskStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
    Copy, Rocket, Pencil, RefreshCw, ImageIcon, Trash2,
    Search, Sparkles, Upload, AlertCircle, CheckCircle2,
    Crown, BookOpen, Scroll, Layers, ArrowLeft,
    ChevronDown, FileText, ClipboardCopy, Scissors, Crop,
    Scale, ExternalLink, ShieldCheck, Wand2, ChevronRight,
    X, Maximize2, Video, Play, ArrowLeftRight, ListChecks,
    Star, Award, TrendingUp, Target, Shield, Brain, Lightbulb, AlertTriangle,
} from "lucide-react";
import type { ConsulResult, ConsulClaimReview } from "@/lib/consulPrompts";
import type { CompareResult } from "@/pages/api/compare-article";
import type { QualityRatingResult } from "@/pages/api/rate-quality";
import { cn } from "@/lib/utils";

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

type Article = {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    html: string | null;
    image_base64: string | null;
    image_prompt: string | null;
    seo: Record<string, unknown> | null;
    outline: string[] | null;
    model_used: string | null;
    image_style: string | null;
    company_id: string | null;
    cluster_id: string | null;
    cluster_role: string | null;
    humanized: boolean;
    featured_video_url: string | null;
    featured_video_platform: string | null;
    created_at: string;
    updated_at: string;
};

type SimilarityResult = {
    id: string;
    title: string;
    slug: string;
    similarity: number;
    cluster_id: string | null;
};

type Props = {
    article: Article;
    companies: Record<string, string>;
    onUpdate: (updated: Article) => void;
    onDelete: (id: string) => void;
    onSelectArticle: (id: string) => void;
};

export default function PanelView({ article, companies, onUpdate, onDelete, onSelectArticle }: Props) {
    const { runTask } = useTaskRunner();
    const { tasks } = useTaskStore();

    // Derive image-generating state from the global task store so it persists across article navigation
    const hasRunningImageTask = tasks.some(
        (t) => t.meta?.articleId === article.id && t.type === "image-regen" && (t.status === "running" || t.status === "queued")
    );
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editExcerpt, setEditExcerpt] = useState("");
    const [editHtml, setEditHtml] = useState("");
    const [saving, setSaving] = useState(false);
    const editorRef = useRef<ArticleEditorHandle>(null);

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);

    // ── Auto-refresh for generating articles ────────────────────────
    const isGenerating = article.excerpt === "Generating article…" || article.excerpt === "Generation failed — please regenerate.";
    useEffect(() => {
        if (!isGenerating) return;
        const interval = setInterval(async () => {
            try {
                const r = await fetch(`/api/articles/${article.id}`);
                if (!r.ok) return;
                const updated = await r.json();
                // Check if real content has arrived
                if (updated.excerpt && updated.excerpt !== "Generating article…") {
                    onUpdate(updated);
                    setFullArticle(updated);
                }
            } catch { /* silent */ }
        }, 5000);
        return () => clearInterval(interval);
    }, [article.id, isGenerating, onUpdate]);

    // ── Auto-refresh for missing image after content arrives ─────────
    // Image generation runs in parallel with humanization, so the image
    // may arrive shortly after the text content. Poll until it appears.
    const hasContent = article.excerpt && article.excerpt !== "Generating article…" && article.excerpt !== "Generation failed — please regenerate.";
    const missingImage = !article.image_base64 && !article.featured_video_url;
    const needsImagePoll = hasContent && missingImage && (article as any).status !== "failed";
    const imagePollStartRef = useRef<number | null>(null);
    useEffect(() => {
        if (!needsImagePoll) {
            imagePollStartRef.current = null;
            return;
        }
        if (!imagePollStartRef.current) imagePollStartRef.current = Date.now();
        // Stop polling after 150 seconds (image generation takes ~106s)
        const elapsed = Date.now() - imagePollStartRef.current;
        if (elapsed > 150_000) return;

        const interval = setInterval(async () => {
            // Stop if we've been polling too long
            if (imagePollStartRef.current && Date.now() - imagePollStartRef.current > 150_000) {
                clearInterval(interval);
                return;
            }
            try {
                const r = await fetch(`/api/articles/${article.id}`);
                if (!r.ok) return;
                const updated = await r.json();
                if (updated.image_base64 || updated.featured_video_url) {
                    setFullArticle(updated);
                    onUpdate({ ...article, ...updated });
                    clearInterval(interval);
                }
            } catch { /* silent */ }
        }, 6000);
        return () => clearInterval(interval);
    }, [article.id, needsImagePoll]); // eslint-disable-line react-hooks/exhaustive-deps
    const [copied, setCopied] = useState<false | "rich" | "plain">(false);
    const [regenerating, setRegenerating] = useState(false);
    const [regenErr, setRegenErr] = useState<string | null>(null);

    const [shortening, setShortening] = useState(false);
    const [shortened, setShortened] = useState(false);
    const [shortenErr, setShortenErr] = useState<string | null>(null);
    const [shortenInfo, setShortenInfo] = useState<{ original: number; shortened: number } | null>(null);

    // Consul fact-check
    const [consulChecking, setConsulChecking] = useState(false);
    const [consulResult, setConsulResult] = useState<ConsulResult | null>(null);
    const [consulErr, setConsulErr] = useState<string | null>(null);
    const [expandedClaims, setExpandedClaims] = useState<Set<number>>(new Set());
    const [applyingRewrite, setApplyingRewrite] = useState<number | null>(null);
    const [appliedRewrites, setAppliedRewrites] = useState<Set<number>>(new Set());
    const [rewriteQueue, setRewriteQueue] = useState<Set<number>>(new Set());
    const [applyingBatch, setApplyingBatch] = useState(false);
    const [consulCollapsed, setConsulCollapsed] = useState(true);

    // refreshingImage is now derived from the global task store (see hasRunningImageTask above)
    // Local state kept only for backward-compat with inline error handling
    const refreshingImage = hasRunningImageTask;
    const [imagePromptInput, setImagePromptInput] = useState("");
    const [imageStyles, setImageStyles] = useState<{ id: string; label: string; narrative?: string; type?: string; composite_bg_prompt?: string; composite_product_query?: string; composite_bg_image_url?: string }[]>([]);
    const [selectedStyle, setSelectedStyle] = useState(article.image_style ?? "default");
    const [refreshErr, setRefreshErr] = useState<string | null>(null);

    // Composite style state for PanelView image refresh
    const [pvCsProductUrl, setPvCsProductUrl] = useState<string | null>(null);
    const [pvCsProductThumb, setPvCsProductThumb] = useState<string | null>(null);
    const [pvCsBgPrompt, setPvCsBgPrompt] = useState("");
    const [pvCsBgImageUrl, setPvCsBgImageUrl] = useState("");
    const [pvCsProductQuery, setPvCsProductQuery] = useState("");
    const [pvCsProductResults, setPvCsProductResults] = useState<SearchImage[]>([]);
    const [pvCsProductSearching, setPvCsProductSearching] = useState(false);

    const [similarResults, setSimilarResults] = useState<SimilarityResult[] | null>(null);
    const [checkingSimilarity, setCheckingSimilarity] = useState(false);
    const [simErr, setSimErr] = useState<string | null>(null);

    const [showInsertModal, setShowInsertModal] = useState(false);
    const [insertMode, setInsertMode] = useState<"inline" | "featured" | "editInline">("inline");
    const [insertTab, setInsertTab] = useState<"search" | "generate" | "composite" | "upload" | "video">("search");
    const [insertSearchQuery, setInsertSearchQuery] = useState("");
    const [insertSearchResults, setInsertSearchResults] = useState<SearchImage[]>([]);
    const [insertSearching, setInsertSearching] = useState(false);
    const [insertGenPrompt, setInsertGenPrompt] = useState("");
    const [insertGenerating, setInsertGenerating] = useState(false);
    const [insertPreview, setInsertPreview] = useState<{ src: string; type: "url" | "base64" } | null>(null);
    const [insertPosition, setInsertPosition] = useState<"top" | "bottom">("bottom");
    const [insertErr, setInsertErr] = useState<string | null>(null);
    const [insertSaving, setInsertSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 16:9 crop state
    const [cropActive, setCropActive] = useState(false);
    const [cropDragY, setCropDragY] = useState(0);      // top of crop region in image-space pixels
    const [cropImgLoaded, setCropImgLoaded] = useState(false);  // triggers re-render for overlay
    const cropCanvasRef = useRef<HTMLCanvasElement>(null);
    const cropImgRef = useRef<HTMLImageElement | null>(null);
    const cropContainerRef = useRef<HTMLDivElement>(null);

    // Composite tab state — two-slot workflow: product + background
    const [compositeStep, setCompositeStep] = useState<"product" | "background" | "generating" | "preview">("product");
    // Product slot
    const [compositeProductUrl, setCompositeProductUrl] = useState<string | null>(null);
    const [compositeProductThumb, setCompositeProductThumb] = useState<string | null>(null);
    const [compositeProductBase64, setCompositeProductBase64] = useState<string | null>(null);
    const [compositeSearchQuery, setCompositeSearchQuery] = useState("");
    const [compositeSearchResults, setCompositeSearchResults] = useState<SearchImage[]>([]);
    const [compositeSearching, setCompositeSearching] = useState(false);
    // Background slot
    const [compositeBgSource, setCompositeBgSource] = useState<"generate" | "search" | "upload">("generate");
    const [compositeBgPrompt, setCompositeBgPrompt] = useState("");
    const [compositeBgUrl, setCompositeBgUrl] = useState<string | null>(null);
    const [compositeBgThumb, setCompositeBgThumb] = useState<string | null>(null);
    const [compositeBgBase64, setCompositeBgBase64] = useState<string | null>(null);
    const [compositeBgSearchQuery, setCompositeBgSearchQuery] = useState("");
    const [compositeBgSearchResults, setCompositeBgSearchResults] = useState<SearchImage[]>([]);
    const [compositeBgSearching, setCompositeBgSearching] = useState(false);
    // Shared composite state
    const [compositeGenerating, setCompositeGenerating] = useState(false);
    const [compositeResult, setCompositeResult] = useState<string | null>(null);
    const [compositeErr, setCompositeErr] = useState<string | null>(null);
    const compositeProductFileRef = useRef<HTMLInputElement>(null);
    const compositeBgFileRef = useRef<HTMLInputElement>(null);
    // savedRangeRef removed — Tiptap manages cursor/selection state internally

    // Video search & embed state
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [ytQuery, setYtQuery] = useState("");
    const [ytResults, setYtResults] = useState<SearchVideo[]>([]);
    const [ytSearching, setYtSearching] = useState(false);
    const [ytErr, setYtErr] = useState<string | null>(null);
    const [pasteVideoUrl, setPasteVideoUrl] = useState("");
    const [pasteVideoErr, setPasteVideoErr] = useState<string | null>(null);

    // Compare article state
    const [showCompareModal, setShowCompareModal] = useState(false);
    const [compareUrl, setCompareUrl] = useState("");
    const [comparing, setComparing] = useState(false);
    const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
    const [compareErr, setCompareErr] = useState<string | null>(null);
    const [compareCollapsed, setCompareCollapsed] = useState(true);

    // Quality rating
    const [ratingLoading, setRatingLoading] = useState(false);
    const [ratingResult, setRatingResult] = useState<QualityRatingResult | null>(null);
    const [ratingErr, setRatingErr] = useState<string | null>(null);
    const [ratingCollapsed, setRatingCollapsed] = useState(true);

    // Improve from weakness
    const [improvingWeakness, setImprovingWeakness] = useState<number | null>(null);
    const [improvedWeaknesses, setImprovedWeaknesses] = useState<Set<number>>(new Set());
    const [savingRule, setSavingRule] = useState<number | null>(null);
    const [savedRules, setSavedRules] = useState<Set<number>>(new Set());



    const [fullArticle, setFullArticle] = useState<Article | null>(null);
    const [loadingFull, setLoadingFull] = useState(false);

    useEffect(() => {
        // Always re-fetch from DB on article switch to pick up images generated while viewing other articles
        setLoadingFull(true);
        fetch(`/api/articles/${article.id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data && !data.error) {
                    setFullArticle(data);
                    onUpdate({ ...article, ...data });
                }
            })
            .catch(() => {
                // Fallback: use prop data if fetch fails
                if (article.html !== null && article.html !== undefined) {
                    setFullArticle(article);
                }
            })
            .finally(() => setLoadingFull(false));
    }, [article.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-refresh when an image task for this article completes in the background
    const prevHasRunningImageTaskRef = useRef(hasRunningImageTask);
    useEffect(() => {
        // Detect transition from running→not running (task just completed)
        if (prevHasRunningImageTaskRef.current && !hasRunningImageTask) {
            // Re-fetch article data to pick up the newly generated image
            fetch(`/api/articles/${article.id}`)
                .then((r) => r.json())
                .then((data) => {
                    if (data && !data.error) {
                        setFullArticle(data);
                        onUpdate({ ...article, ...data });
                    }
                })
                .catch(() => {});
        }
        prevHasRunningImageTaskRef.current = hasRunningImageTask;
    }, [hasRunningImageTask]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync fullArticle when the parent article prop updates (e.g. after image regeneration or edits)
    useEffect(() => {
        if (fullArticle && (
            article.image_base64 !== fullArticle.image_base64 ||
            article.html !== fullArticle.html ||
            article.updated_at !== fullArticle.updated_at
        )) {
            setFullArticle({ ...fullArticle, ...article });
        }
    }, [article.image_base64, article.html, article.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!article.company_id) { setImageStyles([]); return; }
        fetch(`/api/companies/${article.company_id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data?.image_style_categories && Array.isArray(data.image_style_categories) && data.image_style_categories.length > 0) {
                    setImageStyles(data.image_style_categories);
                } else { setImageStyles([]); }
            })
            .catch(() => setImageStyles([]));
    }, [article.company_id]);

    const displayArticle = fullArticle || article;

    function startEdit() {
        setEditing(true);
        setEditTitle(article.title);
        setEditExcerpt(article.excerpt ?? "");
        setEditHtml(displayArticle.html ?? "");
    }

    async function saveEdit() {
        setSaving(true);
        try {
            const htmlToSave = editorRef.current?.getHTML() ?? editHtml;
            const r = await fetch(`/api/articles/${article.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: editTitle, excerpt: editExcerpt, html: htmlToSave }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to update");
            onUpdate({ ...article, ...data });
            setEditing(false);
        } catch (e: any) { alert(`Save failed: ${e.message}`); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            const r = await fetch(`/api/articles/${article.id}`, { method: "DELETE" });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to delete");
            onDelete(article.id);
        } catch (e: any) { alert(`Delete failed: ${e.message}`); }
        finally { setDeleting(false); setConfirmDelete(false); }
    }

    async function handlePublish() {
        setPublishing(true);
        try {
            const da = displayArticle;
            const r = await fetch("/api/publish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: article.title, slug: article.slug,
                    excerpt: article.excerpt || article.title.substring(0, 160),
                    content_html: da.html || "",
                    featured_image_url: da.image_base64 ? `data:image/png;base64,${da.image_base64}` : undefined,
                    tags: [], published: true, seo_data: article.seo || undefined,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Publish failed");
            setPublished(true);
            setTimeout(() => setPublished(false), 3000);
        } catch (e: any) { alert(`Publish failed: ${e.message}`); }
        finally { setPublishing(false); }
    }

    async function handleCopyRich() {
        // Build Word/CMS-compatible HTML with embedded images
        const featuredImg = displayArticle.image_base64
            ? `<p style="text-align:center;margin-bottom:24px"><img src="data:image/png;base64,${displayArticle.image_base64}" alt="${article.title.replace(/"/g, '&quot;')}" style="max-width:100%;height:auto;border-radius:8px" width="680" /></p>`
            : "";

        const bodyHtml = displayArticle.html ?? "";

        // Wrap in a minimal styled container for Word compatibility
        const richHtml = [
            `<div style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;color:#2c2c2c;line-height:1.6">`,
            `<h1 style="font-size:28px;font-weight:700;margin-bottom:8px;line-height:1.25">${article.title}</h1>`,
            article.excerpt ? `<p style="font-size:16px;color:#555;font-style:italic;margin-bottom:20px">${article.excerpt}</p>` : "",
            featuredImg,
            bodyHtml,
            `</div>`,
        ].filter(Boolean).join("\n");

        const plain = article.title
            + (article.excerpt ? `\n\n${article.excerpt}` : "")
            + "\n\n"
            + bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

        try {
            await navigator.clipboard.write([new ClipboardItem({
                "text/html": new Blob([richHtml], { type: "text/html" }),
                "text/plain": new Blob([plain], { type: "text/plain" }),
            })]);
        } catch {
            await navigator.clipboard.writeText(plain);
        }
        setCopied("rich");
        setTimeout(() => setCopied(false), 2500);
    }

    async function handleCopyPlain() {
        const bodyHtml = displayArticle.html ?? "";
        const plain = article.title
            + (article.excerpt ? `\n\n${article.excerpt}` : "")
            + "\n\n"
            + bodyHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        try {
            await navigator.clipboard.writeText(plain);
        } catch { /* noop */ }
        setCopied("plain");
        setTimeout(() => setCopied(false), 2500);
    }

    async function handleRegenerate() {
        setRegenerating(true); setRegenErr(null);
        try {
            // Step 1: Create a new article via the background pipeline
            const createResp = await fetch("/api/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    creation_prompt: article.title,
                    image_style: article.image_style ?? "default",
                    company_id: article.company_id ?? undefined,
                }),
            });
            const createData = await createResp.json();
            if (!createResp.ok) throw new Error(createData.error || "Failed to start regeneration");
            const tempArticleId = createData.id;
            if (!tempArticleId) throw new Error("No article ID returned");

            // Step 2: Poll until content + image are ready
            // Blog content arrives first (~60-120s), then image arrives after
            // (~106s from when it starts, which is when blog finishes).
            // We wait up to 150s after content for the image.
            const maxWait = 300_000;
            const imageExtraWait = 150_000;
            const pollInterval = 5_000;
            const startTime = Date.now();
            let tempArticle: any = null;
            let contentReadyTime: number | null = null;

            while (Date.now() - startTime < maxWait) {
                await new Promise((r) => setTimeout(r, pollInterval));
                try {
                    const r = await fetch(`/api/articles/${tempArticleId}`);
                    if (!r.ok) continue;
                    const data = await r.json();

                    const hasContent = data.html && data.excerpt
                        && data.excerpt !== "Generating article…"
                        && data.excerpt !== "Generation failed — please regenerate.";

                    if (!hasContent) continue;

                    // Content is ready — track when we first saw it
                    if (!contentReadyTime) contentReadyTime = Date.now();

                    // If image is ready, we're done
                    if (data.image_base64) {
                        tempArticle = data;
                        break;
                    }

                    // If image generation failed (error saved to DB), stop waiting
                    if (data.image_prompt && typeof data.image_prompt === "string" && data.image_prompt.startsWith("IMAGE_ERROR:")) {
                        console.warn("Image generation failed:", data.image_prompt);
                        tempArticle = data;
                        break;
                    }

                    // Wait up to imageExtraWait for the image to appear
                    if (Date.now() - contentReadyTime > imageExtraWait) {
                        tempArticle = data;
                        break;
                    }
                } catch { /* keep polling */ }
            }

            if (!tempArticle) throw new Error("Regeneration timed out — the new article is still generating. Check the activity log.");

            // Step 3: Copy the new content to the current article
            const saveResp = await fetch(`/api/articles/${article.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: tempArticle.title,
                    html: tempArticle.html,
                    excerpt: tempArticle.excerpt,
                    ...(tempArticle.image_base64 ? { image_base64: tempArticle.image_base64 } : {}),
                }),
            });
            const saveData = await saveResp.json();
            if (!saveResp.ok) throw new Error(saveData.error || "Failed to save regenerated content");
            onUpdate({ ...article, ...saveData });
            setFullArticle({ ...article, ...saveData });

            // Step 4: Delete the temporary article (best-effort)
            try { await fetch(`/api/articles/${tempArticleId}`, { method: "DELETE" }); } catch { /* best-effort */ }
        } catch (e: any) { setRegenErr(e.message); }
        finally { setRegenerating(false); }
    }

    async function handleShorten(targetWords: number) {
        if (!displayArticle.html) return;
        setShortening(true); setShortenErr(null); setShortened(false); setShortenInfo(null);
        await runTask({
            type: "shorten",
            label: `${article.title.slice(0, 40)} → ~${targetWords.toLocaleString()} words`,
            endpoint: "/api/shorten",
            body: {
                html: displayArticle.html,
                title: article.title,
                excerpt: article.excerpt || undefined,
                company_id: article.company_id ?? undefined,
                target_words: targetWords,
            },
            meta: { articleId: article.id, companyId: article.company_id },
            onSuccess: async (data: any) => {
                try {
                    // If already under limit, show info but don't save
                    if (data.word_count === data.original_word_count) {
                        setShortenInfo({ original: data.original_word_count, shortened: data.word_count });
                        setShortened(true);
                        setTimeout(() => setShortened(false), 4000);
                        return;
                    }

                    // Save shortened content
                    const saveResp = await fetch(`/api/articles/${article.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            html: data.html,
                            ...(data.excerpt ? { excerpt: data.excerpt } : {}),
                        }),
                    });
                    const saveData = await saveResp.json();
                    if (!saveResp.ok) throw new Error(saveData.error || "Failed to save");
                    onUpdate({ ...article, ...saveData });
                    setShortenInfo({ original: data.original_word_count, shortened: data.word_count });
                    setShortened(true);
                    setTimeout(() => { setShortened(false); setShortenInfo(null); }, 5000);
                } catch (e: any) { setShortenErr(e.message); }
                finally { setShortening(false); }
            },
            onError: (errMsg) => { setShortenErr(errMsg); setShortening(false); },
        });
    }

    async function handleConsulCheck() {
        if (!displayArticle.html) return;
        setConsulChecking(true); setConsulErr(null); setConsulResult(null); setExpandedClaims(new Set()); setAppliedRewrites(new Set()); setRewriteQueue(new Set()); setApplyingBatch(false);
        await runTask({
            type: "consul-check",
            label: `Deep check: ${article.title.slice(0, 40)}`,
            endpoint: "/api/fact-check-consul",
            body: { title: article.title, excerpt: article.excerpt, html: displayArticle.html },
            meta: { articleId: article.id },
            onSuccess: (data: any) => { setConsulResult(data); setConsulChecking(false); },
            onError: (errMsg) => { setConsulErr(errMsg); setConsulChecking(false); },
        });
    }

    async function handleCompare() {
        if (!displayArticle.html || !compareUrl.trim()) return;
        setComparing(true); setCompareErr(null); setCompareResult(null); setShowCompareModal(false);
        await runTask({
            type: "compare",
            label: `Compare: ${article.title.slice(0, 30)} vs URL`,
            endpoint: "/api/compare-article",
            body: {
                html: displayArticle.html,
                title: article.title,
                excerpt: article.excerpt || undefined,
                competitor_url: compareUrl.trim(),
                company_id: article.company_id ?? undefined,
            },
            meta: { articleId: article.id },
            onSuccess: (data: any) => { setCompareResult(data); setComparing(false); },
            onError: (errMsg) => { setCompareErr(errMsg); setComparing(false); },
        });
    }

    async function handleRateQuality() {
        if (!displayArticle.html) return;
        setRatingLoading(true); setRatingErr(null); setRatingResult(null);
        await runTask({
            type: "quality-rating",
            label: `Rate: ${article.title.slice(0, 40)}`,
            endpoint: "/api/rate-quality",
            body: {
                html: displayArticle.html,
                title: article.title,
                excerpt: article.excerpt || undefined,
                company_id: article.company_id ?? undefined,
            },
            meta: { articleId: article.id },
            onSuccess: (data: any) => { setRatingResult(data); setRatingLoading(false); },
            onError: (errMsg) => { setRatingErr(errMsg); setRatingLoading(false); },
        });
    }

    /** Improve article by addressing a specific weakness */
    async function handleImproveWeakness(weaknessIndex: number) {
        if (!displayArticle.html || !ratingResult) return;
        const weakness = ratingResult.top_weaknesses[weaknessIndex];
        if (!weakness) return;
        setImprovingWeakness(weaknessIndex);
        try {
            const r = await fetch("/api/improve-from-weakness", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    html: displayArticle.html,
                    weakness: typeof weakness === "string" ? weakness : JSON.stringify(weakness),
                    title: article.title,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Improve failed");
            const saveResp = await fetch(`/api/articles/${article.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html: data.html }),
            });
            const saveData = await saveResp.json();
            if (!saveResp.ok) throw new Error(saveData.error || "Save failed");
            onUpdate({ ...article, ...saveData });
            setImprovedWeaknesses((prev) => new Set(prev).add(weaknessIndex));
        } catch (e: any) { alert(`Improve failed: ${e.message}`); }
        finally { setImprovingWeakness(null); }
    }

    /** Improve all remaining weaknesses sequentially */
    async function handleImproveAll() {
        if (!ratingResult) return;
        const remaining = ratingResult.top_weaknesses
            .map((_, i) => i)
            .filter((i) => !improvedWeaknesses.has(i));
        for (const i of remaining) {
            await handleImproveWeakness(i);
        }
    }

    /** Save a weakness as a quality rule for future article generation */
    async function handleSaveQualityRule(weaknessIndex: number) {
        if (!ratingResult || !article.company_id) return;
        const weakness = ratingResult.top_weaknesses[weaknessIndex];
        if (!weakness) return;
        setSavingRule(weaknessIndex);
        try {
            const getResp = await fetch(`/api/companies/${article.company_id}`);
            const companyData = await getResp.json();
            if (!getResp.ok) throw new Error(companyData?.error || "Failed to fetch company");
            const currentRules: string[] = companyData.quality_rules ?? [];
            const ruleText = typeof weakness === "string" ? weakness : JSON.stringify(weakness);
            if (currentRules.includes(ruleText)) {
                setSavedRules((prev) => new Set(prev).add(weaknessIndex));
                return;
            }
            const updatedRules = [...currentRules, ruleText];
            const putResp = await fetch(`/api/companies/${article.company_id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ quality_rules: updatedRules }),
            });
            const putData = await putResp.json();
            if (!putResp.ok) throw new Error(putData?.error || "Failed to save rule");
            setSavedRules((prev) => new Set(prev).add(weaknessIndex));
        } catch (e: any) { alert(`Save rule failed: ${e.message}`); }
        finally { setSavingRule(null); }
    }

    function toggleConsulClaim(index: number) {
        setExpandedClaims((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    }

    function toggleRewriteQueue(claimIndex: number) {
        setRewriteQueue((prev) => {
            const next = new Set(prev);
            if (next.has(claimIndex)) next.delete(claimIndex); else next.add(claimIndex);
            return next;
        });
    }

    /** Get all claim indices that have suggested rewrites and aren't already applied */
    function getRewritableClaims(): number[] {
        if (!consulResult) return [];
        return consulResult.claims
            .map((c, i) => ({ c, i }))
            .filter(({ c, i }) => c.suggested_rewrite && !appliedRewrites.has(i))
            .map(({ i }) => i);
    }

    /** Queue all rewritable claims at once */
    function queueAllRewrites() {
        const indices = getRewritableClaims();
        setRewriteQueue(new Set(indices));
    }

    /** Apply a single rewrite (unchanged behavior for individual clicks) */
    async function handleApplyRewrite(claimIndex: number) {
        if (!displayArticle.html || !consulResult) return;
        const claim = consulResult.claims[claimIndex];
        if (!claim?.suggested_rewrite) return;
        setApplyingRewrite(claimIndex);
        try {
            const r = await fetch("/api/apply-rewrite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html: displayArticle.html, claim: claim.claim, suggested_rewrite: claim.suggested_rewrite }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Apply rewrite failed");
            // Save the corrected HTML
            const saveResp = await fetch(`/api/articles/${article.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html: data.html }),
            });
            const saveData = await saveResp.json();
            if (!saveResp.ok) throw new Error(saveData.error || "Save failed");
            onUpdate({ ...article, ...saveData });
            setAppliedRewrites((prev) => new Set(prev).add(claimIndex));
            setRewriteQueue((prev) => { const next = new Set(prev); next.delete(claimIndex); return next; });
        } catch (e: any) { alert(`Rewrite failed: ${e.message}`); }
        finally { setApplyingRewrite(null); }
    }

    /** Apply all queued rewrites in a single batch API call */
    async function handleApplyBatchRewrites() {
        if (!displayArticle.html || !consulResult || rewriteQueue.size === 0) return;
        const corrections = Array.from(rewriteQueue)
            .map((i) => consulResult.claims[i])
            .filter((c) => c?.suggested_rewrite)
            .map((c) => ({ claim: c.claim, suggested_rewrite: c.suggested_rewrite! }));
        if (corrections.length === 0) return;
        setApplyingBatch(true);
        try {
            const r = await fetch("/api/apply-rewrite-batch", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html: displayArticle.html, corrections }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Batch rewrite failed");
            // Save the corrected HTML
            const saveResp = await fetch(`/api/articles/${article.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html: data.html }),
            });
            const saveData = await saveResp.json();
            if (!saveResp.ok) throw new Error(saveData.error || "Save failed");
            onUpdate({ ...article, ...saveData });
            // Mark all queued claims as applied
            setAppliedRewrites((prev) => {
                const next = new Set(prev);
                for (const i of rewriteQueue) next.add(i);
                return next;
            });
            setRewriteQueue(new Set());
        } catch (e: any) { alert(`Batch rewrite failed: ${e.message}`); }
        finally { setApplyingBatch(false); }
    }

    // PanelView: is the selected style composite?
    const pvSelectedStyleObj = imageStyles.find((s) => s.id === selectedStyle);
    const pvIsCompositeStyle = pvSelectedStyleObj?.type === "composite";

    async function pvCsProductSearch() {
        if (!pvCsProductQuery.trim()) return;
        setPvCsProductSearching(true);
        try {
            const r = await fetch("/api/image-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: pvCsProductQuery.trim(), num: 8 }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Search failed");
            setPvCsProductResults(data.images ?? []);
        } catch { setPvCsProductResults([]); }
        finally { setPvCsProductSearching(false); }
    }

    async function refreshImage() {
        setRefreshErr(null);
        // Close the modal immediately — generation moves to activity viewer
        setShowInsertModal(false);
        // Capture article data for the closure — the user may navigate to another article
        const capturedArticle = { ...article };
        const capturedSelectedStyle = selectedStyle;
        // Use article title/excerpt as clean context — do NOT send old image_prompt
        // which contains baked-in style directives from previous generations
        const cleanBase = `Hero image for article: ${capturedArticle.title}${capturedArticle.excerpt ? `. ${capturedArticle.excerpt}` : ""}`;
        const payload: Record<string, unknown> = {
            base_prompt: cleanBase,
            custom_prompt: imagePromptInput.trim() || undefined,
            image_style: capturedSelectedStyle,
            company_id: capturedArticle.company_id ?? undefined,
        };
        // Add composite params if applicable
        if (pvIsCompositeStyle && pvCsProductUrl) {
            payload.composite_product_image_url = pvCsProductUrl;
            payload.article_title = capturedArticle.title;
            payload.article_excerpt = capturedArticle.excerpt;
            if (pvCsBgImageUrl.trim()) payload.composite_bg_image_url = pvCsBgImageUrl.trim();
            if (pvCsBgPrompt.trim()) payload.composite_bg_prompt = pvCsBgPrompt.trim();
        }
        // runTask is fire-and-forget — the task runs in the background even if the user
        // navigates to a different article. refreshingImage is derived from the task store.
        runTask({
            type: "image-regen",
            label: `Hero: ${capturedArticle.title.slice(0, 50)}`,
            endpoint: "/api/regenerate-image",
            body: payload,
            meta: { articleId: capturedArticle.id, companyId: capturedArticle.company_id, imageTask: true },
            onSuccess: async (data: any) => {
                try {
                    const saveResp = await fetch(`/api/articles/${capturedArticle.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ image_base64: data.image_base64, image_prompt: data.final_prompt, image_style: capturedSelectedStyle }),
                    });
                    const saveData = await saveResp.json();
                    if (!saveResp.ok) throw new Error(saveData.error || "Failed to save");
                    // Try to propagate to parent — will work if this article is still displayed
                    try { onUpdate({ ...capturedArticle, image_base64: data.image_base64, image_prompt: data.final_prompt, image_style: capturedSelectedStyle }); } catch {}
                    setImagePromptInput("");
                } catch (e: any) { setRefreshErr(e.message); }
            },
            onError: (errMsg) => { setRefreshErr(errMsg); },
        });
    }

    async function checkSimilarity() {
        if (!article.company_id) return;
        setCheckingSimilarity(true); setSimErr(null); setSimilarResults(null);
        try {
            const r = await fetch("/api/similarity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_id: article.company_id, article_id: article.id, threshold: 0.75 }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Similarity check failed");
            setSimilarResults(data.results ?? []);
        } catch (e: any) { setSimErr(e.message); }
        finally { setCheckingSimilarity(false); }
    }

    async function onInsertSearch() {
        if (!insertSearchQuery.trim()) return;
        setInsertSearching(true); setInsertErr(null); setInsertPreview(null);
        try {
            const r = await fetch("/api/image-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: insertSearchQuery.trim(), num: 12 }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Search failed");
            setInsertSearchResults(data.images ?? []);
        } catch (e: any) { setInsertErr(e.message); }
        finally { setInsertSearching(false); }
    }

    async function onYouTubeSearch() {
        if (!ytQuery.trim()) return;
        setYtSearching(true); setYtErr(null);
        try {
            const r = await fetch("/api/youtube-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: ytQuery.trim(), num: 12 }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "YouTube search failed");
            setYtResults(data.videos ?? []);
        } catch (e: any) { setYtErr(e.message); }
        finally { setYtSearching(false); }
    }

    /** Extract YouTube video ID from a URL (supports youtube.com/watch, youtu.be, embed, shorts) */
    function extractYouTubeId(url: string): string | null {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        ];
        for (const re of patterns) {
            const m = url.match(re);
            if (m) return m[1];
        }
        return null;
    }

    /** Extract Vimeo video ID from a URL (supports vimeo.com/ID, player.vimeo.com/video/ID) */
    function extractVimeoId(url: string): string | null {
        const m = url.match(/(?:vimeo\.com\/)(?:video\/)?(?:channels\/[^/]+\/)?(?:groups\/[^/]+\/videos\/)?(?:manage\/videos\/)?(?:album\/\d+\/video\/)?(\d+)/);
        return m ? m[1] : null;
    }

    /** Detect video platform from URL and return type + id */
    function detectVideoUrl(url: string): { platform: "youtube" | "vimeo"; id: string } | null {
        const ytId = extractYouTubeId(url);
        if (ytId) return { platform: "youtube", id: ytId };
        const vimeoId = extractVimeoId(url);
        if (vimeoId) return { platform: "vimeo", id: vimeoId };
        return null;
    }

    function insertYouTubeVideo(vid: SearchVideo) {
        const videoId = extractYouTubeId(vid.link);
        if (!videoId || !editorRef.current) return;
        editorRef.current.insertYouTube(videoId, vid.title);
        setShowVideoModal(false);
    }

    function insertVideoFromUrl() {
        const url = pasteVideoUrl.trim();
        if (!url || !editorRef.current) return;
        const detected = detectVideoUrl(url);
        if (!detected) {
            setPasteVideoErr("Could not detect a YouTube or Vimeo video from this URL. Please check the link and try again.");
            return;
        }
        setPasteVideoErr(null);
        if (detected.platform === "youtube") {
            editorRef.current.insertYouTube(detected.id);
        } else {
            editorRef.current.insertVimeo(detected.id);
        }
        setPasteVideoUrl("");
        setShowVideoModal(false);
    }

    /** Save a video as the article's featured media (replaces featured image) */
    async function saveFeaturedVideo(videoUrl: string, platform: "youtube" | "vimeo", videoId: string) {
        setInsertSaving(true); setInsertErr(null);
        const embedUrl = platform === "youtube"
            ? `https://www.youtube.com/embed/${videoId}`
            : `https://player.vimeo.com/video/${videoId}`;
        try {
            const r = await fetch(`/api/articles/${article.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ featured_video_url: embedUrl, featured_video_platform: platform }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            onUpdate({ ...article, ...data });
            setShowInsertModal(false);
        } catch (e: any) { setInsertErr(e.message); }
        finally { setInsertSaving(false); }
    }

    /** Remove the featured video (does not restore an image — user can pick a new one) */
    async function removeFeaturedVideo() {
        try {
            const r = await fetch(`/api/articles/${article.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ featured_video_url: null }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            onUpdate({ ...article, ...data });
        } catch (e: any) { alert(`Remove video failed: ${e.message}`); }
    }

    async function onCompositeSearch() {
        if (!compositeSearchQuery.trim()) return;
        setCompositeSearching(true); setCompositeErr(null);
        try {
            const r = await fetch("/api/image-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: compositeSearchQuery.trim(), num: 12 }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Search failed");
            setCompositeSearchResults(data.images ?? []);
        } catch (e: any) { setCompositeErr(e.message); }
        finally { setCompositeSearching(false); }
    }

    async function onCompositeBgSearch() {
        if (!compositeBgSearchQuery.trim()) return;
        setCompositeBgSearching(true); setCompositeErr(null);
        try {
            const r = await fetch("/api/image-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: compositeBgSearchQuery.trim(), num: 12 }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Search failed");
            setCompositeBgSearchResults(data.images ?? []);
        } catch (e: any) { setCompositeErr(e.message); }
        finally { setCompositeBgSearching(false); }
    }

    async function onCompositeGenerate() {
        if (!compositeProductUrl && !compositeProductBase64) return;
        setCompositeGenerating(true); setCompositeErr(null); setCompositeStep("generating");
        try {
            const payload: Record<string, unknown> = {
                article_title: article.title,
                article_excerpt: article.excerpt || "",
                image_style: selectedStyle,
                company_id: article.company_id ?? undefined,
            };

            // Product source
            if (compositeProductBase64) {
                payload.product_image_base64 = compositeProductBase64;
            } else {
                payload.product_image_url = compositeProductUrl;
            }

            // Background source
            if (compositeBgSource === "search" && compositeBgUrl) {
                payload.background_image_url = compositeBgUrl;
            } else if (compositeBgSource === "upload" && compositeBgBase64) {
                payload.background_image_base64 = compositeBgBase64;
            } else {
                // AI-generate background
                payload.custom_bg_prompt = compositeBgPrompt.trim() || undefined;
            }

            const r = await fetch("/api/composite-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Composite generation failed");
            setCompositeResult(data.image_base64);
            setCompositeStep("preview");
        } catch (e: any) { setCompositeErr(e.message); setCompositeStep("background"); }
        finally { setCompositeGenerating(false); }
    }

    async function onCompositeSave() {
        if (!compositeResult) return;
        setInsertSaving(true); setCompositeErr(null);
        try {
            const r = await fetch(`/api/articles/${article.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_base64: compositeResult }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            onUpdate({ ...article, ...data });
            setShowInsertModal(false);
        } catch (e: any) { setCompositeErr(e.message); }
        finally { setInsertSaving(false); }
    }

    function resetComposite() {
        setCompositeStep("product");
        setCompositeProductUrl(null);
        setCompositeProductThumb(null);
        setCompositeProductBase64(null);
        setCompositeSearchQuery("");
        setCompositeSearchResults([]);
        setCompositeBgSource("generate");
        setCompositeBgPrompt("");
        setCompositeBgUrl(null);
        setCompositeBgThumb(null);
        setCompositeBgBase64(null);
        setCompositeBgSearchQuery("");
        setCompositeBgSearchResults([]);
        setCompositeResult(null);
        setCompositeErr(null);
    }

    async function onInsertGenerate() {
        // Use article title/excerpt as clean context — do NOT fall back to old image_prompt
        const cleanBase = `Hero image for article: ${article.title}${article.excerpt ? `. ${article.excerpt}` : ""}`;
        const customPrompt = insertGenPrompt.trim() || undefined;
        setInsertGenerating(true); setInsertErr(null); setInsertPreview(null);
        // Close the modal — generation moves to activity viewer
        const capturedInsertMode = insertMode;
        const capturedArticle = { ...article };
        setShowInsertModal(false);
        runTask({
            type: "image-regen",
            label: `Image: ${capturedArticle.title.slice(0, 50)}`,
            endpoint: "/api/regenerate-image",
            body: { base_prompt: cleanBase, custom_prompt: customPrompt, image_style: selectedStyle, company_id: capturedArticle.company_id ?? undefined },
            meta: { articleId: capturedArticle.id, companyId: capturedArticle.company_id, imageTask: true, insertMode: capturedInsertMode },
            onSuccess: async (data: any) => {
                setInsertPreview({ src: data.image_base64, type: "base64" });
                // If it was a featured image request, auto-save
                if (capturedInsertMode === "featured") {
                    try {
                        const r = await fetch(`/api/articles/${capturedArticle.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ image_base64: data.image_base64 }),
                        });
                        const saveData = await r.json();
                        if (r.ok) try { onUpdate({ ...capturedArticle, ...saveData }); } catch {}
                    } catch {}
                }
                setInsertGenerating(false);
            },
            onError: (errMsg) => { setInsertErr(errMsg); setInsertGenerating(false); },
        });
    }

    useEffect(() => {
        if (insertMode !== "featured" || !insertPreview || !showInsertModal) return;
        (async () => {
            setInsertSaving(true); setInsertErr(null);
            try {
                let base64Data: string;
                if (insertPreview.type === "base64") { base64Data = insertPreview.src; }
                else {
                    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(insertPreview.src)}`;
                    const imgResp = await fetch(proxyUrl);
                    if (!imgResp.ok) throw new Error("Failed to fetch image");
                    const blob = await imgResp.blob();
                    base64Data = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                }
                const r = await fetch(`/api/articles/${article.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ image_base64: base64Data }),
                });
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || "Save failed");
                onUpdate({ ...article, ...data });
            } catch (e: any) { setInsertErr(e.message); }
            finally { setInsertSaving(false); }
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [insertPreview]);

    async function doInsertImage() {
        if (!insertPreview) return;
        setInsertSaving(true); setInsertErr(null);
        try {
            if (insertMode === "featured") {
                let base64Data: string;
                if (insertPreview.type === "base64") { base64Data = insertPreview.src; }
                else {
                    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(insertPreview.src)}`;
                    const imgResp = await fetch(proxyUrl);
                    if (!imgResp.ok) throw new Error("Failed to fetch image");
                    const blob = await imgResp.blob();
                    base64Data = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                }
                const r = await fetch(`/api/articles/${article.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_base64: base64Data }) });
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || "Save failed");
                onUpdate({ ...article, ...data });
            } else if (insertMode === "editInline" && editorRef.current) {
                const imgSrc = insertPreview.type === "base64" ? `data:image/png;base64,${insertPreview.src}` : `/api/image-proxy?url=${encodeURIComponent(insertPreview.src)}`;
                editorRef.current.insertImage(imgSrc);
            } else {
                const imgSrc = insertPreview.type === "base64" ? `data:image/png;base64,${insertPreview.src}` : `/api/image-proxy?url=${encodeURIComponent(insertPreview.src)}`;
                const figureHtml = `<figure style="margin:24px 0;text-align:center"><img src="${imgSrc}" alt="" style="max-width:100%;border-radius:10px" /></figure>`;
                const currentHtml = displayArticle.html ?? "";
                const newHtml = insertPosition === "top" ? figureHtml + "\n" + currentHtml : currentHtml + "\n" + figureHtml;
                const r = await fetch(`/api/articles/${article.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html: newHtml }) });
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || "Save failed");
                onUpdate({ ...article, ...data });
            }
            setShowInsertModal(false);
        } catch (e: any) { setInsertErr(e.message); }
        finally { setInsertSaving(false); }
    }

    const seo = article.seo as any;

    const RoleIcon = article.cluster_role === "pillar" ? Crown : article.cluster_role === "supporting" ? BookOpen : Scroll;

    // ======= INSERT IMAGE MODAL =======
    // ── Crop to 16:9 ─────────────────────────────────────────────────────
    function startCrop() {
        if (!insertPreview) return;
        setCropActive(true);
        setCropDragY(0);
        setCropImgLoaded(false);
    }

    function applyCrop() {
        if (!cropImgRef.current) return;
        const img = cropImgRef.current;
        const imgW = img.naturalWidth;
        const imgH = img.naturalHeight;
        // Crop region: full width, height = width * 9/16, top = cropDragY
        const cropH = Math.round(imgW * (9 / 16));
        const maxY = Math.max(0, imgH - cropH);
        const y = Math.min(Math.max(0, Math.round(cropDragY)), maxY);
        const canvas = document.createElement("canvas");
        canvas.width = imgW;
        canvas.height = cropH;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, y, imgW, cropH, 0, 0, imgW, cropH);
        const base64 = canvas.toDataURL("image/png").split(",")[1];
        setInsertPreview({ src: base64, type: "base64" });
        setCropActive(false);
    }

    const insertImageModal = (
        <Dialog open={showInsertModal} onOpenChange={setShowInsertModal}>
            <DialogContent className="max-w-7xl w-[95vw] max-h-[95vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {insertMode === "featured" && insertTab === "video" ? <Video className="h-5 w-5 text-red-500" /> : <ImageIcon className="h-5 w-5" />}
                        {insertMode === "featured" ? "Change Featured Media" : "Insert Image"}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={insertTab} onValueChange={(v) => { setInsertTab(v as any); setInsertPreview(null); setInsertErr(null); if (v === "composite") resetComposite(); }}>
                    <TabsList className={cn("grid w-full", insertMode === "featured" ? "grid-cols-5" : "grid-cols-4")}>
                        <TabsTrigger value="search" className="gap-1.5"><Search className="h-3.5 w-3.5" />Search</TabsTrigger>
                        <TabsTrigger value="generate" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />Generate</TabsTrigger>
                        <TabsTrigger value="composite" className="gap-1.5"><Layers className="h-3.5 w-3.5" />Composite</TabsTrigger>
                        <TabsTrigger value="upload" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Upload</TabsTrigger>
                        {insertMode === "featured" && (
                            <TabsTrigger value="video" className="gap-1.5"><Video className="h-3.5 w-3.5" />Video</TabsTrigger>
                        )}
                    </TabsList>

                    <TabsContent value="search" className="space-y-3">
                        <div className="flex gap-2">
                            <Input placeholder="e.g. family hiking mountain trail" value={insertSearchQuery} onChange={(e) => setInsertSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onInsertSearch(); }} />
                            <Button onClick={onInsertSearch} disabled={insertSearching || !insertSearchQuery.trim()}>
                                {insertSearching ? "Searching…" : "Search"}
                            </Button>
                        </div>
                        {insertSearchResults.length > 0 && (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2 max-h-72 overflow-y-auto">
                                {insertSearchResults.map((img, i) => (
                                    <button key={i} onClick={() => setInsertPreview({ src: img.imageUrl, type: "url" })}
                                        className={cn("p-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors",
                                            insertPreview?.src === img.imageUrl ? "border-primary" : "border-border hover:border-primary/50"
                                        )}>
                                        <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} className="w-full h-24 object-cover" />
                                        <div className="px-1.5 py-1 text-[10px] text-muted-foreground truncate">{img.domain}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="generate" className="space-y-3">
                        {imageStyles.length > 0 && (
                            <div>
                                <Label className="text-xs">Hero style</Label>
                                <select value={selectedStyle} onChange={(e) => { setSelectedStyle(e.target.value); setImagePromptInput(""); setInsertGenPrompt(""); setInsertPreview(null); setRefreshErr(null); setPvCsProductUrl(null); setPvCsProductThumb(null); setPvCsProductResults([]); setPvCsProductQuery(""); setPvCsBgPrompt(""); setPvCsBgImageUrl(""); resetComposite(); }}
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    {imageStyles.map((s) => (
                                        <option key={s.id} value={s.id}>{s.label}{s.narrative ? ` — ${s.narrative.slice(0, 60)}…` : ""}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Input placeholder="Add extra direction (optional)…" value={insertGenPrompt} onChange={(e) => setInsertGenPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onInsertGenerate(); }} />
                            <Button onClick={onInsertGenerate} disabled={insertGenerating}>
                                {insertGenerating ? "Generating…" : "Generate"}
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">💡 Will generate from selected style + article context{insertGenPrompt.trim() ? " + your prompt" : ""}</p>
                    </TabsContent>

                    <TabsContent value="composite" className="space-y-3">
                        {/* Hidden file inputs for composite uploads */}
                        <input ref={compositeProductFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64 = (reader.result as string).split(",")[1];
                                setCompositeProductBase64(base64);
                                setCompositeProductThumb(`data:image/png;base64,${base64}`);
                                setCompositeProductUrl(null);
                                setCompositeStep("background");
                            };
                            reader.readAsDataURL(file); e.target.value = "";
                        }} />
                        <input ref={compositeBgFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                const base64 = (reader.result as string).split(",")[1];
                                setCompositeBgBase64(base64);
                                setCompositeBgThumb(`data:image/png;base64,${base64}`);
                                setCompositeBgUrl(null);
                            };
                            reader.readAsDataURL(file); e.target.value = "";
                        }} />

                        {/* ───── Step 1: Select Product Image ───── */}
                        {compositeStep === "product" && (
                            <>
                                <div className="text-sm text-muted-foreground mb-1">
                                    <strong>Step 1:</strong> Select your product image
                                </div>
                                <div className="flex gap-2">
                                    <Input placeholder="e.g. Nike Air Max 90 product photo" value={compositeSearchQuery} onChange={(e) => setCompositeSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onCompositeSearch(); }} />
                                    <Button onClick={onCompositeSearch} disabled={compositeSearching || !compositeSearchQuery.trim()}>
                                        {compositeSearching ? "Searching…" : "Search"}
                                    </Button>
                                </div>
                                {compositeSearchResults.length > 0 && (
                                    <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2 max-h-72 overflow-y-auto">
                                        {compositeSearchResults.map((img, i) => (
                                            <button key={i} onClick={() => {
                                                setCompositeProductUrl(img.imageUrl);
                                                setCompositeProductThumb(img.thumbnailUrl || img.imageUrl);
                                                setCompositeProductBase64(null);
                                                setCompositeStep("background");
                                            }}
                                                className={cn("p-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors border-border hover:border-primary/50")}>
                                                <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} className="w-full h-24 object-cover" />
                                                <div className="px-1.5 py-1 text-[10px] text-muted-foreground truncate">{img.domain}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <div className="flex items-center gap-3 pt-2">
                                    <Separator className="flex-1" />
                                    <span className="text-xs text-muted-foreground">or</span>
                                    <Separator className="flex-1" />
                                </div>
                                <Button variant="outline" onClick={() => compositeProductFileRef.current?.click()} className="w-full gap-1.5">
                                    <Upload className="h-3.5 w-3.5" /> Upload Product Image
                                </Button>
                            </>
                        )}

                        {/* ───── Step 2: Choose Background ───── */}
                        {compositeStep === "background" && (compositeProductUrl || compositeProductBase64) && (
                            <>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <button onClick={() => setCompositeStep("product")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                                        <ArrowLeft className="h-3.5 w-3.5" /> Back
                                    </button>
                                    <span>·</span>
                                    <strong>Step 2:</strong> Choose background
                                </div>

                                {/* Product thumbnail */}
                                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/30">
                                    <img
                                        src={compositeProductThumb || compositeProductUrl || `data:image/png;base64,${compositeProductBase64}`}
                                        alt="Selected product"
                                        className="w-16 h-16 rounded-md border border-border object-contain bg-white shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium">Product selected ✓</div>
                                        <div className="text-[10px] text-muted-foreground truncate">
                                            {compositeProductBase64 ? "Uploaded image" : compositeProductUrl}
                                        </div>
                                    </div>
                                </div>

                                {/* Background source tabs */}
                                <div className="flex gap-1 bg-muted rounded-lg p-1">
                                    {([
                                        { id: "generate" as const, label: "AI Generate", icon: <Sparkles className="h-3 w-3" /> },
                                        { id: "search" as const, label: "Search", icon: <Search className="h-3 w-3" /> },
                                        { id: "upload" as const, label: "Upload", icon: <Upload className="h-3 w-3" /> },
                                    ]).map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setCompositeBgSource(tab.id)}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                                                compositeBgSource === tab.id
                                                    ? "bg-background text-foreground shadow-sm"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {tab.icon} {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Background: AI Generate */}
                                {compositeBgSource === "generate" && (
                                    <div className="space-y-3">
                                        {imageStyles.length > 0 && (
                                            <div>
                                                <Label className="text-xs">Hero style</Label>
                                                <select value={selectedStyle} onChange={(e) => { setSelectedStyle(e.target.value); setImagePromptInput(""); setInsertGenPrompt(""); setInsertPreview(null); setRefreshErr(null); setPvCsProductUrl(null); setPvCsProductThumb(null); setPvCsProductResults([]); setPvCsProductQuery(""); setPvCsBgPrompt(""); setPvCsBgImageUrl(""); resetComposite(); }}
                                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                                    {imageStyles.map((s) => (
                                                        <option key={s.id} value={s.id}>{s.label}{s.narrative ? ` — ${s.narrative.slice(0, 50)}…` : ""}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div>
                                            <Label className="text-xs">Background Direction <span className="text-muted-foreground font-normal">(optional)</span></Label>
                                            <Textarea
                                                placeholder={`Auto-generated from article: "${article.title.slice(0, 60)}${article.title.length > 60 ? "…" : ""}". Add extra direction here…`}
                                                value={compositeBgPrompt}
                                                onChange={(e) => setCompositeBgPrompt(e.target.value)}
                                                rows={3}
                                                className="mt-1 text-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Background: Search */}
                                {compositeBgSource === "search" && (
                                    <div className="space-y-3">
                                        <div className="flex gap-2">
                                            <Input placeholder="e.g. mountain landscape sunset" value={compositeBgSearchQuery} onChange={(e) => setCompositeBgSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onCompositeBgSearch(); }} />
                                            <Button onClick={onCompositeBgSearch} disabled={compositeBgSearching || !compositeBgSearchQuery.trim()} size="sm">
                                                {compositeBgSearching ? "…" : "Search"}
                                            </Button>
                                        </div>
                                        {compositeBgSearchResults.length > 0 && (
                                            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2 max-h-56 overflow-y-auto">
                                                {compositeBgSearchResults.map((img, i) => (
                                                    <button key={i} onClick={() => {
                                                        setCompositeBgUrl(img.imageUrl);
                                                        setCompositeBgThumb(img.thumbnailUrl || img.imageUrl);
                                                        setCompositeBgBase64(null);
                                                    }}
                                                        className={cn("p-0 rounded-lg overflow-hidden cursor-pointer border-2 transition-colors",
                                                            compositeBgUrl === img.imageUrl ? "border-primary" : "border-border hover:border-primary/50"
                                                        )}>
                                                        <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} className="w-full h-24 object-cover" />
                                                        <div className="px-1.5 py-1 text-[10px] text-muted-foreground truncate">{img.domain}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {compositeBgUrl && (
                                            <div className="flex items-center gap-2 p-2 rounded-md border border-primary/30 bg-primary/5">
                                                <img src={compositeBgThumb || compositeBgUrl} alt="Selected background" className="w-12 h-8 rounded object-cover" />
                                                <span className="text-xs font-medium text-foreground">Background selected ✓</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Background: Upload */}
                                {compositeBgSource === "upload" && (
                                    <div className="space-y-3">
                                        <div onClick={() => compositeBgFileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
                                            e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (!file?.type.startsWith("image/")) return;
                                            const reader = new FileReader(); reader.onloadend = () => {
                                                const base64 = (reader.result as string).split(",")[1];
                                                setCompositeBgBase64(base64);
                                                setCompositeBgThumb(`data:image/png;base64,${base64}`);
                                                setCompositeBgUrl(null);
                                            }; reader.readAsDataURL(file);
                                        }} className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
                                            <Upload className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
                                            <div className="text-xs font-medium">Click to browse or drag & drop</div>
                                            <div className="text-[10px] text-muted-foreground mt-0.5">Background image</div>
                                        </div>
                                        {compositeBgBase64 && (
                                            <div className="flex items-center gap-2 p-2 rounded-md border border-primary/30 bg-primary/5">
                                                <img src={compositeBgThumb || `data:image/png;base64,${compositeBgBase64}`} alt="Uploaded background" className="w-12 h-8 rounded object-cover" />
                                                <span className="text-xs font-medium text-foreground">Background uploaded ✓</span>
                                                <button onClick={() => { setCompositeBgBase64(null); setCompositeBgThumb(null); }} className="ml-auto text-xs text-muted-foreground hover:text-destructive">Remove</button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Generate composite button */}
                                <Button
                                    onClick={onCompositeGenerate}
                                    className="w-full gap-1.5"
                                    disabled={
                                        (compositeBgSource === "search" && !compositeBgUrl) ||
                                        (compositeBgSource === "upload" && !compositeBgBase64)
                                    }
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {compositeBgSource === "generate"
                                        ? "Generate Background & Composite"
                                        : "Remove Product Background & Composite"}
                                </Button>
                            </>
                        )}

                        {/* ───── Step 3: Generating ───── */}
                        {compositeStep === "generating" && (
                            <div className="py-10 text-center space-y-4">
                                <div className="relative mx-auto w-16 h-16">
                                    <div className="absolute inset-0 rounded-full border-4 border-muted" />
                                    <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium">Creating your composite…</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {compositeBgSource === "generate"
                                            ? "Generating background → Removing product background → Compositing"
                                            : "Removing product background → Compositing on selected background"}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ───── Step 4: Preview composite result ───── */}
                        {compositeStep === "preview" && compositeResult && (
                            <>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                                    <button onClick={() => setCompositeStep("background")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                                        <ArrowLeft className="h-3.5 w-3.5" /> Adjust
                                    </button>
                                    <span>·</span>
                                    <strong>Result</strong>
                                </div>
                                <img src={`data:image/png;base64,${compositeResult}`} alt="Composite preview" className="w-full rounded-lg border border-border" />
                                <div className="flex gap-2 justify-end pt-2">
                                    <Button variant="outline" onClick={() => {
                                        setCompositeResult(null);
                                        setCompositeStep("background");
                                    }}>
                                        Regenerate
                                    </Button>
                                    <Button onClick={onCompositeSave} disabled={insertSaving} className="gap-1.5">
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {insertSaving ? "Saving…" : "Save as Featured Image"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="upload">
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0]; if (!file) return;
                            const reader = new FileReader(); reader.onloadend = () => setInsertPreview({ src: (reader.result as string).split(",")[1], type: "base64" }); reader.readAsDataURL(file); e.target.value = "";
                        }} />
                        <div onClick={() => fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => {
                            e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (!file?.type.startsWith("image/")) return;
                            const reader = new FileReader(); reader.onloadend = () => setInsertPreview({ src: (reader.result as string).split(",")[1], type: "base64" }); reader.readAsDataURL(file);
                        }} className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 transition-colors">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <div className="text-sm font-medium">Click to browse or drag & drop</div>
                        </div>
                    </TabsContent>

                    {/* ── Video tab (featured mode only) ── */}
                    {insertMode === "featured" && (
                        <TabsContent value="video" className="space-y-4">
                            {/* Paste URL section */}
                            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                                <div className="text-sm font-medium flex items-center gap-2">
                                    <ExternalLink className="h-4 w-4 text-muted-foreground" /> Paste a video URL
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Paste a YouTube or Vimeo URL…"
                                        value={pasteVideoUrl}
                                        onChange={(e) => { setPasteVideoUrl(e.target.value); setPasteVideoErr(null); }}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                const url = pasteVideoUrl.trim();
                                                if (!url) return;
                                                const detected = detectVideoUrl(url);
                                                if (!detected) { setPasteVideoErr("Could not detect a YouTube or Vimeo video from this URL."); return; }
                                                setPasteVideoErr(null);
                                                saveFeaturedVideo(url, detected.platform, detected.id);
                                            }
                                        }}
                                    />
                                    <Button
                                        onClick={() => {
                                            const url = pasteVideoUrl.trim();
                                            if (!url) return;
                                            const detected = detectVideoUrl(url);
                                            if (!detected) { setPasteVideoErr("Could not detect a YouTube or Vimeo video from this URL."); return; }
                                            setPasteVideoErr(null);
                                            saveFeaturedVideo(url, detected.platform, detected.id);
                                        }}
                                        disabled={!pasteVideoUrl.trim() || insertSaving}
                                        className="gap-1.5 whitespace-nowrap"
                                    >
                                        <Video className="h-4 w-4" />
                                        {insertSaving ? "Saving…" : "Set as Featured"}
                                    </Button>
                                </div>
                                {pasteVideoErr && (
                                    <p className="text-xs text-destructive">{pasteVideoErr}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    Supports YouTube (youtube.com, youtu.be) and Vimeo (vimeo.com) links
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <Separator className="flex-1" />
                                <span className="text-xs text-muted-foreground">or search YouTube</span>
                                <Separator className="flex-1" />
                            </div>

                            {/* YouTube Search */}
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Search YouTube for videos…"
                                    value={ytQuery}
                                    onChange={(e) => setYtQuery(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") onYouTubeSearch(); }}
                                />
                                <Button onClick={onYouTubeSearch} disabled={ytSearching || !ytQuery.trim()} className="gap-1.5 whitespace-nowrap">
                                    <Play className="h-4 w-4" />
                                    {ytSearching ? "Searching…" : "Search"}
                                </Button>
                            </div>

                            {ytErr && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{ytErr}</AlertDescription>
                                </Alert>
                            )}

                            {/* Results grid */}
                            {ytResults.length > 0 && (
                                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 max-h-[60vh] overflow-y-auto">
                                    {ytResults.map((vid, i) => {
                                        const videoId = extractYouTubeId(vid.link);
                                        return (
                                            <Card key={i} className="overflow-hidden hover:shadow-lg transition-shadow group">
                                                <div className="relative bg-black aspect-video overflow-hidden">
                                                    {vid.imageUrl && (
                                                        <img
                                                            src={vid.imageUrl}
                                                            alt={vid.title}
                                                            loading="lazy"
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                        />
                                                    )}
                                                    {vid.duration && (
                                                        <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded">
                                                            {vid.duration}
                                                        </span>
                                                    )}
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-70 pointer-events-none">
                                                        <svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.5)"/><polygon points="18,14 36,24 18,34" fill="#fff"/></svg>
                                                    </div>
                                                </div>
                                                <CardContent className="p-2.5 space-y-1.5">
                                                    <div className="text-sm font-semibold line-clamp-2 leading-tight">{vid.title}</div>
                                                    {vid.channel && <div className="text-xs text-muted-foreground font-medium">{vid.channel}</div>}
                                                    <div className="flex items-center gap-2">
                                                        {vid.date && <span className="text-[11px] text-muted-foreground">{vid.date}</span>}
                                                    </div>
                                                    <div className="flex gap-1.5 pt-1">
                                                        {videoId && (
                                                            <Button
                                                                size="sm"
                                                                className="gap-1 flex-1 text-xs"
                                                                disabled={insertSaving}
                                                                onClick={() => saveFeaturedVideo(vid.link, "youtube", videoId)}
                                                            >
                                                                <Video className="h-3 w-3" />
                                                                {insertSaving ? "Saving…" : "Set as Featured"}
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-1 text-xs"
                                                            asChild
                                                        >
                                                            <a href={vid.link} target="_blank" rel="noopener noreferrer">
                                                                <ExternalLink className="h-3 w-3" /> Watch
                                                            </a>
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}

                            {ytResults.length === 0 && !ytSearching && !ytErr && (
                                <div className="py-12 text-center text-muted-foreground">
                                    <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">Search YouTube or paste a video URL above to set as the featured media.</p>
                                    <p className="text-xs mt-1">The video will replace the featured image and display as an embedded player.</p>
                                </div>
                            )}
                        </TabsContent>
                    )}
                </Tabs>

                {(insertErr || compositeErr) && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{insertErr || compositeErr}</AlertDescription>
                    </Alert>
                )}

                {insertPreview && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-xs">Preview</Label>
                            <div className="flex gap-1.5">
                                {!cropActive && (
                                    <Button variant="outline" size="sm" onClick={startCrop} className="gap-1 text-xs h-7">
                                        <Crop className="h-3 w-3" /> Crop 16:9
                                    </Button>
                                )}
                                {cropActive && (
                                    <>
                                        <Button variant="default" size="sm" onClick={applyCrop} className="gap-1 text-xs h-7">
                                            <Crop className="h-3 w-3" /> Apply Crop
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => setCropActive(false)} className="text-xs h-7">
                                            Cancel
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                        {!cropActive ? (
                            <img src={insertPreview.type === "base64" ? `data:image/png;base64,${insertPreview.src}` : insertPreview.src} alt="Preview"
                                className="w-full max-h-[50vh] object-contain rounded-lg border border-border" />
                        ) : (
                            /* Interactive 16:9 crop overlay */
                            <div ref={cropContainerRef} className="relative select-none rounded-lg border border-border overflow-hidden bg-black"
                                style={{ cursor: "ns-resize" }}
                                onMouseDown={(e) => {
                                    const container = cropContainerRef.current;
                                    const img = cropImgRef.current;
                                    if (!container || !img) return;
                                    const rect = container.getBoundingClientRect();
                                    const displayH = container.offsetHeight;
                                    const imgH = img.naturalHeight;
                                    const imgW = img.naturalWidth;
                                    const cropH = Math.round(imgW * (9 / 16));
                                    const maxY = Math.max(0, imgH - cropH);
                                    const scale = imgH / displayH;
                                    const startMouseY = e.clientY;
                                    const startCropY = cropDragY;
                                    const onMove = (ev: MouseEvent) => {
                                        const delta = (ev.clientY - startMouseY) * scale;
                                        setCropDragY(Math.min(maxY, Math.max(0, startCropY + delta)));
                                    };
                                    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                                    window.addEventListener("mousemove", onMove);
                                    window.addEventListener("mouseup", onUp);
                                }}>
                                <img
                                    ref={cropImgRef}
                                    src={insertPreview.type === "base64" ? `data:image/png;base64,${insertPreview.src}` : insertPreview.src}
                                    alt="Crop source"
                                    className="w-full block"
                                    style={{ maxHeight: "50vh", objectFit: "contain" }}
                                    crossOrigin="anonymous"
                                    onLoad={() => setCropImgLoaded(true)}
                                />
                                {/* Dark overlay above/below crop region */}
                                {cropImgLoaded && cropImgRef.current && (() => {
                                    const img = cropImgRef.current!;
                                    const container = cropContainerRef.current;
                                    if (!container) return null;
                                    const displayW = container.offsetWidth;
                                    const displayH = container.offsetHeight;
                                    const imgW = img.naturalWidth || 1;
                                    const imgH = img.naturalHeight || 1;
                                    const cropH = imgW * (9 / 16);
                                    const scale = displayH / imgH;
                                    const topPx = cropDragY * scale;
                                    const heightPx = cropH * scale;
                                    return (
                                        <>
                                            <div className="absolute left-0 right-0 top-0 bg-black/60 pointer-events-none" style={{ height: `${topPx}px` }} />
                                            <div className="absolute left-0 right-0 bg-black/60 pointer-events-none" style={{ top: `${topPx + heightPx}px`, bottom: 0 }} />
                                            <div className="absolute left-0 right-0 border-2 border-dashed border-white/80 pointer-events-none" style={{ top: `${topPx}px`, height: `${heightPx}px` }}>
                                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-white/70 text-xs font-medium">↕ Drag to adjust crop</div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                )}

                {insertPreview && (
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-border">
                        {insertMode === "inline" && (
                            <div className="flex items-center gap-4 text-sm">
                                <span className="font-medium">Position:</span>
                                {(["top", "bottom"] as const).map((pos) => (
                                    <label key={pos} className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="radio" name="insert-pos-panel" checked={insertPosition === pos} onChange={() => setInsertPosition(pos)} className="accent-primary" />
                                        {pos === "top" ? "Top" : "Bottom"}
                                    </label>
                                ))}
                            </div>
                        )}
                        {insertMode === "editInline" && <span className="text-sm text-muted-foreground">Inserted at cursor</span>}
                        {insertMode === "featured" && (
                            <span className={cn("text-sm font-medium", insertSaving ? "text-warning" : "text-success")}>
                                {insertSaving ? "⏳ Saving…" : "✓ Updated"}
                            </span>
                        )}
                        {insertMode !== "featured" && (
                            <Button onClick={doInsertImage} disabled={insertSaving}>
                                {insertSaving ? "Saving…" : "Insert & Save"}
                            </Button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );

    // ======= INSERT VIDEO MODAL =======
    const insertVideoModal = (
        <Dialog open={showVideoModal} onOpenChange={setShowVideoModal}>
            <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-red-500" /> Insert Video
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Paste URL section */}
                    <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                        <div className="text-sm font-medium flex items-center gap-2">
                            <ExternalLink className="h-4 w-4 text-muted-foreground" /> Paste a video URL
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder="Paste a YouTube or Vimeo URL…"
                                value={pasteVideoUrl}
                                onChange={(e) => { setPasteVideoUrl(e.target.value); setPasteVideoErr(null); }}
                                onKeyDown={(e) => { if (e.key === "Enter") insertVideoFromUrl(); }}
                            />
                            <Button onClick={insertVideoFromUrl} disabled={!pasteVideoUrl.trim()} className="gap-1.5 whitespace-nowrap">
                                <Video className="h-4 w-4" /> Embed
                            </Button>
                        </div>
                        {pasteVideoErr && (
                            <p className="text-xs text-destructive">{pasteVideoErr}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Supports YouTube (youtube.com, youtu.be) and Vimeo (vimeo.com) links
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Separator className="flex-1" />
                        <span className="text-xs text-muted-foreground">or search YouTube</span>
                        <Separator className="flex-1" />
                    </div>

                    {/* YouTube Search bar */}
                    <div className="flex gap-2">
                        <Input
                            placeholder="Search YouTube for videos to embed…"
                            value={ytQuery}
                            onChange={(e) => setYtQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") onYouTubeSearch(); }}
                        />
                        <Button onClick={onYouTubeSearch} disabled={ytSearching || !ytQuery.trim()} className="gap-1.5 whitespace-nowrap">
                            <Play className="h-4 w-4" />
                            {ytSearching ? "Searching…" : "Search"}
                        </Button>
                    </div>

                    {ytErr && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{ytErr}</AlertDescription>
                        </Alert>
                    )}

                    {/* Results grid */}
                    {ytResults.length > 0 && (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 max-h-[60vh] overflow-y-auto">
                            {ytResults.map((vid, i) => {
                                const videoId = extractYouTubeId(vid.link);
                                return (
                                    <Card key={i} className="overflow-hidden hover:shadow-lg transition-shadow group">
                                        <div className="relative bg-black aspect-video overflow-hidden">
                                            {vid.imageUrl && (
                                                <img
                                                    src={vid.imageUrl}
                                                    alt={vid.title}
                                                    loading="lazy"
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                />
                                            )}
                                            {vid.duration && (
                                                <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded">
                                                    {vid.duration}
                                                </span>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-70 pointer-events-none">
                                                <svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.5)"/><polygon points="18,14 36,24 18,34" fill="#fff"/></svg>
                                            </div>
                                        </div>
                                        <CardContent className="p-2.5 space-y-1.5">
                                            <div className="text-sm font-semibold line-clamp-2 leading-tight">{vid.title}</div>
                                            {vid.channel && <div className="text-xs text-muted-foreground font-medium">{vid.channel}</div>}
                                            <div className="flex items-center gap-2">
                                                {vid.date && <span className="text-[11px] text-muted-foreground">{vid.date}</span>}
                                            </div>
                                            <div className="flex gap-1.5 pt-1">
                                                {videoId && (
                                                    <Button
                                                        size="sm"
                                                        className="gap-1 flex-1 text-xs"
                                                        onClick={() => insertYouTubeVideo(vid)}
                                                    >
                                                        <Video className="h-3 w-3" /> Embed
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1 text-xs"
                                                    asChild
                                                >
                                                    <a href={vid.link} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-3 w-3" /> Watch
                                                    </a>
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {ytResults.length === 0 && !ytSearching && !ytErr && (
                        <div className="py-12 text-center text-muted-foreground">
                            <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">Search YouTube or paste a video URL above to embed in your article.</p>
                            <p className="text-xs mt-1">Supports YouTube and Vimeo — videos will be embedded as responsive iframes at the cursor position.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );

    // ======= EDIT MODE (fullscreen overlay) =======
    if (editing) {
        return (
            <>
            <div
                className="fixed inset-0 z-50 flex flex-col bg-background"
                style={{ animation: "editor-slide-up 0.3s ease-out" }}
            >
                {/* ── Sticky top bar ────────────────────────────────── */}
                <div className="shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    <div className="mx-auto max-w-4xl flex items-center justify-between px-6 py-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                                <Pencil className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold leading-tight">Editing Article</h3>
                                <p className="text-xs text-muted-foreground truncate max-w-[300px]">{editTitle || article.title}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditing(false)}
                                disabled={saving}
                                className="gap-1.5 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" /> Discard
                            </Button>
                            <Button
                                size="sm"
                                onClick={saveEdit}
                                disabled={saving}
                                className="gap-1.5 min-w-[120px]"
                            >
                                {saving ? (
                                    <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                                ) : (
                                    <><CheckCircle2 className="h-3.5 w-3.5" /> Save Changes</>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── Scrollable editor body ─────────────────────────── */}
                <div className="flex-1 overflow-y-auto">
                    <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Title</Label>
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="text-lg font-semibold h-12 border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary bg-transparent"
                                placeholder="Article title…"
                            />
                        </div>

                        {/* Excerpt */}
                        <div className="space-y-2">
                            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Excerpt</Label>
                            <Textarea
                                value={editExcerpt}
                                onChange={(e) => setEditExcerpt(e.target.value)}
                                rows={2}
                                className="resize-none border-0 border-b border-border rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary bg-transparent text-muted-foreground"
                                placeholder="Brief description of the article…"
                            />
                        </div>

                        {/* Body — Tiptap editor (expanded for fullscreen) */}
                        <div className="space-y-2">
                            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Body</Label>
                            <ArticleEditor
                                ref={editorRef}
                                initialContent={editHtml}
                                onChange={(html) => setEditHtml(html)}
                                onImageButtonClick={() => {
                                    setInsertMode("editInline"); setInsertPreview(null); setInsertErr(null); setInsertGenerating(false); setShowInsertModal(true);
                                }}
                                onVideoButtonClick={() => {
                                    setYtResults([]); setYtErr(null); setPasteVideoUrl(""); setPasteVideoErr(null); setShowVideoModal(true);
                                }}
                                className="fullscreen-editor"
                            />
                        </div>
                    </div>
                </div>
            </div>
            {insertImageModal}
            {insertVideoModal}
            </>
        );
    }

    // ======= READ MODE =======
    return (
        <>
        <div className="p-5 overflow-y-auto h-full space-y-4">
            {/* Header */}
            <div>
                <h2 className="text-xl font-semibold tracking-tight mb-1.5">{article.title}</h2>
                {article.excerpt && <p className="text-sm text-muted-foreground italic mb-3">{article.excerpt}</p>}
                <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">
                        {article.company_id && companies[article.company_id] ? companies[article.company_id] : "Brand Studio"}
                    </Badge>
                    {article.cluster_role && (
                        <Badge variant="outline" className="gap-1">
                            <RoleIcon className="h-3 w-3" />
                            {article.cluster_role.replace("_", "-")}
                        </Badge>
                    )}
                    {article.model_used && <Badge variant="outline">{article.model_used}</Badge>}
                    {displayArticle.html && (() => {
                        const wc = displayArticle.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean).length;
                        return <Badge variant="outline">{wc.toLocaleString()} words</Badge>;
                    })()}
                    <span className="text-xs text-muted-foreground self-center">
                        {new Date(article.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                </div>
            </div>

            {loadingFull && (
                <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            )}

            {/* Actions — grouped by purpose */}
            <div className="flex items-center gap-1.5 flex-wrap pb-4 border-b border-border">
                {/* ── Copy & Publish ── */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("gap-1.5", copied && "text-success border-success", !copied && published && "text-success border-success")}>
                            {copied ? <><CheckCircle2 className="h-3.5 w-3.5" /> {copied === "rich" ? "Copied for CMS" : "Copied"}</> : published ? <><CheckCircle2 className="h-3.5 w-3.5" /> Published!</> : <><Copy className="h-3.5 w-3.5" /> Copy & Publish</>}
                            <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[220px]">
                        <DropdownMenuLabel>Copy Article</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleCopyRich} className="gap-2 cursor-pointer">
                            <FileText className="h-4 w-4" />
                            <div>
                                <div className="font-medium">Copy for Word / CMS</div>
                                <div className="text-xs text-muted-foreground">Rich HTML with images embedded</div>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleCopyPlain} className="gap-2 cursor-pointer">
                            <ClipboardCopy className="h-4 w-4" />
                            <div>
                                <div className="font-medium">Copy as Plain Text</div>
                                <div className="text-xs text-muted-foreground">Text only, no formatting</div>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handlePublish} disabled={publishing} className="gap-2 cursor-pointer">
                            <Rocket className="h-4 w-4" />
                            <div>
                                <div className="font-medium">{publishing ? "Publishing…" : "Publish to Website"}</div>
                                <div className="text-xs text-muted-foreground">Push to your CMS via webhook</div>
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* ── Transform ── */}
                <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating} className="gap-1.5">
                    <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} /> {regenerating ? "Regenerating…" : "Regenerate"}
                </Button>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={shortening || !displayArticle.html}
                            className={cn("gap-1.5", shortened && "text-success border-success")}>
                            <Scissors className={cn("h-3.5 w-3.5", shortening && "animate-pulse")} />
                            {shortening ? "Shortening…" : shortened ? (
                                shortenInfo && shortenInfo.original === shortenInfo.shortened
                                    ? `Already short (${shortenInfo.original} words)`
                                    : `Shortened! ${shortenInfo ? `${shortenInfo.original} → ${shortenInfo.shortened}` : ""}`
                            ) : "Shorten"}
                            {!shortening && !shortened && <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[200px]">
                        <DropdownMenuLabel>Target Length</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleShorten(500)} className="gap-2 cursor-pointer">
                            <Scissors className="h-4 w-4" />
                            <div>
                                <div className="font-medium">~500 words</div>
                                <div className="text-xs text-muted-foreground">Quick summary</div>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShorten(1000)} className="gap-2 cursor-pointer">
                            <Scissors className="h-4 w-4" />
                            <div>
                                <div className="font-medium">~1,000 words</div>
                                <div className="text-xs text-muted-foreground">Short read</div>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShorten(1500)} className="gap-2 cursor-pointer">
                            <Scissors className="h-4 w-4" />
                            <div>
                                <div className="font-medium">~1,500 words</div>
                                <div className="text-xs text-muted-foreground">Medium length</div>
                            </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleShorten(2000)} className="gap-2 cursor-pointer">
                            <Scissors className="h-4 w-4" />
                            <div>
                                <div className="font-medium">~2,000 words</div>
                                <div className="text-xs text-muted-foreground">Light trim</div>
                            </div>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                {/* Image button hidden per request — image insertion still available in Edit mode */}

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* ── Quality (grouped dropdown) ── */}
                {(() => {
                    const anyRunning = checkingSimilarity || consulChecking || comparing || ratingLoading;
                    const checksRun = (similarResults !== null ? 1 : 0) + (consulResult ? 1 : 0) + (compareResult ? 1 : 0) + (ratingResult ? 1 : 0);
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className={cn("gap-1.5", checksRun > 0 && "border-primary/50")}>
                                    {anyRunning ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                                    {anyRunning ? "Running…" : checksRun > 0 ? `Quality (${checksRun})` : "Quality"}
                                    <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[240px]">
                                <DropdownMenuLabel>Quality Checks</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={checkSimilarity} disabled={checkingSimilarity || !article.company_id} className="gap-2 cursor-pointer">
                                    {checkingSimilarity ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    <div>
                                        <div className="font-medium">Similarity</div>
                                        <div className="text-xs text-muted-foreground">
                                            {checkingSimilarity ? "Checking…" : similarResults !== null ? (similarResults.length === 0 ? "✓ No overlap found" : `⚠ ${similarResults.length} similar article${similarResults.length !== 1 ? "s" : ""}`) : "Check for content overlap"}
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleConsulCheck} disabled={consulChecking || !displayArticle.html} className="gap-2 cursor-pointer">
                                    {consulChecking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
                                    <div>
                                        <div className="font-medium">Fact-Check Consul</div>
                                        <div className="text-xs text-muted-foreground">
                                            {consulChecking ? "Consulting models…" : consulResult ? `✓ ${consulResult.overall_verdict === "pass" ? "Passed" : consulResult.overall_verdict === "needs_review" ? "Needs review" : "Failed"} · ${consulResult.claims.length} claims` : "Multi-model fact verification"}
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => { setShowCompareModal(true); setCompareUrl(""); setCompareErr(null); }} disabled={comparing || !displayArticle.html} className="gap-2 cursor-pointer">
                                    {comparing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowLeftRight className="h-4 w-4" />}
                                    <div>
                                        <div className="font-medium">Compare</div>
                                        <div className="text-xs text-muted-foreground">
                                            {comparing ? "Comparing…" : compareResult ? "✓ Comparison complete" : "Compare against a competitor URL"}
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleRateQuality} disabled={ratingLoading || !displayArticle.html} className="gap-2 cursor-pointer">
                                    {ratingLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
                                    <div>
                                        <div className="font-medium">Rate Quality</div>
                                        <div className="text-xs text-muted-foreground">
                                            {ratingLoading ? "Rating…" : ratingResult ? `✓ Score: ${ratingResult.overall_score}/100` : "AI content quality scoring"}
                                        </div>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                })()}

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* ── Danger ── */}
                {confirmDelete ? (
                    <div className="flex gap-1.5">
                        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                            {deleting ? "…" : "Confirm"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                    </div>
                ) : (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="text-destructive hover:text-destructive gap-1.5">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                )}
            </div>

            {regenErr && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Regeneration failed: {regenErr}</AlertDescription>
                </Alert>
            )}

            {shortenErr && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Shortening failed: {shortenErr}</AlertDescription>
                </Alert>
            )}

            {/* Similarity Results (inline) */}
            {simErr && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Similarity check failed: {simErr}</AlertDescription>
                </Alert>
            )}
            {similarResults !== null && similarResults.length > 0 && (
                <div className="space-y-1.5">
                    <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Search className="h-3 w-3" /> {similarResults.length} similar article{similarResults.length !== 1 ? "s" : ""} found
                    </h4>
                    {similarResults.map((r) => {
                        const pct = Math.round(r.similarity * 100);
                        return (
                            <button key={r.id} onClick={() => onSelectArticle(r.id)}
                                className="flex items-center gap-2 w-full p-2 rounded-md border border-border bg-background hover:bg-accent text-left text-xs transition-colors">
                                <Badge variant={pct >= 92 ? "destructive" : "secondary"} className="text-[11px] font-bold shrink-0">
                                    {pct}%
                                </Badge>
                                <span className="truncate">{r.title}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Fact-Check Consul */}
            {consulErr && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Consul check failed: {consulErr}</AlertDescription>
                </Alert>
            )}
            {consulResult && (() => {
                const VERDICT_COLORS: Record<string, string> = {
                    pass: "#22c55e", needs_review: "#f59e0b", fail: "#ef4444",
                    accurate: "#22c55e", unverifiable: "#a3a3a3", misleading: "#f59e0b", inaccurate: "#ef4444",
                    disputed: "#8b5cf6",
                };
                const AGREEMENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
                    full: { label: "Full Agreement", icon: "✓", color: "#22c55e" },
                    majority: { label: "Majority Agreement", icon: "⅔", color: "#22c55e" },
                    partial: { label: "Partial Agreement", icon: "~", color: "#f59e0b" },
                    split: { label: "Models Disagree", icon: "✗", color: "#ef4444" },
                    single_source: { label: "Single Source", icon: "1", color: "#a3a3a3" },
                };
                const flaggedCount = consulResult.claims.filter(c => c.consensus_verdict !== "accurate").length;
                return (
                    <Collapsible open={!consulCollapsed} onOpenChange={(open) => setConsulCollapsed(!open)}>
                    <Card className="border-primary/20">
                        <CollapsibleTrigger asChild>
                        <button className="w-full p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Scale className="h-4 w-4 text-primary" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Fact-Check Consul</span>
                                <Badge style={{ backgroundColor: VERDICT_COLORS[consulResult.overall_verdict] }} className="text-white ml-1">
                                    {consulResult.overall_verdict === "pass" ? "✓ Pass" : consulResult.overall_verdict === "needs_review" ? "⚠ Needs Review" : "✗ Fail"}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{Math.round(consulResult.overall_confidence * 100)}%</span>
                                {consulCollapsed && flaggedCount > 0 && (
                                    <span className="text-[11px] text-muted-foreground">· {flaggedCount} flagged</span>
                                )}
                                {consulCollapsed && (
                                    <span className="text-[11px] text-muted-foreground">· {consulResult.claims.length} claims</span>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className={cn("h-2 w-2 rounded-full", consulResult.models_used.gemini.status === "success" ? "bg-green-500" : "bg-red-500")} />
                                    <span className={cn("h-2 w-2 rounded-full", consulResult.models_used.grok.status === "success" ? "bg-green-500" : "bg-red-500")} />
                                    <span className={cn("h-2 w-2 rounded-full", consulResult.models_used.claude.status === "success" ? "bg-green-500" : "bg-red-500")} />
                                </div>
                                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", consulCollapsed && "-rotate-90")} />
                            </div>
                        </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                        <CardContent className="p-4 pt-0 space-y-4">
                            {/* Model status detail */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <span className={cn("h-2 w-2 rounded-full", consulResult.models_used.gemini.status === "success" ? "bg-green-500" : "bg-red-500")} />
                                    <span className="text-[11px] text-muted-foreground">Gemini</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={cn("h-2 w-2 rounded-full", consulResult.models_used.grok.status === "success" ? "bg-green-500" : "bg-red-500")} />
                                    <span className="text-[11px] text-muted-foreground">Grok</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className={cn("h-2 w-2 rounded-full", consulResult.models_used.claude.status === "success" ? "bg-green-500" : "bg-red-500")} />
                                    <span className="text-[11px] text-muted-foreground">Claude</span>
                                </div>
                            </div>

                            {consulResult.summary && <p className="text-sm leading-relaxed">{consulResult.summary}</p>}

                            {/* Batch rewrite controls */}
                            {(() => {
                                const rewritable = getRewritableClaims();
                                if (rewritable.length === 0) return null;
                                return (
                                    <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/50 border border-dashed border-border">
                                        <Wand2 className="h-3.5 w-3.5 text-primary shrink-0" />
                                        <span className="text-xs text-muted-foreground flex-1">
                                            {rewriteQueue.size > 0
                                                ? <><strong>{rewriteQueue.size}</strong> rewrite{rewriteQueue.size !== 1 ? "s" : ""} queued</>
                                                : <>{rewritable.length} correction{rewritable.length !== 1 ? "s" : ""} available</>}
                                        </span>
                                        {rewriteQueue.size === 0 ? (
                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={queueAllRewrites}>
                                                <ListChecks className="h-3 w-3" /> Queue All
                                            </Button>
                                        ) : (
                                            <div className="flex items-center gap-1.5">
                                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRewriteQueue(new Set())} disabled={applyingBatch}>Clear</Button>
                                                <Button variant="default" size="sm" className="h-7 text-xs gap-1.5" onClick={handleApplyBatchRewrites} disabled={applyingBatch}>
                                                    {applyingBatch ? <><RefreshCw className="h-3 w-3 animate-spin" /> Applying {rewriteQueue.size}…</> : <><Wand2 className="h-3 w-3" /> Apply {rewriteQueue.size} Rewrite{rewriteQueue.size !== 1 ? "s" : ""}</>}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            <h4 className="text-sm font-medium">Claims Reviewed ({consulResult.claims.length})</h4>

                            {consulResult.claims.map((claim, i) => {
                                const agr = AGREEMENT_LABELS[claim.agreement] ?? AGREEMENT_LABELS.single_source;
                                const isExp = expandedClaims.has(i);
                                return (
                                    <div key={i} className="p-3 rounded-md border" style={{ borderColor: `${VERDICT_COLORS[claim.consensus_verdict]}33`, backgroundColor: `${VERDICT_COLORS[claim.consensus_verdict]}08` }}>
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

                                        {(claim.gemini_explanation || claim.grok_explanation || claim.claude_explanation) && claim.agreement !== "full" && (
                                            <div className="mt-2">
                                                <button onClick={() => toggleConsulClaim(i)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                                                    {isExp ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                    {isExp ? "Hide" : "Show"} individual model reasoning
                                                </button>
                                                {isExp && (
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
                                                        {claim.claude_explanation && (
                                                            <div className="p-2 rounded border border-border bg-card">
                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                    <span className="h-2 w-2 rounded-full bg-amber-600" />
                                                                    <span className="text-[11px] font-semibold">Claude</span>
                                                                    {claim.claude_verdict && (
                                                                        <Badge className="text-[9px] uppercase ml-1" style={{ color: VERDICT_COLORS[claim.claude_verdict], backgroundColor: `${VERDICT_COLORS[claim.claude_verdict]}18` }}>
                                                                            {claim.claude_verdict}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-muted-foreground">{claim.claude_explanation}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {claim.sources.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {claim.sources.map((src, si) => (
                                                    <a key={si} href={src.url} target="_blank" rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline px-1.5 py-0.5 rounded bg-primary/5 border border-primary/10">
                                                        <ExternalLink className="h-2.5 w-2.5" />
                                                        {src.title ? src.title.slice(0, 40) : (() => { try { return new URL(src.url).hostname; } catch { return src.url.slice(0, 30); } })()}
                                                        <span className="text-muted-foreground">({src.from})</span>
                                                    </a>
                                                ))}
                                            </div>
                                        )}

                                        {claim.suggested_rewrite && (
                                            <div className="mt-2 p-2 bg-card border border-dashed border-border rounded-md">
                                                <p className="text-sm">✏️ <strong>Suggested rewrite:</strong> {claim.suggested_rewrite}</p>
                                                <div className="flex items-center gap-2 mt-2">
                                                    {!appliedRewrites.has(i) && !applyingBatch && (
                                                        <Button variant={rewriteQueue.has(i) ? "secondary" : "ghost"} size="sm" className={cn("gap-1.5 text-xs h-7", rewriteQueue.has(i) && "border border-primary/30 text-primary")}
                                                            disabled={applyingRewrite === i || applyingBatch}
                                                            onClick={() => toggleRewriteQueue(i)}>
                                                            {rewriteQueue.has(i) ? <><CheckCircle2 className="h-3 w-3" /> Queued</> : <><ListChecks className="h-3 w-3" /> Add to Queue</>}
                                                        </Button>
                                                    )}
                                                    <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-7", appliedRewrites.has(i) && "border-success text-success")}
                                                        disabled={applyingRewrite === i || appliedRewrites.has(i) || applyingBatch}
                                                        onClick={() => handleApplyRewrite(i)}>
                                                        {applyingRewrite === i ? <><RefreshCw className="h-3 w-3 animate-spin" /> Applying…</> : applyingBatch && rewriteQueue.has(i) ? <><RefreshCw className="h-3 w-3 animate-spin" /> In Batch…</> : appliedRewrites.has(i) ? <><CheckCircle2 className="h-3 w-3" /> Applied</> : <><Wand2 className="h-3 w-3" /> Apply Now</>}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                        </CollapsibleContent>
                    </Card>
                    </Collapsible>
                );
            })()}

            {/* Quality Rating Results */}
            {ratingErr && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Quality rating failed: {ratingErr}</AlertDescription>
                </Alert>
            )}
            {ratingResult && (() => {
                const VERDICT_MAP: Record<string, { bg: string; text: string; label: string }> = {
                    not_competitive: { bg: "#ef4444", text: "#fff", label: "Not Competitive" },
                    competitive: { bg: "#f59e0b", text: "#fff", label: "Competitive" },
                    highly_competitive: { bg: "#22c55e", text: "#fff", label: "Highly Competitive" },
                    category_defining: { bg: "#8b5cf6", text: "#fff", label: "Category-Defining" },
                };
                const verdict = VERDICT_MAP[ratingResult.final_verdict] ?? VERDICT_MAP.competitive;
                const scoreColor = (s: number) => s >= 8 ? "#22c55e" : s >= 5 ? "#f59e0b" : "#ef4444";
                const overallColor = scoreColor(ratingResult.overall_score);
                const scores = [
                    { label: "SEO", value: ratingResult.seo_score, icon: <Target className="h-3 w-3" /> },
                    { label: "GEO / AEO", value: ratingResult.geo_aeo_score, icon: <Brain className="h-3 w-3" /> },
                    { label: "Editorial", value: ratingResult.editorial_quality_score, icon: <Sparkles className="h-3 w-3" /> },
                    { label: "Info Gain", value: ratingResult.information_gain_score, icon: <Lightbulb className="h-3 w-3" /> },
                    { label: "Trust", value: ratingResult.trustworthiness_score, icon: <Shield className="h-3 w-3" /> },
                ];
                return (
                    <Collapsible open={!ratingCollapsed} onOpenChange={(open) => setRatingCollapsed(!open)}>
                    <Card className="border-amber-500/20">
                        <CollapsibleTrigger asChild>
                        <button className="w-full p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Star className="h-4 w-4 text-amber-500" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Quality Rating</span>
                                <Badge style={{ backgroundColor: overallColor }} className="text-white ml-1 text-sm font-bold px-2">
                                    {ratingResult.overall_score}/10
                                </Badge>
                                <Badge style={{ backgroundColor: verdict.bg, color: verdict.text }} className="ml-0.5">
                                    {verdict.label}
                                </Badge>
                                {ratingCollapsed && (
                                    <span className="text-[11px] text-muted-foreground">· {ratingResult.top_weaknesses.length} weaknesses · {ratingResult.highest_leverage_improvements.length} improvements</span>
                                )}
                            </div>
                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", ratingCollapsed && "-rotate-90")} />
                        </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                        <CardContent className="p-4 pt-0 space-y-5">
                            {/* Executive Summary */}
                            <p className="text-sm leading-relaxed">{ratingResult.executive_summary}</p>

                            {/* Score Gauges */}
                            <div className="space-y-2.5">
                                <h4 className="text-sm font-medium flex items-center gap-1.5"><Award className="h-3.5 w-3.5 text-amber-500" /> Dimension Scores</h4>
                                {scores.map((s, i) => {
                                    const pct = (s.value / 10) * 100;
                                    const color = scoreColor(s.value);
                                    return (
                                        <div key={i}>
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-xs font-medium flex items-center gap-1.5">{s.icon} {s.label}</span>
                                                <span className="text-xs font-bold" style={{ color }}>{s.value}/10</span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Top Weaknesses */}
                            {ratingResult.top_weaknesses.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-sm font-medium flex items-center gap-1.5 text-red-500">
                                            <AlertCircle className="h-3.5 w-3.5" /> Top Weaknesses
                                        </h4>
                                        {(() => {
                                            const remaining = ratingResult.top_weaknesses.filter((_, i) => !improvedWeaknesses.has(i)).length;
                                            const allDone = remaining === 0;
                                            return remaining > 0 || allDone ? (
                                                <Button
                                                    variant={allDone ? "ghost" : "outline"}
                                                    size="sm"
                                                    className={cn("h-6 text-[11px] gap-1 px-2", allDone && "text-success")}
                                                    disabled={improvingWeakness !== null || allDone}
                                                    onClick={handleImproveAll}
                                                >
                                                    {improvingWeakness !== null ? <><RefreshCw className="h-2.5 w-2.5 animate-spin" /> Improving {improvedWeaknesses.size + 1}/{ratingResult.top_weaknesses.length}…</> : allDone ? <><CheckCircle2 className="h-2.5 w-2.5" /> All Improved</> : <><Wand2 className="h-2.5 w-2.5" /> Improve All ({remaining})</>}
                                                </Button>
                                            ) : null;
                                        })()}
                                    </div>
                                    <ul className="space-y-2">
                                        {ratingResult.top_weaknesses.map((w, i) => (
                                            <li key={i} className={cn("text-xs p-2.5 rounded-md border transition-colors", improvedWeaknesses.has(i) ? "border-success/30 bg-success/5" : "border-red-500/15 bg-red-500/5")}>
                                                <div className="flex gap-2">
                                                    {improvedWeaknesses.has(i)
                                                        ? <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />
                                                        : <AlertCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
                                                    }
                                                    <span className={cn("text-muted-foreground flex-1", improvedWeaknesses.has(i) && "line-through opacity-60")}>
                                                        {typeof w === "string" ? w : JSON.stringify(w)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-2 ml-5">
                                                    <Button
                                                        variant={improvedWeaknesses.has(i) ? "ghost" : "outline"}
                                                        size="sm"
                                                        className={cn("h-6 text-[11px] gap-1 px-2", improvedWeaknesses.has(i) && "text-success")}
                                                        disabled={improvingWeakness !== null || improvedWeaknesses.has(i)}
                                                        onClick={() => handleImproveWeakness(i)}
                                                    >
                                                        {improvingWeakness === i ? <><RefreshCw className="h-2.5 w-2.5 animate-spin" /> Improving…</> : improvedWeaknesses.has(i) ? <><CheckCircle2 className="h-2.5 w-2.5" /> Improved</> : <><Wand2 className="h-2.5 w-2.5" /> Improve</>}
                                                    </Button>
                                                    {article.company_id && (
                                                        <Button
                                                            variant={savedRules.has(i) ? "ghost" : "ghost"}
                                                            size="sm"
                                                            className={cn("h-6 text-[11px] gap-1 px-2", savedRules.has(i) ? "text-success" : "text-muted-foreground hover:text-foreground")}
                                                            disabled={savingRule !== null || savedRules.has(i)}
                                                            onClick={() => handleSaveQualityRule(i)}
                                                        >
                                                            {savingRule === i ? <><RefreshCw className="h-2.5 w-2.5 animate-spin" /> Saving…</> : savedRules.has(i) ? <><CheckCircle2 className="h-2.5 w-2.5" /> Saved to Prompts</> : <><BookOpen className="h-2.5 w-2.5" /> Add to Future Prompts</>}
                                                        </Button>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Highest Leverage Improvements */}
                            {ratingResult.highest_leverage_improvements.length > 0 && (
                                <div className="p-3 rounded-md border border-dashed border-amber-500/20 bg-amber-500/5">
                                    <h4 className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1.5">
                                        <TrendingUp className="h-3.5 w-3.5" /> Highest Leverage Improvements
                                    </h4>
                                    <ol className="space-y-1.5">
                                        {ratingResult.highest_leverage_improvements.map((imp, i) => (
                                            <li key={i} className="text-xs text-foreground flex gap-2">
                                                <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>
                                                {typeof imp === "string" ? imp : JSON.stringify(imp)}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}

                            {/* Rewrite Recommendations */}
                            {ratingResult.rewrite_recommendations.length > 0 && (
                                <details className="group">
                                    <summary className="cursor-pointer text-xs font-medium flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors">
                                        <Wand2 className="h-3 w-3" /> Rewrite Recommendations ({ratingResult.rewrite_recommendations.length})
                                    </summary>
                                    <ul className="mt-2 space-y-2">
                                        {ratingResult.rewrite_recommendations.map((r, i) => (
                                            <li key={i} className="text-xs text-muted-foreground p-2 rounded-md bg-muted/50 border border-border">
                                                {typeof r === "string" ? r : typeof r === "object" && r !== null && "before" in r && "after" in r ? (<><strong>Before:</strong> {(r as any).before}<br /><strong>After:</strong> {(r as any).after}</>) : JSON.stringify(r)}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}

                            {/* Missing Content Opportunities */}
                            {ratingResult.missing_content_opportunities.length > 0 && (
                                <details className="group">
                                    <summary className="cursor-pointer text-xs font-medium flex items-center gap-1.5 text-blue-500 hover:text-blue-400 transition-colors">
                                        <Lightbulb className="h-3 w-3" /> Missing Content ({ratingResult.missing_content_opportunities.length})
                                    </summary>
                                    <ul className="mt-2 space-y-1.5">
                                        {ratingResult.missing_content_opportunities.map((m, i) => (
                                            <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                                <span className="text-blue-400 shrink-0">+</span>{typeof m === "string" ? m : JSON.stringify(m)}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}

                            {/* Cluster Expansion Ideas */}
                            {ratingResult.cluster_expansion_ideas.length > 0 && (
                                <details className="group">
                                    <summary className="cursor-pointer text-xs font-medium flex items-center gap-1.5 text-purple-500 hover:text-purple-400 transition-colors">
                                        <Layers className="h-3 w-3" /> Cluster Expansion Ideas ({ratingResult.cluster_expansion_ideas.length})
                                    </summary>
                                    <ul className="mt-2 space-y-1.5">
                                        {ratingResult.cluster_expansion_ideas.map((c, i) => (
                                            <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                                <span className="text-purple-400 shrink-0">→</span>{typeof c === "string" ? c : JSON.stringify(c)}
                                            </li>
                                        ))}
                                    </ul>
                                </details>
                            )}

                            {/* AI Detection Risks */}
                            {ratingResult.ai_detection_risks.length > 0 && (
                                <div className="p-3 rounded-md border border-orange-500/20 bg-orange-500/5">
                                    <h4 className="text-xs font-semibold text-orange-500 mb-2 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5" /> AI-Detection Risks
                                    </h4>
                                    <ul className="space-y-1.5">
                                        {ratingResult.ai_detection_risks.map((r, i) => (
                                            <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                                <AlertTriangle className="h-3 w-3 text-orange-400 shrink-0 mt-0.5" />{typeof r === "string" ? r : JSON.stringify(r)}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </CardContent>
                        </CollapsibleContent>
                    </Card>
                    </Collapsible>
                );
            })()}

            {/* Compare Article Results */}
            {compareErr && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>Compare failed: {compareErr}</AlertDescription>
                </Alert>
            )}
            {compareResult && (() => {
                const WINNER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
                    organic: { bg: "#22c55e", text: "#fff", label: "✓ Your Article Wins" },
                    competitor: { bg: "#ef4444", text: "#fff", label: "✗ Competitor Wins" },
                    tie: { bg: "#f59e0b", text: "#fff", label: "~ Tie" },
                };
                const winner = WINNER_COLORS[compareResult.overall_winner] ?? WINNER_COLORS.tie;
                const totalOrganic = compareResult.categories.reduce((s, c) => s + c.organic_score, 0);
                const totalCompetitor = compareResult.categories.reduce((s, c) => s + c.competitor_score, 0);
                return (
                    <Collapsible open={!compareCollapsed} onOpenChange={(open) => setCompareCollapsed(!open)}>
                    <Card className="border-primary/20">
                        <CollapsibleTrigger asChild>
                        <button className="w-full p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
                            <div className="flex items-center gap-2 flex-wrap">
                                <ArrowLeftRight className="h-4 w-4 text-primary" />
                                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Content Comparison</span>
                                <Badge style={{ backgroundColor: winner.bg, color: winner.text }} className="ml-1">
                                    {winner.label}
                                </Badge>
                                {compareCollapsed && (
                                    <span className="text-[11px] text-muted-foreground">· {totalOrganic} vs {totalCompetitor}</span>
                                )}
                            </div>
                            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", compareCollapsed && "-rotate-90")} />
                        </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                        <CardContent className="p-4 pt-0 space-y-4">
                            {/* Word count detail */}
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                <span>Organic: {compareResult.organic_word_count.toLocaleString()} words</span>
                                <span>·</span>
                                <span>Competitor: {compareResult.competitor_word_count.toLocaleString()} words</span>
                            </div>

                            {/* Competitor link */}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium">vs.</span>
                                <span className="truncate flex-1 italic">&ldquo;{compareResult.competitor_title}&rdquo;</span>
                                <a href={compareUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline shrink-0">
                                    <ExternalLink className="h-3 w-3" /> View
                                </a>
                            </div>

                            <p className="text-sm leading-relaxed">{compareResult.overall_reasoning}</p>

                            {/* Category scores */}
                            <div>
                                <h4 className="text-sm font-medium mb-3">Category Scores <span className="text-muted-foreground font-normal">({totalOrganic} vs {totalCompetitor} total)</span></h4>
                                <div className="space-y-3">
                                    {compareResult.categories.map((cat, i) => {
                                        const orgPct = (cat.organic_score / 10) * 100;
                                        const compPct = (cat.competitor_score / 10) * 100;
                                        const orgWins = cat.organic_score > cat.competitor_score;
                                        const tied = cat.organic_score === cat.competitor_score;
                                        return (
                                            <div key={i}>
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-medium">{cat.category}</span>
                                                    <span className="text-[11px] text-muted-foreground">
                                                        <span className={cn(orgWins && "text-green-500 font-semibold", !orgWins && !tied && "text-muted-foreground")}>{cat.organic_score}</span>
                                                        <span className="mx-1">vs</span>
                                                        <span className={cn(!orgWins && !tied && "text-red-500 font-semibold", orgWins && "text-muted-foreground")}>{cat.competitor_score}</span>
                                                    </span>
                                                </div>
                                                <div className="flex gap-1 h-2">
                                                    <div className="flex-1 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${orgPct}%`, backgroundColor: orgWins ? "#22c55e" : tied ? "#f59e0b" : "#a3a3a3" }} />
                                                    </div>
                                                    <div className="flex-1 bg-muted rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all" style={{ width: `${compPct}%`, backgroundColor: !orgWins && !tied ? "#ef4444" : tied ? "#f59e0b" : "#a3a3a3" }} />
                                                    </div>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">{cat.explanation}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500 inline-block" /> Organic</span>
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Competitor</span>
                                </div>
                            </div>

                            {/* Strengths & Weaknesses */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <h5 className="text-xs font-semibold text-green-600 mb-1.5">Your Strengths</h5>
                                    <ul className="space-y-1">
                                        {compareResult.organic_strengths.map((s, i) => (
                                            <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-green-500 shrink-0 mt-0.5" />{s}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h5 className="text-xs font-semibold text-red-500 mb-1.5">Your Weaknesses</h5>
                                    <ul className="space-y-1">
                                        {compareResult.organic_weaknesses.map((w, i) => (
                                            <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><AlertCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />{w}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h5 className="text-xs font-semibold text-blue-500 mb-1.5">Competitor Strengths</h5>
                                    <ul className="space-y-1">
                                        {compareResult.competitor_strengths.map((s, i) => (
                                            <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><CheckCircle2 className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />{s}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h5 className="text-xs font-semibold text-amber-500 mb-1.5">Competitor Weaknesses</h5>
                                    <ul className="space-y-1">
                                        {compareResult.competitor_weaknesses.map((w, i) => (
                                            <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><AlertCircle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />{w}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* Improvement suggestions */}
                            {compareResult.improvement_suggestions.length > 0 && (
                                <div className="p-3 rounded-md border border-dashed border-primary/20 bg-primary/5">
                                    <h5 className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                                        <Wand2 className="h-3.5 w-3.5" /> Improvement Suggestions
                                    </h5>
                                    <ol className="space-y-1.5">
                                        {compareResult.improvement_suggestions.map((s, i) => (
                                            <li key={i} className="text-xs text-foreground flex gap-2">
                                                <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                                                {s}
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            )}
                        </CardContent>
                        </CollapsibleContent>
                    </Card>
                    </Collapsible>
                );
            })()}

            {/* SEO Data */}
            {seo && (
                <details className="group">
                    <summary className="cursor-pointer text-sm font-medium py-2 flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                        📊 SEO Data
                    </summary>
                    <Card className="mt-1">
                        <CardContent className="p-4 text-sm space-y-1.5">
                            {seo.primary_keyword && <div><strong className="text-muted-foreground">Primary:</strong> {seo.primary_keyword}</div>}
                            {seo.secondary_keywords && <div><strong className="text-muted-foreground">Secondary:</strong> {(seo.secondary_keywords as string[]).join(", ")}</div>}
                            {seo.meta_title && <div><strong className="text-muted-foreground">Meta Title:</strong> {seo.meta_title}</div>}
                            {seo.meta_description && <div><strong className="text-muted-foreground">Meta Desc:</strong> {seo.meta_description}</div>}
                        </CardContent>
                    </Card>
                </details>
            )}

            {/* Featured Image or Video */}
            {displayArticle.featured_video_url ? (
                <div id="featured-video" className="relative group">
                    <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", maxWidth: "100%", borderRadius: "12px" }}>
                        <iframe
                            src={displayArticle.featured_video_url}
                            title={article.title}
                            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0, borderRadius: "12px" }}
                            allow={displayArticle.featured_video_platform === "vimeo"
                                ? "autoplay; fullscreen; picture-in-picture"
                                : "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"}
                            allowFullScreen
                        />
                    </div>
                    <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="secondary" size="sm" onClick={() => { setShowInsertModal(true); setInsertMode("featured"); setInsertGenPrompt(""); setInsertPreview(null); setInsertErr(null); setInsertGenerating(false); setInsertTab("video"); }}
                            className="gap-1.5 shadow-lg backdrop-blur-sm">
                            <Video className="h-3.5 w-3.5" /> Change
                        </Button>
                        <Button variant="secondary" size="sm" onClick={removeFeaturedVideo}
                            className="gap-1.5 shadow-lg backdrop-blur-sm">
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                    </div>
                </div>
            ) : displayArticle.image_base64 ? (
                <div id="featured-image" className="relative group">
                    <img src={`data:image/png;base64,${displayArticle.image_base64}`} alt={article.title}
                        className="w-full rounded-xl" />
                    <Button variant="secondary" size="sm" onClick={() => { setShowInsertModal(true); setInsertMode("featured"); setInsertGenPrompt(""); setInsertPreview(null); setInsertErr(null); setInsertGenerating(false); setInsertTab("generate"); }}
                        className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity gap-1.5 shadow-lg backdrop-blur-sm">
                        <ImageIcon className="h-3.5 w-3.5" /> Change
                    </Button>
                </div>
            ) : null}



            {/* Article Content */}
            <div dangerouslySetInnerHTML={{ __html: displayArticle.html ?? "" }}
                className="prose prose-sm dark:prose-invert max-w-none leading-relaxed article-content" />

            {/* Image Prompt */}
            {article.image_prompt && (
                <details className="group">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">Image prompt</summary>
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground mt-1 p-3 bg-muted rounded-md">{article.image_prompt}</pre>
                </details>
            )}

            {insertImageModal}

            {/* Compare Modal */}
            <Dialog open={showCompareModal} onOpenChange={setShowCompareModal}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ArrowLeftRight className="h-5 w-5" />
                            Compare Against Competitor
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label className="text-xs">Competitor URL</Label>
                            <Input
                                placeholder="https://competitor.com/their-article"
                                value={compareUrl}
                                onChange={(e) => setCompareUrl(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && compareUrl.trim()) handleCompare(); }}
                                className="mt-1"
                                autoFocus
                            />
                            <p className="text-[11px] text-muted-foreground mt-1.5">
                                We&apos;ll scrape the content and run a head-to-head analysis across depth, readability, SEO, accuracy, originality, and structure.
                            </p>
                        </div>
                        <Button onClick={handleCompare} disabled={!compareUrl.trim() || comparing} className="w-full gap-1.5">
                            <ArrowLeftRight className="h-4 w-4" />
                            {comparing ? "Comparing…" : "Run Comparison"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>


        </>
    );
}
