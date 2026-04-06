// src/pages/api/clusters/auto-cluster.ts
// POST: Analyze unclustered articles for a company, group them into topical clusters using
// embeddings (similarity) + LLM (intelligent grouping), then create cluster records and assign articles.

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import {
    generateEmbeddings,
    buildArticleEmbeddingText,
    cosineSimilarity,
    formatVectorForSupabase,
} from "@/lib/embeddings";
import { getStructuredResponse } from "@/lib/ai-client";

// Schema for the LLM response — an array of proposed clusters
const AutoClusterSchema = {
    type: "object",
    additionalProperties: false,
    required: ["clusters"],
    properties: {
        clusters: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: ["cluster_name", "pillar_topic", "pillar_article_id", "supporting_article_ids", "long_tail_article_ids"],
                properties: {
                    cluster_name: { type: "string" },
                    pillar_topic: { type: "string" },
                    pillar_article_id: { type: "string" },
                    supporting_article_ids: {
                        type: "array",
                        items: { type: "string" },
                    },
                    long_tail_article_ids: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
            },
        },
    },
} as const;

type ArticleSummary = {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    primary_keyword: string | null;
    secondary_keywords: string[];
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const supabase = getSupabase();

    try {
        const { company_id } = req.body ?? {};

        if (!company_id) {
            return res.status(400).json({ error: "company_id is required" });
        }

        // 1. Fetch all articles for this company
        //    Don't select embedding (large vector) — we'll handle embeddings separately
        const { data: articles, error: fetchErr } = await supabase
            .from("articles")
            .select("id, title, slug, excerpt, html, seo")
            .eq("company_id", company_id)
            .order("created_at", { ascending: true });

        if (fetchErr) throw fetchErr;

        if (!articles || articles.length < 2) {
            return res.status(200).json({
                message: articles?.length === 1
                    ? "Only 1 unclustered article found — need at least 2 to form a cluster."
                    : "No unclustered articles found for this company.",
                clusters_created: 0,
                articles_assigned: 0,
            });
        }

        // 2. Generate embeddings for all articles (batch)
        //    Always generate fresh to avoid parsing issues with pgvector format
        const texts = (articles as any[]).map((a: any) =>
            buildArticleEmbeddingText(a.title, a.html || "")
        );
        const vectors = await generateEmbeddings(texts);

        // Save embeddings for articles that don't have them yet
        for (let i = 0; i < articles.length; i++) {
            try {
                const vectorStr = formatVectorForSupabase(vectors[i]);
                await supabase
                    .from("articles")
                    .update({ embedding: vectorStr })
                    .eq("id", (articles as any[])[i].id);
            } catch (saveErr) {
                // Non-blocking — continue even if save fails
                console.warn(`Failed to save embedding for article ${(articles as any[])[i].id}:`, saveErr);
            }
        }

        // 3. Build article vectors for similarity computation
        const articleVectors = (articles as any[]).map((a, i) => ({
            id: a.id,
            vector: vectors[i],
        }));

        // 4. Build similarity data for the LLM
        //    Only include notable similarities (> 0.70) to keep prompt manageable
        const similarities: { a: string; b: string; sim: number }[] = [];

        for (let i = 0; i < articleVectors.length; i++) {
            for (let j = i + 1; j < articleVectors.length; j++) {
                const sim = cosineSimilarity(articleVectors[i].vector, articleVectors[j].vector);
                if (sim >= 0.70) {
                    similarities.push({
                        a: articleVectors[i].id,
                        b: articleVectors[j].id,
                        sim: Math.round(sim * 1000) / 1000,
                    });
                }
            }
        }
        similarities.sort((a, b) => b.sim - a.sim);

        // 5. Build article summaries for the LLM
        const articleSummaries: ArticleSummary[] = (articles as any[]).map((a) => ({
            id: a.id,
            title: a.title,
            slug: a.slug,
            excerpt: a.excerpt,
            primary_keyword: a.seo?.primary_keyword ?? null,
            secondary_keywords: a.seo?.secondary_keywords ?? [],
        }));

        // 6. Call LLM to propose cluster groupings
        const systemPrompt = [
            `You are an SEO content strategist. Given a set of existing articles, group them into topical clusters.`,
            ``,
            `## Rules`,
            `- Each cluster should have a clear topical theme.`,
            `- Every cluster needs exactly 1 pillar article (the broadest, most comprehensive one on the topic).`,
            `- Other articles become supporting (mid-depth subtopics) or long_tail (narrow/specific queries).`,
            `- A cluster should have at least 2 articles total.`,
            `- Articles that don't fit any cluster should be left out entirely (don't force bad groupings).`,
            `- Use the similarity scores to inform which articles are topically related.`,
            `- The cluster_name should be a short, descriptive label for the topic (e.g., "Dental Implant Guide", "React Performance").`,
            `- The pillar_topic should describe what the cluster covers broadly.`,
        ].join("\n");

        const userPrompt = [
            `Here are ${articleSummaries.length} unclustered articles:`,
            ``,
            `### Articles`,
            ...articleSummaries.map((a) =>
                `- ID: ${a.id} | Title: "${a.title}" | Keyword: "${a.primary_keyword || "none"}" | Slug: ${a.slug}`
            ),
            ``,
            similarities.length > 0
                ? [
                    `### Similarity Scores (cosine similarity, 1.0 = identical)`,
                    `Top ${Math.min(similarities.length, 50)} pairs:`,
                    ...similarities.slice(0, 50).map((s) => {
                        const aTitle = articleSummaries.find((a) => a.id === s.a)?.title ?? s.a;
                        const bTitle = articleSummaries.find((a) => a.id === s.b)?.title ?? s.b;
                        return `- "${aTitle}" ↔ "${bTitle}": ${s.sim}`;
                    }),
                ].join("\n")
                : `No notable similarity pairs found (all below 0.70).`,
            ``,
            `Group these articles into topical clusters. Only include articles that genuinely fit a cluster. Return the article IDs exactly as provided above.`,
        ].join("\n");

        const result = await getStructuredResponse<{ clusters: any[] }>(
            "gpt-4.1-nano",
            systemPrompt,
            userPrompt,
            AutoClusterSchema as any,
            { schemaName: "auto_cluster_result" }
        );

        // 7. Create clusters and assign articles
        const validArticleIds = new Set(articleSummaries.map((a) => a.id));
        const createdClusters: any[] = [];
        let totalAssigned = 0;

        for (const proposed of result.clusters) {
            // Validate article IDs
            const pillarId = proposed.pillar_article_id;
            if (!validArticleIds.has(pillarId)) continue;

            const supportingIds = (proposed.supporting_article_ids ?? []).filter(
                (id: string) => validArticleIds.has(id)
            );
            const longTailIds = (proposed.long_tail_article_ids ?? []).filter(
                (id: string) => validArticleIds.has(id)
            );

            const allIds = [pillarId, ...supportingIds, ...longTailIds];
            if (allIds.length < 2) continue; // Skip clusters with fewer than 2 articles

            // Build a strategy object from the existing articles
            const pillarArticle = articleSummaries.find((a) => a.id === pillarId)!;
            const buildPage = (a: ArticleSummary) => ({
                title: a.title,
                keyword: a.primary_keyword || a.title,
                slug: a.slug,
                description: a.excerpt || a.title,
                word_count: "existing",
                links_to: [] as string[],
            });

            const strategy = {
                cluster_name: proposed.cluster_name,
                pillar: buildPage(pillarArticle),
                supporting: supportingIds
                    .map((id: string) => articleSummaries.find((a) => a.id === id))
                    .filter(Boolean)
                    .map((a: any) => buildPage(a)),
                long_tail: longTailIds
                    .map((id: string) => articleSummaries.find((a) => a.id === id))
                    .filter(Boolean)
                    .map((a: any) => buildPage(a)),
            };

            // Populate links_to: each page links to the pillar
            for (const sp of strategy.supporting) {
                sp.links_to = [strategy.pillar.slug];
            }
            for (const lt of strategy.long_tail) {
                lt.links_to = [strategy.pillar.slug];
            }
            strategy.pillar.links_to = [
                ...strategy.supporting.map((s: any) => s.slug),
                ...strategy.long_tail.map((s: any) => s.slug),
            ];

            // Create the cluster
            const { data: cluster, error: clusterErr } = await supabase
                .from("clusters")
                .insert({
                    company_id,
                    name: proposed.cluster_name,
                    pillar_topic: proposed.pillar_topic || proposed.cluster_name,
                    strategy,
                    status: "complete", // Articles already exist
                })
                .select()
                .single();

            if (clusterErr) {
                console.error("Failed to create cluster:", clusterErr);
                continue;
            }

            // Assign articles to the cluster
            const assignments = [
                { ids: [pillarId], role: "pillar" },
                { ids: supportingIds, role: "supporting" },
                { ids: longTailIds, role: "long_tail" },
            ];

            for (const { ids, role } of assignments) {
                for (const articleId of ids) {
                    const { error: updateErr } = await supabase
                        .from("articles")
                        .update({
                            cluster_id: cluster.id,
                            cluster_role: role,
                        })
                        .eq("id", articleId);

                    if (updateErr) {
                        console.warn(`Failed to assign article ${articleId} to cluster:`, updateErr);
                    } else {
                        totalAssigned++;
                    }
                }
            }

            createdClusters.push({
                id: cluster.id,
                name: cluster.name,
                pillar_topic: cluster.pillar_topic,
                article_count: allIds.length,
                pillar: pillarArticle.title,
                supporting_count: supportingIds.length,
                long_tail_count: longTailIds.length,
            });
        }

        return res.status(200).json({
            message: createdClusters.length > 0
                ? `Created ${createdClusters.length} cluster(s), assigned ${totalAssigned} articles.`
                : "No meaningful clusters could be formed from the available articles.",
            clusters_created: createdClusters.length,
            articles_assigned: totalAssigned,
            clusters: createdClusters,
        });
    } catch (err: any) {
        console.error("API /api/clusters/auto-cluster error:", err);
        const message = err?.message || (typeof err === "string" ? err : JSON.stringify(err));
        return res.status(500).json({ error: message });
    }
}
