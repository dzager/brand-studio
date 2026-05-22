import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase, createServerSupabase } from "@/lib/supabase";
import { requireAuth, getUserAccounts, isPlatformAdmin } from "@/lib/auth";
import { buildBrandEngine, type CompanyRecord } from "@/lib/buildBrandEngine";
import { compileBlogSystemPrompt } from "@/brand/engine";
import {
    generateEmbeddings,
    buildPageEmbeddingText,
    findOverlaps,
    classifySeverity,
    formatVectorForSupabase,
    type PageEmbedding,
    type OverlapWarnings,
} from "@/lib/embeddings";
import { resolveModelId, getStructuredResponse } from "@/lib/ai-client";

const ClusterStrategySchema = {
    type: "object",
    additionalProperties: false,
    required: ["cluster_name", "pillar", "supporting", "long_tail"],
    properties: {
        cluster_name: { type: "string" },
        pillar: {
            type: "object",
            additionalProperties: false,
            required: ["title", "keyword", "slug", "description", "word_count", "links_to"],
            properties: {
                title: { type: "string" },
                keyword: { type: "string" },
                slug: { type: "string" },
                description: { type: "string" },
                word_count: { type: "string" },
                links_to: { type: "array", items: { type: "string" } },
            },
        },
        supporting: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "keyword", "slug", "description", "word_count", "links_to"],
                properties: {
                    title: { type: "string" },
                    keyword: { type: "string" },
                    slug: { type: "string" },
                    description: { type: "string" },
                    word_count: { type: "string" },
                    links_to: { type: "array", items: { type: "string" } },
                },
            },
            minItems: 3,
            maxItems: 8,
        },
        long_tail: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["title", "keyword", "slug", "description", "word_count", "links_to"],
                properties: {
                    title: { type: "string" },
                    keyword: { type: "string" },
                    slug: { type: "string" },
                    description: { type: "string" },
                    word_count: { type: "string" },
                    links_to: { type: "array", items: { type: "string" } },
                },
            },
            minItems: 5,
            maxItems: 15,
        },
    },
} as const;

