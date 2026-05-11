/**
 * Research Agent — Core orchestration for topic research
 *
 * Pipeline: search query generation → web search (Serper) → crawl pages → AI analysis
 * Reuses existing crawlWebsite infrastructure and AI client abstraction.
 */

import * as cheerio from "cheerio";
import { getStructuredResponse, getTextResponse, resolveModelId } from "@/lib/ai-client";

// ── Types ────────────────────────────────────────────────────────────────

export interface ResearchConfig {
    query: string;
    companyName?: string;
    companyIndustry?: string;
    maxSources?: number;    // default 8
    model?: string;
}

export interface CrawledSource {
    url: string;
    title: string;
    domain: string;
    content_text: string;
    snippet: string;        // search result snippet
}

export interface ResearchAnalysis {
    title: string;
    key_findings: string[];
    statistics: { stat: string; source: string; context: string }[];
    expert_quotes: { quote: string; attribution: string; source_url: string }[];
    contrarian_angles: string[];
    content_gaps: string[];
    suggested_angles: string[];
    suggested_queries: string[];
    source_summaries: { url: string; summary: string; relevance_score: number }[];
}

export interface ResearchResult {
    title: string;
    analysis: ResearchAnalysis;
    sources: CrawledSource[];
}

// ── Constants ────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10000;
const MAX_BODY_TEXT_PER_PAGE = 8000;
const USER_AGENT = "Mozilla/5.0 (compatible; BrandStudio/1.0)";

// ── Search Query Generation ──────────────────────────────────────────────

/**
 * Generate diverse search queries from a research topic.
 * Returns 5-8 queries targeting different angles.
 */
async function generateSearchQueries(
    topic: string,
    companyContext: string,
    model: string
): Promise<string[]> {
    const system = `You are a research strategist. Generate 5-8 diverse Google search queries to deeply research a topic. 
Cover different angles: factual data, expert opinions, recent developments, industry reports, statistics, and contrarian views.
Each query should be specific and likely to surface high-quality, authoritative sources.
Return ONLY a JSON array of strings — no explanation.`;

    const prompt = `Topic: "${topic}"
${companyContext ? `Context: This research is for ${companyContext}.` : ""}

Generate 5-8 search queries as a JSON array.`;

    const raw = await getTextResponse(model, system, prompt, { temperature: 0.4 });
    try {
        const cleaned = raw.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
        const queries = JSON.parse(cleaned);
        if (Array.isArray(queries) && queries.every((q: unknown) => typeof q === "string")) {
            return queries.slice(0, 8);
        }
    } catch {
        // Fallback: split by newlines
        const lines = raw.split("\n").map(l => l.replace(/^\d+[\.\)]\s*/, "").replace(/^["'-]\s*/, "").replace(/["']$/, "").trim()).filter(l => l.length > 5);
        if (lines.length > 0) return lines.slice(0, 8);
    }
    // Ultimate fallback
    return [topic, `${topic} statistics 2026`, `${topic} expert analysis`];
}

// ── Serper Web Search ────────────────────────────────────────────────────

interface SerperOrganic {
    title: string;
    link: string;
    snippet: string;
    position: number;
}

interface SerperResponse {
    organic: SerperOrganic[];
    peopleAlsoAsk?: { question: string; snippet: string }[];
    relatedSearches?: { query: string }[];
    knowledgeGraph?: { title: string; description: string };
}

/**
 * Search the web via Serper API (Google search proxy).
 */
async function serperSearch(query: string, num = 5): Promise<SerperResponse> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) throw new Error("Missing SERPER_API_KEY");

    const resp = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query, num }),
    });

    if (!resp.ok) {
        const text = await resp.text();
        console.warn(`Serper search failed (${resp.status}):`, text);
        return { organic: [] };
    }

    return resp.json();
}

// ── Page Crawling ────────────────────────────────────────────────────────

/**
 * Fetch a single page and extract its text content.
 * Lightweight version of crawlWebsite's fetchPage — optimized for research.
 */
