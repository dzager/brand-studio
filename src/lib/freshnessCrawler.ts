/**
 * Freshness Crawler — Deep site crawl for fact verification
 *
 * Extends the existing crawlWebsite pattern to crawl up to 50 indexable pages
 * on a client site. Uses sitemap.xml discovery + BFS link traversal.
 */

import * as cheerio from "cheerio";

// ── Types ────────────────────────────────────────────────────────────────

export type CrawledFactPage = {
    url: string;
    title: string;
    text: string;              // cleaned body text
    last_modified?: string;    // from HTTP headers or meta
    published_date?: string;   // extracted from page
    page_type: "blog" | "landing" | "service" | "resource" | "other";
    word_count: number;
    headings: string[];
};

export type DeepCrawlResult = {
    root_url: string;
    pages: CrawledFactPage[];
    pages_discovered: number;  // total URLs found
    pages_crawled: number;     // successfully fetched
    pages_skipped: number;     // filtered out or failed
    elapsed_ms: number;
};

export type DeepCrawlOptions = {
    maxPages?: number;         // default 50
    includePatterns?: RegExp[];
    excludePatterns?: RegExp[];
    onProgress?: (crawled: number, total: number) => void;
};

// ── Constants ────────────────────────────────────────────────────────────

const DEFAULT_MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 12000;
const MAX_BODY_TEXT_PER_PAGE = 12000;
const USER_AGENT = "Mozilla/5.0 (compatible; BrandStudio/1.0)";
const CONCURRENT_FETCHES = 4;

/** URL path patterns to skip — these rarely contain verifiable facts */
const SKIP_PATTERNS: RegExp[] = [
    /\/(privacy|terms|cookie|legal|disclaimer|tos|gdpr|imprint|impressum)/i,
    /\/(login|signin|sign-in|register|signup|sign-up|auth|account|dashboard)/i,
    /\/(cart|checkout|payment|order|wishlist)/i,
    /\/(wp-admin|wp-login|wp-content|wp-includes)/i,
    /\/(tag|tags|author|category|categories|page\/\d+)/i,
    /\/(search|404|500|error)/i,
    /\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|json|zip|mp4|mp3|wav)$/i,
    /[?&](utm_|ref=|fbclid|gclid)/i,
    /#/,
];

