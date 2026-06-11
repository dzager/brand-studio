/**
 * Link Audit Engine
 *
 * Analyzes crawled pages to produce a comprehensive link health report:
 * - Broken link detection (HTTP HEAD/GET)
 * - Redirect detection (301/302)
 * - Orphan page detection (pages with zero incoming internal links)
 * - Interlinking opportunity detection (keyword/title mentions without links)
 * - Per-page link density scoring
 */

import type { DeepCrawlResult, CrawledFactPage } from "./freshnessCrawler";

// ── Types ────────────────────────────────────────────────────────────────

export type LinkStatus = "ok" | "broken" | "redirect" | "timeout" | "error";

export type CheckedLink = {
    source_url: string;
    source_title: string;
    href: string;
    anchor_text: string;
    is_internal: boolean;
    status: LinkStatus;
    http_code: number;
    redirect_url?: string;   // final destination for redirects
    error?: string;
};

export type BrokenLink = CheckedLink & { status: "broken" | "timeout" | "error" };

export type RedirectLink = CheckedLink & { status: "redirect"; redirect_url: string };

export type OrphanPage = {
    url: string;
    title: string;
    page_type: string;
    outgoing_links: number;  // how many links this page has going out
};

export type InterlinkOpportunity = {
    source_url: string;
    source_title: string;
    target_url: string;
    target_title: string;
    matched_phrase: string;
    context: string;          // sentence containing the unlinked mention
    confidence: "high" | "medium" | "low";
};

export type PageLinkDensity = {
    url: string;
    title: string;
    internal_out: number;     // outgoing internal links
    internal_in: number;      // incoming internal links from other crawled pages
    external_out: number;     // outgoing external links
    total: number;
    word_count: number;
    density_per_1000_words: number;
    rating: "good" | "low" | "high";
};

export type LinkAuditReport = {
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
    all_links: CheckedLink[];
    overall_score: number;
    run_at: string;
    elapsed_ms: number;
};

export type LinkAuditOptions = {
    checkExternal?: boolean;  // default true — also check external link status
    maxLinksToCheck?: number; // default 500
    onProgress?: (phase: string, current: number, total: number) => void;
    onPartialReport?: (partial: Partial<LinkAuditReport>) => Promise<void>;
};

// ── Constants ────────────────────────────────────────────────────────────

const HEAD_TIMEOUT_MS = 8000;
const CONCURRENT_CHECKS = 8;
const MAX_LINKS_DEFAULT = 500;
const USER_AGENT = "Mozilla/5.0 (compatible; BrandStudio-LinkChecker/1.0)";

// Minimum word length for opportunity matching to avoid noise
const MIN_PHRASE_LENGTH = 4;
// Max opportunities to return
const MAX_OPPORTUNITIES = 50;

// ── Link Extraction ─────────────────────────────────────────────────────

type RawLink = {
    source_url: string;
    source_title: string;
    href: string;
    anchor_text: string;
    is_internal: boolean;
};

/**
 * Extract all links from crawled pages.
 * Uses the links_found field populated by the enhanced crawler.
 */
function extractAllLinks(pages: CrawledFactPage[], rootUrl: string): RawLink[] {
    const links: RawLink[] = [];
    const rootHostname = new URL(rootUrl).hostname;

    for (const page of pages) {
        if (!page.links_found) continue;
        for (const link of page.links_found) {
            let isInternal = link.is_internal;
            // Double-check internal status against root hostname
            try {
                const parsed = new URL(link.href, page.url);
                isInternal = parsed.hostname === rootHostname;
            } catch {
                // malformed URL — treat as external
                isInternal = false;
            }

            links.push({
                source_url: page.url,
                source_title: page.title,
                href: link.href,
                anchor_text: link.anchor_text,
                is_internal: isInternal,
            });
        }
    }

    return links;
}

// ── Link Status Checking ─────────────────────────────────────────────────

/**
 * Check HTTP status of a URL using HEAD, falling back to GET.
 */