function buildClusterSystemPrompt(brand: ReturnType<typeof buildBrandEngine>): string {
    const brandName = brand.engine_meta.brand_name;
    const industry = brand.latent_brand_profile.archetype;
    const currentYear = new Date().getFullYear();

    const parts: string[] = [
        `You are an expert SEO + GEO (AI search optimization) strategist for ${brandName}.`,
        `Your job is to design topical clusters — interconnected content systems that dominate a category in both traditional search AND AI-driven search (LLMs, answer engines, featured snippets).`,
        ``,
        `## What is a Topical Cluster?`,
        `A topical cluster is a content architecture with:`,
        `1. **Pillar Page** — comprehensive hub article targeting the broadest keyword (2,500–4,000 words)`,
        `2. **Supporting Pages** (5–8) — deep-dive articles on major subtopics, each targeting a mid-volume keyword (1,800–2,400 words)`,
        `3. **Long-Tail Pages** (8–15) — focused articles targeting specific, low-competition queries (800–1,200 words)`,
        ``,
        `## CORE PRINCIPLES (MANDATORY)`,
        `- Prioritize clarity, specificity, and factual intent over cleverness`,
        `- Titles must map directly to real search queries`,
        `- Optimize for answer extraction — AI should be able to quote the page`,
        `- Avoid generic, marketing-style phrasing`,
        ``,
        `## TITLE STRUCTURE RULES`,
        `Each title MUST:`,
        `1. Start with the PRIMARY KEYWORD (or very close variation)`,
        `2. Include 3–5 HIGH-INTENT MODIFIERS (see modifier rule below)`,
        `3. Include the YEAR (${currentYear}) when relevant`,
        `4. Add SPECIFICITY when possible:`,
        `   - Form numbers (I-130, I-485)`,
        `   - Audience (spouses, fiancé visa holders)`,
        `   - Context (inside U.S. vs abroad)`,
        `5. Use natural phrasing (not a keyword list)`,
        `6. Prefer:`,
        `   - Colon (:) to separate keyword from modifiers`,
        `   - "and" before the final modifier`,
        `7. Target 50–70 characters when possible (clarity > strict length)`,
        ``,
        `## HIGH-INTENT MODIFIER RULE (MANDATORY)`,
        `Always include 3–5 of the following types when relevant:`,
        `- Process: how to apply, steps, process`,
        `- Cost: cost, fees, total cost`,
        `- Time: timeline, processing time, how long`,
        `- Requirements: eligibility, requirements`,
        `- Documents: documents, checklist, evidence`,
        `- Forms: specific forms (I-130, I-485)`,
        `Replace generic modifiers with concrete ones.`,
        ``,
        `## TITLE NATURALIZATION RULE`,
        `Avoid stacking modifiers with commas only.`,
        `Bad: Marriage Green Card Requirements, Costs, Timeline (${currentYear})`,
        `Good: Marriage Green Card (${currentYear}): Requirements, Costs, Timeline, and Process`,
        `Titles should sound like a human wrote them, not a keyword dump.`,
        ``,
        `## ENTITY ENRICHMENT RULE (FOR GEO)`,
        `When possible, include at least one of:`,
        `- Government entities (USCIS)`,
        `- Form numbers (I-130, I-485)`,
        `- Specific audiences (spouses, fiancé visa holders)`,
        `- Context (inside U.S. vs abroad)`,
        `This improves AI answer extraction and ranking.`,
        ``,
        `## COVERAGE SIGNALING RULE`,
        `Titles must match page intent:`,
        `- Pillar pages: Include 3–5 modifiers (broad coverage)`,
        `- Supporting pages: Focus on 1–2 modifiers (specific intent)`,
        `- Long-tail pages: Focus on 1 modifier with maximum specificity`,
        `Examples:`,
        `Pillar → requirements + cost + timeline + process`,
        `Supporting → income requirements OR processing time`,
        ``,
        `## BANNED / LOW-VALUE TERMS`,
        `Avoid unless absolutely necessary:`,
        `- complete guide`,
        `- ultimate guide`,
        `- everything you need to know`,
        `- explained`,
        `- full guide`,
        `- no-nonsense`,
        `Replace with specific, searchable terms.`,
        ``,
        `## SLUG RULES (CRITICAL)`,
        `Each slug MUST:`,
        `1. Be lowercase, using hyphens (-) only`,
        `2. Contain the PRIMARY KEYWORD`,
        `3. Include 1–2 HIGH-INTENT MODIFIERS (not all)`,
        `4. Remove stop words (the, and, of, for, to)`,
        `5. Be concise: 3–6 words ideal`,
        `6. Avoid dates unless necessary`,
        `7. Never duplicate another slug in the same cluster`,
        ``,
        `## SELF-SCORING (MANDATORY)`,
        `Score each title internally (1–10) based on:`,
        `- Keyword alignment`,
        `- Modifier strength (3–5 high-intent modifiers)`,
        `- Specificity (entities, forms, audience)`,
        `- GEO clarity (answer-extractable)`,
        `If score < 9: rewrite once to improve it.`,
        `Return only final versions scoring 9+.`,
        ``,
        `## Strategy Rules`,
        `- Every page must target a UNIQUE primary keyword — no keyword cannibalization`,
        `- Every supporting and long-tail page links back to the pillar`,
        `- Supporting pages interlink with each other where topically relevant`,
        `- Long-tail pages link to their parent supporting page AND the pillar`,
        `- The links_to field contains slugs of pages this page should link to`,
        `- Keywords should reflect real search queries — how actual users would type them`,
        `- Descriptions should explain what makes each page unique and what specific angle it covers`,
        ``,
        `## Keyword Strategy`,
        `- Pillar keyword: highest volume, broadest intent (e.g., "dental implants")`,
        `- Supporting keywords: mid-volume, subtopic-specific (e.g., "dental implants vs bridges")`,
        `- Long-tail keywords: low-competition, very specific queries (e.g., "dental implant cost in Seattle with insurance")`,
        `- Include "People Also Ask" style questions as long-tail keywords where appropriate`,
        `- Include comparison, cost, timeline, and eligibility keywords`,
        ``,
        `## Content Differentiation`,
        `- Each page must have a clear, unique angle — not just a different title for the same content`,
        `- Supporting pages should cover subtopics the pillar only summarizes`,
        `- Long-tail pages should answer one specific question in depth`,
        `- Never plan two pages that a reader would consider "the same article"`,
    ];

    // Inject company editorial guidelines for topic guidance
    if (brand.editorial_guidelines) {
        parts.push(``);
        parts.push(`## Company Context`);
        parts.push(`Use the following company editorial context to inform topic selection, terminology, audience targeting, and content angles:`);
        parts.push(brand.editorial_guidelines);
    }

    return parts.join("\n");
}

