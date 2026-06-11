/**
 * Freshness Audit PDF Generator
 * Generates a professional PDF report from audit data using jspdf.
 */
import jsPDF from "jspdf";

/* ── Types (mirrored from freshness page) ─────────── */

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

function healthLabel(score: number): string {
  if (score >= 90) return "Healthy";
  if (score >= 70) return "Needs Attention";
  return "Critical";
}

function healthRgb(score: number): [number, number, number] {
  if (score >= 90) return [34, 197, 94];   // green
  if (score >= 70) return [245, 158, 11];  // amber
  return [239, 68, 68];                     // red
}

function severityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/* ── PDF Generator ─────────────────────────────────── */

const PAGE_W = 210;
const MARGIN_L = 18;
const MARGIN_R = 18;
const MARGIN_T = 20;
const MARGIN_B = 20;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

export function generateFreshnessAuditPdf(report: FullReport) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN_T;
  const pageH = doc.internal.pageSize.getHeight();

  function ensureSpace(needed: number) {
    if (y + needed > pageH - MARGIN_B) {
      doc.addPage();
      y = MARGIN_T;
      return true;
    }
    return false;
  }

  function addFooter(pageNum: number) {
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`Page ${pageNum}`, PAGE_W / 2, pageH - 10, { align: "center" });
    doc.text("Content Freshness Audit", MARGIN_L, pageH - 10);
    doc.text(new Date(report.run_at).toLocaleDateString(), PAGE_W - MARGIN_R, pageH - 10, { align: "right" });
  }

  // ── Title ──
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.text("Content Freshness Audit", MARGIN_L, y);
  y += 8;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(report.site_url, MARGIN_L, y);
  y += 5;

  doc.setFontSize(9);
  doc.text(
    `Completed ${new Date(report.run_at).toLocaleString()} · Duration: ${formatDuration(report.elapsed_ms)}`,
    MARGIN_L,
    y
  );
  y += 10;

  // ── Divider ──
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
  y += 8;

  // ── Summary Stats ──
  const statBoxW = CONTENT_W / 4;
  const statBoxH = 24;
  const stats = [
    { label: "Health Score", value: `${report.overall_health}`, sub: healthLabel(report.overall_health), color: healthRgb(report.overall_health) },
    { label: "Pages Crawled", value: `${report.pages_crawled}`, sub: "", color: [60, 60, 60] as [number, number, number] },
    { label: "Facts Verified", value: `${report.total_facts_verified}/${report.total_facts_extracted}`, sub: "", color: [60, 60, 60] as [number, number, number] },
    { label: "Issues Found", value: `${report.issues_found}`, sub: report.critical_issues > 0 ? `${report.critical_issues} critical` : "None critical", color: report.critical_issues > 0 ? [239, 68, 68] as [number, number, number] : [34, 197, 94] as [number, number, number] },
  ];

  stats.forEach((stat, i) => {
    const x = MARGIN_L + i * statBoxW;
    // Stat box background
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(x + 1, y, statBoxW - 2, statBoxH, 2, 2, "F");

    // Value
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.text(stat.value, x + statBoxW / 2, y + 10, { align: "center" });

    // Label
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(stat.label, x + statBoxW / 2, y + 16, { align: "center" });

    // Sub-label
    if (stat.sub) {
      doc.setFontSize(6.5);
      doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
      doc.text(stat.sub, x + statBoxW / 2, y + 20.5, { align: "center" });
    }
  });
  y += statBoxH + 10;

  // ── Internal Conflicts ──
  if (report.internal_conflicts.length > 0) {
    ensureSpace(20);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(`Internal Conflicts (${report.internal_conflicts.length})`, MARGIN_L, y);
    y += 7;

    report.internal_conflicts.forEach((conflict) => {
      ensureSpace(28);

      // Conflict box
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.2);
      const conflictLines = doc.splitTextToSize(conflict.explanation, CONTENT_W - 8);
      const boxH = 22 + conflictLines.length * 3.5;
      doc.roundedRect(MARGIN_L, y, CONTENT_W, boxH, 1.5, 1.5, "FD");

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 100, 0);
      doc.text(conflict.conflict_type.replace(/_/g, " ").toUpperCase(), MARGIN_L + 4, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(7.5);
      doc.text(`Page A: ${truncate(conflict.page_a_title, 80)}`, MARGIN_L + 4, y + 10);
      doc.setTextColor(100, 100, 100);
      doc.text(`"${truncate(conflict.claim_a, 90)}"`, MARGIN_L + 4, y + 14);

      doc.setTextColor(60, 60, 60);
      doc.text(`Page B: ${truncate(conflict.page_b_title, 80)}`, MARGIN_L + 4, y + 19);
      doc.setTextColor(100, 100, 100);
      doc.text(`"${truncate(conflict.claim_b, 90)}"`, MARGIN_L + 4, y + 23);

      // Explanation
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.text(conflictLines, MARGIN_L + 4, y + 28);

      y += boxH + 4;
    });
    y += 4;
  }

  // ── Page Reports ──
  ensureSpace(14);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text(`Page Reports (${report.pages.length})`, MARGIN_L, y);
  y += 7;

  // Sort pages: issues first, then by health score ascending
  const sortedPages = [...report.pages].sort((a, b) => {
    if (a.issues.length > 0 && b.issues.length === 0) return -1;
    if (a.issues.length === 0 && b.issues.length > 0) return 1;
    return a.health_score - b.health_score;
  });

  sortedPages.forEach((page) => {
    // Page header
    const hasIssues = page.issues.length > 0;
    ensureSpace(18);

    // Page row background
    const scoreColor = healthRgb(page.health_score);
    if (hasIssues) {
      doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.setGState(doc.GState({ opacity: 0.06 }));
      doc.roundedRect(MARGIN_L, y - 1, CONTENT_W, 10, 1, 1, "F");
      doc.setGState(doc.GState({ opacity: 1 }));
    }

    // Health score badge
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
    doc.text(`${page.health_score}`, MARGIN_L + 3, y + 5);

    // Page title
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(truncate(page.title || page.url, 70), MARGIN_L + 16, y + 3.5);

    // Page meta
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text(`${truncate(page.url, 60)} · ${page.page_type} · ${page.total_facts} facts · ${page.facts_verified} verified`, MARGIN_L + 16, y + 7.5);

    // Issue count
    if (hasIssues) {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(239, 68, 68);
      doc.text(`${page.issues.length} issue${page.issues.length !== 1 ? "s" : ""}`, PAGE_W - MARGIN_R, y + 5, { align: "right" });
    }

    y += 12;

    // Issues for this page
    if (hasIssues) {
      // Sort by severity
      const sortedIssues = [...page.issues].sort((a, b) => {
        const sev: Record<string, number> = { critical: 0, warning: 1, info: 2 };
        return (sev[a.severity] ?? 2) - (sev[b.severity] ?? 2);
      });

      sortedIssues.forEach((issue) => {
        const summaryLines = doc.splitTextToSize(issue.summary, CONTENT_W - 18);
        const correctionLines = issue.suggested_correction
          ? doc.splitTextToSize(`Suggested: ${issue.suggested_correction}`, CONTENT_W - 18)
          : [];
        const neededH = 12 + summaryLines.length * 3.2 + (correctionLines.length > 0 ? correctionLines.length * 3.2 + 3 : 0);
        ensureSpace(neededH);

        // Severity indicator
        const sevColor: Record<string, [number, number, number]> = {
          critical: [239, 68, 68],
          warning: [245, 158, 11],
          info: [160, 160, 160],
        };
        const sc = sevColor[issue.severity] || sevColor.info;

        // Severity dot
        doc.setFillColor(sc[0], sc[1], sc[2]);
        doc.circle(MARGIN_L + 6, y + 1.5, 1.2, "F");

        // Severity label + claim type
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(sc[0], sc[1], sc[2]);
        doc.text(severityLabel(issue.severity), MARGIN_L + 10, y + 2.5);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(140, 140, 140);
        doc.text(
          `${issue.status.replace(/_/g, " ")} · ${issue.fact.claim_type}${issue.fact.time_sensitive ? " · ⏰ time-sensitive" : ""}`,
          MARGIN_L + 10 + doc.getTextWidth(severityLabel(issue.severity)) + 3,
          y + 2.5
        );
        y += 5;

        // Claim
        const claimLines = doc.splitTextToSize(`"${issue.fact.claim}"`, CONTENT_W - 14);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(50, 50, 50);
        doc.text(claimLines, MARGIN_L + 10, y);
        y += claimLines.length * 3.2 + 1.5;

        // Summary
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(summaryLines, MARGIN_L + 10, y);
        y += summaryLines.length * 3.2 + 1;

        // Suggested correction
        if (correctionLines.length > 0) {
          doc.setTextColor(34, 140, 80);
          doc.setFont("helvetica", "italic");
          doc.text(correctionLines, MARGIN_L + 10, y);
          y += correctionLines.length * 3.2 + 1;
        }

        y += 2;
      });

      // Thin separator after issues
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.15);
      doc.line(MARGIN_L + 4, y, PAGE_W - MARGIN_R - 4, y);
      y += 4;
    }
  });

  // ── Add page footers ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i);
  }

  // ── Save ──
  const domain = report.site_url.replace(/^https?:\/\//, "").replace(/\//g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  const dateStr = new Date(report.run_at).toISOString().slice(0, 10);
  doc.save(`freshness-audit_${domain}_${dateStr}.pdf`);
}
