import type { NextApiRequest, NextApiResponse } from "next";

/**
 * POST /api/scrape-article
 * Scrapes a published article URL and returns clean, semantic HTML
 * suitable for importing into the article editor.
 *
 * Body: { url: string }
 * Returns: { title: string; html: string; excerpt: string }
 */

// ── Allowed tags & attributes for sanitization ──────────────────────────
const ALLOWED_TAGS = new Set([
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr",
    "ul", "ol", "li",
    "a",
    "img",
    "blockquote",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
    "strong", "b", "em", "i", "u", "s", "del",
    "code", "pre",
    "figure", "figcaption",
    "div", "span", // kept for structure, but attributes stripped
    "sup", "sub",
]);

/** Attributes we keep per tag — everything else is stripped */
const ALLOWED_ATTRS: Record<string, string[]> = {
    a: ["href", "title"],
    img: ["src", "alt", "width", "height"],
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { url } = req.body ?? {};

    if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "url is required" });
    }

    // Basic URL validation
    try {
        new URL(url);
    } catch {
        return res.status(400).json({ error: "Invalid URL format" });
    }

    try {
        const html = await fetchRawHtml(url);
        if (!html) {
            return res.status(422).json({
                error: "Could not fetch the page. It may be unreachable or require authentication.",
            });
        }

        const result = extractArticleHtml(html, url);
        if (!result) {
            return res.status(422).json({
                error: "Could not extract article content from this URL. The page may not contain a recognizable article.",
            });
        }

        return res.status(200).json(result);
    } catch (err: any) {
        console.error("API /api/scrape-article error:", err);
        return res.status(500).json({
            error: err.message || "Failed to scrape article",
        });
    }
}

// ── Fetch raw HTML (standard fetch + Firecrawl fallback) ────────────────

async function fetchRawHtml(url: string): Promise<string | null> {
    // Attempt 1: Standard fetch
    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; BrandStudio/1.0)",
                Accept: "text/html",
            },
            signal: AbortSignal.timeout(10000),
        });
        if (resp.ok) {
            return await resp.text();
        }
        console.warn(`[scrape-article] Standard fetch returned ${resp.status} for ${url}`);
    } catch (err) {
        console.warn(`[scrape-article] Standard fetch failed for ${url}:`, err);
    }

    // Attempt 2: Firecrawl fallback
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (firecrawlKey) {
        try {
            console.log(`[scrape-article] Retrying ${url} with Firecrawl...`);
            const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${firecrawlKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url, formats: ["html"] }),
                signal: AbortSignal.timeout(15000),
            });
            if (resp.ok) {
                const result = await resp.json();
                if (result.success && result.data?.html) {
                    return result.data.html;
                }
            }
        } catch (err) {
            console.warn(`[scrape-article] Firecrawl error for ${url}:`, err);
        }
    }

    return null;
}

// ── Extract & sanitize article HTML ─────────────────────────────────────

