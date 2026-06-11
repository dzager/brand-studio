/**
 * Freshness Audit Page — Site-wide fact verification dashboard
 */
import { useState, useEffect, useCallback, useRef } from "react";
import type { GetServerSideProps } from "next";
import AppLayout from "@/components/layout/AppLayout";
import { useTaskRunner } from "@/hooks/useTaskRunner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ShieldCheck, Plus, AlertCircle, Globe, Clock, CheckCircle2,
  XCircle, Loader2, ChevronRight, ChevronDown, ExternalLink,
  AlertTriangle, Info, Download, Trash2, FileText, StopCircle, Pencil,
  ArrowRight, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateFreshnessAuditPdf } from "@/lib/freshnessPdf";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

/* ── Types ─────────────────────────────────────────── */

type AuditSummary = {
  id: string;
  site_url: string;
  title: string | null;
  status: string;
  company_id: string | null;
  pages_crawled: number;
  pages_discovered: number | null;
  total_facts: number;
  issues_found: number;
  critical_issues: number;
  overall_health: number;
  created_at: string;
  completed_at: string | null;
  error: string | null;
};

type FreshnessIssue = {
  fact: { claim: string; claim_type: string; context: string; time_sensitive: boolean };
  status: string;
  severity: string;
  sources: { url: string; title: string; snippet: string; date?: string }[];
  internal_conflict?: {
    conflicting_page_url: string;
    conflicting_page_title: string;
    conflicting_claim: string;
    explanation: string;
  };
  summary: string;
  suggested_correction?: string;
};

type PageReport = {
  url: string;
  title: string;
  page_type: string;
  published_date?: string;
  total_facts: number;
  facts_verified: number;
  issues: FreshnessIssue[];
  health_score: number;
};

type InternalConflict = {
  page_a_url: string;
  page_a_title: string;
  claim_a: string;
  page_b_url: string;
  page_b_title: string;
  claim_b: string;
  conflict_type: string;
  explanation: string;
  severity: string;
};

type FullReport = {
  site_url: string;
  pages_crawled: number;
  pages_discovered?: number;
  remaining_urls?: string[];
  total_facts_extracted: number;
  total_facts_verified: number;
  issues_found: number;
  critical_issues: number;
  overall_health: number;
  pages: PageReport[];
  internal_conflicts: InternalConflict[];
  run_at: string;
  elapsed_ms: number;
};

/* ── Helpers ───────────────────────────────────────── */

function healthColor(score: number) {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-amber-500";
  return "text-destructive";
}

function healthBg(score: number) {
  if (score >= 90) return "bg-green-500/10 border-green-500/20";
  if (score >= 70) return "bg-amber-500/10 border-amber-500/20";
  return "bg-destructive/10 border-destructive/20";
}