async function fetchPageContent(url: string): Promise<{ title: string; text: string; domain: string } | null> {
    try {
        const resp = await fetch(url, {
            headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            redirect: "follow",
        });

        if (!resp.ok) return null;

        const contentType = resp.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html")) return null;

        const html = await resp.text();
        const $ = cheerio.load(html);

        // Remove noise
        $("script, style, nav, footer, aside, .sidebar, .comments, .ad, iframe, form, noscript, svg, header").remove();

        const title = $("title").first().text().trim();
        let domain = "";
        try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { }

        // Extract body text
        const contentEl =
            $("article").first().length > 0 ? $("article").first()
            : $("main").first().length > 0 ? $("main").first()
            : $('[role="main"]').first().length > 0 ? $('[role="main"]').first()
            : $(".post-content, .entry-content, .article-content, .page-content").first().length > 0
                ? $(".post-content, .entry-content, .article-content, .page-content").first()
            : $("body");

        const paragraphs: string[] = [];
        contentEl.find("h1, h2, h3, h4, p, li, blockquote").each((_i, el) => {
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
        if (bodyText.length < 100) return null;

        return { title, text: bodyText, domain };
    } catch (err) {
        console.warn(`Research crawl failed for ${url}:`, err);
        return null;
    }
}

// ── AI Analysis ──────────────────────────────────────────────────────────

const ResearchAnalysisSchema = {
    type: "object",
    additionalProperties: false,
    required: [
        "title", "key_findings", "statistics", "expert_quotes",
        "contrarian_angles", "content_gaps", "suggested_angles",
        "suggested_queries", "source_summaries"
    ],
    properties: {
        title: {
            type: "string",
            description: "A descriptive title summarizing this research (e.g. 'Dental Implant Costs & Trends in 2026')",
        },
        key_findings: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 12,
            description: "The most important findings from across all sources. Be specific — include numbers, names, and context.",
        },
        statistics: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["stat", "source", "context"],
                properties: {
                    stat: { type: "string", description: "The specific data point (e.g. '73% of patients prefer...')" },
                    source: { type: "string", description: "Which source URL this came from" },
                    context: { type: "string", description: "Why this stat matters" },
                },
            },
            description: "Specific data points, percentages, dollar figures, timelines cited in sources.",
        },
        expert_quotes: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["quote", "attribution", "source_url"],
                properties: {
                    quote: { type: "string" },
                    attribution: { type: "string", description: "Who said it and their credentials" },
                    source_url: { type: "string" },
                },
            },
            description: "Direct quotes from experts, practitioners, or authoritative figures.",
        },
        contrarian_angles: {
            type: "array",
            items: { type: "string" },
            description: "Surprising, counter-narrative, or underrepresented perspectives found.",
        },
        content_gaps: {
            type: "array",
            items: { type: "string" },
            description: "Topics or questions that the existing content landscape doesn't cover well.",
        },
        suggested_angles: {
            type: "array",
            items: { type: "string" },
            description: "Specific article angles this research supports (e.g. 'Cost comparison guide: implants vs bridges in 2026').",
        },
        suggested_queries: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 5,
            description: "Follow-up research queries to deepen understanding on sub-topics.",
        },
        source_summaries: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["url", "summary", "relevance_score"],
                properties: {
                    url: { type: "string" },
                    summary: { type: "string", description: "2-3 sentence summary of what this source contributes" },
                    relevance_score: { type: "number", description: "0-1 relevance score for this source" },
                },
            },
            description: "Per-source summaries with relevance scores.",
        },
    },
} as const;

// ── Main Export ──────────────────────────────────────────────────────────

/**
 * Conduct in-depth topic research.
 *
 * Pipeline:
 * 1. Generate diverse search queries from the topic
 * 2. Search the web via Serper (Google proxy)
 * 3. Deduplicate and select top URLs
 * 4. Crawl each URL for full article text
 * 5. Send all content to AI for structured analysis
 */