/** Page type classification patterns */
const PAGE_TYPE_PATTERNS: { pattern: RegExp; type: CrawledFactPage["page_type"] }[] = [
    { pattern: /\/(blog|articles?|news|insights?|journal|posts?)\//i, type: "blog" },
    { pattern: /\/(resources?|guides?|how-to|tutorials?|learn|library|knowledge)\//i, type: "resource" },
    { pattern: /\/(services?|solutions?|offerings?|capabilities|what-we-do)\//i, type: "service" },
    { pattern: /\/(pricing|plans|features?|products?|about|contact|team)\/?$/i, type: "landing" },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizeUrl(href: string, baseUrl: string): string | null {
    try {
        const parsed = new URL(href, baseUrl);
        const base = new URL(baseUrl);
        if (parsed.hostname !== base.hostname) return null;
        if (!["http:", "https:"].includes(parsed.protocol)) return null;
        parsed.hash = "";
        parsed.search = ""; // strip query params for dedup
        let clean = parsed.toString();
        if (clean.endsWith("/") && clean !== parsed.origin + "/") {
            clean = clean.slice(0, -1);
        }
        return clean;
    } catch {
        return null;
    }
}

function shouldSkipUrl(url: string, excludePatterns: RegExp[]): boolean {
    const path = new URL(url).pathname;
    for (const pattern of SKIP_PATTERNS) {
        if (pattern.test(url)) return true;
    }
    for (const pattern of excludePatterns) {
        if (pattern.test(path)) return true;
    }
    return false;
}

function classifyPageType(url: string): CrawledFactPage["page_type"] {
    const path = new URL(url).pathname;
    for (const { pattern, type } of PAGE_TYPE_PATTERNS) {
        if (pattern.test(path)) return type;
    }
    // Root or short paths are likely landing pages
    const segments = path.split("/").filter(Boolean);
    if (segments.length <= 1) return "landing";
    return "other";
}

/**
 * Priority score for URL ordering — higher = crawl first.
 * Blog and resource pages are most likely to contain verifiable facts.
 */
function urlPriority(url: string): number {
    const path = new URL(url).pathname;
    if (/\/(blog|articles?|news|insights?|posts?)\//i.test(path)) return 10;
    if (/\/(resources?|guides?|how-to|learn)\//i.test(path)) return 8;
    if (/\/(services?|solutions?|products?|pricing|features?)\//i.test(path)) return 6;
    if (/\/(about|team|company|our-story)\/?$/i.test(path)) return 4;
    const depth = path.split("/").filter(Boolean).length;
    return Math.max(1, 5 - depth); // prefer shallower pages
}

// ── Sitemap Parser ───────────────────────────────────────────────────────

/**
 * Discover URLs from sitemap.xml (handles sitemap indexes too).
 */
async function discoverFromSitemap(rootUrl: string): Promise<string[]> {
    const urls: string[] = [];
    const base = new URL(rootUrl);
    const sitemapUrls = [
        `${base.origin}/sitemap.xml`,
        `${base.origin}/sitemap_index.xml`,
        `${base.origin}/post-sitemap.xml`,
        `${base.origin}/page-sitemap.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
        try {
            const resp = await fetch(sitemapUrl, {
                headers: { "User-Agent": USER_AGENT },
                signal: AbortSignal.timeout(8000),
                redirect: "follow",
            });
            if (!resp.ok) continue;

            const xml = await resp.text();
            if (!xml.includes("<url") && !xml.includes("<sitemap")) continue;

            // Extract all <loc> tags
            const locMatches = xml.match(/<loc>\s*(.*?)\s*<\/loc>/gi) ?? [];
            for (const match of locMatches) {
                const loc = match.replace(/<\/?loc>/gi, "").trim();
                if (loc && loc.startsWith("http")) {
                    // If it's a sub-sitemap, try to parse it too (one level deep)
                    if (loc.includes("sitemap") && loc.endsWith(".xml")) {
                        try {
                            const subResp = await fetch(loc, {
                                headers: { "User-Agent": USER_AGENT },
                                signal: AbortSignal.timeout(8000),
                            });
                            if (subResp.ok) {
                                const subXml = await subResp.text();
                                const subLocs = subXml.match(/<loc>\s*(.*?)\s*<\/loc>/gi) ?? [];
                                for (const subMatch of subLocs) {
                                    const subLoc = subMatch.replace(/<\/?loc>/gi, "").trim();
                                    if (subLoc && subLoc.startsWith("http") && !subLoc.includes("sitemap")) {
                                        urls.push(subLoc);
                                    }
                                }
                            }
                        } catch { /* skip failed sub-sitemaps */ }
                    } else {
                        urls.push(loc);
                    }
                }
            }

            if (urls.length > 0) break; // found a working sitemap
        } catch { /* sitemap not available */ }
    }

    return urls;
}

// ── Page Fetcher ─────────────────────────────────────────────────────────

/**
 * Fetch and extract structured content from a single page.
 */
async function fetchFactPage(url: string, firecrawlApiKey?: string): Promise<CrawledFactPage | null> {
    try {
        let html = "";
        let lastModified: string | undefined;

        if (firecrawlApiKey) {
            console.log(`[freshness-crawl] Scraping ${url} with Firecrawl...`);
            const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${firecrawlApiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    url,
                    formats: ["html"]
                }),
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
            });

            if (!resp.ok) {
                console.warn(`[freshness-crawl] Firecrawl scraping returned status ${resp.status}`);
                return null;
            }

            const result = await resp.json();
            if (!result.success || !result.data?.html) {
                console.warn(`[freshness-crawl] Firecrawl scraping failed:`, result.error || "no HTML data returned");
                return null;
            }
            html = result.data.html;
            lastModified = result.data.metadata?.lastModified || undefined;
        } else {
            const resp = await fetch(url, {
                headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
                redirect: "follow",
            });

            if (!resp.ok) return null;

            const contentType = resp.headers.get("content-type") ?? "";
            if (!contentType.includes("text/html")) return null;

            lastModified = resp.headers.get("last-modified") ?? undefined;
            html = await resp.text();
        }

        const $ = cheerio.load(html);

        // Extract dates before removing elements
        let publishedDate: string | undefined;
        // Try structured data first
        const jsonLdScripts = $('script[type="application/ld+json"]');
        jsonLdScripts.each((_i, el) => {
            try {
                const ld = JSON.parse($(el).text());
                const items = Array.isArray(ld) ? ld : [ld];
                for (const item of items) {
                    if (item.datePublished) publishedDate = item.datePublished;
                    else if (item.dateCreated) publishedDate = item.dateCreated;
                }
            } catch { /* skip malformed JSON-LD */ }
        });
        // Fallback: meta tags
        if (!publishedDate) {
            publishedDate =
                $('meta[property="article:published_time"]').attr("content")?.trim() ||
                $('meta[name="date"]').attr("content")?.trim() ||
                $('time[datetime]').first().attr("datetime")?.trim() ||
                undefined;
        }

        const title = $("title").first().text().trim();
        const headings: string[] = [];
        $("h1, h2, h3").each((_i, el) => {
            const text = $(el).text().trim();
            if (text && text.length < 200) headings.push(text);
        });

        // Remove noise
        $("script, style, nav, footer, aside, .sidebar, .comments, .ad, iframe, form, noscript, svg, header").remove();

        // Extract body text
        const contentEl =
            $("article").first().length > 0 ? $("article").first()
            : $("main").first().length > 0 ? $("main").first()
            : $('[role="main"]').first().length > 0 ? $('[role="main"]').first()
            : $(".post-content, .entry-content, .article-content, .page-content").first().length > 0
                ? $(".post-content, .entry-content, .article-content, .page-content").first()
            : $("body");

        const paragraphs: string[] = [];
        contentEl.find("h1, h2, h3, h4, p, li, blockquote, td, th").each((_i, el) => {
            const tag = $(el).prop("tagName")?.toLowerCase() ?? "";
            const text = $(el).text().trim();
            if (!text || text.length < 10) return;
            if (tag.startsWith("h")) {
                paragraphs.push(`\n## ${text}`);
            } else if (tag === "li") {
                paragraphs.push(`- ${text}`);
            } else if (tag === "blockquote") {
                paragraphs.push(`> ${text}`);
            } else {
                paragraphs.push(text);
            }
        });

        let bodyText = paragraphs.join("\n").trim();
        if (bodyText.length > MAX_BODY_TEXT_PER_PAGE) {
            bodyText = bodyText.slice(0, MAX_BODY_TEXT_PER_PAGE) + "\n[...truncated]";
        }

        // Skip pages with very little content
        if (bodyText.length < 150) return null;

        const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

        // Discover internal links for BFS
        const links: string[] = [];
        const seen = new Set<string>();
        $("a[href]").each((_i, el) => {
            const href = $(el).attr("href");
            if (!href) return;
            const normalized = normalizeUrl(href, url);
            if (normalized && !seen.has(normalized) && normalized !== url) {
                seen.add(normalized);
                links.push(normalized);
            }
        });

        return {
            url,
            title,
            text: bodyText,
            last_modified: lastModified,
            published_date: publishedDate,
            page_type: classifyPageType(url),
            word_count: wordCount,
            headings,
            // Store links temporarily for BFS (not in final type, stripped later)
            ...(links.length > 0 ? { _links: links } : {}),
        } as CrawledFactPage & { _links?: string[] };
    } catch (err) {
        console.warn(`[freshness-crawl] Failed to fetch ${url}:`, err);
        return null;
    }
}

/**
 * Crawl a single page URL for fact freshness auditing.
 * Skips sitemap discovery and BFS — just fetches and processes the one URL.
 */
export async function crawlSinglePage(pageUrl: string): Promise<DeepCrawlResult> {
    const startTime = Date.now();

    let normalizedUrl = pageUrl.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = `https://${normalizedUrl}`;
    }

    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    const page = await fetchFactPage(normalizedUrl, firecrawlApiKey);

    if (!page) {
        return {
            root_url: normalizedUrl,
            pages: [],
            pages_discovered: 1,
            pages_crawled: 0,
            pages_skipped: 1,
            elapsed_ms: Date.now() - startTime,
        };
    }

    // Strip internal BFS links if present
    delete (page as any)._links;

    return {
        root_url: normalizedUrl,
        pages: [page],
        pages_discovered: 1,
        pages_crawled: 1,
        pages_skipped: 0,
        elapsed_ms: Date.now() - startTime,
    };
}

// ── Main Export ──────────────────────────────────────────────────────────

/**
 * Deep crawl a website for fact freshness auditing.
 * Discovers pages via sitemap + BFS, prioritizes content pages.
 */
export async function deepCrawl(
    rootUrl: string,
    options?: DeepCrawlOptions
): Promise<DeepCrawlResult> {
    const startTime = Date.now();
    const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
    const excludePatterns = options?.excludePatterns ?? [];

    // Normalize root URL
    let normalizedRoot = rootUrl.trim();
    if (!normalizedRoot.startsWith("http://") && !normalizedRoot.startsWith("https://")) {
        normalizedRoot = `https://${normalizedRoot}`;
    }

    const crawled = new Map<string, CrawledFactPage>();
    const queued = new Set<string>();
    const urlQueue: string[] = [];

    // ── Step 1: Discover URLs from sitemap ──
    console.log(`[freshness-crawl] Discovering URLs from sitemap for ${normalizedRoot}`);
    const sitemapUrls = await discoverFromSitemap(normalizedRoot);
    console.log(`[freshness-crawl] Found ${sitemapUrls.length} URLs in sitemap`);

    // ── Step 2: Seed the queue ──
    // Always start with homepage
    urlQueue.push(normalizedRoot);
    queued.add(normalizedRoot);

    // Add sitemap URLs, filtered and prioritized
    const base = new URL(normalizedRoot);
    for (const sUrl of sitemapUrls) {
        try {
            const parsed = new URL(sUrl);
            if (parsed.hostname !== base.hostname) continue;
        } catch { continue; }

        const normalized = normalizeUrl(sUrl, normalizedRoot);
        if (normalized && !queued.has(normalized) && !shouldSkipUrl(normalized, excludePatterns)) {
            urlQueue.push(normalized);
            queued.add(normalized);
        }
    }

    // Sort queue by priority (blog/resource pages first)
    urlQueue.sort((a, b) => urlPriority(b) - urlPriority(a));

    // ── Step 3: BFS crawl with concurrency ──
    let pagesDiscovered = queued.size;
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;

    if (firecrawlApiKey) {
        console.log(`[freshness-crawl] Firecrawl API key detected. Fetching pages via Firecrawl.`);
    }

    while (urlQueue.length > 0 && crawled.size < maxPages) {
        // Take a batch
        const batch = urlQueue.splice(0, Math.min(CONCURRENT_FETCHES, maxPages - crawled.size));

        const results = await Promise.allSettled(
            batch.map(url => fetchFactPage(url, firecrawlApiKey))
        );

        for (const result of results) {
            if (result.status !== "fulfilled" || !result.value) continue;

            const page = result.value as CrawledFactPage & { _links?: string[] };
            const discoveredLinks = page._links ?? [];
            delete (page as any)._links;

            crawled.set(page.url, page);

            // Add discovered links to queue (BFS expansion)
            for (const link of discoveredLinks) {
                if (!queued.has(link) && !shouldSkipUrl(link, excludePatterns)) {
                    queued.add(link);
                    urlQueue.push(link);
                    pagesDiscovered++;
                }
            }
        }

        // Re-sort after adding new links
        urlQueue.sort((a, b) => urlPriority(b) - urlPriority(a));

        // Progress callback
        options?.onProgress?.(crawled.size, Math.min(pagesDiscovered, maxPages));
    }

    const pages = Array.from(crawled.values());
    console.log(`[freshness-crawl] Crawl complete: ${pages.length} pages from ${normalizedRoot}`);

    return {
        root_url: normalizedRoot,
        pages,
        pages_discovered: pagesDiscovered,
        pages_crawled: pages.length,
        pages_skipped: pagesDiscovered - pages.length,
        elapsed_ms: Date.now() - startTime,
    };
}
