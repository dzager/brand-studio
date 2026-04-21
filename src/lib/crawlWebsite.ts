import * as cheerio from "cheerio";

// ── Types ────────────────────────────────────────────────────────────────

export type ImageSignal = {
    alt: string;
    src: string;
    context: string;          // surrounding heading/text near the image
};

export type CrawledPage = {
    url: string;
    title: string;
    metaDescription: string;
    ogSiteName: string;
    ogDescription: string;
    ogTitle: string;
    ogImage: string;          // og:image URL
    themeColor: string;
    headings: string[];       // all h1–h3 text
    heroText: string;         // first prominent text block on the page
    bodyText: string;         // cleaned body text (truncated)
    links: string[];          // internal links found
    images: ImageSignal[];    // image alt texts + context
};

export type CrawlResult = {
    homepage: CrawledPage;
    additionalPages: CrawledPage[];
    discoveredColors: string[];   // hex colors found in meta/CSS
    allBodyText: string;          // combined body text from all pages
    allImageSignals: ImageSignal[]; // combined image signals from all pages
};

// ── Constants ────────────────────────────────────────────────────────────

const MAX_ADDITIONAL_PAGES = 3;
const FETCH_TIMEOUT_MS = 12000;
const MAX_BODY_TEXT_PER_PAGE = 6000;
const USER_AGENT = "Mozilla/5.0 (compatible; BrandStudio/1.0)";

/** Patterns for discovering high-value brand pages, in priority order */
const PAGE_PRIORITY_PATTERNS: RegExp[] = [
    /\/(about|about-us|our-story|who-we-are|team|our-team|company)(\/|$)/i,
    /\/(blog|articles|news|resources|insights|journal)(\/|$)/i,
    /\/(services|products|what-we-do|solutions|offerings|capabilities)(\/|$)/i,
];

// ── Helpers ──────────────────────────────────────────────────────────────

function normalizeUrl(href: string, baseUrl: string): string | null {
    try {
        const parsed = new URL(href, baseUrl);
        // Only keep same-origin http/https links
        const base = new URL(baseUrl);
        if (parsed.hostname !== base.hostname) return null;
        if (!["http:", "https:"].includes(parsed.protocol)) return null;
        // Strip hash and trailing slash for dedup
        parsed.hash = "";
        let clean = parsed.toString();
        if (clean.endsWith("/") && clean !== parsed.origin + "/") {
            clean = clean.slice(0, -1);
        }
        return clean;
    } catch {
        return null;
    }
}

/**
 * Fetch a single page and extract structured brand signals.
 */
async function fetchPage(url: string): Promise<CrawledPage | null> {
    try {
        const resp = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            redirect: "follow",
        });

        if (!resp.ok) {
            console.warn(`crawlWebsite: ${url} returned ${resp.status}`);
            return null;
        }

        const contentType = resp.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) {
            console.warn(`crawlWebsite: ${url} is not HTML (${contentType})`);
            return null;
        }

        const html = await resp.text();
        const $ = cheerio.load(html);

        // ── OG image ──
        const ogImage = $('meta[property="og:image"]').attr("content")?.trim() ?? "";

        // ── Image signals (extract before removing noise so we get all images) ──
        const images: ImageSignal[] = [];
        const seenAlts = new Set<string>();
        $("img[alt]").each((_i, el) => {
            const alt = $(el).attr("alt")?.trim() ?? "";
            const src = $(el).attr("src")?.trim() ?? "";
            // Skip tiny icons, spacers, and duplicates
            if (!alt || alt.length < 5 || seenAlts.has(alt.toLowerCase())) return;
            seenAlts.add(alt.toLowerCase());

            // Get nearby context: closest heading or parent text
            let context = "";
            const parent = $(el).parent();
            const prevHeading = $(el).prevAll("h1, h2, h3, h4").first().text().trim();
            const figcaption = parent.find("figcaption").text().trim();
            const parentText = parent.text().trim().slice(0, 200);
            context = figcaption || prevHeading || parentText;

            images.push({ alt, src, context });
        });

        // Remove noise
        $("script, style, nav, footer, aside, .sidebar, .comments, .ad, iframe, form, noscript, svg").remove();

        // ── Meta extraction ──
        const title = $("title").first().text().trim();
        const metaDescription = $('meta[name="description"]').attr("content")?.trim() ?? "";
        const ogSiteName = $('meta[property="og:site_name"]').attr("content")?.trim() ?? "";
        const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() ?? "";
        const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() ?? "";
        const themeColor = $('meta[name="theme-color"]').attr("content")?.trim() ?? "";

        // ── Headings ──
        const headings: string[] = [];
        $("h1, h2, h3").each((_i, el) => {
            const text = $(el).text().trim();
            if (text && text.length < 200) headings.push(text);
        });

        // ── Hero text (first substantial text block) ──
        let heroText = "";
        const heroSelectors = [
            ".hero", "[class*='hero']", ".banner", "[class*='banner']",
            ".jumbotron", "header h1", "header p",
        ];
        for (const sel of heroSelectors) {
            const el = $(sel).first();
            if (el.length) {
                heroText = el.text().trim().slice(0, 500);
                if (heroText.length > 20) break;
            }
        }
        // Fallback: first h1 + following paragraph
        if (heroText.length < 20) {
            const h1 = $("h1").first().text().trim();
            const firstP = $("h1").first().next("p").text().trim();
            heroText = [h1, firstP].filter(Boolean).join(" ").slice(0, 500);
        }

        // ── Body text ──
        const contentEl =
            $("article").first().length > 0 ? $("article").first()
            : $("main").first().length > 0 ? $("main").first()
            : $('[role="main"]').first().length > 0 ? $('[role="main"]').first()
            : $(".post-content, .entry-content, .article-content, .page-content").first().length > 0
                ? $(".post-content, .entry-content, .article-content, .page-content").first()
            : $("body");

        const paragraphs: string[] = [];
        contentEl.find("h1, h2, h3, h4, p, li").each((_i, el) => {
            const tag = $(el).prop("tagName")?.toLowerCase() ?? "";
            const text = $(el).text().trim();
            if (!text) return;
            if (tag.startsWith("h")) {
                paragraphs.push(`\n## ${text}`);
            } else if (tag === "li") {
                paragraphs.push(`- ${text}`);
            } else {
                paragraphs.push(text);
            }
        });

        let bodyText = paragraphs.join("\n").trim();
        if (bodyText.length > MAX_BODY_TEXT_PER_PAGE) {
            bodyText = bodyText.slice(0, MAX_BODY_TEXT_PER_PAGE) + "\n[...truncated]";
        }

        // ── Internal links ──
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
            metaDescription,
            ogSiteName,
            ogDescription,
            ogTitle,
            ogImage,
            themeColor,
            headings,
            heroText,
            bodyText,
            links,
            images: images.slice(0, 30), // cap at 30 images per page
        };
    } catch (err) {
        console.error(`crawlWebsite: failed to fetch ${url}:`, err);
        return null;
    }
}