function buildClusterUserPrompt(topic: string): string {
    const currentYear = new Date().getFullYear();
    return [
        `Design a complete topical cluster strategy for the topic: "${topic}"`,
        ``,
        `Generate:`,
        `1. One pillar page (comprehensive, 2,500-4,000 words)`,
        `2. 5-8 supporting pages (mid-depth, 1,800-2,400 words each)`,
        `3. 8-15 long-tail pages (focused, 800-1,200 words each)`,
        ``,
        `For each page, provide:`,
        `- title: Optimized for SEO + GEO. Start with primary keyword, use colon (:) to separate keyword from modifiers, include 3-5 high-intent modifiers (pillar) or 1-2 (supporting/long-tail), add year (${currentYear}) when relevant, include entities (forms, audiences, context), use "and" before the final modifier. Target 50-70 characters. Must read naturally — no keyword dumping. Self-score each title 1-10 and only return 9+ versions.`,
        `- keyword: the exact search query this page targets — how a real user would type it`,
        `- slug: concise URL slug (3-6 words). Must contain the primary keyword + 1-2 modifiers. Lowercase, hyphens only, no stop words, no dates unless necessary.`,
        `- description: 1-2 sentences explaining the unique angle and content`,
        `- word_count: target word range (e.g., "2500-4000")`,
        `- links_to: array of slugs this page should link to`,
        ``,
        `The pillar page's links_to should include ALL supporting and long-tail slugs.`,
        `Supporting pages should link to the pillar slug plus 2-3 related slugs.`,
        `Long-tail pages should link to the pillar slug plus their parent supporting slug.`,
    ].join("\n");
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const user = await requireAuth(req, res);
    if (!user) return;

    const supabase = createServerSupabase(req, res);
    const adminSupabase = getSupabase();

    // Determine if this member is scoped to a specific company
    let scopedCompanyIds: string[] = [];
    let accountIds: string[] = [];
    const isAdminUser = await isPlatformAdmin(user.id);
    if (!isAdminUser) {
        const accts = await getUserAccounts(user.id);
        scopedCompanyIds = accts
            .filter((a) => a.company_id)
            .map((a) => a.company_id!);
        accountIds = accts.map((a) => a.account_id);
    }

    try {
        if (req.method === "GET") {
            const { company_id } = req.query;

            let query = adminSupabase
                .from("clusters")
                .select("*")
                .order("created_at", { ascending: false });

            // Apply company scope: member-scoped companies OR account fallback OR explicit query param
            if (scopedCompanyIds.length > 0) {
                query = query.in("company_id", scopedCompanyIds);
            } else if (!isAdminUser && accountIds.length > 0) {
                query = query.in("account_id", accountIds);
            } else if (typeof company_id === "string" && company_id) {
                query = query.eq("company_id", company_id);
            }

            const { data, error } = await query;
            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === "POST") {
            const { company_id, topic, model: requestedModel } = req.body ?? {};

            if (!company_id || !topic) {
                return res.status(400).json({ error: "company_id and topic are required" });
            }

            // Build brand engine for company context
            const { data: companyData, error: companyErr } = await supabase
                .from("companies")
                .select("*")
                .eq("id", company_id)
                .single();

            if (companyErr || !companyData) {
                return res.status(400).json({ error: "Company not found" });
            }

            const brand = buildBrandEngine(companyData as CompanyRecord);

            const selectedModel = resolveModelId(requestedModel);

            const system = buildClusterSystemPrompt(brand);
            const user = buildClusterUserPrompt(topic.trim());

            const strategy = await getStructuredResponse<any>(
                selectedModel,
                system,
                user,
                ClusterStrategySchema as any,
                { schemaName: "cluster_strategy" }
            );

            // ── Embedding & Overlap Detection ───────────────────────────

            // Collect all planned pages
            const allPages = [
                { ...strategy.pillar, _type: "pillar" as const },
                ...strategy.supporting.map((p: any) => ({ ...p, _type: "supporting" as const })),
                ...strategy.long_tail.map((p: any) => ({ ...p, _type: "long_tail" as const })),
            ];

            // Build embedding texts for all pages
            const embeddingTexts = allPages.map((p) =>
                buildPageEmbeddingText({ title: p.title, keyword: p.keyword, description: p.description })
            );

            // Generate embeddings in batch
            let pageEmbeddings: PageEmbedding[] = [];
            let overlapWarnings: OverlapWarnings = { intra_cluster: [], existing_content: [] };

            try {
                const vectors = await generateEmbeddings(embeddingTexts);

                pageEmbeddings = allPages.map((p, i) => ({
                    slug: p.slug,
                    keyword: p.keyword,
                    title: p.title,
                    embedding: vectors[i],
                }));

                // Intra-cluster overlap detection
                const intraItems = pageEmbeddings.map((pe) => ({
                    slug: pe.slug,
                    keyword: pe.keyword,
                    vector: pe.embedding,
                }));
                overlapWarnings.intra_cluster = findOverlaps(intraItems);

                // Cross-content overlap detection (against all company articles)
                for (const pe of pageEmbeddings) {
                    try {
                        const vectorStr = formatVectorForSupabase(pe.embedding);
                        const { data: matches } = await supabase.rpc(
                            "match_company_articles",
                            {
                                query_embedding: vectorStr,
                                target_company_id: company_id,
                                match_threshold: 0.80,
                                match_count: 5,
                            }
                        );

                        if (matches && matches.length > 0) {
                            for (const m of matches) {
                                overlapWarnings.existing_content.push({
                                    planned_slug: pe.slug,
                                    planned_keyword: pe.keyword,
                                    existing_article_id: m.id,
                                    existing_title: m.title,
                                    existing_slug: m.slug,
                                    similarity: Math.round(m.similarity * 1000) / 1000,
                                    severity: classifySeverity(m.similarity),
                                });
                            }
                        }
                    } catch (rpcErr) {
                        console.warn("Cross-content overlap check failed for", pe.slug, rpcErr);
                    }
                }

                // Sort existing_content by similarity desc
                overlapWarnings.existing_content.sort((a, b) => b.similarity - a.similarity);
            } catch (embErr) {
                console.warn("Embedding generation failed (non-blocking):", embErr);
            }

            // Strip full vectors from stored page_embeddings to keep JSONB manageable
            // (store only slug/keyword/title — vectors are large)
            const storedEmbeddings = pageEmbeddings.map(({ slug, keyword, title, embedding }) => ({
                slug,
                keyword,
                title,
                embedding: embedding.slice(0, 10), // store first 10 dims as fingerprint
                full_dims: embedding.length,
            }));

            // Save cluster with page embeddings
            const { data: cluster, error: saveErr } = await adminSupabase
                .from("clusters")
                .insert({
                    company_id,
                    name: strategy.cluster_name || topic.trim(),
                    pillar_topic: topic.trim(),
                    strategy,
                    status: "draft",
                    page_embeddings: storedEmbeddings,
                    account_id: companyData.account_id || null,
                })
                .select()
                .single();

            if (saveErr) throw saveErr;

            return res.status(201).json({
                ...cluster,
                overlap_warnings: overlapWarnings,
            });
        }

        return res.status(405).json({ error: "Method not allowed" });
    } catch (err) {
        console.error("API /api/clusters error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
