// src/pages/api/similarity.ts
// POST: Find similar articles for a given text or article_id within a company.

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import {
    generateEmbedding,
    buildArticleEmbeddingText,
    formatVectorForSupabase,
    type SimilarityResult,
} from "@/lib/embeddings";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const supabase = getSupabase();

    try {
        const {
            company_id,
            text,
            article_id,
            threshold = 0.80,
        } = req.body ?? {};

        if (!company_id) {
            return res.status(400).json({ error: "company_id is required" });
        }

        if (!text && !article_id) {
            return res.status(400).json({ error: "Either text or article_id is required" });
        }

        let queryEmbedding: number[];

        if (article_id) {
            // Find similar articles to an existing article
            const { data: article, error: articleErr } = await supabase
                .from("articles")
                .select("title, html, embedding")
                .eq("id", article_id)
                .single();

            if (articleErr || !article) {
                return res.status(404).json({ error: "Article not found" });
            }

            if (article.embedding) {
                // Use existing embedding — parse from pgvector format
                // pgvector returns arrays directly via supabase-js
                queryEmbedding = article.embedding as unknown as number[];
            } else {
                // Generate embedding on the fly
                const embText = buildArticleEmbeddingText(article.title, article.html);
                queryEmbedding = await generateEmbedding(embText);
            }
        } else {
            // Embed the provided text
            queryEmbedding = await generateEmbedding(text);
        }

        const vectorStr = formatVectorForSupabase(queryEmbedding);

        const { data: matches, error: rpcErr } = await supabase.rpc(
            "match_company_articles",
            {
                query_embedding: vectorStr,
                target_company_id: company_id,
                match_threshold: Math.max(0, Math.min(1, Number(threshold))),
                match_count: 20,
                exclude_article_id: article_id || null,
            }
        );

        if (rpcErr) throw rpcErr;

        const results: SimilarityResult[] = (matches ?? []).map((m: any) => ({
            id: m.id,
            title: m.title,
            slug: m.slug,
            cluster_id: m.cluster_id,
            cluster_role: m.cluster_role,
            similarity: Math.round(m.similarity * 1000) / 1000,
        }));

        return res.status(200).json({ results });
    } catch (err) {
        console.error("API /api/similarity error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
