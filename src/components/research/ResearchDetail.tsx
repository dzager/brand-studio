/**
 * ResearchDetail — Tabbed detail view for a research project
 * Tabs: Overview | Sources | Brief | Follow-up
 */
import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Search, ExternalLink, ChevronDown, ChevronRight, BarChart3, Quote, AlertTriangle,
    Lightbulb, FileText, Sparkles, RefreshCw, Trash2, Globe, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskRunner } from "@/hooks/useTaskRunner";
import HighlightableText, { type Highlight } from "./HighlightableText";
import ResearchBrief, { type BriefData } from "./ResearchBrief";

interface Source {
    id: string;
    url: string;
    title: string;
    domain: string;
    content_text: string | null;
    summary: string | null;
    relevance_score: number;
    highlights: Highlight[];
}

interface Analysis {
    title: string;
    key_findings: string[];
    statistics: { stat: string; source: string; context: string }[];
    expert_quotes: { quote: string; attribution: string; source_url: string }[];
    contrarian_angles: string[];
    content_gaps: string[];
    suggested_angles: string[];
    suggested_queries: string[];
    source_summaries: { url: string; summary: string; relevance_score: number }[];
}

interface Project {
    id: string;
    title: string;
    status: string;
    query: string;
    company_id: string;
    analysis: Analysis | null;
    brief: BriefData | null;
    suggested_queries: string[];
    sources: Source[];
    created_at: string;
}

interface ResearchDetailProps {
    projectId: string;
    onDelete: (id: string) => void;
    onFollowUpCreated: () => void;
}

const TABS = [
    { id: "overview", label: "Overview", icon: Lightbulb },
    { id: "sources", label: "Sources", icon: Globe },
    { id: "brief", label: "Brief", icon: FileText },
    { id: "followup", label: "Follow-up", icon: Search },
] as const;

type TabId = typeof TABS[number]["id"];