async function checkLinkStatus(url: string): Promise<{ status: LinkStatus; code: number; redirectUrl?: string; error?: string }> {
    // Resolve relative URLs — skip if can't resolve
    let resolved: string;
    try {
        resolved = new URL(url).toString();
    } catch {
        return { status: "error", code: 0, error: "Invalid URL" };
    }

    try {
        // Try HEAD first (cheaper)
        const resp = await fetch(resolved, {
            method: "HEAD",
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
            redirect: "manual", // don't auto-follow — we want to detect redirects
        });

        const code = resp.status;

        // Redirect (301, 302, 307, 308)
        if (code >= 300 && code < 400) {
            const location = resp.headers.get("location");
            return {
                status: "redirect",
                code,
                redirectUrl: location || undefined,
            };
        }

        // Method not allowed — try GET
        if (code === 405) {
            const getResp = await fetch(resolved, {
                method: "GET",
                headers: { "User-Agent": USER_AGENT },
                signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
                redirect: "manual",
            });
            const getCode = getResp.status;
            if (getCode >= 300 && getCode < 400) {
                return { status: "redirect", code: getCode, redirectUrl: getResp.headers.get("location") || undefined };
            }
            if (getCode >= 400) {
                return { status: "broken", code: getCode };
            }
            return { status: "ok", code: getCode };
        }

        if (code >= 400) {
            return { status: "broken", code };
        }

        return { status: "ok", code };
    } catch (err: any) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
            return { status: "timeout", code: 0, error: "Request timed out" };
        }
        return { status: "error", code: 0, error: err.message || "Fetch failed" };
    }
}

/**
 * Check many links with concurrency control.
 */
async function checkLinksInBatches(
    links: RawLink[],
    maxLinks: number,
    onProgress?: (current: number, total: number) => void
): Promise<CheckedLink[]> {
    // Deduplicate by href (keep first occurrence for source tracking)
    const uniqueMap = new Map<string, RawLink>();
    const allOccurrences = new Map<string, RawLink[]>();

    for (const link of links) {
        if (!uniqueMap.has(link.href)) {
            uniqueMap.set(link.href, link);
            allOccurrences.set(link.href, [link]);
        } else {
            allOccurrences.get(link.href)!.push(link);
        }
    }

    const uniqueLinks = Array.from(uniqueMap.values()).slice(0, maxLinks);
    const total = uniqueLinks.length;
    const results: CheckedLink[] = [];
    let checked = 0;

    // Process in batches
    for (let i = 0; i < total; i += CONCURRENT_CHECKS) {
        const batch = uniqueLinks.slice(i, i + CONCURRENT_CHECKS);
        const batchResults = await Promise.allSettled(
            batch.map(async (link) => {
                const result = await checkLinkStatus(link.href);
                return { link, result };
            })
        );

        for (const settled of batchResults) {
            if (settled.status === "fulfilled") {
                const { link, result } = settled.value;

                // Create a checked link for each occurrence (source page)
                const occurrences = allOccurrences.get(link.href) || [link];
                for (const occ of occurrences) {
                    results.push({
                        source_url: occ.source_url,
                        source_title: occ.source_title,
                        href: link.href,
                        anchor_text: occ.anchor_text,
                        is_internal: occ.is_internal,
                        status: result.status,
                        http_code: result.code,
                        redirect_url: result.redirectUrl,
                        error: result.error,
                    });
                }
            }
            checked++;
        }

        onProgress?.(checked, total);
    }

    return results;
}

// ── Orphan Page Detection ────────────────────────────────────────────────

function detectOrphanPages(pages: CrawledFactPage[], allLinks: CheckedLink[]): OrphanPage[] {
    // Build a set of all internal link targets
    const linkedUrls = new Set<string>();
    for (const link of allLinks) {
        if (link.is_internal && (link.status === "ok" || link.status === "redirect")) {
            // Normalize the target URL
            try {
                const normalized = new URL(link.href).toString().replace(/\/$/, "");
                linkedUrls.add(normalized);
            } catch { /* skip */ }
        }
    }

    const orphans: OrphanPage[] = [];
    for (const page of pages) {
        const normalizedUrl = page.url.replace(/\/$/, "");
        // Check if any other page links to this one
        if (!linkedUrls.has(normalizedUrl) && !linkedUrls.has(normalizedUrl + "/")) {
            orphans.push({
                url: page.url,
                title: page.title,
                page_type: page.page_type,
                outgoing_links: page.links_found?.length ?? 0,
            });
        }
    }

    // Don't count the homepage as orphan (it's the root — everything links FROM it)
    return orphans.filter(o => {
        try {
            const path = new URL(o.url).pathname;
            return path !== "/" && path !== "";
        } catch { return true; }
    });
}

// ── Interlinking Opportunity Detection ───────────────────────────────────