export async function conductResearch(config: ResearchConfig): Promise<ResearchResult> {
    const {
        query,
        companyName,
        companyIndustry,
        maxSources = 8,
        model: requestedModel,
    } = config;

    const model = resolveModelId(requestedModel);
    const companyContext = [companyName, companyIndustry].filter(Boolean).join(", ");

    // ── Step 1: Generate search queries ──────────────────────────────
    console.log(`[research] Generating search queries for: "${query}"`);
    const searchQueries = await generateSearchQueries(query, companyContext, "gpt-4.1-mini");

    // ── Step 2: Search the web ──────────────────────────────────────
    console.log(`[research] Executing ${searchQueries.length} search queries...`);
    const allOrganicResults: { query: string; result: SerperOrganic }[] = [];
    const seenUrls = new Set<string>();

    // Run searches in parallel (2 at a time)
    const searchBatches: string[][] = [];
    for (let i = 0; i < searchQueries.length; i += 2) {
        searchBatches.push(searchQueries.slice(i, i + 2));
    }

    for (const batch of searchBatches) {
        const results = await Promise.allSettled(
            batch.map(q => serperSearch(q, 5))
        );
        for (let i = 0; i < results.length; i++) {
            const r = results[i];
            if (r.status === "fulfilled" && r.value.organic) {
                for (const organic of r.value.organic) {
                    if (!seenUrls.has(organic.link)) {
                        seenUrls.add(organic.link);
                        allOrganicResults.push({ query: batch[i], result: organic });
                    }
                }
            }
        }
    }

    // ── Step 3: Select top URLs to crawl ────────────────────────────
    // Prioritize by search position and diversity of queries
    const sortedResults = allOrganicResults
        .sort((a, b) => a.result.position - b.result.position)
        .slice(0, maxSources);

    console.log(`[research] Found ${allOrganicResults.length} unique URLs, crawling top ${sortedResults.length}`);

    // ── Step 4: Crawl pages ─────────────────────────────────────────
    const crawlResults = await Promise.allSettled(
        sortedResults.map(r => fetchPageContent(r.result.link))
    );

    const sources: CrawledSource[] = [];
    for (let i = 0; i < crawlResults.length; i++) {
        const r = crawlResults[i];
        const organic = sortedResults[i].result;
        if (r.status === "fulfilled" && r.value) {
            sources.push({
                url: organic.link,
                title: r.value.title || organic.title,
                domain: r.value.domain,
                content_text: r.value.text,
                snippet: organic.snippet,
            });
        } else {
            // Still include the source with snippet only
            let domain = "";
            try { domain = new URL(organic.link).hostname.replace(/^www\./, ""); } catch { }
            sources.push({
                url: organic.link,
                title: organic.title,
                domain,
                content_text: "",
                snippet: organic.snippet,
            });
        }
    }

    console.log(`[research] Successfully crawled ${sources.filter(s => s.content_text.length > 0).length} of ${sources.length} sources`);

    // ── Step 5: AI Analysis ─────────────────────────────────────────
    const sourceContext = sources.map((s, i) => {
        const content = s.content_text
            ? s.content_text.slice(0, 4000)
            : `[Could not crawl — snippet only] ${s.snippet}`;
        return `### Source ${i + 1}: ${s.title}\nURL: ${s.url}\nDomain: ${s.domain}\n\n${content}`;
    }).join("\n\n---\n\n");

    const analysisSystem = `You are an expert research analyst. Given a research topic and content from multiple web sources, produce a structured analysis.

Rules:
- Be specific and factual. Every finding should be grounded in the source material.
- Include actual numbers, names, and dates — not vague summaries.
- For statistics, cite the exact source URL.
- For expert quotes, provide the exact quote and attribution.
- Identify content gaps — what are competitors NOT covering that would make good articles?
- Suggest specific, actionable article angles — not generic topics.
- Generate follow-up research queries that would deepen understanding of specific sub-topics.
- For source summaries, evaluate each source's contribution and assign a relevance score (0-1).`;

    const analysisPrompt = `Research Topic: "${query}"
${companyContext ? `Company Context: ${companyContext}` : ""}

I searched the web and gathered content from ${sources.length} sources. Analyze all of this content and produce a structured research report.

${sourceContext}`;

    console.log(`[research] Running AI analysis...`);
    const analysis = await getStructuredResponse<ResearchAnalysis>(
        model,
        analysisSystem,
        analysisPrompt,
        ResearchAnalysisSchema as any,
        { schemaName: "research_analysis", temperature: 0.3 }
    );

    return {
        title: analysis.title,
        analysis,
        sources,
    };
}

// ── Brief Compilation ────────────────────────────────────────────────────

export interface Highlight {
    text: string;
    note?: string;
    color?: string;
    source_url?: string;
    source_title?: string;
}

export interface ResearchBrief {
    summary: string;
    key_themes: { theme: string; evidence: string[] }[];
    content_angles: { angle: string; rationale: string; target_keyword?: string }[];
    supporting_data: string[];
}

const BriefSchema = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "key_themes", "content_angles", "supporting_data"],
    properties: {
        summary: {
            type: "string",
            description: "A 2-3 paragraph executive summary synthesizing all highlights into a coherent narrative.",
        },
        key_themes: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["theme", "evidence"],
                properties: {
                    theme: { type: "string" },
                    evidence: {
                        type: "array",
                        items: { type: "string" },
                        description: "Specific evidence from the highlights supporting this theme.",
                    },
                },
            },
            description: "3-6 key themes identified across all highlights.",
        },
        content_angles: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["angle", "rationale"],
                properties: {
                    angle: { type: "string", description: "A specific article angle (e.g. 'Complete guide to...')" },
                    rationale: { type: "string", description: "Why this angle is compelling based on the research" },
                    target_keyword: { type: "string", description: "Suggested primary keyword for SEO" },
                },
            },
            description: "3-5 specific article angles this research supports.",
        },
        supporting_data: {
            type: "array",
            items: { type: "string" },
            description: "Key statistics, quotes, and data points to reference in content.",
        },
    },
} as const;

/**
 * Compile a Research Brief from curated highlights.
 */
export async function compileBrief(
    query: string,
    highlights: Highlight[],
    model?: string
): Promise<ResearchBrief> {
    const resolvedModel = resolveModelId(model);

    const highlightText = highlights.map((h, i) => {
        let entry = `${i + 1}. "${h.text}"`;
        if (h.source_title) entry += `\n   Source: ${h.source_title}`;
        if (h.source_url) entry += ` (${h.source_url})`;
        if (h.note) entry += `\n   Note: ${h.note}`;
        return entry;
    }).join("\n\n");

    const system = `You are a content strategist synthesizing research highlights into an actionable brief.
The brief should connect the dots between individual findings, identify overarching themes, and recommend specific content angles.
Be specific and data-driven — reference the actual highlights, not generic advice.`;

    const prompt = `Research Topic: "${query}"

The user has curated ${highlights.length} highlights from their research:

${highlightText}

Synthesize these into a structured Research Brief.`;

    return getStructuredResponse<ResearchBrief>(
        resolvedModel,
        system,
        prompt,
        BriefSchema as any,
        { schemaName: "research_brief", temperature: 0.3 }
    );
}
