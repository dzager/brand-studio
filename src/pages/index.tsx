import { useState, useEffect } from "react";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { IMAGE_STYLE_CATEGORIES, type ImageStyleCategory } from "@/brand/engine";

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
    pass: "#22c55e",
    needs_review: "#f59e0b",
    fail: "#ef4444",
    accurate: "#22c55e",
    unverifiable: "#a3a3a3",
    misleading: "#f59e0b",
    inaccurate: "#ef4444",
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

    // Image gallery & refresh state
    const [gallery, setGallery] = useState<GalleryImage[]>([]);
    const [selectedImgId, setSelectedImgId] = useState<number | null>(null);
    const [customImagePrompt, setCustomImagePrompt] = useState("");
    const [refreshingImage, setRefreshingImage] = useState(false);
    const [refreshErr, setRefreshErr] = useState<string | null>(null);

    // Humanize state
    const [humanizing, setHumanizing] = useState(false);
    const [humanized, setHumanized] = useState(false);
    const [humanizeErr, setHumanizeErr] = useState<string | null>(null);

    // Active image styles (company-specific or global)
    const [activeStyles, setActiveStyles] = useState<ImageStyleCategory[]>(IMAGE_STYLE_CATEGORIES);

    // Style recommendation
    const [recommending, setRecommending] = useState(false);
    const [recommendation, setRecommendation] = useState<{ id: string; label: string; reason: string } | null>(null);
    const [recommendErr, setRecommendErr] = useState<string | null>(null);

    // Image search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchImage[]>([]);
    const [searching, setSearching] = useState(false);
    const [searchErr, setSearchErr] = useState<string | null>(null);

    // YouTube search state
    const [ytQuery, setYtQuery] = useState("");
    const [ytResults, setYtResults] = useState<SearchVideo[]>([]);
    const [ytSearching, setYtSearching] = useState(false);
    const [ytErr, setYtErr] = useState<string | null>(null);

    // Prompt templates
    const [companyPrompts, setCompanyPrompts] = useState<{ id: string; name: string; body: string }[]>([]);
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);

    // Prompt preview state
    const [previewing, setPreviewing] = useState(false);
    const [previewData, setPreviewData] = useState<{ system: string; user: string; image_system: string; image_user: string; model: string; estimated_tokens?: number } | null>(null);
    const [previewErr, setPreviewErr] = useState<string | null>(null);
    const [previewCopied, setPreviewCopied] = useState<string | null>(null);

    // Overlap check state
    const [checkingOverlap, setCheckingOverlap] = useState(false);
    const [overlapResults, setOverlapResults] = useState<{ id: string; title: string; slug: string; similarity: number; cluster_id: string | null }[] | null>(null);
    const [overlapErr, setOverlapErr] = useState<string | null>(null);

    // Fetch companies
    useEffect(() => {
        fetch("/api/companies")
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setCompanies(data);
            })
            .catch(() => { });

        // Fetch available AI models
        fetch("/api/models")
            .then((r) => r.json())
            .then((data) => {
                if (data?.models && Array.isArray(data.models)) {
                    setAvailableModels(data.models);
                    // If current model isn't in the list, set to first available
                    if (data.models.length > 0 && !data.models.some((m: any) => m.id === model)) {
                        setModel(data.models[0].id);
                    }
                }
            })
            .catch(() => { });
    }, []);

    // When company changes, fetch its details to get image_style_categories
    useEffect(() => {
        if (!companyId) {
            setActiveStyles(IMAGE_STYLE_CATEGORIES);
            setImageStyle("default");
            return;
        }
        fetch(`/api/companies/${companyId}`)
            .then((r) => r.json())
            .then((data) => {
                if (
                    data?.image_style_categories &&
                    Array.isArray(data.image_style_categories) &&
                    data.image_style_categories.length > 0
                ) {
                    setActiveStyles(data.image_style_categories);
                } else {
                    setActiveStyles(IMAGE_STYLE_CATEGORIES);
                }
                setImageStyle("default");
            })
            .catch(() => {
                setActiveStyles(IMAGE_STYLE_CATEGORIES);
                setImageStyle("default");
            });
    }, [companyId]);

    // Fetch prompt templates when company changes
    useEffect(() => {
        setCompanyPrompts([]);
        setActiveTemplateId(null);
        if (!companyId) return;
        fetch(`/api/prompts?company_id=${companyId}`)
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setCompanyPrompts(data);
            })
            .catch(() => {});
    }, [companyId]);

    async function onCreate() {
        setLoading(true);
        setErr(null);
        setResult(null);
        setFactCheck(null);
        setFactCheckErr(null);
        setGallery([]);
        setSelectedImgId(null);
        setCustomImagePrompt("");
        setRefreshErr(null);
        setHumanized(false);
        setHumanizeErr(null);

        try {
            const r = await fetch("/api/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ creation_prompt: prompt, image_style: imageStyle, model, word_count: wordCount, company_id: companyId || undefined }),
            });

            const text = await r.text();
            console.log("RAW RESPONSE:", text);
            const data = text ? JSON.parse(text) : null;

            if (!r.ok) {
                throw new Error(data?.error || `Request failed with status ${r.status}`);
            }
            setResult(data);

            // Seed the gallery with the initial image
            if (data?.image_base64) {
                const img: GalleryImage = {
                    id: ++_imgId,
                    base64: data.image_base64,
                    prompt: data.image_prompt ?? "",
                    label: "Original",
                };
                setGallery([img]);
                setSelectedImgId(img.id);
            }
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function onPreviewPrompt() {
        setPreviewing(true);
        setPreviewErr(null);
        setPreviewData(null);
        setPreviewCopied(null);

        try {
            const r = await fetch("/api/preview-prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    creation_prompt: prompt,
                    image_style: imageStyle,
                    model,
                    word_count: wordCount,
                    company_id: companyId || undefined,
                }),
            });

            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || `Preview failed (${r.status})`);
            setPreviewData(data);
        } catch (e: any) {
            setPreviewErr(e.message);
        } finally {
            setPreviewing(false);
        }
    }

    function copyPreviewSection(label: string, text: string) {
        navigator.clipboard.writeText(text).then(() => {
            setPreviewCopied(label);
            setTimeout(() => setPreviewCopied(null), 2000);
        });
    }

    async function onCheckOverlap() {
        if (!prompt.trim() || !companyId) return;
        setCheckingOverlap(true);
        setOverlapErr(null);
        setOverlapResults(null);

        try {
            const r = await fetch("/api/similarity", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    company_id: companyId,
                    text: prompt.trim(),
                    threshold: 0.75,
                }),
            });

            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Overlap check failed");
            setOverlapResults(data.results ?? []);
        } catch (e: any) {
            setOverlapErr(e.message);
        } finally {
            setCheckingOverlap(false);
        }
    }

    async function onRefreshImage() {
        if (!result?.image_prompt) return;
        setRefreshingImage(true);
        setRefreshErr(null);

        try {
            const r = await fetch("/api/regenerate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    base_prompt: result.image_prompt,
                    custom_prompt: customImagePrompt.trim() || undefined,
                    image_style: imageStyle,
                    company_id: companyId || undefined,
                }),
            });

            const text = await r.text();
            console.log("REGENERATE RESPONSE:", text);
            const data = text ? JSON.parse(text) : null;

            if (!r.ok) {
                throw new Error(data?.error || `Regeneration failed with status ${r.status}`);
            }

            const newImg: GalleryImage = {
                id: ++_imgId,
                base64: data.image_base64,
                prompt: data.final_prompt ?? result.image_prompt,
                label: customImagePrompt.trim()
                    ? `Variation: ${customImagePrompt.trim().slice(0, 40)}${customImagePrompt.trim().length > 40 ? "…" : ""}`
                    : `Variation ${gallery.length + 1}`,
            };
            setGallery((prev) => [...prev, newImg]);
            setSelectedImgId(newImg.id);
        } catch (e: any) {
            setRefreshErr(e.message);
        } finally {
            setRefreshingImage(false);
        }
    }

    async function onFactCheck() {
        if (!result) return;
        setFactChecking(true);
        setFactCheckErr(null);
        setFactCheck(null);

        try {
            const r = await fetch("/api/fact-check", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: result.title,
                    excerpt: result.excerpt,
                    html: result.html,
                }),
            });

            const text = await r.text();
            console.log("FACT-CHECK RESPONSE:", text);
            const data = text ? JSON.parse(text) : null;

            if (!r.ok) {
                throw new Error(data?.error || `Fact-check failed with status ${r.status}`);
            }
            setFactCheck(data);
        } catch (e: any) {
            setFactCheckErr(e.message);
        } finally {
            setFactChecking(false);
        }
    }

    async function onHumanize() {
        if (!result) return;
        setHumanizing(true);
        setHumanizeErr(null);

        try {
            const r = await fetch("/api/humanize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: result.title,
                    excerpt: result.excerpt,
                    html: result.html,
                }),
            });

            const text = await r.text();
            console.log("HUMANIZE RESPONSE:", text);
            const data = text ? JSON.parse(text) : null;

            if (!r.ok) {
                throw new Error(data?.error || `Humanize failed with status ${r.status}`);
            }

            // Replace the result content with humanized versions
            setResult((prev: any) => ({
                ...prev,
                title: data.title ?? prev.title,
                excerpt: data.excerpt ?? prev.excerpt,
                html: data.html ?? prev.html,
            }));
            setHumanized(true);
        } catch (e: any) {
            setHumanizeErr(e.message);
        } finally {
            setHumanizing(false);
        }
    }

    async function onSearchImages() {
        if (!searchQuery.trim()) return;
        setSearching(true);
        setSearchErr(null);

        try {
            const r = await fetch("/api/image-search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: searchQuery.trim(), num: 12 }),
            });

            const text = await r.text();
            const data = text ? JSON.parse(text) : null;

            if (!r.ok) {
                throw new Error(data?.error || `Search failed (${r.status})`);
            }

            setSearchResults(data.images ?? []);
        } catch (e: any) {
            setSearchErr(e.message);
        } finally {
            setSearching(false);
        }
    }

    function selectSearchImage(img: SearchImage) {
        const newImg: GalleryImage = {
            id: ++_imgId,
            url: img.imageUrl,
            prompt: `Web search: ${img.title}`,
            label: img.title.slice(0, 40) || "Web Image",
        };
        setGallery((prev) => [...prev, newImg]);
        setSelectedImgId(newImg.id);
    }

    async function onSearchYouTube() {
        if (!ytQuery.trim()) return;
        setYtSearching(true);
        setYtErr(null);

        try {
            const r = await fetch("/api/youtube-search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: ytQuery.trim(), num: 12 }),
            });

            const text = await r.text();
            const data = text ? JSON.parse(text) : null;

            if (!r.ok) {
                throw new Error(data?.error || `YouTube search failed (${r.status})`);
            }

            setYtResults(data.videos ?? []);
        } catch (e: any) {
            setYtErr(e.message);
        } finally {
            setYtSearching(false);
        }
    }

    const selectedImage = gallery.find((img) => img.id === selectedImgId) ?? null;
    const selectedSrc = selectedImage
        ? selectedImage.base64
            ? `data:image/png;base64,${selectedImage.base64}`
            : selectedImage.url ?? null
        : null;

    return (
        <main style={{ margin: "40px auto", padding: "16px 40px", fontFamily: "system-ui" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1 style={{ margin: 0 }}>Brand Studio</h1>
                <div style={{ display: "flex", gap: 8 }}>
                    <Link
                        href="/companies"
                        style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: "#fff",
                            textDecoration: "none",
                            color: "#333",
                        }}
                    >
                        🏢 Companies
                    </Link>
                    <Link
                        href="/clusters"
                        style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: "#fff",
                            textDecoration: "none",
                            color: "#333",
                        }}
                    >
                        🔗 Clusters
                    </Link>
                    <Link
                        href="/articles"
                        style={{
                            padding: "8px 16px",
                            fontSize: 14,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: "#fff",
                            textDecoration: "none",
                            color: "#333",
                        }}
                    >
                        📄 Saved Articles
                    </Link>
                </div>
            </div>
            <p>Create on-brand blog posts + images from a single prompt.</p>

            {/* Company Selector */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                <label htmlFor="company-select" style={{ fontSize: 14, fontWeight: 500 }}>
                    Company:
                </label>
                <select
                    id="company-select"
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: 14, borderRadius: 6, border: companyId ? "1px solid #ccc" : "2px solid #f59e0b", flex: 1, maxWidth: 300 }}
                >
                    <option value="">— Select a company —</option>
                    {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
                {!companyId && companies.length > 0 && (
                    <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 500 }}>Required</span>
                )}
                {companies.length === 0 && (
                    <Link href="/companies" style={{ fontSize: 12, color: "#6366f1" }}>Create a company first →</Link>
                )}
            </div>

            {/* Prompt Template Selector */}
            {companyPrompts.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: "#555", display: "block", marginBottom: 6 }}>
                        Prompt Templates:
                    </label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {companyPrompts.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => {
                                    setPrompt(t.body);
                                    setActiveTemplateId(t.id);
                                }}
                                style={{
                                    padding: "6px 14px",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    borderRadius: 20,
                                    border: activeTemplateId === t.id ? "2px solid #FDB72A" : "1px solid #ddd",
                                    background: activeTemplateId === t.id ? "#fffbeb" : "#fff",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                }}
                            >
                                📝 {t.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <textarea
                value={prompt}
                onChange={(e) => {
                    setPrompt(e.target.value);
                    setActiveTemplateId(null);
                }}
                rows={3}
                style={{ width: "100%", padding: 12, fontSize: 16 }}
            />

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12 }}>
                <label htmlFor="image-style" style={{ fontSize: 14, fontWeight: 500 }}>
                    Image Style:
                </label>
                <select
                    id="image-style"
                    value={imageStyle}
                    onChange={(e) => setImageStyle(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }}
                >
                    {activeStyles.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.label}
                        </option>
                    ))}
                </select>
                <span
                    title={activeStyles.map((s) => `${s.label}${s.narrative ? ` — ${s.narrative.slice(0, 80)}` : ""}`).join("\n")}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        border: "1px solid #999",
                        fontSize: 12,
                        color: "#666",
                        cursor: "help",
                        userSelect: "none",
                    }}
                >
                    i
                </span>
                {activeStyles.length > 1 && (
                    <button
                        type="button"
                        disabled={recommending || !prompt.trim()}
                        onClick={async () => {
                            setRecommending(true);
                            setRecommendation(null);
                            setRecommendErr(null);
                            try {
                                const r = await fetch("/api/recommend-style", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ prompt: prompt.trim(), styles: activeStyles }),
                                });
                                const data = await r.json();
                                if (!r.ok) throw new Error(data.error || "Recommendation failed");
                                setRecommendation(data);
                                setImageStyle(data.id);
                            } catch (e: any) {
                                setRecommendErr(e.message);
                            } finally {
                                setRecommending(false);
                            }
                        }}
                        style={{
                            padding: "6px 14px",
                            fontSize: 13,
                            borderRadius: 6,
                            border: "1px solid #6366f1",
                            background: recommending ? "#e0e7ff" : "#6366f1",
                            color: recommending ? "#6366f1" : "#fff",
                            cursor: recommending || !prompt.trim() ? "not-allowed" : "pointer",
                            fontWeight: 500,
                            opacity: !prompt.trim() ? 0.5 : 1,
                        }}
                    >
                        {recommending ? "Analyzing…" : "✨ Recommend"}
                    </button>
                )}
            </div>
            {recommendation && (
                <div
                    style={{
                        marginTop: 6,
                        padding: "8px 12px",
                        background: "#eef2ff",
                        border: "1px solid #c7d2fe",
                        borderRadius: 6,
                        fontSize: 13,
                        color: "#3730a3",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                    }}
                >
                    <span>✨</span>
                    <span>
                        <strong>{recommendation.label}</strong> — {recommendation.reason}
                    </span>
                    <button
                        type="button"
                        onClick={() => setRecommendation(null)}
                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#6366f1", fontSize: 14 }}
                    >
                        ✕
                    </button>
                </div>
            )}
            {recommendErr && (
                <div style={{ marginTop: 6, fontSize: 13, color: "#ef4444" }}>
                    Recommendation failed: {recommendErr}
                </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                <label htmlFor="model-select" style={{ fontSize: 14, fontWeight: 500 }}>
                    Model:
                </label>
                <select
                    id="model-select"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }}
                >
                    {availableModels.length > 0 ? (
                        availableModels.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.label}{m.provider !== "openai" ? ` (${m.provider})` : ""}
                            </option>
                        ))
                    ) : (
                        <>
                            <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
                            <option value="gpt-5.1">GPT-5.1</option>
                        </>
                    )}
                </select>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
                <label htmlFor="word-count" style={{ fontSize: 14, fontWeight: 500 }}>
                    Length:
                </label>
                <select
                    id="word-count"
                    value={wordCount}
                    onChange={(e) => setWordCount(e.target.value)}
                    style={{ padding: "8px 12px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }}
                >
                    <option value="300-500">Short (300–500 words)</option>
                    <option value="800-1200">Medium (800–1,200 words)</option>
                    <option value="1500-2500">Long (1,500–2,500 words)</option>
                    <option value="2500-4000">Deep Dive (2,500–4,000 words)</option>
                    <option value="">No limit</option>
                </select>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
                <button
                    onClick={onCreate}
                    disabled={loading || !companyId}
                    style={{ padding: "10px 14px", fontSize: 16, opacity: !companyId ? 0.5 : 1, cursor: !companyId ? "not-allowed" : loading ? "wait" : "pointer" }}
                >
                    {loading ? "Creating…" : "Create"}
                </button>
                <button
                    onClick={onPreviewPrompt}
                    disabled={previewing || loading || !companyId || prompt.trim().length < 5}
                    style={{
                        padding: "10px 14px",
                        fontSize: 14,
                        fontWeight: 500,
                        borderRadius: 6,
                        border: "1px solid #6366f1",
                        background: previewing ? "#e0e7ff" : "#fff",
                        color: "#6366f1",
                        cursor: previewing || loading || prompt.trim().length < 5 ? "not-allowed" : "pointer",
                        opacity: prompt.trim().length < 5 ? 0.5 : 1,
                        transition: "all 0.15s",
                    }}
                >
                    {previewing ? "Loading…" : "👁 Preview Prompt"}
                </button>
                <button
                    onClick={onCheckOverlap}
                    disabled={checkingOverlap || loading || !companyId || prompt.trim().length < 5}
                    style={{
                        padding: "10px 14px",
                        fontSize: 14,
                        fontWeight: 500,
                        borderRadius: 6,
                        border: "1px solid #f59e0b",
                        background: checkingOverlap ? "#fffbeb" : "#fff",
                        color: "#b45309",
                        cursor: checkingOverlap || loading || !companyId || prompt.trim().length < 5 ? "not-allowed" : "pointer",
                        opacity: !companyId || prompt.trim().length < 5 ? 0.5 : 1,
                        transition: "all 0.15s",
                    }}
                >
                    {checkingOverlap ? "Checking…" : "🔍 Check Overlap"}
                </button>
            </div>

            {/* Overlap Check Results */}
            {overlapErr && (
                <p style={{ color: "crimson", fontSize: 13, marginTop: 6 }}>{overlapErr}</p>
            )}
            {overlapResults !== null && (
                <div
                    style={{
                        marginTop: 10,
                        padding: 14,
                        borderRadius: 8,
                        border: `1px solid ${overlapResults.length > 0 ? "#fdba74" : "#86efac"}`,
                        background: overlapResults.length > 0 ? "#fff7ed" : "#f0fdf4",
                    }}
                >
                    {overlapResults.length === 0 ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                            <span>✅</span>
                            <span style={{ color: "#16a34a", fontWeight: 500 }}>No significant overlap found. This topic looks fresh!</span>
                            <button
                                onClick={() => setOverlapResults(null)}
                                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 14 }}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                                <span>⚠️</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: "#c2410c" }}>
                                    {overlapResults.length} similar article{overlapResults.length !== 1 ? "s" : ""} found
                                </span>
                                <button
                                    onClick={() => setOverlapResults(null)}
                                    style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#999", fontSize: 14 }}
                                >
                                    ✕
                                </button>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {overlapResults.map((r) => {
                                    const pct = Math.round(r.similarity * 100);
                                    const color = pct >= 92 ? "#dc2626" : pct >= 85 ? "#c2410c" : "#a16207";
                                    return (
                                        <div
                                            key={r.id}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 10,
                                                padding: "8px 12px",
                                                borderRadius: 6,
                                                background: "#fff",
                                                border: "1px solid #e5e5e5",
                                                fontSize: 13,
                                            }}
                                        >
                                            <span style={{
                                                padding: "2px 8px",
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color,
                                                background: pct >= 92 ? "#fef2f2" : pct >= 85 ? "#fff7ed" : "#fefce8",
                                                border: `1px solid ${pct >= 92 ? "#fca5a5" : pct >= 85 ? "#fdba74" : "#fcd34d"}`,
                                                flexShrink: 0,
                                            }}>
                                                {pct}%
                                            </span>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 500 }}>{r.title}</div>
                                                <div style={{ fontSize: 11, color: "#888" }}>/{r.slug}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <p style={{ fontSize: 12, color: "#9a3412", marginTop: 8, marginBottom: 0 }}>
                                You can still create this article — these are advisory warnings only.
                            </p>
                        </>
                    )}
                </div>
            )}

            {err && <p style={{ color: "crimson" }}>{err}</p>}

            {result && (
                <section style={{ marginTop: 28 }}>
                    <h2>{result.title}</h2>
                    <p><em>{result.excerpt}</em></p>

                    {/* === Image Section with Gallery === */}
                    {selectedSrc && (
                        <div style={{ margin: "16px 0" }}>
                            <img
                                src={selectedSrc}
                                alt={result.title}
                                style={{ width: "100%", borderRadius: 12 }}
                            />
                            <details style={{ marginTop: 8 }}>
                                <summary>Image prompt</summary>
                                <pre style={{ whiteSpace: "pre-wrap" }}>
                                    {selectedImage?.prompt ?? result.image_prompt}
                                </pre>
                            </details>
                        </div>
                    )}

                    {/* Image Refresh Controls */}
                    <div
                        style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "stretch",
                            marginTop: 12,
                            flexWrap: "wrap",
                        }}
                    >
                        <input
                            type="text"
                            placeholder="Optional: add extra image direction…"
                            value={customImagePrompt}
                            onChange={(e) => setCustomImagePrompt(e.target.value)}
                            style={{
                                flex: 1,
                                minWidth: 200,
                                padding: "8px 12px",
                                fontSize: 14,
                                borderRadius: 6,
                                border: "1px solid #ccc",
                            }}
                        />
                        <button
                            onClick={onRefreshImage}
                            disabled={refreshingImage || !result?.image_prompt}
                            style={{
                                padding: "8px 16px",
                                fontSize: 14,
                                fontWeight: 500,
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                background: "#fff",
                                cursor: refreshingImage ? "wait" : "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {refreshingImage ? "Generating…" : "🔄 Refresh Image"}
                        </button>
                    </div>
                    {refreshErr && (
                        <p style={{ color: "crimson", fontSize: 13, marginTop: 4 }}>{refreshErr}</p>
                    )}

                    {/* Gallery Thumbnails */}
                    {gallery.length > 1 && (
                        <div style={{ marginTop: 16 }}>
                            <h4 style={{ margin: "0 0 8px", fontSize: 13, color: "#666" }}>
                                Image Gallery ({gallery.length})
                            </h4>
                            <div
                                style={{
                                    display: "flex",
                                    gap: 10,
                                    overflowX: "auto",
                                    paddingBottom: 8,
                                }}
                            >
                                {gallery.map((img) => (
                                    <button
                                        key={img.id}
                                        onClick={() => setSelectedImgId(img.id)}
                                        style={{
                                            flex: "0 0 auto",
                                            width: 120,
                                            padding: 0,
                                            border:
                                                img.id === selectedImgId
                                                    ? "3px solid #FDB72A"
                                                    : "2px solid #ddd",
                                            borderRadius: 8,
                                            overflow: "hidden",
                                            cursor: "pointer",
                                            background: "none",
                                        }}
                                    >
                                        <img
                                            src={img.base64 ? `data:image/png;base64,${img.base64}` : img.url ?? ""}
                                            alt={img.label}
                                            style={{
                                                width: "100%",
                                                height: 80,
                                                objectFit: "cover",
                                                display: "block",
                                            }}
                                        />
                                        <div
                                            style={{
                                                padding: "4px 6px",
                                                fontSize: 11,
                                                color: "#555",
                                                textAlign: "center",
                                                whiteSpace: "nowrap",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                            }}
                                        >
                                            {img.label}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <details style={{ marginTop: 16 }}>
                        <summary>SEO</summary>
                        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result.seo, null, 2)}</pre>
                    </details>

                    <hr style={{ margin: "20px 0" }} />

                    <div dangerouslySetInnerHTML={{ __html: result.html }} />

                    {/* Humanize & Fact-Check Section */}
                    <hr style={{ margin: "24px 0" }} />

                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <button
                            onClick={onHumanize}
                            disabled={humanizing || humanized}
                            style={{
                                padding: "10px 18px",
                                fontSize: 14,
                                fontWeight: 500,
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                background: humanized ? "#f0fdf4" : "#fff",
                                cursor: humanizing ? "wait" : humanized ? "default" : "pointer",
                            }}
                        >
                            {humanizing ? "Humanizing…" : humanized ? "Humanized ✓" : "✨ Humanize"}
                        </button>
                        {humanized && (
                            <span style={{ fontSize: 13, color: "#22c55e" }}>
                                Title, excerpt, and body have been rewritten
                            </span>
                        )}
                    </div>
                    {humanizeErr && (
                        <p style={{ color: "crimson", fontSize: 13, marginTop: 4 }}>{humanizeErr}</p>
                    )}

                    <hr style={{ margin: "24px 0" }} />

                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button
                            onClick={onFactCheck}
                            disabled={factChecking}
                            style={{
                                padding: "10px 18px",
                                fontSize: 14,
                                fontWeight: 500,
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                background: factCheck ? "#f5f5f5" : "#fff",
                                cursor: factChecking ? "wait" : "pointer",
                            }}
                        >
                            {factChecking ? "Fact-checking…" : factCheck ? "Re-check" : "🔍 Fact-Check"}
                        </button>
                        {factCheck && (
                            <span
                                style={{
                                    padding: "4px 10px",
                                    borderRadius: 12,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: "#fff",
                                    background: VERDICT_COLORS[factCheck.overall_verdict],
                                }}
                            >
                                {factCheck.overall_verdict === "pass"
                                    ? "✓ Pass"
                                    : factCheck.overall_verdict === "needs_review"
                                        ? "⚠ Needs Review"
                                        : "✗ Fail"}
                            </span>
                        )}
                        {factCheck && (
                            <span style={{ fontSize: 13, color: "#888" }}>
                                Confidence: {Math.round(factCheck.confidence * 100)}%
                            </span>
                        )}
                    </div>

                    {factCheckErr && <p style={{ color: "crimson", marginTop: 8 }}>{factCheckErr}</p>}

                    {factCheck && (
                        <div
                            style={{
                                marginTop: 16,
                                padding: 16,
                                border: "1px solid #e5e5e5",
                                borderRadius: 8,
                                background: "#fafafa",
                            }}
                        >
                            {factCheck.summary && (
                                <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.5 }}>
                                    {factCheck.summary}
                                </p>
                            )}

                            <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>
                                Claims Reviewed ({factCheck.claims.length})
                            </h4>

                            {factCheck.claims.map((claim, i) => (
                                <div
                                    key={i}
                                    style={{
                                        padding: 12,
                                        marginBottom: 10,
                                        borderRadius: 6,
                                        border: `1px solid ${VERDICT_COLORS[claim.verdict]}33`,
                                        background: `${VERDICT_COLORS[claim.verdict]}08`,
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                        <span
                                            style={{
                                                padding: "2px 8px",
                                                borderRadius: 4,
                                                fontSize: 11,
                                                fontWeight: 600,
                                                textTransform: "uppercase",
                                                color: VERDICT_COLORS[claim.verdict],
                                                background: `${VERDICT_COLORS[claim.verdict]}18`,
                                            }}
                                        >
                                            {claim.verdict}
                                        </span>
                                    </div>
                                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 500 }}>
                                        &ldquo;{claim.claim}&rdquo;
                                    </p>
                                    <p style={{ margin: 0, fontSize: 13, color: "#555", lineHeight: 1.4 }}>
                                        {claim.explanation}
                                    </p>
                                    {claim.suggested_edit && (
                                        <p
                                            style={{
                                                margin: "8px 0 0",
                                                fontSize: 13,
                                                color: "#333",
                                                padding: "6px 10px",
                                                background: "#fff",
                                                borderRadius: 4,
                                                border: "1px dashed #ccc",
                                            }}
                                        >
                                            ✏️ <strong>Suggested edit:</strong> {claim.suggested_edit}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* ====== Image Search Section ====== */}
            <section style={{ marginTop: 40 }}>
                <hr style={{ margin: "32px 0" }} />
                <h2 style={{ margin: "0 0 8px" }}>🔍 Image Search</h2>
                <p style={{ fontSize: 14, color: "#666", margin: "0 0 16px" }}>
                    Search the web for product photos, stock images, or any visual asset.
                </p>

                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input
                        type="text"
                        placeholder="e.g. Fender Stratocaster red guitar"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") onSearchImages(); }}
                        style={{
                            flex: 1,
                            padding: "10px 14px",
                            fontSize: 15,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                        }}
                    />
                    <button
                        onClick={onSearchImages}
                        disabled={searching || !searchQuery.trim()}
                        style={{
                            padding: "10px 20px",
                            fontSize: 15,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: searching ? "#f5f5f5" : "#fff",
                            cursor: searching ? "wait" : "pointer",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {searching ? "Searching…" : "🔍 Search"}
                    </button>
                </div>

                {searchErr && (
                    <p style={{ color: "crimson", fontSize: 13, marginBottom: 12 }}>{searchErr}</p>
                )}

                {searchResults.length > 0 && (
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                        gap: 14,
                        marginTop: 8,
                    }}>
                        {searchResults.map((img, i) => (
                            <div
                                key={i}
                                style={{
                                    border: "1px solid #e5e5e5",
                                    borderRadius: 10,
                                    overflow: "hidden",
                                    background: "#fff",
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                <div
                                    onClick={() => selectSearchImage(img)}
                                    style={{
                                        cursor: "pointer",
                                        position: "relative",
                                        background: "#f0f0f0",
                                        aspectRatio: "4/3",
                                        overflow: "hidden",
                                    }}
                                >
                                    <img
                                        src={img.thumbnailUrl || img.imageUrl}
                                        alt={img.title}
                                        loading="lazy"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            display: "block",
                                        }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = "none";
                                        }}
                                    />
                                </div>
                                <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                                    <div style={{
                                        fontSize: 12,
                                        fontWeight: 500,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        color: "#333",
                                    }}>
                                        {img.title}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#999" }}>
                                        {img.domain}
                                        {img.width && img.height ? ` · ${img.width}×${img.height}` : ""}
                                    </div>
                                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                                        <a
                                            href={`/api/image-proxy?url=${encodeURIComponent(img.imageUrl)}`}
                                            download
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 500,
                                                color: "#0369a1",
                                                textDecoration: "none",
                                            }}
                                        >
                                            ⬇ Download
                                        </a>
                                        <button
                                            onClick={() => selectSearchImage(img)}
                                            style={{
                                                fontSize: 12,
                                                fontWeight: 500,
                                                color: "#0369a1",
                                                background: "none",
                                                border: "none",
                                                padding: 0,
                                                cursor: "pointer",
                                            }}
                                        >
                                            ▲ Use Image
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ====== YouTube Search Section ====== */}
            <section style={{ marginTop: 40 }}>
                <hr style={{ margin: "32px 0" }} />
                <h2 style={{ margin: "0 0 8px" }}>▶️ YouTube Search</h2>
                <p style={{ fontSize: 14, color: "#666", margin: "0 0 16px" }}>
                    Search YouTube for relevant videos, tutorials, and media.
                </p>

                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                    <input
                        type="text"
                        placeholder="e.g. best dental implant options for seniors"
                        value={ytQuery}
                        onChange={(e) => setYtQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") onSearchYouTube(); }}
                        style={{
                            flex: 1,
                            padding: "10px 14px",
                            fontSize: 15,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                        }}
                    />
                    <button
                        onClick={onSearchYouTube}
                        disabled={ytSearching || !ytQuery.trim()}
                        style={{
                            padding: "10px 20px",
                            fontSize: 15,
                            fontWeight: 500,
                            borderRadius: 6,
                            border: "1px solid #ccc",
                            background: ytSearching ? "#f5f5f5" : "#fff",
                            cursor: ytSearching ? "wait" : "pointer",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {ytSearching ? "Searching…" : "▶️ Search"}
                    </button>
                </div>

                {ytErr && (
                    <p style={{ color: "crimson", fontSize: 13, marginBottom: 12 }}>{ytErr}</p>
                )}

                {ytResults.length > 0 && (
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                        gap: 14,
                        marginTop: 8,
                    }}>
                        {ytResults.map((vid, i) => (
                            <a
                                key={i}
                                href={vid.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    border: "1px solid #e5e5e5",
                                    borderRadius: 10,
                                    overflow: "hidden",
                                    background: "#fff",
                                    display: "flex",
                                    flexDirection: "column",
                                    textDecoration: "none",
                                    color: "inherit",
                                    transition: "box-shadow 0.15s",
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)";
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.boxShadow = "none";
                                }}
                            >
                                <div
                                    style={{
                                        position: "relative",
                                        background: "#000",
                                        aspectRatio: "16/9",
                                        overflow: "hidden",
                                    }}
                                >
                                    {vid.imageUrl && (
                                        <img
                                            src={vid.imageUrl}
                                            alt={vid.title}
                                            loading="lazy"
                                            style={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                                display: "block",
                                            }}
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = "none";
                                            }}
                                        />
                                    )}
                                    {vid.duration && (
                                        <span
                                            style={{
                                                position: "absolute",
                                                bottom: 6,
                                                right: 6,
                                                background: "rgba(0,0,0,0.8)",
                                                color: "#fff",
                                                fontSize: 11,
                                                fontWeight: 600,
                                                padding: "2px 6px",
                                                borderRadius: 4,
                                                letterSpacing: 0.5,
                                            }}
                                        >
                                            {vid.duration}
                                        </span>
                                    )}
                                    {/* Play icon overlay */}
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            opacity: 0.7,
                                            pointerEvents: "none",
                                        }}
                                    >
                                        <svg width="48" height="48" viewBox="0 0 48 48">
                                            <circle cx="24" cy="24" r="22" fill="rgba(0,0,0,0.5)" />
                                            <polygon points="18,14 36,24 18,34" fill="#fff" />
                                        </svg>
                                    </div>
                                </div>
                                <div style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                                    <div style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: "#111",
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                        lineHeight: 1.35,
                                    }}>
                                        {vid.title}
                                    </div>
                                    {vid.channel && (
                                        <div style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>
                                            {vid.channel}
                                        </div>
                                    )}
                                    {vid.date && (
                                        <div style={{ fontSize: 11, color: "#999" }}>
                                            {vid.date}
                                        </div>
                                    )}
                                    {vid.snippet && (
                                        <div style={{
                                            fontSize: 11,
                                            color: "#888",
                                            marginTop: 2,
                                            display: "-webkit-box",
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: "vertical",
                                            overflow: "hidden",
                                            lineHeight: 1.4,
                                        }}>
                                            {vid.snippet}
                                        </div>
                                    )}
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </section>

            {/* ====== Prompt Preview Modal ====== */}
            {previewData && (
                <div
                    onClick={() => setPreviewData(null)}
                    style={{
                        position: "fixed",
                        inset: 0,
                        background: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(4px)",
                        zIndex: 9999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 24,
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: "#fff",
                            borderRadius: 12,
                            width: "100%",
                            maxWidth: 900,
                            maxHeight: "90vh",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
                        }}
                    >
                        {/* Modal Header */}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "16px 24px",
                                borderBottom: "1px solid #e5e5e5",
                                background: "#fafafa",
                            }}
                        >
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18 }}>Prompt Preview</h3>
                                <div style={{ display: "flex", gap: 16, marginTop: 4, fontSize: 13, color: "#666" }}>
                                    <span>Model: <strong>{previewData.model}</strong></span>
                                    {previewData.estimated_tokens && (
                                        <span>≈ <strong>{previewData.estimated_tokens.toLocaleString()}</strong> tokens</span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setPreviewData(null)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    fontSize: 22,
                                    cursor: "pointer",
                                    color: "#999",
                                    padding: "4px 8px",
                                    lineHeight: 1,
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ overflow: "auto", padding: 24, flex: 1 }}>
                            {/* System Prompt */}
                            <div style={{ marginBottom: 24 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <h4 style={{
                                        margin: 0,
                                        fontSize: 13,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                        color: "#6366f1",
                                        fontWeight: 600,
                                    }}>
                                        System Prompt
                                    </h4>
                                    <button
                                        onClick={() => copyPreviewSection("system", previewData.system)}
                                        style={{
                                            padding: "4px 10px",
                                            fontSize: 12,
                                            borderRadius: 4,
                                            border: "1px solid #ddd",
                                            background: previewCopied === "system" ? "#f0fdf4" : "#fff",
                                            color: previewCopied === "system" ? "#22c55e" : "#555",
                                            cursor: "pointer",
                                            fontWeight: 500,
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {previewCopied === "system" ? "Copied ✓" : "📋 Copy"}
                                    </button>
                                </div>
                                <pre
                                    style={{
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        background: "#f8f8fc",
                                        border: "1px solid #e0e0ef",
                                        borderRadius: 8,
                                        padding: 16,
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        maxHeight: 400,
                                        overflow: "auto",
                                        color: "#333",
                                        margin: 0,
                                    }}
                                >
                                    {previewData.system}
                                </pre>
                            </div>

                            {/* User Prompt */}
                            <div>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <h4 style={{
                                        margin: 0,
                                        fontSize: 13,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                        color: "#059669",
                                        fontWeight: 600,
                                    }}>
                                        User Prompt
                                    </h4>
                                    <button
                                        onClick={() => copyPreviewSection("user", previewData.user)}
                                        style={{
                                            padding: "4px 10px",
                                            fontSize: 12,
                                            borderRadius: 4,
                                            border: "1px solid #ddd",
                                            background: previewCopied === "user" ? "#f0fdf4" : "#fff",
                                            color: previewCopied === "user" ? "#22c55e" : "#555",
                                            cursor: "pointer",
                                            fontWeight: 500,
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {previewCopied === "user" ? "Copied ✓" : "📋 Copy"}
                                    </button>
                                </div>
                                <pre
                                    style={{
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        background: "#f0fdf4",
                                        border: "1px solid #d1fae5",
                                        borderRadius: 8,
                                        padding: 16,
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        maxHeight: 400,
                                        overflow: "auto",
                                        color: "#333",
                                        margin: 0,
                                    }}
                                >
                                    {previewData.user}
                                </pre>
                            </div>

                            {/* Image Prompt Section */}
                            <div style={{ marginTop: 24 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                                    <h4 style={{
                                        margin: 0,
                                        fontSize: 13,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.05em",
                                        color: "#d97706",
                                        fontWeight: 600,
                                    }}>
                                        Image Prompt (separate step)
                                    </h4>
                                    <button
                                        onClick={() => copyPreviewSection("image", `${previewData.image_system}\n\n${previewData.image_user}`)}
                                        style={{
                                            padding: "4px 10px",
                                            fontSize: 12,
                                            borderRadius: 4,
                                            border: "1px solid #ddd",
                                            background: previewCopied === "image" ? "#f0fdf4" : "#fff",
                                            color: previewCopied === "image" ? "#22c55e" : "#555",
                                            cursor: "pointer",
                                            fontWeight: 500,
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {previewCopied === "image" ? "Copied ✓" : "📋 Copy"}
                                    </button>
                                </div>
                                <pre
                                    style={{
                                        whiteSpace: "pre-wrap",
                                        wordBreak: "break-word",
                                        background: "#fffbeb",
                                        border: "1px solid #fde68a",
                                        borderRadius: 8,
                                        padding: 16,
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        maxHeight: 300,
                                        overflow: "auto",
                                        color: "#333",
                                        margin: 0,
                                    }}
                                >
                                    {previewData.image_system}{"\n\n"}{previewData.image_user}
                                </pre>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 10,
                                padding: "12px 24px",
                                borderTop: "1px solid #e5e5e5",
                                background: "#fafafa",
                            }}
                        >
                            <button
                                onClick={() => {
                                    copyPreviewSection("all", `=== ARTICLE SYSTEM PROMPT ===\n\n${previewData.system}\n\n=== ARTICLE USER PROMPT ===\n\n${previewData.user}\n\n=== IMAGE PROMPT ===\n\n${previewData.image_system}\n\n${previewData.image_user}`);
                                }}
                                style={{
                                    padding: "8px 16px",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    borderRadius: 6,
                                    border: "1px solid #ddd",
                                    background: previewCopied === "all" ? "#f0fdf4" : "#fff",
                                    color: previewCopied === "all" ? "#22c55e" : "#333",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                }}
                            >
                                {previewCopied === "all" ? "Copied ✓" : "📋 Copy All"}
                            </button>
                            <button
                                onClick={() => setPreviewData(null)}
                                style={{
                                    padding: "8px 16px",
                                    fontSize: 13,
                                    fontWeight: 500,
                                    borderRadius: 6,
                                    border: "1px solid #ccc",
                                    background: "#fff",
                                    cursor: "pointer",
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {previewErr && (
                <p style={{ color: "crimson", fontSize: 13, marginTop: 8 }}>
                    Preview failed: {previewErr}
                </p>
            )}
        </main>
    );
}