function detectOpportunities(
    pages: CrawledFactPage[],
    allLinks: CheckedLink[]
): InterlinkOpportunity[] {
    // Build a map of: target URL → set of source URLs that already link to it
    const existingLinks = new Map<string, Set<string>>();
    for (const link of allLinks) {
        if (!link.is_internal) continue;
        try {
            const targetNorm = new URL(link.href).pathname.replace(/\/$/, "").toLowerCase();
            if (!existingLinks.has(targetNorm)) existingLinks.set(targetNorm, new Set());
            existingLinks.get(targetNorm)!.add(link.source_url);
        } catch { /* skip */ }
    }

    const opportunities: InterlinkOpportunity[] = [];

    // For each page, build searchable phrases (title words, headings)
    const pageSignatures = pages.map(page => {
        const phrases: string[] = [];
        // Use page title
        if (page.title) phrases.push(page.title.toLowerCase());
        // Use H1/H2 headings
        for (const h of page.headings.slice(0, 5)) {
            if (h.length >= MIN_PHRASE_LENGTH) phrases.push(h.toLowerCase());
        }
        return {
            url: page.url,
            title: page.title,
            pathname: new URL(page.url).pathname.replace(/\/$/, "").toLowerCase(),
            phrases,
        };
    });

    // For each source page, check if its text mentions another page's phrases
    // but doesn't link to that page
    for (const sourcePage of pages) {
        const sourceText = sourcePage.text.toLowerCase();
        const sourceUrl = sourcePage.url;

        for (const target of pageSignatures) {
            // Don't suggest linking to self
            if (target.url === sourceUrl) continue;

            // Check if source already links to target
            const targetPath = target.pathname;
            const linkers = existingLinks.get(targetPath);
            if (linkers?.has(sourceUrl)) continue;

            // Search for target's phrases in source text
            for (const phrase of target.phrases) {
                if (phrase.length < MIN_PHRASE_LENGTH) continue;

                const idx = sourceText.indexOf(phrase);
                if (idx === -1) continue;

                // Extract surrounding context (sentence-ish)
                const contextStart = Math.max(0, sourceText.lastIndexOf(".", idx - 1) + 1);
                const contextEnd = Math.min(sourceText.length, sourceText.indexOf(".", idx + phrase.length) + 1 || idx + 120);
                const context = sourcePage.text.slice(contextStart, contextEnd).trim();

                // Determine confidence based on phrase quality
                let confidence: InterlinkOpportunity["confidence"] = "medium";
                if (phrase === target.title?.toLowerCase() && phrase.split(/\s+/).length >= 3) {
                    confidence = "high";
                } else if (phrase.split(/\s+/).length < 2) {
                    confidence = "low";
                }

                opportunities.push({
                    source_url: sourceUrl,
                    source_title: sourcePage.title,
                    target_url: target.url,
                    target_title: target.title,
                    matched_phrase: phrase,
                    context: context.slice(0, 200),
                    confidence,
                });

                // Only one opportunity per source→target pair
                break;
            }
        }

        if (opportunities.length >= MAX_OPPORTUNITIES) break;
    }

    // Sort by confidence (high first), then alphabetically
    return opportunities
        .sort((a, b) => {
            const confOrder = { high: 0, medium: 1, low: 2 };
            return confOrder[a.confidence] - confOrder[b.confidence];
        })
        .slice(0, MAX_OPPORTUNITIES);
}

// ── Link Density Analysis ────────────────────────────────────────────────

function analyzeLinkDensity(
    pages: CrawledFactPage[],
    allLinks: CheckedLink[]
): PageLinkDensity[] {
    // Count incoming internal links per page
    const incomingCount = new Map<string, number>();
    for (const link of allLinks) {
        if (!link.is_internal) continue;
        try {
            const target = new URL(link.href).toString().replace(/\/$/, "");
            incomingCount.set(target, (incomingCount.get(target) || 0) + 1);
        } catch { /* skip */ }
    }

    return pages.map(page => {
        const pageLinks = allLinks.filter(l => l.source_url === page.url);
        const internalOut = pageLinks.filter(l => l.is_internal).length;
        const externalOut = pageLinks.filter(l => !l.is_internal).length;
        const normalizedUrl = page.url.replace(/\/$/, "");
        const internalIn = incomingCount.get(normalizedUrl) || incomingCount.get(normalizedUrl + "/") || 0;
        const total = internalOut + externalOut;
        const densityPer1000 = page.word_count > 0 ? Math.round((total / page.word_count) * 1000) : 0;

        let rating: PageLinkDensity["rating"] = "good";
        if (densityPer1000 < 5) rating = "low";
        else if (densityPer1000 > 50) rating = "high";

        return {
            url: page.url,
            title: page.title,
            internal_out: internalOut,
            internal_in: internalIn,
            external_out: externalOut,
            total,
            word_count: page.word_count,
            density_per_1000_words: densityPer1000,
            rating,
        };
    });
}

// ── Scoring ──────────────────────────────────────────────────────────────