function extractArticleHtml(
    rawHtml: string,
    sourceUrl: string
): { title: string; html: string; excerpt: string } | null {
    // Dynamic import of cheerio is not needed — it's a dependency
    const cheerio = require("cheerio");
    const $ = cheerio.load(rawHtml);

    // Remove noise elements
    $(
        "script, style, noscript, nav, header, footer, aside, " +
        ".sidebar, .comments, .related-posts, .newsletter, .ad, .ads, .advertisement, " +
        ".social-share, .share-buttons, .author-bio, .cookie-banner, .popup, .modal, " +
        "iframe, form, [role='navigation'], [role='banner'], [role='contentinfo'], " +
        "[aria-hidden='true'], .wp-block-spacer, .breadcrumb, .breadcrumbs"
    ).remove();

    // Extract title
    const title =
        $("h1").first().text().trim() ||
        $("meta[property='og:title']").attr("content")?.trim() ||
        $("title").text().trim() ||
        "Imported Article";

    // Find the main content container
    const contentEl =
        $("article").first().length > 0
            ? $("article").first()
            : $("main").first().length > 0
            ? $("main").first()
            : $('[role="main"]').first().length > 0
            ? $('[role="main"]').first()
            : $(".post-content, .entry-content, .article-content, .blog-content, .content-area, .post-body").first().length > 0
            ? $(".post-content, .entry-content, .article-content, .blog-content, .content-area, .post-body").first()
            : $("body");

    // Remove the h1 from content (we extracted it separately)
    contentEl.find("h1").first().remove();

    // Sanitize the HTML: strip disallowed tags, remove all attributes except allowed ones
    sanitizeNode($, contentEl);

    // Get the cleaned inner HTML
    let cleanHtml = contentEl.html()?.trim() ?? "";

    // Collapse excessive whitespace/newlines and remove empty tags
    cleanHtml = cleanHtml
        .replace(/<(div|span|p)>\s*<\/\1>/gi, "")   // empty block tags
        .replace(/\n{3,}/g, "\n\n")                  // excessive newlines
        .replace(/(<br\s*\/?>){3,}/gi, "<br><br>")   // excessive <br>s
        .trim();

    if (!cleanHtml || cleanHtml.length < 50) {
        return null;
    }

    // Build excerpt from text content
    const textContent = contentEl.text().replace(/\s+/g, " ").trim();
    const excerpt = textContent.slice(0, 160).trim() + (textContent.length > 160 ? "…" : "");

    // Resolve relative image URLs to absolute
    const urlObj = new URL(sourceUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    cleanHtml = cleanHtml.replace(
        /(<img[^>]+src=")([^"]+)(")/gi,
        (_match: string, pre: string, src: string, post: string) => {
            if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
                return `${pre}${src}${post}`;
            }
            const absolute = src.startsWith("/") ? `${baseUrl}${src}` : `${baseUrl}/${src}`;
            return `${pre}${absolute}${post}`;
        }
    );

    // Also resolve relative link hrefs
    cleanHtml = cleanHtml.replace(
        /(<a[^>]+href=")([^"]+)(")/gi,
        (_match: string, pre: string, href: string, post: string) => {
            if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("#")) {
                return `${pre}${href}${post}`;
            }
            const absolute = href.startsWith("/") ? `${baseUrl}${href}` : `${baseUrl}/${href}`;
            return `${pre}${absolute}${post}`;
        }
    );

    return { title, html: cleanHtml, excerpt };
}

/**
 * Recursively sanitize a cheerio node tree:
 * - Remove disallowed tags (unwrap their children)
 * - Strip all attributes except those in the allowlist
 */
function sanitizeNode($: any, node: any): void {
    node.children().each((_i: number, child: any) => {
        const el = $(child);
        const tagName = (child.tagName || child.name || "").toLowerCase();

        if (child.type === "text") return;

        if (!tagName || !ALLOWED_TAGS.has(tagName)) {
            // Unwrap: keep children, remove the tag itself
            const children = el.children();
            if (children.length > 0) {
                sanitizeNode($, el);
                el.replaceWith(el.contents());
            } else {
                // If the disallowed tag has meaningful text, replace with a <span>
                const text = el.text().trim();
                if (text) {
                    el.replaceWith(text);
                } else {
                    el.remove();
                }
            }
            return;
        }

        // Strip attributes not in allowlist
        const allowed = ALLOWED_ATTRS[tagName] || [];
        const attrs = child.attribs || {};
        for (const attr of Object.keys(attrs)) {
            if (!allowed.includes(attr)) {
                el.removeAttr(attr);
            }
        }

        // Sanitize href: remove javascript: links
        if (tagName === "a") {
            const href = el.attr("href") || "";
            if (href.toLowerCase().startsWith("javascript:")) {
                el.attr("href", "#");
            }
        }

        // Recurse into children
        sanitizeNode($, el);
    });
}
