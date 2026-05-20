// PanelView.tsx — Article detail pane for improving content
// Shows similarity analysis, SEO data, article content, and all action buttons

import { useState, useRef, useEffect } from "react";
import ArticleEditor, { type ArticleEditorHandle } from "@/components/articles/ArticleEditor";

import { useTaskRunner } from "@/hooks/useTaskRunner";
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
    X, Maximize2, Video, Play,
} from "lucide-react";
import type { ConsulResult, ConsulClaimReview } from "@/lib/consulPrompts";
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

    const [refreshingImage, setRefreshingImage] = useState(false);
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
    const [insertTab, setInsertTab] = useState<"search" | "generate" | "composite" | "upload">("search");
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

    // YouTube search & embed state
    const [showYouTubeModal, setShowYouTubeModal] = useState(false);
    const [ytQuery, setYtQuery] = useState("");
    const [ytResults, setYtResults] = useState<SearchVideo[]>([]);
    const [ytSearching, setYtSearching] = useState(false);
    const [ytErr, setYtErr] = useState<string | null>(null);



    const [fullArticle, setFullArticle] = useState<Article | null>(null);
    const [loadingFull, setLoadingFull] = useState(false);

    useEffect(() => {
        if (article.html !== null && article.html !== undefined) {
            setFullArticle(article);
            return;
        }
        setLoadingFull(true);
        fetch(`/api/articles/${article.id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data && !data.error) {
                    setFullArticle(data);
                    onUpdate({ ...article, ...data });
                }
            })
            .catch(() => {})
            .finally(() => setLoadingFull(false));
    }, [article.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        await runTask({
            type: "article",
            label: `Regenerate: ${article.title.slice(0, 40)}`,
            endpoint: "/api/create",
            body: {
                creation_prompt: article.title,
                image_style: article.image_style ?? "default",
                company_id: article.company_id ?? undefined,
            },
            meta: { articleId: article.id },
            onSuccess: async (data: any) => {
                try {
                    const saveResp = await fetch(`/api/articles/${article.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            html: data.html, excerpt: data.excerpt, image_base64: data.image_base64,
                            image_prompt: data.image_prompt, seo: data.seo, outline: data.outline, model_used: data.model_used,
                        }),
                    });
                    const saveData = await saveResp.json();
                    if (!saveResp.ok) throw new Error(saveData.error || "Failed to save");
                    onUpdate({ ...article, ...saveData });
                } catch (e: any) { setRegenErr(e.message); }
                setRegenerating(false);
            },
            onError: (errMsg) => { setRegenErr(errMsg); setRegenerating(false); },
        });
    }

    async function handleShorten() {
        if (!displayArticle.html) return;
        setShortening(true); setShortenErr(null); setShortened(false); setShortenInfo(null);
        try {
            const r = await fetch("/api/shorten", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    html: displayArticle.html,
                    title: article.title,
                    excerpt: article.excerpt || undefined,
                    company_id: article.company_id ?? undefined,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Shortening failed");

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
    }

    async function handleConsulCheck() {
        if (!displayArticle.html) return;
        setConsulChecking(true); setConsulErr(null); setConsulResult(null); setExpandedClaims(new Set()); setAppliedRewrites(new Set());
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

    function toggleConsulClaim(index: number) {
        setExpandedClaims((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    }

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
        } catch (e: any) { alert(`Rewrite failed: ${e.message}`); }
        finally { setApplyingRewrite(null); }
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
        setRefreshingImage(true); setRefreshErr(null);
        // Close the modal immediately — generation moves to activity viewer
        setShowInsertModal(false);
        // Use article title/excerpt as clean context — do NOT send old image_prompt
        // which contains baked-in style directives from previous generations
        const cleanBase = `Hero image for article: ${article.title}${article.excerpt ? `. ${article.excerpt}` : ""}`;
        const payload: Record<string, unknown> = {
            base_prompt: cleanBase,
            custom_prompt: imagePromptInput.trim() || undefined,
            image_style: selectedStyle,
            company_id: article.company_id ?? undefined,
        };
        // Add composite params if applicable
        if (pvIsCompositeStyle && pvCsProductUrl) {
            payload.composite_product_image_url = pvCsProductUrl;
            payload.article_title = article.title;
            payload.article_excerpt = article.excerpt;
            if (pvCsBgImageUrl.trim()) payload.composite_bg_image_url = pvCsBgImageUrl.trim();
            if (pvCsBgPrompt.trim()) payload.composite_bg_prompt = pvCsBgPrompt.trim();
        }
        await runTask({
            type: "image-regen",
            label: `Hero: ${article.title.slice(0, 50)}`,
            endpoint: "/api/regenerate-image",
            body: payload,
            meta: { articleId: article.id, companyId: article.company_id, imageTask: true },
            onSuccess: async (data: any) => {
                try {
                    const saveResp = await fetch(`/api/articles/${article.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ image_base64: data.image_base64, image_prompt: data.final_prompt, image_style: selectedStyle }),
                    });
                    const saveData = await saveResp.json();
                    if (!saveResp.ok) throw new Error(saveData.error || "Failed to save");
                    onUpdate({ ...article, image_base64: data.image_base64, image_prompt: data.final_prompt, image_style: selectedStyle });
                    setImagePromptInput("");
                } catch (e: any) { setRefreshErr(e.message); }
                setRefreshingImage(false);
            },
            onError: (errMsg) => { setRefreshErr(errMsg); setRefreshingImage(false); },
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

    function insertYouTubeVideo(vid: SearchVideo) {
        const videoId = extractYouTubeId(vid.link);
        if (!videoId || !editorRef.current) return;
        editorRef.current.insertYouTube(videoId, vid.title);
        setShowYouTubeModal(false);
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
        setShowInsertModal(false);
        await runTask({
            type: "image-regen",
            label: `Image: ${article.title.slice(0, 50)}`,
            endpoint: "/api/regenerate-image",
            body: { base_prompt: cleanBase, custom_prompt: customPrompt, image_style: selectedStyle, company_id: article.company_id ?? undefined },
            meta: { articleId: article.id, companyId: article.company_id, imageTask: true, insertMode: capturedInsertMode },
            onSuccess: async (data: any) => {
                setInsertPreview({ src: data.image_base64, type: "base64" });
                // If it was a featured image request, auto-save
                if (capturedInsertMode === "featured") {
                    try {
                        const r = await fetch(`/api/articles/${article.id}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ image_base64: data.image_base64 }),
                        });
                        const saveData = await r.json();
                        if (r.ok) onUpdate({ ...article, ...saveData });
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
                        <ImageIcon className="h-5 w-5" />
                        {insertMode === "featured" ? "Change Featured Image" : "Insert Image"}
                    </DialogTitle>
                </DialogHeader>

                <Tabs value={insertTab} onValueChange={(v) => { setInsertTab(v as any); setInsertPreview(null); setInsertErr(null); if (v === "composite") resetComposite(); }}>
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="search" className="gap-1.5"><Search className="h-3.5 w-3.5" />Search</TabsTrigger>
                        <TabsTrigger value="generate" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />Generate</TabsTrigger>
                        <TabsTrigger value="composite" className="gap-1.5"><Layers className="h-3.5 w-3.5" />Composite</TabsTrigger>
                        <TabsTrigger value="upload" className="gap-1.5"><Upload className="h-3.5 w-3.5" />Upload</TabsTrigger>
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

    // ======= INSERT YOUTUBE MODAL =======
    const insertYouTubeModal = (
        <Dialog open={showYouTubeModal} onOpenChange={setShowYouTubeModal}>
            <DialogContent className="max-w-4xl w-[90vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-red-500" /> Insert YouTube Video
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Search bar */}
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
                            <p className="text-sm">Search for YouTube videos to embed in your article.</p>
                            <p className="text-xs mt-1">Videos will be embedded as responsive iframes at the cursor position.</p>
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
                                    setInsertMode("editInline"); setInsertPreview(null); setInsertErr(null); setShowInsertModal(true);
                                }}
                                onYouTubeButtonClick={() => {
                                    setYtResults([]); setYtErr(null); setShowYouTubeModal(true);
                                }}
                                className="fullscreen-editor"
                            />
                        </div>
                    </div>
                </div>
            </div>
            {insertImageModal}
            {insertYouTubeModal}
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
                {/* ── Content ── */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("gap-1.5", copied && "text-success border-success")}>
                            {copied ? <><CheckCircle2 className="h-3.5 w-3.5" /> {copied === "rich" ? "Copied for CMS" : "Copied"}</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
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
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={handlePublish} disabled={publishing} className={cn("gap-1.5", published && "text-success border-success")}>
                    {publishing ? "Publishing…" : published ? <><CheckCircle2 className="h-3.5 w-3.5" /> Published!</> : <><Rocket className="h-3.5 w-3.5" /> Publish</>}
                </Button>
                <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* ── Transform ── */}
                <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={regenerating} className="gap-1.5">
                    <RefreshCw className={cn("h-3.5 w-3.5", regenerating && "animate-spin")} /> {regenerating ? "Regenerating…" : "Regenerate"}
                </Button>
                <Button variant="outline" size="sm" onClick={handleShorten} disabled={shortening || !displayArticle.html}
                    className={cn("gap-1.5", shortened && "text-success border-success")}>
                    <Scissors className={cn("h-3.5 w-3.5", shortening && "animate-pulse")} />
                    {shortening ? "Shortening…" : shortened ? (
                        shortenInfo && shortenInfo.original === shortenInfo.shortened
                            ? `Already <2k (${shortenInfo.original} words)`
                            : `Shortened! ${shortenInfo ? `${shortenInfo.original} → ${shortenInfo.shortened}` : ""}`
                    ) : "Shorten"}
                </Button>
                {/* Image button hidden per request — image insertion still available in Edit mode */}

                <Separator orientation="vertical" className="h-6 mx-1" />

                {/* ── Quality ── */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" onClick={checkSimilarity} disabled={checkingSimilarity || !article.company_id}
                                className={cn("gap-1.5", similarResults !== null && similarResults.length === 0 && "text-success border-success", similarResults !== null && similarResults.length > 0 && "text-amber-500 border-amber-500")}>
                                {checkingSimilarity ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking…</> : similarResults !== null ? <><Search className="h-3.5 w-3.5" /> {similarResults.length === 0 ? "No Overlap" : `${similarResults.length} Similar`}</> : <><Search className="h-3.5 w-3.5" /> Similarity</>}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            Checks for content overlap with other articles in this brand to prevent keyword cannibalization
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <Button variant="outline" size="sm" onClick={handleConsulCheck} disabled={consulChecking || !displayArticle.html}
                    className="gap-1.5 border-primary/30">
                    {consulChecking ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Consulting…</> : consulResult ? <><Scale className="h-3.5 w-3.5" /> Re-check</> : <><Scale className="h-3.5 w-3.5" /> Fact-Check Consul</>}
                </Button>

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
                    partial: { label: "Partial Agreement", icon: "~", color: "#f59e0b" },
                    split: { label: "Models Disagree", icon: "✗", color: "#ef4444" },
                    single_source: { label: "Single Source", icon: "1", color: "#a3a3a3" },
                };
                return (
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

                                        {(claim.gemini_explanation || claim.grok_explanation) && claim.agreement !== "full" && (
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
                                                <Button variant="outline" size="sm" className={cn("mt-2 gap-1.5 text-xs h-7", appliedRewrites.has(i) && "border-success text-success")}
                                                    disabled={applyingRewrite === i || appliedRewrites.has(i)}
                                                    onClick={() => handleApplyRewrite(i)}>
                                                    {applyingRewrite === i ? <><RefreshCw className="h-3 w-3 animate-spin" /> Applying…</> : appliedRewrites.has(i) ? <><CheckCircle2 className="h-3 w-3" /> Applied</> : <><Wand2 className="h-3 w-3" /> Apply Rewrite</>}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
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

            {/* Featured Image */}
            {displayArticle.image_base64 && (
                <div id="featured-image" className="relative group">
                    <img src={`data:image/png;base64,${displayArticle.image_base64}`} alt={article.title}
                        className="w-full rounded-xl" />
                    <Button variant="secondary" size="sm" onClick={() => { setShowInsertModal(true); setInsertMode("featured"); setInsertGenPrompt(""); setInsertPreview(null); setInsertErr(null); setInsertTab("generate"); }}
                        className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity gap-1.5 shadow-lg backdrop-blur-sm">
                        <ImageIcon className="h-3.5 w-3.5" /> Change
                    </Button>
                </div>
            )}



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
        </div>


        </>
    );
}
