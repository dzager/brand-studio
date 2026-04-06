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
 * Fetch a URL and extract its main textual content.
 * Uses cheerio to parse HTML and extract article-like content.
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

    try {
        const resp = await fetch(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (compatible; BrandStudio/1.0)",
                Accept: "text/html",
            },
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (!resp.ok) {
            console.warn(`fetchArticleContent: ${url} returned ${resp.status}`);
            return null;
        }

        const html = await resp.text();
        const $ = cheerio.load(html);

        // Remove noise
        $(
            "script, style, nav, header, footer, aside, .sidebar, .comments, .related-posts, .newsletter, .ad, iframe, form"
        ).remove();

        // Extract title
        const title =
            $("h1").first().text().trim() ||
            $("title").text().trim() ||
            url;

        // Extract main content — try common article containers
        let contentEl =
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
            console.warn(
                `fetchArticleContent: insufficient content from ${url}`
            );
            return null;
        }

        // Cache the result
        cache.set(url, { title, text: articleText, fetchedAt: Date.now() });

        return { title, text: articleText };
    } catch (err) {
        console.error(`fetchArticleContent error for ${url}:`, err);
        return null;
    }
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
