/**
 * Link Audit Page — Site-wide link health dashboard
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
  Link2, Plus, AlertCircle, Globe, Clock, CheckCircle2,
  XCircle, Loader2, ChevronRight, ChevronDown, ExternalLink,
  AlertTriangle, Info, Download, Trash2, FileText, StopCircle,
  Unlink, ArrowRight, Workflow, BarChart3, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generateLinkAuditPdf } from "@/lib/linkAuditPdf";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

export const getServerSideProps: GetServerSideProps = async () => ({ props: {} });

/* ── Types ─────────────────────────────────────────── */

type AuditSummary = {
  id: string;
  site_url: string;
  status: string;
  company_id: string | null;
  pages_crawled: number;
  total_links: number;
  broken_links: number;
  redirects_found: number;
  orphan_pages: number;
  opportunities_found: number;
  overall_score: number;
  created_at: string;
  completed_at: string | null;
  error: string | null;
};

type BrokenLink = {
  source_url: string;
  source_title: string;
  href: string;
  anchor_text: string;
  is_internal: boolean;
  status: string;
  http_code: number;
  error?: string;
};

type RedirectLink = {
  source_url: string;
  source_title: string;
  href: string;
  anchor_text: string;
  is_internal: boolean;
  http_code: number;
  redirect_url: string;
};

type OrphanPage = {
  url: string;
  title: string;
  page_type: string;
  outgoing_links: number;
};

type InterlinkOpportunity = {
  source_url: string;
  source_title: string;
  target_url: string;
  target_title: string;
  matched_phrase: string;
  context: string;
  confidence: "high" | "medium" | "low";
};

type PageLinkDensity = {
  url: string;
  title: string;
  internal_out: number;
  internal_in: number;
  external_out: number;
  total: number;
  word_count: number;
  density_per_1000_words: number;
  rating: "good" | "low" | "high";
};

type FullReport = {
  site_url: string;
  pages_crawled: number;
  total_links: number;
  internal_links: number;
  external_links: number;
  broken_links: BrokenLink[];
  redirect_links: RedirectLink[];
  orphan_pages: OrphanPage[];
  opportunities: InterlinkOpportunity[];
  link_density: PageLinkDensity[];
  overall_score: number;
  run_at: string;
  elapsed_ms: number;
  remaining_urls?: string[];
  pages_discovered?: number;
};

/* ── Helpers ───────────────────────────────────────── */

function scoreColor(score: number) {
  if (score >= 90) return "text-green-500";
  if (score >= 70) return "text-amber-500";
  return "text-destructive";
}

function scoreBg(score: number) {
  if (score >= 90) return "bg-green-500/10 border-green-500/20";
  if (score >= 70) return "bg-amber-500/10 border-amber-500/20";
  return "bg-destructive/10 border-destructive/20";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDuration(ms: number) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function httpStatusBadge(code: number) {
  if (code === 0) return <Badge variant="outline" className="text-[10px] px-1.5 py-0">N/A</Badge>;
  if (code >= 500) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{code}</Badge>;
  if (code >= 400) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{code}</Badge>;
  if (code >= 300) return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{code}</Badge>;
  return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600">{code}</Badge>;
}

function confidenceBadge(confidence: string) {
  const map: Record<string, { variant: "default" | "secondary" | "outline" }> = {
    high: { variant: "default" },
    medium: { variant: "secondary" },
    low: { variant: "outline" },
  };
  const config = map[confidence] || { variant: "outline" };
  return <Badge variant={config.variant} className="text-[10px] px-1.5 py-0 capitalize">{confidence}</Badge>;
}

function densityBadge(rating: string) {
  const map: Record<string, { label: string; variant: "default" | "destructive" | "secondary" | "outline" }> = {
    good: { label: "Good", variant: "outline" },
    low: { label: "Low", variant: "secondary" },
    high: { label: "High", variant: "destructive" },
  };
  const config = map[rating] || { label: rating, variant: "outline" };
  return <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">{config.label}</Badge>;
}

/* ── Tab Navigation ────────────────────────────────── */

type ReportTab = "overview" | "broken" | "redirects" | "opportunities" | "orphans" | "density";

const TABS: { key: ReportTab; label: string; icon: typeof AlertCircle }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "broken", label: "Broken", icon: Unlink },
  { key: "redirects", label: "Redirects", icon: ArrowRight },
  { key: "opportunities", label: "Opportunities", icon: Workflow },
  { key: "orphans", label: "Orphans", icon: AlertTriangle },
  { key: "density", label: "Density", icon: BarChart3 },
];

