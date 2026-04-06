// PanelView.tsx — Article detail pane for improving content
// Shows similarity analysis, SEO data, article content, and all action buttons

import { useState, useRef, useEffect } from "react";

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
    // Edit state
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editExcerpt, setEditExcerpt] = useState("");
    const [editHtml, setEditHtml] = useState("");
    const [editViewMode, setEditViewMode] = useState<"visual" | "html">("visual");
    const [saving, setSaving] = useState(false);
    const contentEditableRef = useRef<HTMLDivElement>(null);

    // Delete
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Publish
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);

    // Copy
    const [copied, setCopied] = useState(false);

    // Regenerate article
    const [regenerating, setRegenerating] = useState(false);
    const [regenErr, setRegenErr] = useState<string | null>(null);

    // Image refresh & style
    const [refreshingImage, setRefreshingImage] = useState(false);
    const [imagePromptInput, setImagePromptInput] = useState("");
    const [imageStyles, setImageStyles] = useState<{ id: string; label: string; narrative?: string }[]>([]);
    const [selectedStyle, setSelectedStyle] = useState(article.image_style ?? "default");
    const [refreshErr, setRefreshErr] = useState<string | null>(null);

    // Similarity
    const [similarResults, setSimilarResults] = useState<SimilarityResult[] | null>(null);
    const [checkingSimilarity, setCheckingSimilarity] = useState(false);
    const [simErr, setSimErr] = useState<string | null>(null);

    // Insert image modal
    const [showInsertModal, setShowInsertModal] = useState(false);
    const [insertMode, setInsertMode] = useState<"inline" | "featured" | "editInline">("inline");
    const [insertTab, setInsertTab] = useState<"search" | "generate" | "upload">("search");
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
    const savedRangeRef = useRef<Range | null>(null);

    // Lazy-load full article data (html, image_base64 excluded from list for performance)
    const [fullArticle, setFullArticle] = useState<Article | null>(null);
    const [loadingFull, setLoadingFull] = useState(false);

    useEffect(() => {
        // If article already has html, it's already full
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

    // Fetch company image styles
    useEffect(() => {
        if (!article.company_id) {
            setImageStyles([]);
            return;
        }
        fetch(`/api/companies/${article.company_id}`)
            .then((r) => r.json())
            .then((data) => {
                if (data?.image_style_categories && Array.isArray(data.image_style_categories) && data.image_style_categories.length > 0) {
                    setImageStyles(data.image_style_categories);
                } else {
                    setImageStyles([]);
                }
            })
            .catch(() => setImageStyles([]));
    }, [article.company_id]);

    // Use fullArticle for content/image display, fallback to article for metadata
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
        } catch (e: any) {
            alert(`Save failed: ${e.message}`);
        } finally { setSaving(false); }
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            const r = await fetch(`/api/articles/${article.id}`, { method: "DELETE" });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to delete");
            onDelete(article.id);
        } catch (e: any) {
            alert(`Delete failed: ${e.message}`);
        } finally { setDeleting(false); setConfirmDelete(false); }
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
        } catch (e: any) {
            alert(`Publish failed: ${e.message}`);
        } finally { setPublishing(false); }
    }

    async function handleCopy() {
        const html = [`<h1>${article.title}</h1>`, article.excerpt ? `<p><em>${article.excerpt}</em></p>` : "", displayArticle.html ?? ""].filter(Boolean).join("\n");
        const plain = article.title + (article.excerpt ? `\n\n${article.excerpt}` : "") + "\n\n" + (displayArticle.html ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        try {
            await navigator.clipboard.write([new ClipboardItem({
                "text/html": new Blob([html], { type: "text/html" }),
                "text/plain": new Blob([plain], { type: "text/plain" }),
            })]);
        } catch { await navigator.clipboard.writeText(plain); }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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

            // Update the existing article with new content
            const saveResp = await fetch(`/api/articles/${article.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    html: data.html,
                    excerpt: data.excerpt,
                    image_base64: data.image_base64,
                    image_prompt: data.image_prompt,
                    seo: data.seo,
                    outline: data.outline,
                    model_used: data.model_used,
                }),
            });
            const saveData = await saveResp.json();
            if (!saveResp.ok) throw new Error(saveData.error || "Failed to save");
            onUpdate({ ...article, ...saveData });
        } catch (e: any) { setRegenErr(e.message); }
        finally { setRegenerating(false); }
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
                body: JSON.stringify({ image_base64: data.image_base64, image_prompt: data.final_prompt, image_style: selectedStyle }),
            });
            const saveData = await saveResp.json();
            if (!saveResp.ok) throw new Error(saveData.error || "Failed to save");
            onUpdate({ ...article, image_base64: data.image_base64, image_prompt: data.final_prompt, image_style: selectedStyle });
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

    // Insert image helpers
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

    // Auto-save featured image when a preview is set in featured mode
    useEffect(() => {
        if (insertMode !== "featured" || !insertPreview || !showInsertModal) return;
        // Auto-trigger the save
        (async () => {
            setInsertSaving(true); setInsertErr(null);
            try {
                let base64Data: string;
                if (insertPreview.type === "base64") {
                    base64Data = insertPreview.src;
                } else {
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
                // Insert at cursor in the contentEditable editor
                const imgSrc = insertPreview.type === "base64" ? `data:image/png;base64,${insertPreview.src}` : `/api/image-proxy?url=${encodeURIComponent(insertPreview.src)}`;
                const figureHtml = `<figure style="margin:24px 0;text-align:center"><img src="${imgSrc}" alt="" style="max-width:100%;border-radius:10px" /></figure>`;

                // Restore saved selection and insert
                const sel = window.getSelection();
                if (savedRangeRef.current && sel) {
                    sel.removeAllRanges();
                    sel.addRange(savedRangeRef.current);
                    // Insert using execCommand for undo support
                    document.execCommand("insertHTML", false, figureHtml);
                } else {
                    // Fallback: append to editor
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
    const roleColor = article.cluster_role ? ({
        pillar: { bg: "#eef2ff", fg: "#4338ca" },
        supporting: { bg: "#f0fdf4", fg: "#16a34a" },
        long_tail: { bg: "#fefce8", fg: "#a16207" },
    } as any)[article.cluster_role] : null;

    const btnStyle: React.CSSProperties = {
        padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 5,
        border: "1px solid #ddd", background: "#fff", cursor: "pointer",
    };

    if (editing) {
        return (
            <div style={{ padding: 20 }}>
                <h3 style={{ margin: "0 0 16px" }}>✏️ Edit Article</h3>
                <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Title</label>
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                        style={{ width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box" }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Excerpt</label>
                    <textarea value={editExcerpt} onChange={(e) => setEditExcerpt(e.target.value)} rows={2}
                        style={{ width: "100%", padding: "8px 12px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <label style={{ fontSize: 13, fontWeight: 500 }}>Body</label>
                        <div style={{ display: "flex", gap: 0, border: "1px solid #ccc", borderRadius: 5, overflow: "hidden" }}>
                            {(["visual", "html"] as const).map((mode) => (
                                <button key={mode} type="button" onClick={() => { if (mode === "html" && editViewMode === "visual") syncFromContentEditable(); setEditViewMode(mode); }}
                                    style={{ padding: "4px 12px", fontSize: 11, fontWeight: editViewMode === mode ? 600 : 400, border: "none", background: editViewMode === mode ? "#191F1D" : "#fff", color: editViewMode === mode ? "#fff" : "#555", cursor: "pointer" }}>
                                    {mode === "visual" ? "Visual" : "HTML"}
                                </button>
                            ))}
                        </div>
                    </div>
                    {editViewMode === "visual" && (
                        <div style={{ display: "flex", gap: 2, flexWrap: "wrap", padding: "6px 8px", background: "#f5f5f5", border: "1px solid #ccc", borderBottom: "none", borderRadius: "6px 6px 0 0" }}>
                            {[{ label: "B", cmd: "bold" }, { label: "I", cmd: "italic" }, { label: "H2", cmd: "formatBlock", value: "H2" }, { label: "H3", cmd: "formatBlock", value: "H3" }, { label: "P", cmd: "formatBlock", value: "P" }].map((btn) => (
                                <button key={btn.label} type="button" onMouseDown={(e) => { e.preventDefault(); execFormat(btn.cmd, btn.value); }}
                                    style={{ padding: "4px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 4, background: "#fff", cursor: "pointer" }}>{btn.label}</button>
                            ))}
                            <div style={{ width: 1, background: "#ddd", margin: "0 4px" }} />
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); const url = prompt("Enter URL:"); if (url) execFormat("createLink", url); }}
                                style={{ padding: "4px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 4, background: "#fff", cursor: "pointer" }}>🔗</button>
                            <button type="button" onMouseDown={(e) => { e.preventDefault(); execFormat("insertUnorderedList"); }}
                                style={{ padding: "4px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 4, background: "#fff", cursor: "pointer" }}>• List</button>
                            <div style={{ width: 1, background: "#ddd", margin: "0 4px" }} />
                            <button type="button" onMouseDown={(e) => {
                                e.preventDefault();
                                // Save current cursor position before opening modal
                                const sel = window.getSelection();
                                if (sel && sel.rangeCount > 0) {
                                    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                                }
                                setInsertMode("editInline");
                                setInsertPreview(null);
                                setInsertErr(null);
                                setShowInsertModal(true);
                            }}
                                style={{ padding: "4px 10px", fontSize: 13, border: "1px solid #ddd", borderRadius: 4, background: "#fff", cursor: "pointer" }}>🖼</button>
                        </div>
                    )}
                    {editViewMode === "visual" ? (
                        <div ref={contentEditableRef} contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: editHtml }} onBlur={syncFromContentEditable}
                            style={{ width: "100%", minHeight: 250, padding: "12px 14px", fontSize: 14, lineHeight: 1.7, borderRadius: "0 0 6px 6px", border: "1px solid #ccc", boxSizing: "border-box", background: "#fff", outline: "none", overflowY: "auto", maxHeight: 500 }} />
                    ) : (
                        <textarea value={editHtml} onChange={(e) => setEditHtml(e.target.value)} rows={14}
                            style={{ width: "100%", padding: "8px 12px", fontSize: 13, fontFamily: "monospace", borderRadius: 6, border: "1px solid #ccc", boxSizing: "border-box", resize: "vertical" }} />
                    )}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setEditing(false)} disabled={saving} style={{ ...btnStyle }}>Cancel</button>
                    <button onClick={saveEdit} disabled={saving} style={{ ...btnStyle, border: "1px solid #FDB72A", background: "#FDB72A", color: "#191F1D", fontWeight: 600 }}>
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                </div>

                {/* Insert Image Modal — rendered inside edit mode so it overlays the editor */}
                {showInsertModal && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowInsertModal(false)}>
                        <div style={{ background: "#fff", borderRadius: 12, width: "90%", maxWidth: 720, maxHeight: "85vh", overflowY: "auto", padding: 24, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                <h2 style={{ margin: 0, fontSize: 18 }}>🖼 Insert Image into Article</h2>
                                <button onClick={() => setShowInsertModal(false)} style={btnStyle}>✕ Close</button>
                            </div>
                            <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e5e5e5" }}>
                                {(["search", "generate", "upload"] as const).map((tab) => (
                                    <button key={tab} onClick={() => { setInsertTab(tab); setInsertPreview(null); setInsertErr(null); }}
                                        style={{ padding: "10px 20px", fontSize: 14, fontWeight: insertTab === tab ? 600 : 400, border: "none", borderBottom: insertTab === tab ? "2px solid #FDB72A" : "2px solid transparent", background: "none", cursor: "pointer", color: insertTab === tab ? "#191F1D" : "#888", marginBottom: -2 }}>
                                        {tab === "search" ? "🔍 Search Web" : tab === "generate" ? "✨ Generate" : "📁 Upload"}
                                    </button>
                                ))}
                            </div>
                            {insertTab === "search" && (
                                <div>
                                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                        <input type="text" placeholder="e.g. family hiking mountain trail" value={insertSearchQuery} onChange={(e) => setInsertSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onInsertSearch(); }}
                                            style={{ flex: 1, padding: "10px 14px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }} />
                                        <button onClick={onInsertSearch} disabled={insertSearching || !insertSearchQuery.trim()} style={{ ...btnStyle, padding: "10px 18px" }}>{insertSearching ? "Searching…" : "Search"}</button>
                                    </div>
                                    {insertSearchResults.length > 0 && (
                                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
                                            {insertSearchResults.map((img, i) => (
                                                <button key={i} onClick={() => setInsertPreview({ src: img.imageUrl, type: "url" })} style={{ padding: 0, border: insertPreview?.src === img.imageUrl ? "3px solid #FDB72A" : "2px solid #e5e5e5", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "none" }}>
                                                    <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                                                    <div style={{ padding: "4px 6px", fontSize: 10, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{img.domain}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            {insertTab === "generate" && (
                                <div style={{ marginBottom: 12 }}>
                                    {imageStyles.length > 0 && (
                                        <div style={{ marginBottom: 10 }}>
                                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#666", marginBottom: 4 }}>Image Style</label>
                                            <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)}
                                                style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #ccc" }}>
                                                {imageStyles.map((s) => (
                                                    <option key={s.id} value={s.id}>{s.label}{s.narrative ? ` — ${s.narrative.slice(0, 60)}…` : ""}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <input type="text" placeholder={article.image_prompt ? "Leave empty to use original prompt…" : "Describe the image…"} value={insertGenPrompt} onChange={(e) => setInsertGenPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onInsertGenerate(); }}
                                            style={{ flex: 1, padding: "10px 14px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }} />
                                        <button onClick={onInsertGenerate} disabled={insertGenerating} style={{ ...btnStyle, padding: "10px 18px" }}>{insertGenerating ? "Generating…" : "Generate"}</button>
                                    </div>
                                    {!insertGenPrompt.trim() && article.image_prompt && (
                                        <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>💡 Will use: <em>{article.image_prompt.slice(0, 120)}{article.image_prompt.length > 120 ? "…" : ""}</em></div>
                                    )}
                                </div>
                            )}
                            {insertTab === "upload" && (
                                <div>
                                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                                        const file = e.target.files?.[0]; if (!file) return;
                                        const reader = new FileReader(); reader.onloadend = () => setInsertPreview({ src: (reader.result as string).split(",")[1], type: "base64" }); reader.readAsDataURL(file); e.target.value = "";
                                    }} />
                                    <div onClick={() => fileInputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => {
                                        e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (!file?.type.startsWith("image/")) return;
                                        const reader = new FileReader(); reader.onloadend = () => setInsertPreview({ src: (reader.result as string).split(",")[1], type: "base64" }); reader.readAsDataURL(file);
                                    }} style={{ border: "2px dashed #ccc", borderRadius: 10, padding: "40px 20px", textAlign: "center", cursor: "pointer", color: "#888" }}>
                                        <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                                        <div style={{ fontWeight: 500, color: "#555" }}>Click to browse or drag & drop</div>
                                    </div>
                                </div>
                            )}
                            {insertErr && <p style={{ color: "crimson", fontSize: 13, margin: "8px 0" }}>{insertErr}</p>}
                            {insertPreview && (
                                <div style={{ marginBottom: 16 }}>
                                    <p style={{ fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 8 }}>Preview</p>
                                    <img src={insertPreview.type === "base64" ? `data:image/png;base64,${insertPreview.src}` : insertPreview.src} alt="Preview" style={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e5e5" }} />
                                </div>
                            )}
                            {insertPreview && (
                                <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                    <span style={{ fontSize: 13, color: "#666" }}>Image will be inserted at cursor position</span>
                                    <button onClick={doInsertImage} disabled={insertSaving} style={{ ...btnStyle, border: "1px solid #FDB72A", background: "#FDB72A", color: "#191F1D", fontWeight: 600, padding: "10px 24px" }}>
                                        {insertSaving ? "Saving…" : "Insert"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ padding: 20, overflowY: "auto", height: "100%" }}>
            {/* Header */}
            <div style={{ marginBottom: 16 }}>
                <h2 style={{ margin: "0 0 6px", fontSize: 20 }}>{article.title}</h2>
                {article.excerpt && <p style={{ margin: "0 0 10px", color: "#666", fontSize: 14 }}><em>{article.excerpt}</em></p>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12 }}>
                    <span style={{ padding: "2px 8px", borderRadius: 4, background: "#e0f2fe", color: "#0369a1", fontWeight: 500 }}>
                        {article.company_id && companies[article.company_id] ? companies[article.company_id] : "Brand Studio"}
                    </span>
                    {roleColor && (
                        <span style={{ padding: "2px 8px", borderRadius: 4, background: roleColor.bg, color: roleColor.fg, fontWeight: 600 }}>
                            🔗 {article.cluster_role?.replace("_", "-")}
                        </span>
                    )}
                    {article.model_used && <span style={{ padding: "2px 8px", borderRadius: 4, background: "#f0f0f0" }}>{article.model_used}</span>}
                    <span style={{ color: "#999" }}>{new Date(article.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
            </div>

            {loadingFull && <p style={{ color: "#888", fontSize: 13 }}>Loading article content…</p>}

            {/* Actions bar */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #e5e5e5" }}>
                <button onClick={handleCopy} style={{ ...btnStyle, background: copied ? "#f0fdf4" : "#fff", color: copied ? "#22c55e" : undefined }}>
                    {copied ? "Copied ✓" : "📋 Copy"}
                </button>
                <button onClick={handlePublish} disabled={publishing} style={{ ...btnStyle, border: published ? "1px solid #22c55e" : undefined, background: published ? "#f0fdf4" : "#fff", color: published ? "#22c55e" : undefined }}>
                    {publishing ? "Publishing…" : published ? "✓ Published!" : "🚀 Publish"}
                </button>
                <button onClick={startEdit} style={btnStyle}>✏️ Edit</button>
                <button onClick={handleRegenerate} disabled={regenerating} style={{ ...btnStyle, color: regenerating ? "#999" : "#b45309" }}>
                    {regenerating ? "Regenerating…" : "🔄 Regenerate"}
                </button>
                <button onClick={() => { setShowInsertModal(true); setInsertMode("inline"); }} style={btnStyle}>🖼 Image</button>
                {confirmDelete ? (
                    <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={handleDelete} disabled={deleting} style={{ ...btnStyle, border: "1px solid #ef4444", background: "#fef2f2", color: "#ef4444", fontWeight: 600 }}>
                            {deleting ? "…" : "Confirm"}
                        </button>
                        <button onClick={() => setConfirmDelete(false)} style={btnStyle}>Cancel</button>
                    </div>
                ) : (
                    <button onClick={() => setConfirmDelete(true)} style={{ ...btnStyle, color: "#ef4444" }}>🗑 Delete</button>
                )}
            </div>

            {regenErr && <p style={{ color: "crimson", fontSize: 13, margin: "0 0 12px" }}>Regeneration failed: {regenErr}</p>}

            {/* Similarity Analysis */}
            <div style={{ marginBottom: 16, padding: 14, borderRadius: 8, border: "1px solid #e5e5e5", background: "#fafafa" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: similarResults ? 10 : 0 }}>
                    <h4 style={{ margin: 0, fontSize: 14, color: "#555" }}>🔍 Similarity Analysis</h4>
                    <button onClick={checkSimilarity} disabled={checkingSimilarity || !article.company_id}
                        style={{ ...btnStyle, border: "1px solid #f59e0b", color: "#b45309", fontSize: 12, opacity: !article.company_id ? 0.5 : 1 }}>
                        {checkingSimilarity ? "Checking…" : "Find Similar"}
                    </button>
                </div>
                {simErr && <p style={{ color: "crimson", fontSize: 12, margin: "4px 0 0" }}>{simErr}</p>}
                {similarResults !== null && (
                    similarResults.length === 0 ? (
                        <div style={{ fontSize: 13, color: "#16a34a", display: "flex", alignItems: "center", gap: 6 }}>
                            ✅ No significant overlap found
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            {similarResults.map((r) => {
                                const pct = Math.round(r.similarity * 100);
                                const color = pct >= 92 ? "#dc2626" : pct >= 85 ? "#c2410c" : "#a16207";
                                return (
                                    <button key={r.id} onClick={() => onSelectArticle(r.id)}
                                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 5, background: "#fff", border: "1px solid #e5e5e5", cursor: "pointer", fontSize: 12, textAlign: "left", width: "100%" }}>
                                        <span style={{ padding: "1px 6px", borderRadius: 3, fontSize: 11, fontWeight: 700, color, background: pct >= 92 ? "#fef2f2" : pct >= 85 ? "#fff7ed" : "#fefce8", flexShrink: 0 }}>{pct}%</span>
                                        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                                    </button>
                                );
                            })}
                        </div>
                    )
                )}
            </div>

            {/* SEO Data */}
            {seo && (
                <details style={{ marginBottom: 16 }}>
                    <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#555", padding: "8px 0" }}>📊 SEO Data</summary>
                    <div style={{ padding: 14, borderRadius: 8, border: "1px solid #e5e5e5", background: "#fff", fontSize: 13 }}>
                        {seo.primary_keyword && <div style={{ marginBottom: 6 }}><strong>Primary:</strong> {seo.primary_keyword}</div>}
                        {seo.secondary_keywords && <div style={{ marginBottom: 6 }}><strong>Secondary:</strong> {(seo.secondary_keywords as string[]).join(", ")}</div>}
                        {seo.meta_title && <div style={{ marginBottom: 6 }}><strong>Meta Title:</strong> {seo.meta_title}</div>}
                        {seo.meta_description && <div><strong>Meta Desc:</strong> {seo.meta_description}</div>}
                    </div>
                </details>
            )}

            {/* Featured Image */}
            {displayArticle.image_base64 && (
                <div style={{ marginBottom: 16, position: "relative" }}>
                    <img src={`data:image/png;base64,${displayArticle.image_base64}`} alt={article.title}
                        style={{ width: "100%", borderRadius: 10, display: "block" }} />
                    <button onClick={() => { setShowInsertModal(true); setInsertMode("featured"); setInsertGenPrompt(""); setInsertPreview(null); setInsertErr(null); setInsertTab("generate"); }}
                        style={{ position: "absolute", bottom: 10, right: 10, ...btnStyle, background: "rgba(0,0,0,0.55)", color: "#fff", border: "1px solid rgba(255,255,255,0.6)", backdropFilter: "blur(4px)" }}>
                        🖼 Change Image
                    </button>
                </div>
            )}

            {/* Image controls */}
            {article.image_prompt && (
                <div style={{ marginBottom: 16, padding: 14, borderRadius: 8, border: "1px solid #e5e5e5", background: "#fafafa" }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "#555" }}>🖼️ Image Options</h4>

                    {/* Style selector */}
                    {imageStyles.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#666", marginBottom: 4 }}>Image Style</label>
                            <select
                                value={selectedStyle}
                                onChange={(e) => setSelectedStyle(e.target.value)}
                                style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #ccc" }}
                            >
                                {imageStyles.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.label}{s.narrative ? ` — ${s.narrative.slice(0, 60)}…` : ""}
                                    </option>
                                ))}
                            </select>
                            {selectedStyle !== (article.image_style ?? "default") && (
                                <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>⚡ Style changed — regenerate to apply</div>
                            )}
                        </div>
                    )}

                    {/* Prompt + refresh */}
                    <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
                        <input type="text" placeholder="Optional: add extra image direction…" value={imagePromptInput} onChange={(e) => setImagePromptInput(e.target.value)}
                            style={{ flex: 1, minWidth: 200, padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #ccc" }} />
                        <button onClick={refreshImage} disabled={refreshingImage}
                            style={{ ...btnStyle, whiteSpace: "nowrap" }}>
                            {refreshingImage ? "Generating…" : "🔄 Regenerate"}
                        </button>
                    </div>

                    {refreshErr && <p style={{ color: "crimson", fontSize: 12, margin: "8px 0 0" }}>{refreshErr}</p>}
                </div>
            )}

            {/* Article Content */}
            <div dangerouslySetInnerHTML={{ __html: displayArticle.html ?? "" }} style={{ lineHeight: 1.7, fontSize: 15 }} />

            {/* Image Prompt */}
            {article.image_prompt && (
                <details style={{ marginTop: 16 }}>
                    <summary style={{ cursor: "pointer", fontSize: 13, color: "#888" }}>Image prompt</summary>
                    <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#666" }}>{article.image_prompt}</pre>
                </details>
            )}

            {/* ====== Insert Image Modal ====== */}
            {showInsertModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowInsertModal(false)}>
                    <div style={{ background: "#fff", borderRadius: 12, width: "90%", maxWidth: 720, maxHeight: "85vh", overflowY: "auto", padding: 24, boxShadow: "0 12px 40px rgba(0,0,0,0.18)" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <h2 style={{ margin: 0, fontSize: 18 }}>🖼 {insertMode === "featured" ? "Change Featured Image" : insertMode === "editInline" ? "Insert Image" : "Insert Image"}</h2>
                            <button onClick={() => setShowInsertModal(false)} style={btnStyle}>✕ Close</button>
                        </div>
                        <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "2px solid #e5e5e5" }}>
                            {(["search", "generate", "upload"] as const).map((tab) => (
                                <button key={tab} onClick={() => { setInsertTab(tab); setInsertPreview(null); setInsertErr(null); }}
                                    style={{ padding: "10px 20px", fontSize: 14, fontWeight: insertTab === tab ? 600 : 400, border: "none", borderBottom: insertTab === tab ? "2px solid #FDB72A" : "2px solid transparent", background: "none", cursor: "pointer", color: insertTab === tab ? "#191F1D" : "#888", marginBottom: -2 }}>
                                    {tab === "search" ? "🔍 Search Web" : tab === "generate" ? "✨ Generate" : "📁 Upload"}
                                </button>
                            ))}
                        </div>
                        {insertTab === "search" && (
                            <div>
                                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                                    <input type="text" placeholder="e.g. family hiking mountain trail" value={insertSearchQuery} onChange={(e) => setInsertSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onInsertSearch(); }}
                                        style={{ flex: 1, padding: "10px 14px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }} />
                                    <button onClick={onInsertSearch} disabled={insertSearching || !insertSearchQuery.trim()} style={{ ...btnStyle, padding: "10px 18px" }}>{insertSearching ? "Searching…" : "Search"}</button>
                                </div>
                                {insertSearchResults.length > 0 && (
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
                                        {insertSearchResults.map((img, i) => (
                                            <button key={i} onClick={() => setInsertPreview({ src: img.imageUrl, type: "url" })} style={{ padding: 0, border: insertPreview?.src === img.imageUrl ? "3px solid #FDB72A" : "2px solid #e5e5e5", borderRadius: 8, overflow: "hidden", cursor: "pointer", background: "none" }}>
                                                <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} style={{ width: "100%", height: 100, objectFit: "cover", display: "block" }} />
                                                <div style={{ padding: "4px 6px", fontSize: 10, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{img.domain}</div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {insertTab === "generate" && (
                            <div style={{ marginBottom: 12 }}>
                                {/* Style selector in generate tab */}
                                {imageStyles.length > 0 && (
                                    <div style={{ marginBottom: 10 }}>
                                        <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#666", marginBottom: 4 }}>Image Style</label>
                                        <select
                                            value={selectedStyle}
                                            onChange={(e) => setSelectedStyle(e.target.value)}
                                            style={{ width: "100%", padding: "8px 12px", fontSize: 13, borderRadius: 6, border: "1px solid #ccc" }}
                                        >
                                            {imageStyles.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.label}{s.narrative ? ` — ${s.narrative.slice(0, 60)}…` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div style={{ display: "flex", gap: 8 }}>
                                    <input type="text" placeholder={article.image_prompt ? "Leave empty to use original prompt…" : "Describe the image…"} value={insertGenPrompt} onChange={(e) => setInsertGenPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onInsertGenerate(); }}
                                        style={{ flex: 1, padding: "10px 14px", fontSize: 14, borderRadius: 6, border: "1px solid #ccc" }} />
                                    <button onClick={onInsertGenerate} disabled={insertGenerating} style={{ ...btnStyle, padding: "10px 18px" }}>{insertGenerating ? "Generating…" : "Generate"}</button>
                                </div>
                                {!insertGenPrompt.trim() && article.image_prompt && (
                                    <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>💡 Will use: <em>{article.image_prompt.slice(0, 120)}{article.image_prompt.length > 120 ? "…" : ""}</em></div>
                                )}
                            </div>
                        )}
                        {insertTab === "upload" && (
                            <div>
                                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                                    const file = e.target.files?.[0]; if (!file) return;
                                    const reader = new FileReader(); reader.onloadend = () => setInsertPreview({ src: (reader.result as string).split(",")[1], type: "base64" }); reader.readAsDataURL(file); e.target.value = "";
                                }} />
                                <div onClick={() => fileInputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); }} onDrop={(e) => {
                                    e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (!file?.type.startsWith("image/")) return;
                                    const reader = new FileReader(); reader.onloadend = () => setInsertPreview({ src: (reader.result as string).split(",")[1], type: "base64" }); reader.readAsDataURL(file);
                                }} style={{ border: "2px dashed #ccc", borderRadius: 10, padding: "40px 20px", textAlign: "center", cursor: "pointer", color: "#888" }}>
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                                    <div style={{ fontWeight: 500, color: "#555" }}>Click to browse or drag & drop</div>
                                </div>
                            </div>
                        )}
                        {insertErr && <p style={{ color: "crimson", fontSize: 13, margin: "8px 0" }}>{insertErr}</p>}
                        {insertPreview && (
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ fontSize: 13, fontWeight: 500, color: "#555", marginBottom: 8 }}>Preview</p>
                                <img src={insertPreview.type === "base64" ? `data:image/png;base64,${insertPreview.src}` : insertPreview.src} alt="Preview" style={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 8, border: "1px solid #e5e5e5" }} />
                            </div>
                        )}
                        {insertPreview && (
                            <div style={{ borderTop: "1px solid #e5e5e5", paddingTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                {insertMode === "inline" && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 13 }}>
                                        <span style={{ fontWeight: 500 }}>Insert at:</span>
                                        {(["top", "bottom"] as const).map((pos) => (
                                            <label key={pos} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                                                <input type="radio" name="insert-pos-panel" checked={insertPosition === pos} onChange={() => setInsertPosition(pos)} />
                                                {pos === "top" ? "Top" : "Bottom"}
                                            </label>
                                        ))}
                                    </div>
                                )}
                                {insertMode === "editInline" && <span style={{ fontSize: 13, color: "#666" }}>Image will be inserted at cursor position</span>}
                                {insertMode === "featured" && (
                                    <span style={{ fontSize: 13, color: insertSaving ? "#b45309" : "#22c55e", fontWeight: 500 }}>
                                        {insertSaving ? "⏳ Saving to article…" : "✓ Featured image updated"}
                                    </span>
                                )}
                                {insertMode !== "featured" && (
                                    <button onClick={doInsertImage} disabled={insertSaving} style={{ ...btnStyle, border: "1px solid #FDB72A", background: "#FDB72A", color: "#191F1D", fontWeight: 600, padding: "10px 24px" }}>
                                        {insertSaving ? "Saving…" : "Insert & Save"}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