export default function ResearchDetail({ projectId, onDelete, onFollowUpCreated }: ResearchDetailProps) {
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabId>("overview");
    const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
    const [compilingBrief, setCompilingBrief] = useState(false);
    const [followUpQuery, setFollowUpQuery] = useState("");
    const [followUpLoading, setFollowUpLoading] = useState(false);
    const [creatingArticle, setCreatingArticle] = useState(false);
    const { runTask } = useTaskRunner();

    // Fetch project data
    const fetchProject = useCallback(async () => {
        setLoading(true); setErr(null);
        try {
            const r = await fetch(`/api/research/${projectId}`);
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to fetch");
            setProject(data);
        } catch (e: any) { setErr(e.message); }
        finally { setLoading(false); }
    }, [projectId]);

    useEffect(() => { fetchProject(); }, [fetchProject]);

    // Save highlights for a source
    async function saveHighlights(sourceId: string, highlights: Highlight[]) {
        if (!project) return;
        // Optimistic update
        setProject(prev => prev ? {
            ...prev,
            sources: prev.sources.map(s => s.id === sourceId ? { ...s, highlights } : s),
        } : prev);

        try {
            await fetch(`/api/research/${projectId}/highlights`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source_id: sourceId, highlights }),
            });
        } catch { /* Non-blocking */ }
    }

    // Compile brief
    async function onCompileBrief() {
        setCompilingBrief(true);
        await runTask({
            type: "research-brief",
            label: `Brief: ${project?.title?.slice(0, 40) || "Research"}`,
            endpoint: `/api/research/${projectId}/brief`,
            body: {},
            onSuccess: (data: BriefData) => {
                setProject(prev => prev ? { ...prev, brief: data } : prev);
                setCompilingBrief(false);
                setActiveTab("brief");
            },
            onError: () => { setCompilingBrief(false); },
        });
    }

    // Create article from angle
    async function onCreateArticle(angle: string) {
        if (!project) return;
        setCreatingArticle(true);
        await runTask({
            type: "research-article",
            label: `Article: ${angle.slice(0, 40)}`,
            endpoint: `/api/research/${projectId}/create-article`,
            body: { angle },
            meta: { companyId: project.company_id },
            onSuccess: () => {
                setCreatingArticle(false);
                window.dispatchEvent(new Event("article-created"));
            },
            onError: () => { setCreatingArticle(false); },
        });
    }

    // Follow-up research
    async function onFollowUp(query: string) {
        if (!query.trim()) return;
        setFollowUpLoading(true);
        await runTask({
            type: "research",
            label: `Follow-up: ${query.trim().slice(0, 40)}`,
            endpoint: `/api/research/${projectId}/follow-up`,
            body: { query: query.trim() },
            onSuccess: () => {
                setFollowUpLoading(false);
                setFollowUpQuery("");
                onFollowUpCreated();
            },
            onError: () => { setFollowUpLoading(false); },
        });
    }

    async function onDeleteProject() {
        if (!confirm("Delete this research project and all its sources?")) return;
        try {
            await fetch(`/api/research/${projectId}`, { method: "DELETE" });
            onDelete(projectId);
        } catch { }
    }

    if (loading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <div className="space-y-2 mt-6">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </div>
        );
    }

    if (err || !project) {
        return (
            <div className="p-6 text-center text-muted-foreground">
                <p className="text-sm">{err || "Project not found"}</p>
                <Button variant="link" size="sm" onClick={fetchProject}>Retry</Button>
            </div>
        );
    }

    const analysis = project.analysis;
    const highlightCount = project.sources.reduce((acc, s) => acc + (s.highlights?.length || 0), 0);

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-6 pt-5 pb-3 border-b border-border shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold tracking-tight truncate">{project.title}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant={project.status === "complete" ? "default" : project.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                                {project.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                                {project.sources.length} sources
                                {highlightCount > 0 && ` · ${highlightCount} highlights`}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                · {new Date(project.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={onDeleteProject}>
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-0 mt-3 -mb-px">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                                    isActive
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                {tab.label}
                                {tab.id === "sources" && <Badge variant="outline" className="text-[9px] ml-0.5 px-1">{project.sources.length}</Badge>}
                                {tab.id === "brief" && project.brief && <Badge variant="outline" className="text-[9px] ml-0.5 px-1 bg-green-500/10 text-green-600 border-green-500/30">✓</Badge>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {activeTab === "overview" && analysis && <OverviewTab analysis={analysis} onCreateArticle={onCreateArticle} creatingArticle={creatingArticle} />}
                {activeTab === "overview" && !analysis && (
                    <p className="text-sm text-muted-foreground text-center py-12">No analysis available yet.</p>
                )}

                {activeTab === "sources" && (
                    <SourcesTab
                        sources={project.sources}
                        expandedSources={expandedSources}
                        onToggleSource={(id) => {
                            setExpandedSources(prev => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id); else next.add(id);
                                return next;
                            });
                        }}
                        onSaveHighlights={saveHighlights}
                    />
                )}

                {activeTab === "brief" && (
                    <div className="space-y-4">
                        {!project.brief ? (
                            <div className="text-center py-12">
                                <Lightbulb className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground mb-3">
                                    {highlightCount > 0
                                        ? `Compile a brief from your ${highlightCount} highlights`
                                        : "Highlight content from Sources first, or compile from analysis findings"}
                                </p>
                                <Button onClick={onCompileBrief} disabled={compilingBrief} className="gap-1.5">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {compilingBrief ? "Compiling…" : "Compile Brief"}
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-end">
                                    <Button variant="outline" size="sm" onClick={onCompileBrief} disabled={compilingBrief} className="gap-1 text-xs">
                                        <RefreshCw className={cn("h-3 w-3", compilingBrief && "animate-spin")} />
                                        Recompile
                                    </Button>
                                </div>
                                <ResearchBrief brief={project.brief} onCreateArticle={onCreateArticle} />
                            </>
                        )}
                    </div>
                )}

                {activeTab === "followup" && (
                    <FollowUpTab
                        suggestedQueries={project.suggested_queries || analysis?.suggested_queries || []}
                        followUpQuery={followUpQuery}
                        setFollowUpQuery={setFollowUpQuery}
                        onFollowUp={onFollowUp}
                        loading={followUpLoading}
                    />
                )}
            </div>
        </div>
    );
}

