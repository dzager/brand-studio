// src/pages/api/backfill-embeddings.ts
// POST: Generate embeddings for all existing articles that don't have one.
// Processes in batches of 20. Returns count of articles processed.

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import {
    generateEmbeddings,
    buildArticleEmbeddingText,
    stripHtml,
    formatVectorForSupabase,
} from "@/lib/embeddings";

const BATCH_SIZE = 20;

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const supabase = getSupabase();

    try {
        // Get all articles without embeddings
        const { data: articles, error: fetchErr } = await supabase
            .from("articles")
            .select("id, title, html")
            .is("embedding", null)
            .order("created_at", { ascending: true });

        if (fetchErr) throw fetchErr;

        if (!articles || articles.length === 0) {
            return res.status(200).json({
                message: "All articles already have embeddings",
                processed: 0,
                total: 0,
            });
        }

        let processed = 0;
        let failed = 0;

        // Process in batches
        for (let i = 0; i < articles.length; i += BATCH_SIZE) {
            const batch = articles.slice(i, i + BATCH_SIZE);

            // Build embedding texts for the batch
            const texts = batch.map((a) =>
                buildArticleEmbeddingText(a.title, a.html || "")
            );

            try {
                const embeddings = await generateEmbeddings(texts);

                // Update each article with its embedding
                for (let j = 0; j < batch.length; j++) {
                    try {
                        const vectorStr = formatVectorForSupabase(embeddings[j]);
                        await supabase
                            .from("articles")
                            .update({ embedding: vectorStr })
                            .eq("id", batch[j].id);
                        processed++;
                    } catch (updateErr) {
                        console.warn(`Failed to update embedding for article ${batch[j].id}:`, updateErr);
                        failed++;
                    }
                }
            } catch (batchErr) {
                console.error(`Batch embedding generation failed at offset ${i}:`, batchErr);
                failed += batch.length;
            }
        }

        return res.status(200).json({
            message: `Backfill complete`,
            processed,
            failed,
            total: articles.length,
        });
    } catch (err) {
        console.error("API /api/backfill-embeddings error:", err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