function severityIcon(severity: string) {
  if (severity === "critical") return <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />;
  if (severity === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  return <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "destructive" | "outline" | "secondary" }> = {
    outdated: { label: "Outdated", variant: "destructive" },
    conflicting: { label: "Conflicting", variant: "destructive" },
    likely_stale: { label: "Likely Stale", variant: "secondary" },
    unverifiable: { label: "Unverifiable", variant: "outline" },
  };
  const config = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">{config.label}</Badge>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number | undefined | null) {
  if (ms == null || isNaN(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

/* ── Issue Card ────────────────────────────────────── */

function IssueCard({ issue }: { issue: FreshnessIssue }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {severityIcon(issue.severity)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight">"{issue.fact.claim}"</p>
          <div className="flex items-center gap-2 mt-1">
            {statusBadge(issue.status)}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{issue.fact.claim_type}</Badge>
            {issue.fact.time_sensitive && <Badge variant="outline" className="text-[10px] px-1.5 py-0">⏰ Time-sensitive</Badge>}
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />
      </div>

      {expanded && (
        <div className="space-y-2 pt-1 pl-6 text-sm">
          <p className="text-muted-foreground">{issue.summary}</p>

          {issue.suggested_correction && (
            <div className="rounded bg-green-500/5 border border-green-500/20 p-2">
              <p className="text-xs font-medium text-green-600 mb-0.5">Suggested correction:</p>
              <p className="text-xs">{issue.suggested_correction}</p>
            </div>
          )}

          {issue.sources.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Sources:</p>
              {issue.sources.map((src, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{src.title || src.url}</a>
                    {src.snippet && <p className="text-muted-foreground mt-0.5">"{src.snippet}"</p>}
                    {src.date && <span className="text-muted-foreground/60 text-[10px]">{src.date}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {issue.internal_conflict && (
            <div className="rounded bg-amber-500/5 border border-amber-500/20 p-2">
              <p className="text-xs font-medium text-amber-600 mb-0.5">Internal conflict with:</p>
              <a href={issue.internal_conflict.conflicting_page_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                {issue.internal_conflict.conflicting_page_title}
              </a>
              <p className="text-xs mt-1">Conflicting claim: "{issue.internal_conflict.conflicting_claim}"</p>
              <p className="text-xs text-muted-foreground mt-1">{issue.internal_conflict.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Page Report Card ──────────────────────────────── */

function PageCard({ page }: { page: PageReport }) {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = page.issues.length > 0;

  return (
    <div className={cn("rounded-lg border", hasIssues ? healthBg(page.health_score) : "bg-card")}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => hasIssues && setExpanded(!expanded)}>
        <div className={cn("text-lg font-bold tabular-nums", healthColor(page.health_score))}>{page.health_score}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{page.title || page.url}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary truncate max-w-[300px]">{page.url}</a>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">{page.page_type}</Badge>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">{page.total_facts} facts · {page.facts_verified} verified</p>
          {hasIssues && <p className="text-xs font-medium text-destructive">{page.issues.length} issue{page.issues.length !== 1 ? "s" : ""}</p>}
        </div>
        {hasIssues && <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />}
      </div>

      {expanded && hasIssues && (
        <div className="px-3 pb-3 space-y-2 border-t pt-3">
          {page.issues
            .sort((a, b) => {
              const sev: Record<string, number> = { critical: 0, warning: 1, info: 2 };
              return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
            })
            .map((issue, i) => <IssueCard key={i} issue={issue} />)}
        </div>
      )}
    </div>
  );
}

/* ── Report Viewer ─────────────────────────────────── */

function ReportViewer({ auditId, status: parentStatus, onContinue }: { auditId: string; status?: string; onContinue?: (id: string) => void }) {
  const [report, setReport] = useState<FullReport | null>(null);
  const [auditStatus, setAuditStatus] = useState(parentStatus ?? "running");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [continuing, setContinuing] = useState(false);
  const [autoScan, setAutoScan] = useState(true);
  const prevStatusRef = useRef(parentStatus);

  // Sync parent status changes
  useEffect(() => {
    if (parentStatus) setAuditStatus(parentStatus);
  }, [parentStatus]);

  const fetchReport = useCallback((background = false) => {
    fetch(`/api/freshness-report?id=${auditId}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error); }))
      .then(data => {
        setReport(data.report);
        if (data.status) setAuditStatus(data.status);
        if (!background) setLoading(false);
      })
      .catch(e => { setError(e.message); if (!background) setLoading(false); });
  }, [auditId]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchReport();
  }, [fetchReport]);

  // Poll while running
  useEffect(() => {
    if (auditStatus === "running") {
      const interval = setInterval(() => fetchReport(true), 3000);
      return () => clearInterval(interval);
    }
  }, [auditStatus, fetchReport]);

  // Auto-continue: when audit completes with remaining URLs, automatically trigger next batch
  useEffect(() => {
    prevStatusRef.current = auditStatus;

    if (auditStatus !== "running") {
      setContinuing(false);
    }

    if (
      autoScan &&
      auditStatus === "complete" &&
      report?.remaining_urls &&
      report.remaining_urls.length > 0 &&
      onContinue
    ) {
      setContinuing(true);
      const timer = setTimeout(() => {
        onContinue(auditId);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [autoScan, auditStatus, report?.remaining_urls?.length, auditId, onContinue]);

  if (loading) return <div className="p-6 space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-14 w-3/4" /></div>;
  if (error) return <Alert variant="destructive" className="m-6"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>;
  if (!report) return <p className="p-6 text-muted-foreground">No report data available.</p>;

  const filteredPages = report.pages.filter(p => {
    if (filter === "all") return true;
    return p.issues.some(i => i.severity === filter);
  });

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Summary stats */}
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-3 text-center cursor-default">
                <p className={cn("text-3xl font-bold tabular-nums", healthColor(report.overall_health))}>{report.overall_health}</p>
                <p className="text-xs text-muted-foreground mt-1">Health Score</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-center">
              Overall content accuracy rating (0–100). 90+ is healthy, 70–89 needs attention, below 70 is critical.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-3 text-center cursor-default">
                <p className="text-3xl font-bold tabular-nums">{report.pages_crawled}</p>
                <p className="text-xs text-muted-foreground mt-1">Pages Crawled</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-center">
              Number of pages discovered and analyzed during this audit.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-3 text-center cursor-default">
                <p className="text-3xl font-bold tabular-nums">{report.total_facts_verified}<span className="text-lg text-muted-foreground">/{report.total_facts_extracted}</span></p>
                <p className="text-xs text-muted-foreground mt-1">Facts Verified</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-center">
              Facts cross-checked against external sources out of total facts extracted from your content.
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-3 text-center cursor-default">
                <p className={cn("text-3xl font-bold tabular-nums", report.critical_issues > 0 ? "text-destructive" : "text-green-500")}>{report.issues_found}</p>
                <p className="text-xs text-muted-foreground mt-1">Issues Found{report.critical_issues > 0 ? ` (${report.critical_issues} critical)` : ""}</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-center">
              Total factual issues detected — outdated claims, internal conflicts, or unverifiable statements. Critical issues need immediate attention.
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Completed in {formatDuration(report.elapsed_ms)} · {report.total_facts_verified} of {report.total_facts_extracted} facts verified externally</p>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-7 shrink-0"
          onClick={() => generateFreshnessAuditPdf(report)}
        >
          <Download className="h-3 w-3" />
          Download PDF
        </Button>
      </div>

      {/* Continue crawling banner */}
      {auditStatus !== "running" && report.remaining_urls && report.remaining_urls.length > 0 && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium flex items-center gap-2">
              {autoScan && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
              {report.pages_crawled} of {report.pages_discovered ?? (report.pages_crawled + report.remaining_urls.length)} pages audited
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {autoScan
                ? `Auditing remaining ${report.remaining_urls.length} page${report.remaining_urls.length !== 1 ? "s" : ""} automatically…`
                : `${report.remaining_urls.length} more page${report.remaining_urls.length !== 1 ? "s" : ""} discovered and ready to audit.`
              }
            </p>
          </div>
          {autoScan ? (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={() => setAutoScan(false)}
            >
              <StopCircle className="h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              disabled={continuing}
              onClick={() => {
                setAutoScan(true);
                setContinuing(true);
                onContinue?.(auditId);
              }}
            >
              {continuing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              {continuing ? "Continuing…" : "Continue Crawling"}
            </Button>
          )}
        </div>
      )}

      {auditStatus !== "running" && report.remaining_urls && report.remaining_urls.length === 0 && report.pages_discovered && report.pages_discovered > report.pages_crawled && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 flex items-center gap-3">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <p className="text-xs text-muted-foreground">All {report.pages_crawled} discovered pages have been audited.</p>
        </div>
      )}

      {/* Internal conflicts */}
      {report.internal_conflicts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Internal Conflicts ({report.internal_conflicts.length})</h3>
          {report.internal_conflicts.map((c, i) => (
            <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                {severityIcon(c.severity)}
                <Badge variant="outline" className="text-[10px] capitalize">{c.conflict_type.replace(/_/g, " ")}</Badge>
              </div>
              <p><span className="font-medium">Page A:</span> <a href={c.page_a_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{c.page_a_title}</a></p>
              <p className="text-xs text-muted-foreground">"{c.claim_a}"</p>
              <p><span className="font-medium">Page B:</span> <a href={c.page_b_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{c.page_b_title}</a></p>
              <p className="text-xs text-muted-foreground">"{c.claim_b}"</p>
              <p className="text-xs mt-1">{c.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold flex-1">Pages ({filteredPages.length})</h3>
        {(["all", "critical", "warning", "info"] as const).map(f => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" className="text-xs h-7 capitalize" onClick={() => setFilter(f)}>
            {f === "all" ? "All" : f}
          </Button>
        ))}
      </div>

      {/* Page reports */}
      <div className="space-y-2">
        {filteredPages.map((page, i) => <PageCard key={i} page={page} />)}
        {filteredPages.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No pages match this filter.</p>}
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────── */

export default function FreshnessPage() {
  const { activeAccount } = useAuth();
  const { runTask } = useTaskRunner();

  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // New audit form
  const [showForm, setShowForm] = useState(false);
  const [auditUrl, setAuditUrl] = useState("");
  const [auditCompanyId, setAuditCompanyId] = useState("");
  const [auditScope, setAuditScope] = useState<"site" | "page">("site");
  const [alsoRunLinks, setAlsoRunLinks] = useState(false);

  const fetchData = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setErr(null);
    try {
      const [auditResp, compResp] = await Promise.all([
        fetch("/api/freshness-audit"),
        fetch("/api/companies"),
      ]);
      if (auditResp.ok) setAudits(await auditResp.json());
      const compData = await compResp.json();
      if (Array.isArray(compData)) {
        setCompanies(compData.map((c: any) => ({ id: c.id, name: c.name })));
        if (compData.length === 1 && !auditCompanyId) setAuditCompanyId(compData[0].id);
      }
    } catch (e: any) { setErr(e.message); }
    finally { if (!background) setLoading(false); }
  }, [auditCompanyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const isRunning = audits.some(a => a.status === "running");
    if (isRunning) {
      const interval = setInterval(() => fetchData(true), 5000);
      return () => clearInterval(interval);
    }
  }, [audits, fetchData]);

  async function onStartAudit() {
    if (!auditUrl.trim()) return;
    const url = auditUrl.trim();
    const companyId = auditCompanyId || undefined;
    const isSinglePage = auditScope === "page";
    const wantLinks = alsoRunLinks;
    // Reset form immediately — the API returns instantly now
    setAuditUrl("");
    setShowForm(false);
    setAlsoRunLinks(false);

    if (wantLinks) {
      // Use combo endpoint — single crawl for both audits
      runTask({
        type: "site-audit",
        label: `${isSinglePage ? "Page" : "Site"}: ${url.replace(/^https?:\/\//, "").slice(0, 40)}`,
        endpoint: "/api/site-audit",
        body: { url, company_id: companyId, max_pages: isSinglePage ? 1 : 30, single_page: isSinglePage, analyses: ["freshness", "links"] },
        meta: { link: "/freshness" },
        onSuccess: (data: any) => {
          fetchData().then(() => { if (data?.freshness_id) setSelectedId(data.freshness_id); });
        },
        onError: () => { fetchData(); },
      });
    } else {
      runTask({
        type: "freshness-audit",
        label: `${isSinglePage ? "Page" : "Site"}: ${url.replace(/^https?:\/\//, "").slice(0, 40)}`,
        endpoint: "/api/freshness-audit",
        body: { url, company_id: companyId, max_pages: isSinglePage ? 1 : 30, single_page: isSinglePage },
        meta: { link: "/freshness" },
        onSuccess: (data: any) => {
          fetchData().then(() => { if (data?.id) setSelectedId(data.id); });
        },
        onError: () => { fetchData(); },
      });
    }
  }

  async function onDeleteAudit(id: string) {
    await fetch(`/api/freshness-report?id=${id}`, { method: "DELETE" });
    setAudits(prev => prev.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }

  async function onStopAudit(id: string) {
    try {
      const resp = await fetch("/api/freshness-audit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (resp.ok) {
        setAudits(prev =>
          prev.map(a =>
            a.id === id ? { ...a, status: "cancelled", error: "Stopped by user", completed_at: new Date().toISOString() } : a
          )
        );
      }
    } catch (e) {
      console.error("Failed to stop audit:", e);
    }
  }

  async function onContinueAudit(id: string) {
    try {
      const resp = await fetch("/api/freshness-audit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (resp.ok) {
        // Optimistically set status to running so polling kicks in
        setAudits(prev =>
          prev.map(a =>
            a.id === id ? { ...a, status: "running", completed_at: null } : a
          )
        );
      }
    } catch (e) {
      console.error("Failed to continue audit:", e);
    }
  }

  const companyMap = Object.fromEntries(companies.map(c => [c.id, c.name]));

  async function onRenameAudit(id: string, newTitle: string) {
    const trimmed = newTitle.trim();
    setAudits(prev => prev.map(a => a.id === id ? { ...a, title: trimmed || null } : a));
    setEditingId(null);
    try {
      await fetch(`/api/freshness-report?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
    } catch (e) {
      console.error("Failed to rename audit:", e);
    }
  }

  return (
    <AppLayout fullWidth>
      <div className="flex flex-col h-[calc(100vh-7rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Content Freshness</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Verify facts across your sites</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="gap-1.5" size="sm">
            <Plus className="h-3.5 w-3.5" /> New Audit
          </Button>
        </div>

        {/* New Audit Form */}
        {showForm && (
          <div className="mb-4 p-4 rounded-lg border border-primary/20 bg-primary/[0.02] space-y-3 shrink-0 animate-in fade-in-0 slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">New Freshness Audit</span>
              </div>
              <div className="flex items-center rounded-md border border-input bg-background p-0.5">
                <button
                  onClick={() => setAuditScope("site")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    auditScope === "site" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Globe className="h-3 w-3" /> Full Site
                </button>
                <button
                  onClick={() => setAuditScope("page")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                    auditScope === "page" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileText className="h-3 w-3" /> Single Page
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{auditScope === "page" ? "Page URL" : "Website URL"}</Label>
                <Input
                  value={auditUrl}
                  onChange={e => setAuditUrl(e.target.value)}
                  placeholder={auditScope === "page" ? "e.g., https://example.com/blog/my-article" : "e.g., https://example.com"}
                  className="text-sm"
                  onKeyDown={e => { if (e.key === "Enter") onStartAudit(); }}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company (optional)</Label>
                <select
                  value={auditCompanyId}
                  onChange={e => setAuditCompanyId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {auditScope === "page" && (
              <p className="text-[11px] text-muted-foreground">Single-page mode skips site crawling and audits only the specific URL you provide.</p>
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alsoRunLinks}
                  onChange={e => setAlsoRunLinks(e.target.checked)}
                  className="rounded border-input h-3.5 w-3.5 accent-primary"
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> Also run Link Audit
                </span>
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button size="sm" onClick={onStartAudit} disabled={!auditUrl.trim()} className="gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {auditScope === "page" ? "Audit Page" : "Audit Site"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="space-y-3 p-4"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>}
        {err && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertDescription>{err}</AlertDescription></Alert>}

        {!loading && audits.length === 0 && !showForm && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <ShieldCheck className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-2">No audits yet.</p>
            <Button variant="link" size="sm" onClick={() => setShowForm(true)}>Run your first freshness audit →</Button>
          </div>
        )}

        {!loading && audits.length > 0 && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="flex h-full gap-0">
              {/* Audit List */}
              <div className="w-80 shrink-0 border-r border-border overflow-y-auto pr-1">
                <div className="space-y-1 py-1">
                  {audits.map(audit => {
                    const isSelected = selectedId === audit.id;
                    const isRunning = audit.status === "running";
                    const isFailed = audit.status === "failed";
                    const isCancelled = audit.status === "cancelled";

                    return (
                      <div key={audit.id} className="group relative">
                        <button
                          onClick={() => setSelectedId(audit.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                            isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"
                          )}
                        >
                          {isRunning ? <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" /> :
                           isFailed ? <XCircle className="h-4 w-4 text-destructive shrink-0" /> :
                           isCancelled ? <StopCircle className="h-4 w-4 text-amber-500 shrink-0" /> :
                           <div className={cn("text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0 border", healthBg(audit.overall_health), healthColor(audit.overall_health))}>{audit.overall_health}</div>}
                          <div className="flex-1 min-w-0">
                            {editingId === audit.id ? (
                              <input
                                autoFocus
                                className="text-sm font-medium bg-background border border-input rounded px-1.5 py-0.5 w-full outline-none focus:ring-1 focus:ring-ring"
                                value={editingTitle}
                                onChange={e => setEditingTitle(e.target.value)}
                                onBlur={() => onRenameAudit(audit.id, editingTitle)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") onRenameAudit(audit.id, editingTitle);
                                  if (e.key === "Escape") setEditingId(null);
                                }}
                                onClick={e => e.stopPropagation()}
                              />
                            ) : (
                              <div className="flex items-center gap-1 group/title">
                                <p className="text-sm font-medium truncate">{audit.title || audit.site_url.replace(/^https?:\/\//, "")}</p>
                                <button
                                  className="opacity-0 group-hover/title:opacity-60 hover:!opacity-100 p-0.5 rounded transition-opacity shrink-0"
                                  title="Rename audit"
                                  onClick={e => {
                                    e.stopPropagation();
                                    setEditingId(audit.id);
                                    setEditingTitle(audit.title || audit.site_url.replace(/^https?:\/\//, ""));
                                  }}
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {audit.company_id && <span className="text-[10px] text-muted-foreground">{companyMap[audit.company_id] || ""}</span>}
                              <span className="text-[10px] text-muted-foreground">{formatDate(audit.created_at)}</span>
                              {isCancelled && <span className="text-[10px] text-amber-500">· stopped</span>}
                              {!isRunning && !isFailed && !isCancelled && <span className="text-[10px] text-muted-foreground">· {audit.issues_found} issues</span>}
                            </div>
                          </div>
                          <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground/50 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
                        </button>
                        {isRunning && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onStopAudit(audit.id); }}
                            className="absolute right-7 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-80 hover:!opacity-100 p-1 rounded transition-opacity"
                            title="Stop audit"
                          >
                            <StopCircle className="h-3.5 w-3.5 text-amber-500" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteAudit(audit.id); }}
                          className="absolute right-1 top-1 opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded transition-opacity"
                          title="Delete audit"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detail View */}
              <div className="flex-1 overflow-hidden">
                {selectedId ? (
                  <ReportViewer key={selectedId} auditId={selectedId} status={audits.find(a => a.id === selectedId)?.status} onContinue={onContinueAudit} />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Globe className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Select an audit or start a new one</p>
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