/* ── Overview Tab ──────────────────────────────────── */

function OverviewTab({ report }: { report: FullReport }) {
  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-3 text-center cursor-default">
                <p className={cn("text-3xl font-bold tabular-nums", scoreColor(report.overall_score))}>{report.overall_score}</p>
                <p className="text-xs text-muted-foreground mt-1">Link Score</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-center">
              Overall link health rating (0–100). Penalizes broken links, redirects, and orphan pages.
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
                <p className="text-3xl font-bold tabular-nums">{report.total_links}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Links</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-center">
              {report.internal_links} internal · {report.external_links} external
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-lg border p-3 text-center cursor-default">
                <p className={cn("text-3xl font-bold tabular-nums", report.broken_links.length > 0 ? "text-destructive" : "text-green-500")}>{report.broken_links.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Broken Links</p>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[220px] text-center">
              Links returning 4xx/5xx status codes or failing to connect.
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <p className={cn("text-2xl font-bold tabular-nums", report.redirect_links.length > 5 ? "text-amber-500" : "")}>{report.redirect_links.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Redirects</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className={cn("text-2xl font-bold tabular-nums", report.orphan_pages.length > 0 ? "text-amber-500" : "")}>{report.orphan_pages.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Orphan Pages</p>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold tabular-nums text-blue-500">{report.opportunities.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Opportunities</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Completed in {formatDuration(report.elapsed_ms)}</p>
      </div>

      {/* Quick Issues Summary */}
      {(report.broken_links.length > 0 || report.orphan_pages.length > 0) && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Issues Summary</h3>
          {report.broken_links.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <Unlink className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm"><span className="font-medium">{report.broken_links.length} broken link{report.broken_links.length !== 1 ? "s" : ""}</span> found across {new Set(report.broken_links.map(l => l.source_url)).size} page{new Set(report.broken_links.map(l => l.source_url)).size !== 1 ? "s" : ""}</p>
            </div>
          )}
          {report.orphan_pages.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <p className="text-sm"><span className="font-medium">{report.orphan_pages.length} orphan page{report.orphan_pages.length !== 1 ? "s" : ""}</span> receive no internal links from other pages</p>
            </div>
          )}
          {report.opportunities.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <Workflow className="h-4 w-4 text-blue-500 shrink-0" />
              <p className="text-sm"><span className="font-medium">{report.opportunities.length} interlinking opportunit{report.opportunities.length !== 1 ? "ies" : "y"}</span> — pages mentioning topics without linking</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Broken Links Tab ──────────────────────────────── */

function BrokenLinksTab({ links }: { links: BrokenLink[] }) {
  const [sortBy, setSortBy] = useState<"status" | "source">("status");

  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
        <p className="text-sm font-medium">No broken links found!</p>
        <p className="text-xs text-muted-foreground mt-1">All checked links returned valid responses.</p>
      </div>
    );
  }

  const sorted = [...links].sort((a, b) => {
    if (sortBy === "status") return b.http_code - a.http_code;
    return a.source_url.localeCompare(b.source_url);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{links.length} Broken Link{links.length !== 1 ? "s" : ""}</h3>
        <div className="flex gap-1">
          <Button variant={sortBy === "status" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setSortBy("status")}>By Status</Button>
          <Button variant={sortBy === "source" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setSortBy("source")}>By Page</Button>
        </div>
      </div>
      <div className="space-y-2">
        {sorted.map((link, i) => (
          <div key={i} className="rounded-lg border border-destructive/15 bg-destructive/[0.02] p-3 space-y-1">
            <div className="flex items-start gap-2">
              <Unlink className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-destructive hover:underline">{link.href}</a>
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {httpStatusBadge(link.http_code)}
                  {link.is_internal ? (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Internal</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">External</Badge>
                  )}
                  {link.error && <span className="text-[10px] text-muted-foreground">{link.error}</span>}
                </div>
              </div>
            </div>
            <div className="pl-5 text-xs text-muted-foreground">
              <span>Found on: </span>
              <a href={link.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{link.source_title || link.source_url}</a>
              {link.anchor_text && <span> — anchor: "{link.anchor_text}"</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Redirects Tab ─────────────────────────────────── */

function RedirectsTab({ links }: { links: RedirectLink[] }) {
  if (links.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
        <p className="text-sm font-medium">No redirects detected</p>
        <p className="text-xs text-muted-foreground mt-1">All links point directly to their final destination.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{links.length} Redirect{links.length !== 1 ? "s" : ""}</h3>
        <p className="text-xs text-muted-foreground">Update these links to point to the final URL to reduce load time</p>
      </div>
      <div className="space-y-2">
        {links.map((link, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm truncate">{link.href}</p>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  {httpStatusBadge(link.http_code)}
                </div>
              </div>
            </div>
            <div className="pl-5 space-y-0.5">
              <p className="text-xs">
                <span className="text-muted-foreground">→ Final URL: </span>
                <a href={link.redirect_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{link.redirect_url}</a>
              </p>
              <p className="text-xs text-muted-foreground">
                Found on: <a href={link.source_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{link.source_title || link.source_url}</a>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Opportunities Tab ──────────────────────────────── */

function OpportunitiesTab({ opportunities }: { opportunities: InterlinkOpportunity[] }) {
  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
        <p className="text-sm font-medium">No new interlinking opportunities found</p>
        <p className="text-xs text-muted-foreground mt-1">Your pages are well-interlinked for the content we crawled.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{opportunities.length} Opportunit{opportunities.length !== 1 ? "ies" : "y"}</h3>
        <p className="text-xs text-muted-foreground">Pages that mention topics without linking to related content</p>
      </div>
      <div className="space-y-2">
        {opportunities.map((opp, i) => (
          <div key={i} className="rounded-lg border border-blue-500/15 bg-blue-500/[0.02] p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Workflow className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <a href={opp.source_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{opp.source_title}</a>
                  <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  <a href={opp.target_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{opp.target_title}</a>
                  {confidenceBadge(opp.confidence)}
                </div>
              </div>
            </div>
            <div className="pl-5">
              <p className="text-xs text-muted-foreground">
                Mentions "<span className="font-medium text-foreground">{opp.matched_phrase}</span>" without linking:
              </p>
              <p className="text-xs text-muted-foreground mt-1 italic">"{opp.context}"</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Orphan Pages Tab ──────────────────────────────── */

function OrphansTab({ orphans }: { orphans: OrphanPage[] }) {
  if (orphans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
        <p className="text-sm font-medium">No orphan pages detected</p>
        <p className="text-xs text-muted-foreground mt-1">All crawled pages receive at least one internal link.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{orphans.length} Orphan Page{orphans.length !== 1 ? "s" : ""}</h3>
        <p className="text-xs text-muted-foreground">These pages have no internal links pointing to them</p>
      </div>
      <div className="space-y-2">
        {orphans.map((page, i) => (
          <div key={i} className="rounded-lg border border-amber-500/15 bg-amber-500/[0.02] p-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{page.title || page.url}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary truncate max-w-[300px]">{page.url}</a>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">{page.page_type}</Badge>
                  <span className="text-[10px] text-muted-foreground">{page.outgoing_links} outgoing link{page.outgoing_links !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Link Density Tab ──────────────────────────────── */

function DensityTab({ density }: { density: PageLinkDensity[] }) {
  const [sortBy, setSortBy] = useState<"density" | "in" | "out">("density");

  const sorted = [...density].sort((a, b) => {
    if (sortBy === "density") return a.density_per_1000_words - b.density_per_1000_words;
    if (sortBy === "in") return a.internal_in - b.internal_in;
    return b.internal_out - a.internal_out;
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Link Density per Page</h3>
        <div className="flex gap-1">
          <Button variant={sortBy === "density" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setSortBy("density")}>Density</Button>
          <Button variant={sortBy === "in" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setSortBy("in")}>Incoming</Button>
          <Button variant={sortBy === "out" ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setSortBy("out")}>Outgoing</Button>
        </div>
      </div>
      <div className="space-y-1.5">
        {sorted.map((page, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{page.title || page.url}</p>
                <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary truncate block max-w-[300px]">{page.url}</a>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="tabular-nums">↗ {page.internal_out}</span>
                  </TooltipTrigger>
                  <TooltipContent>Internal outgoing links</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="tabular-nums">↙ {page.internal_in}</span>
                  </TooltipTrigger>
                  <TooltipContent>Internal incoming links</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="tabular-nums">⬈ {page.external_out}</span>
                  </TooltipTrigger>
                  <TooltipContent>External outgoing links</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="tabular-nums">{page.density_per_1000_words}/1k</span>
                  </TooltipTrigger>
                  <TooltipContent>Links per 1,000 words</TooltipContent>
                </Tooltip>
                {densityBadge(page.rating)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Report Viewer ─────────────────────────────────── */

function ReportViewer({ auditId, status: parentStatus, onContinue }: { auditId: string; status?: string; onContinue?: (id: string) => void }) {
  const [report, setReport] = useState<FullReport | null>(null);
  const [auditStatus, setAuditStatus] = useState(parentStatus ?? "running");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");
  const [continuing, setContinuing] = useState(false);
  const [autoScan, setAutoScan] = useState(true); // auto-continue by default
  const prevStatusRef = useRef(parentStatus);

  // Sync parent status changes
  useEffect(() => {
    if (parentStatus) setAuditStatus(parentStatus);
  }, [parentStatus]);

  const fetchReport = useCallback((background = false) => {
    fetch(`/api/link-report?id=${auditId}`)
      .then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error); }))
      .then(data => {
        setReport(data.report);
        // Track status directly from the DB — more reliable than parent polling
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

  // Auto-continue: detect running → complete transition with remaining URLs
  useEffect(() => {
    const wasRunning = prevStatusRef.current === "running";
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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full">
        {/* Tab bar + PDF download */}
        <div className="flex items-center justify-between border-b px-4 shrink-0">
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {TABS.map(tab => {
              const Icon = tab.icon;
              let count: number | undefined;
              if (tab.key === "broken") count = report.broken_links.length;
              if (tab.key === "redirects") count = report.redirect_links.length;
              if (tab.key === "opportunities") count = report.opportunities.length;
              if (tab.key === "orphans") count = report.orphan_pages.length;

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap",
                    activeTab === tab.key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {count !== undefined && count > 0 && (
                    <span className={cn(
                      "ml-1 text-[10px] font-semibold rounded-full px-1.5 py-0",
                      tab.key === "broken" ? "bg-destructive/10 text-destructive" :
                      tab.key === "opportunities" ? "bg-blue-500/10 text-blue-500" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-7 shrink-0 ml-2"
            onClick={() => generateLinkAuditPdf(report as any)}
          >
            <Download className="h-3 w-3" />
            PDF
          </Button>
        </div>

        {/* Continue scanning banner */}
        {auditStatus !== "running" && report.remaining_urls && report.remaining_urls.length > 0 && (
          <div className="mx-6 mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex items-center gap-4 shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium flex items-center gap-2">
                {autoScan && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
                {report.pages_crawled} of {report.pages_discovered ?? (report.pages_crawled + report.remaining_urls.length)} pages scanned
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {autoScan
                  ? `Scanning remaining ${report.remaining_urls.length} page${report.remaining_urls.length !== 1 ? "s" : ""} automatically…`
                  : `${report.remaining_urls.length} more page${report.remaining_urls.length !== 1 ? "s" : ""} discovered and ready to scan.`
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
                {continuing ? "Scanning…" : "Continue Scanning"}
              </Button>
            )}
          </div>
        )}

        {auditStatus !== "running" && report.remaining_urls && report.remaining_urls.length === 0 && report.pages_discovered && report.pages_discovered > report.pages_crawled && (
          <div className="mx-6 mt-4 rounded-lg border border-green-500/20 bg-green-500/5 p-3 flex items-center gap-3 shrink-0">
            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
            <p className="text-xs text-muted-foreground">All {report.pages_crawled} discovered pages have been scanned.</p>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && <OverviewTab report={report} />}
          {activeTab === "broken" && <BrokenLinksTab links={report.broken_links} />}
          {activeTab === "redirects" && <RedirectsTab links={report.redirect_links} />}
          {activeTab === "opportunities" && <OpportunitiesTab opportunities={report.opportunities} />}
          {activeTab === "orphans" && <OrphansTab orphans={report.orphan_pages} />}
          {activeTab === "density" && <DensityTab density={report.link_density} />}
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ── Main Page ─────────────────────────────────────── */

export default function LinksPage() {
  const { activeAccount } = useAuth();
  const { runTask } = useTaskRunner();

  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // New audit form
  const [showForm, setShowForm] = useState(false);
  const [auditUrl, setAuditUrl] = useState("");
  const [auditCompanyId, setAuditCompanyId] = useState("");
  const [auditScope, setAuditScope] = useState<"site" | "page">("site");
  const [alsoRunFreshness, setAlsoRunFreshness] = useState(false);

  const fetchData = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    setErr(null);
    try {
      const [auditResp, compResp] = await Promise.all([
        fetch("/api/link-audit"),
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
    const wantFreshness = alsoRunFreshness;
    setAuditUrl("");
    setShowForm(false);
    setAlsoRunFreshness(false);

    if (wantFreshness) {
      // Use combo endpoint — single crawl for both audits
      runTask({
        type: "site-audit",
        label: `${isSinglePage ? "Page" : "Site"}: ${url.replace(/^https?:\/\//, "").slice(0, 40)}`,
        endpoint: "/api/site-audit",
        body: { url, company_id: companyId, max_pages: isSinglePage ? 1 : 50, single_page: isSinglePage, analyses: ["links", "freshness"] },
        meta: { link: "/links" },
        onSuccess: (data: any) => {
          fetchData().then(() => { if (data?.link_id) setSelectedId(data.link_id); });
        },
        onError: () => { fetchData(); },
      });
    } else {
      runTask({
        type: "link-audit",
        label: `${isSinglePage ? "Page" : "Site"}: ${url.replace(/^https?:\/\//, "").slice(0, 40)}`,
        endpoint: "/api/link-audit",
        body: { url, company_id: companyId, max_pages: isSinglePage ? 1 : 50, single_page: isSinglePage },
        meta: { link: "/links" },
        onSuccess: (data: any) => {
          fetchData().then(() => { if (data?.id) setSelectedId(data.id); });
        },
        onError: () => { fetchData(); },
      });
    }
  }

  async function onDeleteAudit(id: string) {
    await fetch(`/api/link-report?id=${id}`, { method: "DELETE" });
    setAudits(prev => prev.filter(a => a.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  async function onStopAudit(id: string) {
    try {
      const resp = await fetch("/api/link-audit", {
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
      const resp = await fetch("/api/link-audit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (resp.ok) {
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

  return (
    <AppLayout fullWidth>
      <div className="flex flex-col h-[calc(100vh-7rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Link Audit</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Find broken links, orphan pages & interlinking opportunities</p>
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
                <Link2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">New Link Audit</span>
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
              <p className="text-[11px] text-muted-foreground">Single-page mode only checks links on the specific URL you provide.</p>
            )}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={alsoRunFreshness}
                  onChange={e => setAlsoRunFreshness(e.target.checked)}
                  className="rounded border-input h-3.5 w-3.5 accent-primary"
                />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" /> Also run Freshness Audit
                </span>
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button size="sm" onClick={onStartAudit} disabled={!auditUrl.trim()} className="gap-1.5">
                  <Link2 className="h-3.5 w-3.5" />
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
              <Link2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-2">No link audits yet.</p>
            <Button variant="link" size="sm" onClick={() => setShowForm(true)}>Run your first link audit →</Button>
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
                           <div className={cn("text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0 border", scoreBg(audit.overall_score), scoreColor(audit.overall_score))}>{audit.overall_score}</div>}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{audit.site_url.replace(/^https?:\/\//, "")}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {audit.company_id && <span className="text-[10px] text-muted-foreground">{companyMap[audit.company_id] || ""}</span>}
                              <span className="text-[10px] text-muted-foreground">{formatDate(audit.created_at)}</span>
                              {isCancelled && <span className="text-[10px] text-amber-500">· stopped</span>}
                              {!isRunning && !isFailed && !isCancelled && audit.broken_links > 0 && (
                                <span className="text-[10px] text-destructive">· {audit.broken_links} broken</span>
                              )}
                              {!isRunning && !isFailed && !isCancelled && audit.broken_links === 0 && (
                                <span className="text-[10px] text-green-500">· healthy</span>
                              )}
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
                      <Link2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
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
