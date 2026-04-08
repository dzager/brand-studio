// ClusterModals.tsx — Dialogs for creating clusters (AI, Manual, Auto-Cluster)

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    Wand2, FolderPlus, Sparkles, RefreshCw, Search, AlertCircle, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Company = { id: string; name: string };

// ── AI Cluster Modal ────────────────────────────────────────────────────

type AiClusterProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companies: Company[];
    onCreated: () => void;
};

export function AiClusterModal({ open, onOpenChange, companies, onCreated }: AiClusterProps) {
    const [companyId, setCompanyId] = useState("");
    const [topic, setTopic] = useState("");
    const [generating, setGenerating] = useState(false);
    const [genErr, setGenErr] = useState<string | null>(null);

    const [existingArticles, setExistingArticles] = useState<{ id: string; title: string; slug: string; company_id?: string }[]>([]);
    const [articleSearch, setArticleSearch] = useState("");
    const [showDropdown, setShowDropdown] = useState(false);
    const [loadingArticles, setLoadingArticles] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        setLoadingArticles(true);
        fetch("/api/articles").then((r) => r.json())
            .then((data) => { if (Array.isArray(data)) setExistingArticles(data.map((a: any) => ({ id: a.id, title: a.title, slug: a.slug, company_id: a.company_id }))); })
            .catch(() => {}).finally(() => setLoadingArticles(false));
    }, [open]);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    async function create() {
        if (!companyId || !topic.trim()) return;
        setGenerating(true); setGenErr(null);
        try {
            const r = await fetch("/api/clusters", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_id: companyId, topic: topic.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Strategy generation failed");
            onCreated();
            onOpenChange(false);
            setTopic("");
        } catch (e: any) { setGenErr(e.message); }
        finally { setGenerating(false); }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Wand2 className="h-5 w-5" /> Generate AI Cluster Strategy
                    </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">Enter a broad topic and AI generates a complete content cluster with keyword targets and interlinking.</p>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-xs">Company *</Label>
                        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                            className={cn("w-full rounded-md border bg-background px-3 py-2 text-sm", companyId ? "border-input" : "border-primary")}>
                            <option value="">— Select company —</option>
                            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Topic *</Label>
                        <div ref={dropdownRef} className="relative mb-2">
                            <div className="relative">
                                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <Input value={articleSearch}
                                    onChange={(e) => { setArticleSearch(e.target.value); setShowDropdown(true); }}
                                    onFocus={() => setShowDropdown(true)}
                                    placeholder={loadingArticles ? "Loading articles…" : "Search existing articles to use as topic…"}
                                    className="pl-9" />
                            </div>
                            {showDropdown && (() => {
                                const filtered = existingArticles.filter((a) => {
                                    const matchesSearch = !articleSearch.trim() || a.title.toLowerCase().includes(articleSearch.toLowerCase());
                                    const matchesCompany = !companyId || a.company_id === companyId;
                                    return matchesSearch && matchesCompany;
                                }).slice(0, 15);
                                if (filtered.length === 0 && !loadingArticles) return null;
                                return (
                                    <div className="absolute top-full left-0 right-0 max-h-56 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg z-50 mt-1">
                                        {loadingArticles ? <div className="p-3 text-sm text-muted-foreground">Loading…</div>
                                            : filtered.map((article) => (
                                                <div key={article.id} onClick={() => { setTopic(article.title); setArticleSearch(""); setShowDropdown(false); }}
                                                    className="px-3 py-2.5 cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-0">
                                                    <div className="text-sm font-medium">{article.title}</div>
                                                    <div className="text-xs text-muted-foreground mt-0.5">/{article.slug}</div>
                                                </div>
                                            ))}
                                    </div>
                                );
                            })()}
                        </div>
                        <Textarea value={topic} onChange={(e) => setTopic(e.target.value)}
                            placeholder="e.g., dental implant options and costs..." rows={3} />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={create} disabled={generating || !companyId || !topic.trim()} className="gap-1.5">
                            <Wand2 className="h-4 w-4" /> {generating ? "Generating Strategy…" : "Generate Cluster Strategy"}
                        </Button>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    </div>
                    {genErr && <p className="text-sm text-destructive">{genErr}</p>}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Manual Cluster Modal ────────────────────────────────────────────────

type ManualClusterProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companies: Company[];
    onCreated: () => void;
};

export function ManualClusterModal({ open, onOpenChange, companies, onCreated }: ManualClusterProps) {
    const [companyId, setCompanyId] = useState("");
    const [name, setName] = useState("");
    const [creating, setCreating] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function create() {
        if (!companyId || !name.trim()) return;
        setCreating(true); setErr(null);
        try {
            const r = await fetch("/api/clusters/manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_id: companyId, name: name.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Creation failed");
            onCreated();
            onOpenChange(false);
            setName("");
        } catch (e: any) { setErr(e.message); }
        finally { setCreating(false); }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FolderPlus className="h-5 w-5" /> Create Manual Cluster
                    </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">Create a named cluster, then assign articles. No AI — you curate the grouping.</p>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-xs">Company *</Label>
                        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                            className={cn("w-full rounded-md border bg-background px-3 py-2 text-sm", companyId ? "border-input" : "border-primary")}>
                            <option value="">— Select company —</option>
                            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Cluster Name *</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Dental Implant Guide" />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={create} disabled={creating || !companyId || !name.trim()} className="gap-1.5">
                            <FolderPlus className="h-4 w-4" /> {creating ? "Creating…" : "Create Cluster"}
                        </Button>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    </div>
                    {err && <p className="text-sm text-destructive">{err}</p>}
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── Auto-Cluster Modal ──────────────────────────────────────────────────

type AutoClusterProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companies: Company[];
    onCreated: () => void;
};

export function AutoClusterModal({ open, onOpenChange, companies, onCreated }: AutoClusterProps) {
    const [companyId, setCompanyId] = useState("");
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<{ message: string; clusters_created: number; articles_assigned: number; clusters?: any[] } | null>(null);
    const [err, setErr] = useState<string | null>(null);

    async function run() {
        if (!companyId) return;
        setRunning(true); setErr(null); setResult(null);
        try {
            const r = await fetch("/api/clusters/auto-cluster", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_id: companyId }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Auto-cluster failed");
            setResult(data);
            if (data.clusters_created > 0) onCreated();
        } catch (e: any) { setErr(e.message); }
        finally { setRunning(false); }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setResult(null); setErr(null); } }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" /> Auto-Cluster Articles
                    </DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                    Analyzes unclustered articles using embeddings and AI to automatically group them into topical clusters.
                </p>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-xs">Company *</Label>
                        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)}
                            className={cn("w-full rounded-md border bg-background px-3 py-2 text-sm", companyId ? "border-input" : "border-primary")}>
                            <option value="">— Select company —</option>
                            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={run} disabled={running || !companyId} className="gap-1.5">
                            {running ? <><RefreshCw className="h-4 w-4 animate-spin" /> Analyzing…</> : "Run Auto-Cluster"}
                        </Button>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                    </div>
                    {err && <p className="text-sm text-destructive">{err}</p>}
                    {result && (
                        <Alert className={result.clusters_created > 0 ? "border-green-500 bg-green-500/5" : ""}>
                            <AlertDescription>
                                <p className="font-semibold">{result.clusters_created > 0 ? "✅" : "ℹ️"} {result.message}</p>
                                {result.clusters && result.clusters.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {result.clusters.map((c: any, i: number) => (
                                            <div key={i} className="text-sm"><strong>{c.name}</strong> — {c.article_count} articles</div>
                                        ))}
                                    </div>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