// ── Overview Tab ─────────────────────────────────────────────────────────

function OverviewTab({ analysis, onCreateArticle, creatingArticle }: { analysis: Analysis; onCreateArticle: (angle: string) => void; creatingArticle: boolean }) {
    return (
        <div className="space-y-5">
            {/* Key Findings */}
            {analysis.key_findings.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Key Findings
                    </h3>
                    <div className="space-y-1.5">
                        {analysis.key_findings.map((f, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm group rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors">
                                <span className="text-primary font-medium shrink-0 mt-0.5">{i + 1}.</span>
                                <span className="text-foreground/85 flex-1">{f}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary"
                                    onClick={() => onCreateArticle(f)}
                                    disabled={creatingArticle}
                                >
                                    <FileText className="h-3 w-3" />
                                    Create Article
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Statistics */}
            {analysis.statistics.length > 0 && (<>
                <Separator />
                <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <BarChart3 className="h-3.5 w-3.5 text-blue-500" /> Statistics & Data
                    </h3>
                    <div className="grid gap-2">
                        {analysis.statistics.map((s, i) => (
                            <Card key={i} className="border-border/50 group hover:border-primary/30 transition-colors">
                                <CardContent className="p-2.5 flex items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{s.stat}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{s.context}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-[10px] gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary mt-0.5"
                                        onClick={() => onCreateArticle(`${s.stat} — ${s.context}`)}
                                        disabled={creatingArticle}
                                    >
                                        <FileText className="h-3 w-3" />
                                        Create Article
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </>)}

            {/* Expert Quotes */}
            {analysis.expert_quotes.length > 0 && (<>
                <Separator />
                <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Quote className="h-3.5 w-3.5 text-purple-500" /> Expert Quotes
                    </h3>
                    <div className="space-y-2">
                        {analysis.expert_quotes.map((q, i) => (
                            <blockquote key={i} className="border-l-2 border-purple-400/50 pl-3 py-1">
                                <p className="text-sm italic text-foreground/80">"{q.quote}"</p>
                                <p className="text-xs text-muted-foreground mt-1">— {q.attribution}</p>
                            </blockquote>
                        ))}
                    </div>
                </div>
            </>)}

            {/* Contrarian Angles */}
            {analysis.contrarian_angles.length > 0 && (<>
                <Separator />
                <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Contrarian Angles
                    </h3>
                    <ul className="space-y-1">
                        {analysis.contrarian_angles.map((a, i) => (
                            <li key={i} className="text-sm text-foreground/80 flex items-start gap-1.5 group rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors">
                                <span className="text-amber-400 shrink-0 mt-0.5">⚡</span>
                                <span className="flex-1">{a}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary"
                                    onClick={() => onCreateArticle(a)}
                                    disabled={creatingArticle}
                                >
                                    <FileText className="h-3 w-3" />
                                    Create Article
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            </>)}

            {/* Content Gaps */}
            {analysis.content_gaps.length > 0 && (<>
                <Separator />
                <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Search className="h-3.5 w-3.5 text-green-500" /> Content Gaps
                    </h3>
                    <ul className="space-y-1">
                        {analysis.content_gaps.map((g, i) => (
                            <li key={i} className="text-sm text-foreground/80 flex items-start gap-1.5 group rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors">
                                <span className="text-green-400 shrink-0 mt-0.5">🔍</span>
                                <span className="flex-1">{g}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary"
                                    onClick={() => onCreateArticle(g)}
                                    disabled={creatingArticle}
                                >
                                    <FileText className="h-3 w-3" />
                                    Create Article
                                </Button>
                            </li>
                        ))}
                    </ul>
                </div>
            </>)}

            {/* Suggested Angles */}
            {analysis.suggested_angles?.length > 0 && (<>
                <Separator />
                <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Suggested Angles
                    </h3>
                    <div className="space-y-1">
                        {analysis.suggested_angles.map((a, i) => (
                            <div key={i} className="text-sm text-foreground/80 flex items-start gap-1.5 group rounded-md px-2 py-1.5 -mx-2 hover:bg-muted/40 transition-colors">
                                <span className="text-primary/60 shrink-0 mt-0.5">→</span>
                                <span className="flex-1">{a}</span>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-[10px] gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-primary hover:text-primary"
                                    onClick={() => onCreateArticle(a)}
                                    disabled={creatingArticle}
                                >
                                    <FileText className="h-3 w-3" />
                                    Create Article
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            </>)}
        </div>
    );
}

// ── Sources Tab ──────────────────────────────────────────────────────────

function SourcesTab({
    sources, expandedSources, onToggleSource, onSaveHighlights,
}: {
    sources: Source[];
    expandedSources: Set<string>;
    onToggleSource: (id: string) => void;
    onSaveHighlights: (sourceId: string, highlights: Highlight[]) => void;
}) {
    return (
        <div className="space-y-2">
            {sources.map((source) => {
                const isExpanded = expandedSources.has(source.id);
                return (
                    <div key={source.id} className="border border-border/50 rounded-lg overflow-hidden">
                        <button
                            onClick={() => onToggleSource(source.id)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors text-left"
                        >
                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{source.title || source.url}</p>
                                <p className="text-xs text-muted-foreground truncate">{source.domain}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {source.highlights?.length > 0 && (
                                    <Badge variant="secondary" className="text-[9px]">{source.highlights.length} hl</Badge>
                                )}
                                {source.relevance_score > 0 && (
                                    <Badge variant="outline" className="text-[9px]">{Math.round(source.relevance_score * 100)}%</Badge>
                                )}
                                <a href={source.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-muted-foreground hover:text-primary">
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </div>
                        </button>

                        {isExpanded && (
                            <div className="border-t border-border/50 px-3 py-3 bg-muted/20">
                                {source.summary && (
                                    <div className="mb-3 p-2 rounded bg-primary/5 border border-primary/10">
                                        <p className="text-xs font-medium text-primary mb-0.5">AI Summary</p>
                                        <p className="text-xs text-foreground/80">{source.summary}</p>
                                    </div>
                                )}
                                {source.content_text ? (
                                    <HighlightableText
                                        content={source.content_text}
                                        highlights={source.highlights || []}
                                        onHighlightsChange={(hl) => onSaveHighlights(source.id, hl)}
                                    />
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">Content could not be extracted from this source.</p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
            {sources.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No sources crawled yet.</p>
            )}
        </div>
    );
}

// ── Follow-up Tab ────────────────────────────────────────────────────────

function FollowUpTab({
    suggestedQueries, followUpQuery, setFollowUpQuery, onFollowUp, loading,
}: {
    suggestedQueries: string[];
    followUpQuery: string;
    setFollowUpQuery: (q: string) => void;
    onFollowUp: (q: string) => void;
    loading: boolean;
}) {
    return (
        <div className="space-y-5">
            {/* Suggested queries */}
            {suggestedQueries.length > 0 && (
                <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 text-primary" /> Suggested Follow-ups
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {suggestedQueries.map((q, i) => (
                            <button
                                key={i}
                                onClick={() => onFollowUp(q)}
                                disabled={loading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
                            >
                                <ArrowRight className="h-3 w-3 text-primary" />
                                {q}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <Separator />

            {/* Custom query */}
            <div>
                <h3 className="text-sm font-semibold mb-2">Custom Research Query</h3>
                <div className="flex gap-2">
                    <Input
                        value={followUpQuery}
                        onChange={e => setFollowUpQuery(e.target.value)}
                        placeholder="Enter a follow-up research topic..."
                        className="text-sm"
                        onKeyDown={e => { if (e.key === "Enter") onFollowUp(followUpQuery); }}
                        disabled={loading}
                    />
                    <Button onClick={() => onFollowUp(followUpQuery)} disabled={loading || !followUpQuery.trim()} className="gap-1 whitespace-nowrap">
                        <Search className="h-3.5 w-3.5" />
                        {loading ? "Researching…" : "Research"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
