/**
 * Link Health Audit PDF Generator
 * Generates a professional PDF report from link audit data using jspdf.
 */
import jsPDF from "jspdf";

/* ── Types (mirrored from link audit engine) ──────── */

type BrokenLink = {
  source_url: string;
  source_title: string;
  href: string;
  anchor_text: string;
  is_internal: boolean;
  status: "broken" | "timeout" | "error";
  http_code: number;
  error?: string;
};

type RedirectLink = {
  source_url: string;
  source_title: string;
  href: string;
  anchor_text: string;
  is_internal: boolean;
  status: "redirect";
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

type LinkAuditReport = {
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

function confidenceRgb(confidence: string): [number, number, number] {
  if (confidence === "high") return [34, 197, 94];
  if (confidence === "medium") return [245, 158, 11];
  return [160, 160, 160];
}

function ratingRgb(rating: string): [number, number, number] {
  if (rating === "good") return [34, 197, 94];
  if (rating === "low") return [245, 158, 11];
  return [239, 68, 68]; // high density
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

function statusLabel(status: string, httpCode: number): string {
  if (httpCode > 0) return `${httpCode} ${status}`;
  return status;
}

/* ── PDF Generator ─────────────────────────────────── */

const PAGE_W = 210;
const MARGIN_L = 18;
const MARGIN_R = 18;
const MARGIN_T = 20;
const MARGIN_B = 20;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;

export function generateLinkAuditPdf(report: LinkAuditReport) {
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
    doc.text("Link Health Audit", MARGIN_L, pageH - 10);
    doc.text(new Date(report.run_at).toLocaleDateString(), PAGE_W - MARGIN_R, pageH - 10, { align: "right" });
  }

  // ── Section header helper ──
  function sectionHeader(title: string) {
    ensureSpace(20);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(title, MARGIN_L, y);
    y += 7;
  }

  // ── Table header helper ──
  function tableHeader(columns: { label: string; x: number }[]) {
    doc.setFillColor(245, 245, 248);
    doc.rect(MARGIN_L, y - 3.5, CONTENT_W, 6, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    columns.forEach((col) => {
      doc.text(col.label, col.x, y);
    });
    y += 5;
  }

  // ── Title ──
  doc.setFontSize(22);
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.text("Link Health Audit", MARGIN_L, y);
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

  // ── Summary Stats (top row: 4 boxes) ──
  const statBoxW = CONTENT_W / 4;
  const statBoxH = 24;
  const scoreColor = healthRgb(report.overall_score);
  const brokenColor: [number, number, number] = report.broken_links.length > 0 ? [239, 68, 68] : [34, 197, 94];

  const statsRow1 = [
    { label: "Overall Score", value: `${report.overall_score}`, sub: healthLabel(report.overall_score), color: scoreColor },
    { label: "Pages Crawled", value: `${report.pages_crawled}`, sub: "", color: [60, 60, 60] as [number, number, number] },
    { label: "Total Links", value: `${report.total_links}`, sub: `${report.internal_links} int · ${report.external_links} ext`, color: [60, 60, 60] as [number, number, number] },
    { label: "Broken Links", value: `${report.broken_links.length}`, sub: report.broken_links.length > 0 ? "Needs fixing" : "None found", color: brokenColor },
  ];

  statsRow1.forEach((stat, i) => {
    const x = MARGIN_L + i * statBoxW;
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(x + 1, y, statBoxW - 2, statBoxH, 2, 2, "F");

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.text(stat.value, x + statBoxW / 2, y + 10, { align: "center" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(stat.label, x + statBoxW / 2, y + 16, { align: "center" });

    if (stat.sub) {
      doc.setFontSize(6.5);
      doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
      doc.text(stat.sub, x + statBoxW / 2, y + 20.5, { align: "center" });
    }
  });
  y += statBoxH + 4;

  // ── Summary Stats (bottom row: 3 boxes centered) ──
  const row2BoxW = CONTENT_W / 4;
  const row2Offset = MARGIN_L + row2BoxW / 2; // center 3 boxes across 4 columns

  const statsRow2 = [
    { label: "Redirects", value: `${report.redirect_links.length}`, sub: "", color: report.redirect_links.length > 0 ? [245, 158, 11] as [number, number, number] : [60, 60, 60] as [number, number, number] },
    { label: "Orphan Pages", value: `${report.orphan_pages.length}`, sub: "", color: report.orphan_pages.length > 0 ? [245, 158, 11] as [number, number, number] : [60, 60, 60] as [number, number, number] },
    { label: "Opportunities", value: `${report.opportunities.length}`, sub: "", color: report.opportunities.length > 0 ? [34, 197, 94] as [number, number, number] : [60, 60, 60] as [number, number, number] },
  ];

  statsRow2.forEach((stat, i) => {
    const x = row2Offset + i * row2BoxW;
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(x + 1, y, row2BoxW - 2, statBoxH, 2, 2, "F");

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
    doc.text(stat.value, x + row2BoxW / 2, y + 10, { align: "center" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(stat.label, x + row2BoxW / 2, y + 16, { align: "center" });

    if (stat.sub) {
      doc.setFontSize(6.5);
      doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
      doc.text(stat.sub, x + row2BoxW / 2, y + 20.5, { align: "center" });
    }
  });
  y += statBoxH + 10;

  // ── Broken Links Section ──
  if (report.broken_links.length > 0) {
    sectionHeader(`Broken Links (${report.broken_links.length})`);

    const colSource = MARGIN_L + 2;
    const colBroken = MARGIN_L + 58;
    const colStatus = MARGIN_L + 138;

    tableHeader([
      { label: "SOURCE PAGE", x: colSource },
      { label: "BROKEN URL", x: colBroken },
      { label: "STATUS", x: colStatus },
    ]);

    report.broken_links.forEach((link) => {
      ensureSpace(14);

      // Alternating row hint
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(truncate(link.source_title || link.source_url, 35), colSource, y);

      doc.setTextColor(239, 68, 68);
      doc.text(truncate(link.href, 50), colBroken, y);

      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(239, 68, 68);
      doc.text(statusLabel(link.status, link.http_code), colStatus, y);

      // Anchor text on second line if present
      if (link.anchor_text) {
        y += 3.5;
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(140, 140, 140);
        doc.text(`anchor: "${truncate(link.anchor_text, 60)}"`, colSource, y);
      }

      // Error detail if present
      if (link.error) {
        y += 3.5;
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(180, 80, 80);
        doc.text(truncate(link.error, 100), colSource, y);
      }

      y += 5;

      // Separator
      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.1);
      doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
      y += 2;
    });

    y += 4;
  }

  // ── Redirect Links Section ──
  if (report.redirect_links.length > 0) {
    sectionHeader(`Redirect Links (${report.redirect_links.length})`);

    const colSource = MARGIN_L + 2;
    const colOriginal = MARGIN_L + 50;
    const colRedirect = MARGIN_L + 110;
    const colCode = MARGIN_L + 158;

    tableHeader([
      { label: "SOURCE PAGE", x: colSource },
      { label: "ORIGINAL URL", x: colOriginal },
      { label: "REDIRECTS TO", x: colRedirect },
      { label: "CODE", x: colCode },
    ]);

    report.redirect_links.forEach((link) => {
      ensureSpace(12);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(truncate(link.source_title || link.source_url, 30), colSource, y);

      doc.setTextColor(100, 100, 100);
      doc.text(truncate(link.href, 38), colOriginal, y);

      doc.setTextColor(245, 158, 11);
      doc.text(truncate(link.redirect_url, 30), colRedirect, y);

      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(245, 158, 11);
      doc.text(`${link.http_code}`, colCode, y);

      y += 5;

      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.1);
      doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
      y += 2;
    });

    y += 4;
  }

  // ── Orphan Pages Section ──
  if (report.orphan_pages.length > 0) {
    sectionHeader(`Orphan Pages (${report.orphan_pages.length})`);

    const colTitle = MARGIN_L + 2;
    const colUrl = MARGIN_L + 60;
    const colType = MARGIN_L + 130;
    const colOut = MARGIN_L + 155;

    tableHeader([
      { label: "TITLE", x: colTitle },
      { label: "URL", x: colUrl },
      { label: "TYPE", x: colType },
      { label: "OUT LINKS", x: colOut },
    ]);

    report.orphan_pages.forEach((page) => {
      ensureSpace(10);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(truncate(page.title || page.url, 36), colTitle, y);

      doc.setTextColor(100, 100, 100);
      doc.text(truncate(page.url, 44), colUrl, y);

      doc.setTextColor(130, 130, 130);
      doc.setFontSize(7);
      doc.text(page.page_type, colType, y);

      doc.setTextColor(60, 60, 60);
      doc.text(`${page.outgoing_links}`, colOut, y);

      y += 5;

      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.1);
      doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
      y += 2;
    });

    y += 4;
  }

  // ── Interlinking Opportunities Section ──
  if (report.opportunities.length > 0) {
    sectionHeader(`Interlinking Opportunities (${report.opportunities.length})`);

    report.opportunities.forEach((opp) => {
      const contextLines = doc.splitTextToSize(`"…${opp.context}…"`, CONTENT_W - 14);
      const boxH = 20 + contextLines.length * 3.2;
      ensureSpace(boxH + 4);

      // Opportunity card background
      doc.setFillColor(240, 253, 244);
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.2);
      doc.roundedRect(MARGIN_L, y, CONTENT_W, boxH, 1.5, 1.5, "FD");

      // Confidence badge
      const confColor = confidenceRgb(opp.confidence);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(confColor[0], confColor[1], confColor[2]);
      doc.text(opp.confidence.toUpperCase(), PAGE_W - MARGIN_R - 4, y + 5, { align: "right" });

      // Source → Target
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40, 40, 40);
      doc.text(truncate(opp.source_title, 55), MARGIN_L + 4, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(7);
      doc.text("→", MARGIN_L + 4 + doc.getTextWidth(truncate(opp.source_title, 55)) + 2, y + 5);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(34, 120, 80);
      doc.text(truncate(opp.target_title, 50), MARGIN_L + 4 + doc.getTextWidth(truncate(opp.source_title, 55)) + 6, y + 5);

      // Matched phrase
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(80, 80, 80);
      doc.text(`Matched phrase: "${truncate(opp.matched_phrase, 70)}"`, MARGIN_L + 4, y + 10);

      // Source / target URLs
      doc.setFontSize(6.5);
      doc.setTextColor(130, 130, 130);
      doc.text(`${truncate(opp.source_url, 60)}  →  ${truncate(opp.target_url, 60)}`, MARGIN_L + 4, y + 14);

      // Context
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 100, 100);
      doc.text(contextLines, MARGIN_L + 4, y + 18.5);

      y += boxH + 4;
    });

    y += 4;
  }

  // ── Link Density Overview ──
  if (report.link_density.length > 0) {
    sectionHeader(`Link Density Overview (${report.link_density.length} pages)`);

    const colTitle = MARGIN_L + 2;
    const colIntOut = MARGIN_L + 60;
    const colIntIn = MARGIN_L + 80;
    const colExtOut = MARGIN_L + 100;
    const colDensity = MARGIN_L + 120;
    const colRating = MARGIN_L + 150;

    tableHeader([
      { label: "PAGE", x: colTitle },
      { label: "INT OUT", x: colIntOut },
      { label: "INT IN", x: colIntIn },
      { label: "EXT OUT", x: colExtOut },
      { label: "DENSITY/1K", x: colDensity },
      { label: "RATING", x: colRating },
    ]);

    // Sort: problematic ratings first
    const sortedDensity = [...report.link_density].sort((a, b) => {
      const ratingOrder: Record<string, number> = { low: 0, high: 1, good: 2 };
      return (ratingOrder[a.rating] ?? 2) - (ratingOrder[b.rating] ?? 2);
    });

    sortedDensity.forEach((page) => {
      ensureSpace(8);

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.text(truncate(page.title || page.url, 36), colTitle, y);

      doc.setTextColor(80, 80, 80);
      doc.text(`${page.internal_out}`, colIntOut, y);
      doc.text(`${page.internal_in}`, colIntIn, y);
      doc.text(`${page.external_out}`, colExtOut, y);
      doc.text(`${page.density_per_1000_words.toFixed(1)}`, colDensity, y);

      const rc = ratingRgb(page.rating);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(rc[0], rc[1], rc[2]);
      doc.text(page.rating.toUpperCase(), colRating, y);

      y += 5;

      doc.setDrawColor(235, 235, 235);
      doc.setLineWidth(0.1);
      doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
      y += 2;
    });

    y += 4;
  }

  // ── Add page footers ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i);
  }

  // ── Save ──
  const domain = report.site_url.replace(/^https?:\/\//, "").replace(/\//g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  const dateStr = new Date(report.run_at).toISOString().slice(0, 10);
  doc.save(`link-audit_${domain}_${dateStr}.pdf`);
}
