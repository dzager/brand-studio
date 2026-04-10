// PanelView.tsx — Article detail pane for improving content
// Shows similarity analysis, SEO data, article content, and all action buttons

import { useState, useRef, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
    Copy, Rocket, Pencil, RefreshCw, ImageIcon, Trash2,
    Search, Sparkles, Upload, AlertCircle, CheckCircle2,
    Crown, BookOpen, Scroll, Eye, Code, Layers, ArrowLeft,
    ChevronDown, FileText, ClipboardCopy, Scissors,
    Scale, ExternalLink, ShieldCheck, Wand2, ChevronRight,
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
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editExcerpt, setEditExcerpt] = useState("");
    const [editHtml, setEditHtml] = useState("");
    const [editViewMode, setEditViewMode] = useState<"visual" | "html">("visual");
    const [saving, setSaving] = useState(false);
    const contentEditableRef = useRef<HTMLDivElement>(null);

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

    const [refreshingImage, setRefreshingImage] = useState(false);
    const [imagePromptInput, setImagePromptInput] = useState("");
    const [imageStyles, setImageStyles] = useState<{ id: string; label: string; narrative?: string }[]>([]);
    const [selectedStyle, setSelectedStyle] = useState(article.image_style ?? "default");
    const [refreshErr, setRefreshErr] = useState<string | null>(null);

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
    const savedRangeRef = useRef<Range | null>(null);

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
        setEditViewMode("visual");
    }

    function syncFromContentEditable() {
        if (contentEditableRef.current) setEditHtml(contentEditableRef.current.innerHTML);
    }

    function execFormat(command: string, value?: string) {
        document.execCommand(command, false, value);
        contentEditableRef.current?.focus();
        syncFromContentEditable();
    }

    async function saveEdit() {
        if (editViewMode === "visual") syncFromContentEditable();
        setSaving(true);
        try {
            const htmlToSave = editViewMode === "visual" && contentEditableRef.current
                ? contentEditableRef.current.innerHTML : editHtml;
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
            `<div style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;max-width:720px;margin:0 auto;color:#1a1a1a;line-height:1.6">`,
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
            const r = await fetch("/api/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    creation_prompt: article.title,
                    image_style: article.image_style ?? "default",
                    company_id: article.company_id ?? undefined,
                }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Regeneration failed");
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
        finally { setRegenerating(false); }
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
        setConsulChecking(true); setConsulErr(null); setConsulResult(null); setExpandedClaims(new Set());
        try {
            const r = await fetch("/api/fact-check-consul", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: article.title, excerpt: article.excerpt, html: displayArticle.html }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Consul check failed");
            setConsulResult(data);
        } catch (e: any) { setConsulErr(e.message); }
        finally { setConsulChecking(false); }
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
        } catch (e: any) { alert(`Rewrite failed: ${e.message}`); }
        finally { setApplyingRewrite(null); }
    }

    async function refreshImage() {
        if (!article.image_prompt) return;
        setRefreshingImage(true); setRefreshErr(null);
        try {
            const r = await fetch("/api/regenerate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ base_prompt: article.image_prompt, custom_prompt: imagePromptInput.trim() || undefined, image_style: selectedStyle, company_id: article.company_id ?? undefined }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Regeneration failed");
            const saveResp = await fetch(`/api/articles/${article.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image_base64: data.image_base64, image_prompt: data.base_prompt || data.final_prompt, image_style: selectedStyle }),
            });
            const saveData = await saveResp.json();
            if (!saveResp.ok) throw new Error(saveData.error || "Failed to save");
            onUpdate({ ...article, image_base64: data.image_base64, image_prompt: data.base_prompt || data.final_prompt, image_style: selectedStyle });
            setImagePromptInput("");
        } catch (e: any) { setRefreshErr(e.message); }
        finally { setRefreshingImage(false); }
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
        const prompt = insertGenPrompt.trim() || article.image_prompt || `Editorial photo for: ${article.title}`;
        setInsertGenerating(true); setInsertErr(null); setInsertPreview(null);
        try {
            const r = await fetch("/api/regenerate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ base_prompt: prompt, image_style: selectedStyle, company_id: article.company_id ?? undefined }) });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Generation failed");
            setInsertPreview({ src: data.image_base64, type: "base64" });
        } catch (e: any) { setInsertErr(e.message); }
        finally { setInsertGenerating(false); }
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
            } else if (insertMode === "editInline" && contentEditableRef.current) {
                const imgSrc = insertPreview.type === "base64" ? `data:image/png;base64,${insertPreview.src}` : `/api/image-proxy?url=${encodeURIComponent(insertPreview.src)}`;
                const figureHtml = `<figure style="margin:24px 0;text-align:center"><img src="${imgSrc}" alt="" style="max-width:100%;border-radius:10px" /></figure>`;
                const sel = window.getSelection();
                if (savedRangeRef.current && sel) {
                    sel.removeAllRanges();
                    sel.addRange(savedRangeRef.current);
                    document.execCommand("insertHTML", false, figureHtml);
                } else {
                    contentEditableRef.current.innerHTML += "\n" + figureHtml;
                }
                syncFromContentEditable();
                savedRangeRef.current = null;
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
                                <Label className="text-xs">Image Style</Label>
                                <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)}
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    {imageStyles.map((s) => (
                                        <option key={s.id} value={s.id}>{s.label}{s.narrative ? ` — ${s.narrative.slice(0, 60)}…` : ""}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Input placeholder={article.image_prompt ? "Leave empty to use original prompt…" : "Describe the image…"} value={insertGenPrompt} onChange={(e) => setInsertGenPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onInsertGenerate(); }} />
                            <Button onClick={onInsertGenerate} disabled={insertGenerating}>
                                {insertGenerating ? "Generating…" : "Generate"}
                            </Button>
                        </div>
                        {!insertGenPrompt.trim() && article.image_prompt && (
                            <p className="text-xs text-muted-foreground">💡 Will use: <em>{article.image_prompt.slice(0, 120)}{article.image_prompt.length > 120 ? "…" : ""}</em></p>
                        )}
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
                                                <Label className="text-xs">Image Style</Label>
                                                <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)}
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
                        <Label className="text-xs mb-2 block">Preview</Label>
                        <img src={insertPreview.type === "base64" ? `data:image/png;base64,${insertPreview.src}` : insertPreview.src} alt="Preview"
                            className="w-full max-h-72 object-contain rounded-lg border border-border" />
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

    // ======= EDIT MODE =======
    if (editing) {
        return (
            <div className="p-5 space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Pencil className="h-4 w-4" /> Edit Article
                </h3>
                <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Excerpt</Label>
                    <Textarea value={editExcerpt} onChange={(e) => setEditExcerpt(e.target.value)} rows={2} />
                </div>
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                        <Label>Body</Label>
                        <div className="flex border border-border rounded-md overflow-hidden">
                            <button onClick={() => { if (editViewMode === "html") setEditViewMode("visual"); }}
                                className={cn("px-3 py-1 text-xs flex items-center gap-1", editViewMode === "visual" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                                <Eye className="h-3 w-3" /> Visual
                            </button>
                            <button onClick={() => { if (editViewMode === "visual") { syncFromContentEditable(); setEditViewMode("html"); } }}
                                className={cn("px-3 py-1 text-xs flex items-center gap-1", editViewMode === "html" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                                <Code className="h-3 w-3" /> HTML
                            </button>
                        </div>
                    </div>
                    {editViewMode === "visual" && (
                        <div className="flex gap-1 flex-wrap p-1.5 bg-muted border border-border border-b-0 rounded-t-md">
                            {[{ label: "B", cmd: "bold" }, { label: "I", cmd: "italic" }, { label: "H2", cmd: "formatBlock", value: "H2" }, { label: "H3", cmd: "formatBlock", value: "H3" }, { label: "P", cmd: "formatBlock", value: "P" }].map((btn) => (
                                <Button key={btn.label} variant="outline" size="sm" className="h-7 px-2.5 text-xs" onMouseDown={(e) => { e.preventDefault(); execFormat(btn.cmd, btn.value); }}>
                                    {btn.label}
                                </Button>
                            ))}
                            <Separator orientation="vertical" className="h-5 mx-0.5" />
                            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onMouseDown={(e) => { e.preventDefault(); const url = prompt("Enter URL:"); if (url) execFormat("createLink", url); }}>
                                🔗
                            </Button>
                            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onMouseDown={(e) => { e.preventDefault(); execFormat("insertUnorderedList"); }}>
                                • List
                            </Button>
                            <Separator orientation="vertical" className="h-5 mx-0.5" />
                            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onMouseDown={(e) => {
                                e.preventDefault();
                                const sel = window.getSelection();
                                if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                                setInsertMode("editInline"); setInsertPreview(null); setInsertErr(null); setShowInsertModal(true);
                            }}>
                                <ImageIcon className="h-3 w-3" />
                            </Button>
                        </div>
                    )}
                    {editViewMode === "visual" ? (
                        <div ref={contentEditableRef} contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: editHtml }} onBlur={syncFromContentEditable}
                            className="w-full min-h-[250px] p-3 text-sm leading-relaxed rounded-b-md border border-border bg-background outline-none overflow-y-auto max-h-[500px] prose prose-sm dark:prose-invert" />
                    ) : (
                        <Textarea value={editHtml} onChange={(e) => setEditHtml(e.target.value)} rows={14} className="font-mono text-xs" />
                    )}
                </div>
                <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                    <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
                </div>
                {insertImageModal}
            </div>
        );
    }

    // ======= READ MODE =======
    return (
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

            {/* Actions */}
            <div className="flex gap-2 flex-wrap pb-4 border-b border-border">
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
                <Button variant="outline" size="sm" onClick={() => { setShowInsertModal(true); setInsertMode("inline"); }} className="gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" /> Image
                </Button>
                <Button variant="outline" size="sm" onClick={handleConsulCheck} disabled={consulChecking || !displayArticle.html}
                    className="gap-1.5 border-primary/30">
                    {consulChecking ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Consulting…</> : consulResult ? <><Scale className="h-3.5 w-3.5" /> Re-check</> : <><Scale className="h-3.5 w-3.5" /> Fact-Check Consul</>}
                </Button>
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

            {/* Similarity Analysis */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-medium flex items-center gap-1.5">
                            <Search className="h-3.5 w-3.5 text-muted-foreground" />
                            Similarity Analysis
                        </h4>
                        <Button variant="outline" size="sm" onClick={checkSimilarity} disabled={checkingSimilarity || !article.company_id}
                            className={cn("text-xs", !article.company_id && "opacity-50")}>
                            {checkingSimilarity ? "Checking…" : "Find Similar"}
                        </Button>
                    </div>
                    {simErr && <p className="text-xs text-destructive mt-1">{simErr}</p>}
                    {similarResults !== null && (
                        similarResults.length === 0 ? (
                            <div className="flex items-center gap-1.5 text-sm text-success">
                                <CheckCircle2 className="h-4 w-4" /> No significant overlap found
                            </div>
                        ) : (
                            <div className="space-y-1.5 mt-2">
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
                        )
                    )}
                </CardContent>
            </Card>

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
                                                <Button variant="outline" size="sm" className="mt-2 gap-1.5 text-xs h-7"
                                                    disabled={applyingRewrite === i}
                                                    onClick={() => handleApplyRewrite(i)}>
                                                    {applyingRewrite === i ? <><RefreshCw className="h-3 w-3 animate-spin" /> Applying…</> : <><Wand2 className="h-3 w-3" /> Apply Rewrite</>}
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
                <div className="relative group">
                    <img src={`data:image/png;base64,${displayArticle.image_base64}`} alt={article.title}
                        className="w-full rounded-xl" />
                    <Button variant="secondary" size="sm" onClick={() => { setShowInsertModal(true); setInsertMode("featured"); setInsertGenPrompt(""); setInsertPreview(null); setInsertErr(null); setInsertTab("generate"); }}
                        className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity gap-1.5 shadow-lg backdrop-blur-sm">
                        <ImageIcon className="h-3.5 w-3.5" /> Change
                    </Button>
                </div>
            )}

            {/* Image controls */}
            {article.image_prompt && (
                <Card>
                    <CardContent className="p-4 space-y-3">
                        <h4 className="text-sm font-medium flex items-center gap-1.5">
                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> Image Options
                        </h4>
                        {imageStyles.length > 0 && (
                            <div>
                                <Label className="text-xs">Image Style</Label>
                                <select value={selectedStyle} onChange={(e) => {
                                        const newStyle = e.target.value;
                                        setSelectedStyle(newStyle);
                                        if (newStyle !== (article.image_style ?? "default") && article.image_prompt && !refreshingImage) {
                                            // Auto-regenerate with new style
                                            setTimeout(() => {
                                                setRefreshingImage(true); setRefreshErr(null);
                                                fetch("/api/regenerate-image", {
                                                    method: "POST",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({ base_prompt: article.image_prompt, image_style: newStyle, company_id: article.company_id ?? undefined }),
                                                })
                                                    .then((r) => r.json())
                                                    .then(async (data) => {
                                                        if (data.error) throw new Error(data.error);
                                                        const saveResp = await fetch(`/api/articles/${article.id}`, {
                                                            method: "PUT",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ image_base64: data.image_base64, image_prompt: data.base_prompt || data.final_prompt, image_style: newStyle }),
                                                        });
                                                        const saveData = await saveResp.json();
                                                        if (!saveResp.ok) throw new Error(saveData.error || "Failed to save");
                                                        onUpdate({ ...article, image_base64: data.image_base64, image_prompt: data.base_prompt || data.final_prompt, image_style: newStyle });
                                                    })
                                                    .catch((err: any) => setRefreshErr(err.message))
                                                    .finally(() => setRefreshingImage(false));
                                            }, 0);
                                        }
                                    }}
                                    className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    {imageStyles.map((s) => (
                                        <option key={s.id} value={s.id}>{s.label}{s.narrative ? ` — ${s.narrative.slice(0, 60)}…` : ""}</option>
                                    ))}
                                </select>
                                {refreshingImage && (
                                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                        <RefreshCw className="h-3 w-3 animate-spin" /> Regenerating with new style…
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <Input placeholder="Optional: add extra image direction…" value={imagePromptInput} onChange={(e) => setImagePromptInput(e.target.value)} className="text-sm" />
                            <Button variant="outline" size="sm" onClick={refreshImage} disabled={refreshingImage} className="gap-1.5 whitespace-nowrap">
                                <RefreshCw className={cn("h-3.5 w-3.5", refreshingImage && "animate-spin")} />
                                {refreshingImage ? "Generating…" : "Regenerate"}
                            </Button>
                        </div>
                        {refreshErr && <p className="text-xs text-destructive">{refreshErr}</p>}
                    </CardContent>
                </Card>
            )}

            {/* Article Content */}
            <div dangerouslySetInnerHTML={{ __html: displayArticle.html ?? "" }}
                className="prose prose-sm dark:prose-invert max-w-none leading-relaxed" />

            {/* Image Prompt */}
            {article.image_prompt && (
                <details className="group">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors">Image prompt</summary>
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground mt-1 p-3 bg-muted rounded-md">{article.image_prompt}</pre>
                </details>
            )}

            {insertImageModal}
        </div>
    );
}
