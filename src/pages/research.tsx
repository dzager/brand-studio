/**
 * Research Hub — Topic research, source curation, and article generation
 *
 * Two-panel layout: project list (left) + detail view (right)
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import AppLayout from "@/components/layout/AppLayout";
import ResearchDetail from "@/components/research/ResearchDetail";
import { useTaskRunner } from "@/hooks/useTaskRunner";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    Search, Plus, AlertCircle, Sparkles, Globe, Clock, CheckCircle2,
    XCircle, Loader2, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const getServerSideProps: GetServerSideProps = async () => {
    return { props: {} };
};

type ProjectSummary = {
    id: string;
    title: string;
    status: string;
    query: string;
    company_id: string;
    source_count: number;
    parent_id: string | null;
    created_at: string;
};

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    complete: { icon: CheckCircle2, color: "text-green-500", label: "Complete" },
    researching: { icon: Loader2, color: "text-blue-500", label: "Researching" },
    pending: { icon: Clock, color: "text-muted-foreground", label: "Pending" },
    failed: { icon: XCircle, color: "text-destructive", label: "Failed" },
};

export default function ResearchPage() {
    const router = useRouter();
    const { activeAccount, isAdmin } = useAuth();
    const { runTask } = useTaskRunner();

    // State
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // New research form
    const [showNewForm, setShowNewForm] = useState(false);
    const [newQuery, setNewQuery] = useState("");
    const [newCompanyId, setNewCompanyId] = useState("");
    const [creating, setCreating] = useState(false);
    const [createErr, setCreateErr] = useState<string | null>(null);

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true); setErr(null);
        try {
            const [projResp, compResp] = await Promise.all([
                fetch("/api/research"),
                fetch("/api/companies"),
            ]);
            const projData = await projResp.json();
            const compData = await compResp.json();

            if (!projResp.ok) throw new Error(projData.error || "Failed to fetch projects");
            setProjects(projData);
            if (Array.isArray(compData)) {
                setCompanies(compData.map((c: any) => ({ id: c.id, name: c.name })));
                if (compData.length === 1 && !newCompanyId) setNewCompanyId(compData[0].id);
            }
        } catch (e: any) { setErr(e.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-select from query param
    useEffect(() => {
        if (!loading && router.query.id && typeof router.query.id === "string") {
            setSelectedId(router.query.id);
        }
    }, [loading, router.query.id]);

    // Create new research
    async function onCreateResearch() {
        if (!newQuery.trim() || !newCompanyId) return;
        setCreating(true); setCreateErr(null);

        await runTask({
            type: "research",
            label: `Research: ${newQuery.trim().slice(0, 50)}`,
            endpoint: "/api/research",
            body: { query: newQuery.trim(), company_id: newCompanyId },
            meta: { companyId: newCompanyId },
            onSuccess: (data: any) => {
                setCreating(false);
                setShowNewForm(false);
                setNewQuery("");
                fetchData().then(() => {
                    if (data?.id) setSelectedId(data.id);
                });
            },
            onError: (errMsg) => {
                setCreateErr(errMsg);
                setCreating(false);
                fetchData(); // Refresh to show the failed project
            },
        });
    }

    function handleDelete(id: string) {
        setProjects(prev => prev.filter(p => p.id !== id));
        if (selectedId === id) setSelectedId(null);
    }

    // Company name lookup
    const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));

    return (
        <AppLayout fullWidth>
            <div className="flex flex-col h-[calc(100vh-7rem)]">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 shrink-0">
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight">Research Hub</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {projects.length} project{projects.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowNewForm(!showNewForm)}
                        className="gap-1.5"
                        size="sm"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        New Research
                    </Button>
                </div>

                {/* New Research Form */}
                {showNewForm && (
                    <div className="mb-4 p-4 rounded-lg border border-primary/20 bg-primary/[0.02] space-y-3 shrink-0 animate-in fade-in-0 slide-in-from-top-2">
                        <div className="flex items-center gap-2">
                            <Search className="h-4 w-4 text-primary" />
                            <span className="text-sm font-semibold">New Research Project</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Research Topic</Label>
                                <Input
                                    value={newQuery}
                                    onChange={e => setNewQuery(e.target.value)}
                                    placeholder="e.g., dental implant costs and trends in 2026..."
                                    className="text-sm"
                                    onKeyDown={e => { if (e.key === "Enter" && !creating) onCreateResearch(); }}
                                    disabled={creating}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Company</Label>
                                <select
                                    value={newCompanyId}
                                    onChange={e => setNewCompanyId(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    disabled={creating}
                                >
                                    <option value="">— Select —</option>
                                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        {createErr && <p className="text-xs text-destructive">{createErr}</p>}
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setShowNewForm(false); setCreateErr(null); }} disabled={creating}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={onCreateResearch}
                                disabled={creating || !newQuery.trim() || !newCompanyId}
                                className="gap-1.5"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                {creating ? "Researching…" : "Start Research"}
                            </Button>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="space-y-3 p-4">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-3/4" />
                    </div>
                )}

                {err && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{err}</AlertDescription>
                    </Alert>
                )}

                {!loading && projects.length === 0 && !showNewForm && (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                            <Search className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground mb-2">No research projects yet.</p>
                        <Button variant="link" size="sm" onClick={() => setShowNewForm(true)}>
                            Start your first research →
                        </Button>
                    </div>
                )}

                {!loading && projects.length > 0 && (
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <div className="flex h-full gap-0">
                            {/* Project List — Left Panel */}
                            <div className="w-80 shrink-0 border-r border-border overflow-y-auto pr-1">
                                <div className="space-y-1 py-1">
                                    {projects.map(project => {
                                        const isSelected = selectedId === project.id;
                                        const status = STATUS_CONFIG[project.status] || STATUS_CONFIG.pending;
                                        const StatusIcon = status.icon;

                                        return (
                                            <button
                                                key={project.id}
                                                onClick={() => setSelectedId(project.id)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                                                    isSelected
                                                        ? "bg-accent text-accent-foreground"
                                                        : "hover:bg-muted/60"
                                                )}
                                            >
                                                <StatusIcon className={cn("h-4 w-4 shrink-0", status.color, project.status === "researching" && "animate-spin")} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate">
                                                        {project.title}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {companyMap[project.company_id] || "Unknown"}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground">·</span>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {project.source_count} sources
                                                        </span>
                                                        {project.parent_id && (
                                                            <>
                                                                <span className="text-[10px] text-muted-foreground">·</span>
                                                                <Badge variant="outline" className="text-[8px] px-1 py-0">follow-up</Badge>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <ChevronRight className={cn(
                                                    "h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-opacity",
                                                    isSelected ? "opacity-100" : "opacity-0"
                                                )} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Detail View — Right Panel */}
                            <div className="flex-1 overflow-hidden">
                                {selectedId ? (
                                    <ResearchDetail
                                        key={selectedId}
                                        projectId={selectedId}
                                        onDelete={handleDelete}
                                        onFollowUpCreated={fetchData}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        <div className="text-center">
                                            <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                            <p className="text-sm">Select a research project or start a new one</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
