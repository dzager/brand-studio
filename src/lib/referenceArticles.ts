import * as cheerio from "cheerio";

/**
 * In-memory cache for fetched article content.
 * Key: URL, Value: { text, title, fetchedAt }
 */
const cache = new Map<
    string,
    { title: string; text: string; fetchedAt: number }
>();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CHARS_PER_ARTICLE = 4000; // Keep prompt manageable

/**
 * Parse raw HTML into a { title, text } result using cheerio.
 * Returns null if the extracted text is too short (< 100 chars).
 */
function extractFromHtml(
    html: string,
    fallbackTitle: string
): { title: string; text: string } | null {
    const $ = cheerio.load(html);

    // Remove noise
    $(
        "script, style, nav, header, footer, aside, .sidebar, .comments, .related-posts, .newsletter, .ad, iframe, form"
    ).remove();

    // Extract title
    const title =
        $("h1").first().text().trim() ||
        $("title").text().trim() ||
        fallbackTitle;

    // Extract main content — try common article containers
    const contentEl =
        $("article").first().length > 0
            ? $("article").first()
            : $("main").first().length > 0
            ? $("main").first()
            : $('[role="main"]').first().length > 0
            ? $('[role="main"]').first()
            : $(".post-content, .entry-content, .article-content, .blog-content").first().length > 0
            ? $(".post-content, .entry-content, .article-content, .blog-content").first()
            : $("body");

    // Get text content, preserving some structure
    const paragraphs: string[] = [];
    contentEl.find("h2, h3, h4, p, li").each((_i, el) => {
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

    let articleText = paragraphs.join("\n").trim();

    // Truncate to keep prompt size manageable
    if (articleText.length > MAX_CHARS_PER_ARTICLE) {
        articleText =
            articleText.slice(0, MAX_CHARS_PER_ARTICLE) +
            "\n\n[...truncated for brevity]";
    }

    if (!articleText || articleText.length < 100) {
        return null;
    }

    return { title, text: articleText };
}

/**
 * Fallback: scrape a URL via Firecrawl API when the standard fetch fails.
 * Returns raw HTML or null if Firecrawl is unavailable / the request fails.
 */
async function fetchViaFirecrawl(
    url: string,
    apiKey: string
): Promise<string | null> {
    try {
        console.log(`[referenceArticles] Retrying ${url} with Firecrawl...`);
        const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ url, formats: ["html"] }),
            signal: AbortSignal.timeout(15000), // 15s — Firecrawl can be slower
        });

        if (!resp.ok) {
            console.warn(
                `[referenceArticles] Firecrawl returned status ${resp.status}`
            );
            return null;
        }

        const result = await resp.json();
        if (!result.success || !result.data?.html) {
            console.warn(
                `[referenceArticles] Firecrawl scrape failed:`,
                result.error || "no HTML data returned"
            );
            return null;
        }

        return result.data.html as string;
    } catch (err) {
        console.warn(`[referenceArticles] Firecrawl error for ${url}:`, err);
        return null;
    }
}

/**
 * Fetch a URL and extract its main textual content.
 * Uses a standard fetch + cheerio first, then falls back to Firecrawl
 * (if FIRECRAWL_API_KEY is set) for pages that block simple requests.
 * Results are cached in memory for 24 hours.
 */
export async function fetchArticleContent(
    url: string
): Promise<{ title: string; text: string } | null> {
    // Check cache first
    const cached = cache.get(url);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return { title: cached.title, text: cached.text };
    }

    // ── Attempt 1: Standard fetch + cheerio ──────────────────────────
    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (compatible; BrandStudio/1.0)",
                Accept: "text/html",
            },
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (resp.ok) {
            const html = await resp.text();
            const result = extractFromHtml(html, url);
            if (result) {
                cache.set(url, { ...result, fetchedAt: Date.now() });
                return result;
            }
            console.warn(
                `fetchArticleContent: insufficient content via standard fetch for ${url}`
            );
        } else {
            console.warn(
                `fetchArticleContent: ${url} returned ${resp.status}`
            );
        }
    } catch (err) {
        console.warn(
            `fetchArticleContent: standard fetch failed for ${url}:`,
            err
        );
    }

    // ── Attempt 2: Firecrawl fallback ────────────────────────────────
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (firecrawlKey) {
        const html = await fetchViaFirecrawl(url, firecrawlKey);
        if (html) {
            const result = extractFromHtml(html, url);
            if (result) {
                console.log(
                    `[referenceArticles] Firecrawl fallback succeeded for ${url}`
                );
                cache.set(url, { ...result, fetchedAt: Date.now() });
                return result;
            }
            console.warn(
                `[referenceArticles] Firecrawl returned HTML but extraction still insufficient for ${url}`
            );
        }
    }

    return null;
}

/**
 * Fetch multiple reference articles and compile them into a prompt section.
 * Returns a string ready to be injected into the system prompt, or empty string if none fetched.
 */
export async function compileReferenceArticles(
    urls: string[]
): Promise<string> {
    if (!urls.length) return "";

    const results = await Promise.allSettled(
        urls.map((u) => fetchArticleContent(u))
    );

    const sections: string[] = [];
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled" && result.value) {
            const { title, text } = result.value;
            sections.push(
                `### Reference Article ${i + 1}: "${title}"\nSource: ${urls[i]}\n\n${text}`
            );
        }
    }

    if (!sections.length) return "";

    return [
        "\n\n## Gold-Standard Reference Articles",
        "Study the structure, tone, and depth of these articles. Model your output after them — match their level of detail, section structure, and editorial voice.\n",
        ...sections,
    ].join("\n");
}