function calculateScore(
    totalLinks: number,
    brokenLinks: BrokenLink[],
    redirectLinks: RedirectLink[],
    orphanPages: OrphanPage[],
    pages: CrawledFactPage[]
): number {
    if (totalLinks === 0) return 100;

    let score = 100;

    // Deductions for broken links (heavy penalty)
    const brokenCount = brokenLinks.length;
    const brokenPct = (brokenCount / totalLinks) * 100;
    if (brokenPct > 10) score -= 30;
    else if (brokenPct > 5) score -= 20;
    else if (brokenPct > 2) score -= 10;
    else if (brokenCount > 0) score -= Math.min(brokenCount * 3, 15);

    // Deductions for redirects (moderate penalty)
    const redirectCount = redirectLinks.length;
    const redirectPct = (redirectCount / totalLinks) * 100;
    if (redirectPct > 20) score -= 15;
    else if (redirectPct > 10) score -= 10;
    else if (redirectCount > 0) score -= Math.min(redirectCount * 1, 8);

    // Deductions for orphan pages
    if (pages.length > 1) {
        const orphanPct = (orphanPages.length / pages.length) * 100;
        if (orphanPct > 40) score -= 20;
        else if (orphanPct > 20) score -= 12;
        else if (orphanPages.length > 0) score -= Math.min(orphanPages.length * 2, 10);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
}

// ── Main Export ──────────────────────────────────────────────────────────

/**
 * Run a complete link audit on crawled page data.
 */
export async function runLinkAudit(
    crawlResult: DeepCrawlResult,
    options?: LinkAuditOptions
): Promise<LinkAuditReport> {
    const startTime = Date.now();
    const checkExternal = options?.checkExternal ?? true;
    const maxLinks = options?.maxLinksToCheck ?? MAX_LINKS_DEFAULT;

    const pages = crawlResult.pages;

    // Phase 1: Extract all links
    options?.onProgress?.("Extracting links", 0, pages.length);
    const rawLinks = extractAllLinks(pages, crawlResult.root_url);

    const internalLinks = rawLinks.filter(l => l.is_internal);
    const externalLinks = rawLinks.filter(l => !l.is_internal);

    // Phase 2: Check link status
    const linksToCheck = checkExternal
        ? rawLinks
        : internalLinks;

    options?.onProgress?.("Checking link status", 0, linksToCheck.length);
    const checkedLinks = await checkLinksInBatches(
        linksToCheck,
        maxLinks,
        (current, total) => options?.onProgress?.("Checking link status", current, total)
    );

    // If we skipped external checks, add external links as unchecked "ok"
    const allCheckedLinks = checkExternal
        ? checkedLinks
        : [
            ...checkedLinks,
            ...externalLinks.map(l => ({
                ...l,
                status: "ok" as LinkStatus,
                http_code: 0,
            })),
        ];

    const brokenLinks = allCheckedLinks.filter(
        (l): l is BrokenLink => l.status === "broken" || l.status === "timeout" || l.status === "error"
    );
    const redirectLinks = allCheckedLinks.filter(
        (l): l is RedirectLink => l.status === "redirect" && !!(l as any).redirect_url
    );

    // Send partial report after link checking
    await options?.onPartialReport?.({
        site_url: crawlResult.root_url,
        pages_crawled: pages.length,
        total_links: rawLinks.length,
        internal_links: internalLinks.length,
        external_links: externalLinks.length,
        broken_links: brokenLinks,
        redirect_links: redirectLinks,
    });

    // Phase 3: Detect orphan pages
    options?.onProgress?.("Detecting orphan pages", 0, 1);
    const orphanPages = detectOrphanPages(pages, allCheckedLinks);

    // Phase 4: Find interlinking opportunities
    options?.onProgress?.("Finding opportunities", 0, 1);
    const opportunities = detectOpportunities(pages, allCheckedLinks);

    // Phase 5: Analyze link density
    options?.onProgress?.("Analyzing link density", 0, 1);
    const linkDensity = analyzeLinkDensity(pages, allCheckedLinks);

    // Phase 6: Calculate overall score
    const overallScore = calculateScore(rawLinks.length, brokenLinks, redirectLinks, orphanPages, pages);

    const report: LinkAuditReport = {
        site_url: crawlResult.root_url,
        pages_crawled: pages.length,
        total_links: rawLinks.length,
        internal_links: internalLinks.length,
        external_links: externalLinks.length,
        broken_links: brokenLinks,
        redirect_links: redirectLinks,
        orphan_pages: orphanPages,
        opportunities,
        link_density: linkDensity,
        all_links: allCheckedLinks,
        overall_score: overallScore,
        run_at: new Date().toISOString(),
        elapsed_ms: Date.now() - startTime,
    };

    return report;
}