/**
 * Extract hex color codes from page content.
 * Looks at theme-color meta, inline styles, and CSS custom properties.
 */
function extractColors($: cheerio.CheerioAPI, html: string): string[] {
    const colors = new Set<string>();

    // Theme color
    const themeColor = $('meta[name="theme-color"]').attr("content")?.trim();
    if (themeColor && /^#[0-9a-fA-F]{3,8}$/.test(themeColor)) {
        colors.add(themeColor.toLowerCase());
    }

    // msapplication-TileColor
    const tileColor = $('meta[name="msapplication-TileColor"]').attr("content")?.trim();
    if (tileColor && /^#[0-9a-fA-F]{3,8}$/.test(tileColor)) {
        colors.add(tileColor.toLowerCase());
    }

    // CSS custom properties and inline hex colors in <style> blocks
    const hexRegex = /#[0-9a-fA-F]{6}\b/g;
    const styleBlocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? [];
    for (const block of styleBlocks) {
        const matches = block.match(hexRegex) ?? [];
        for (const m of matches.slice(0, 20)) { // limit to avoid noise
            colors.add(m.toLowerCase());
        }
    }

    return Array.from(colors);
}

/**
 * Select best additional pages to crawl from discovered internal links.
 * Prioritizes about, blog, and services pages.
 */
function selectAdditionalPages(links: string[], maxPages: number): string[] {
    const selected: string[] = [];
    const used = new Set<string>();

    // Priority pass — pick the best match for each priority pattern
    for (const pattern of PAGE_PRIORITY_PATTERNS) {
        if (selected.length >= maxPages) break;
        for (const link of links) {
            if (used.has(link)) continue;
            if (pattern.test(new URL(link).pathname)) {
                selected.push(link);
                used.add(link);
                break; // one per pattern
            }
        }
    }

    // Fill remaining slots with any other internal links (prefer shorter paths = top-level)
    if (selected.length < maxPages) {
        const remaining = links
            .filter((l) => !used.has(l))
            .sort((a, b) => {
                const pathA = new URL(a).pathname.split("/").filter(Boolean).length;
                const pathB = new URL(b).pathname.split("/").filter(Boolean).length;
                return pathA - pathB;
            });
        for (const link of remaining) {
            if (selected.length >= maxPages) break;
            selected.push(link);
        }
    }

    return selected;
}

// ── Main Export ───────────────────────────────────────────────────────────

/**
 * Crawl a website's homepage and up to 3 additional internal pages.
 * Returns structured data for AI brand analysis.
 */
export async function crawlWebsite(url: string): Promise<CrawlResult> {
    // Normalize input URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
        normalizedUrl = `https://${normalizedUrl}`;
    }

    // 1. Fetch homepage
    const homepage = await fetchPage(normalizedUrl);
    if (!homepage) {
        throw new Error(`Could not fetch the homepage at ${normalizedUrl}. The site may be unreachable, blocking crawlers, or require authentication.`);
    }

    // 2. Extract colors from raw HTML (needs a second cheerio parse for style blocks)
    let rawHtml = "";
    try {
        const resp = await fetch(normalizedUrl, {
            headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            redirect: "follow",
        });
        rawHtml = await resp.text();
    } catch { /* color extraction is best-effort */ }
    const $ = cheerio.load(rawHtml);
    const discoveredColors = extractColors($, rawHtml);

    // 3. Discover and fetch additional pages
    const pagesToCrawl = selectAdditionalPages(homepage.links, MAX_ADDITIONAL_PAGES);
    const additionalResults = await Promise.allSettled(
        pagesToCrawl.map((pageUrl) => fetchPage(pageUrl))
    );
    const additionalPages = additionalResults
        .filter((r): r is PromiseFulfilledResult<CrawledPage | null> => r.status === "fulfilled")
        .map((r) => r.value)
        .filter((p): p is CrawledPage => p !== null);

    // 4. Combine all body text
    const allBodyText = [
        `# Homepage\n${homepage.bodyText}`,
        ...additionalPages.map((p) => `\n# ${p.title || p.url}\n${p.bodyText}`),
    ].join("\n\n");

    // 5. Combine all image signals
    const allImageSignals = [
        ...homepage.images,
        ...additionalPages.flatMap((p) => p.images),
    ];

    return {
        homepage,
        additionalPages,
        discoveredColors,
        allBodyText,
        allImageSignals,
    };
}
