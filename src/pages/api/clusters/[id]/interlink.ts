// src/pages/api/clusters/[id]/interlink.ts
// POST: Retroactively inject internal links between articles in a cluster.
// For manual clusters (or any cluster whose articles were generated/assigned separately),
// this scans every article's HTML and uses AI to add natural cross-references
// to sibling articles within the same cluster.

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import { getTextResponse } from "@/lib/ai-client";

type SiblingInfo = {
    id: string;
    title: string;
    slug: string;
    keyword: string;
    role: string;
    excerpt: string | null;
};

function buildInterlinkPrompt(
    articleTitle: string,
    articleRole: string,
    articleHtml: string,
    siblings: SiblingInfo[]
): string {
    const siblingList = siblings
        .map(
            (s) =>
                `- Title: "${s.title}"\n  Slug: /${s.slug}\n  Keyword: "${s.keyword}"\n  Role: ${s.role}${s.excerpt ? `\n  Summary: ${s.excerpt}` : ""}`
        )
        .join("\n");

    return `You are an expert SEO editor. Your ONLY task is to add internal links to the existing HTML content below.

## Current Article
Title: "${articleTitle}"
Role: ${articleRole}

## Sibling Articles in This Cluster
${siblingList}

## Rules
1. Add 3-8 internal links to the sibling articles listed above, distributed naturally throughout the content.
2. Use DESCRIPTIVE anchor text that relates to the sibling article's keyword — do NOT use generic text like "click here" or "read more".
3. Link format: <a href="/{slug}">{descriptive anchor text}</a>
4. Place links where the linked topic is contextually relevant — do NOT cluster all links in one paragraph.
5. If the article is a PILLAR page, link to ALL sibling articles. If SUPPORTING or LONG_TAIL, link to the pillar + 2-3 related siblings.
6. Do NOT remove any existing content, formatting, headings, images, or structure.
7. Do NOT add new paragraphs or sections just for links — weave them into existing text naturally.
8. Do NOT add links if a link to that same slug already exists in the HTML.
9. Return ONLY the updated HTML — no commentary, no markdown fencing, no explanation.

## Original HTML
${articleHtml}`;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    const supabase = getSupabase();
    const { id: clusterId } = req.query;

    if (typeof clusterId !== "string") {
        return res.status(400).json({ error: "Invalid cluster id" });
    }

    try {
        // Optional: only interlink specific articles (if empty/missing, do all)
        const { article_ids } = req.body ?? {};

        // Load the cluster
        const { data: cluster, error: clusterErr } = await supabase
            .from("clusters")
            .select("id, name, company_id")
            .eq("id", clusterId)
            .single();

        if (clusterErr || !cluster) {
            return res.status(404).json({ error: "Cluster not found" });
        }

        // Load all articles in this cluster (with full HTML)
        const { data: articles, error: articlesErr } = await supabase
            .from("articles")
            .select("id, title, slug, excerpt, html, cluster_role, seo")
            .eq("cluster_id", clusterId);

        if (articlesErr) throw articlesErr;

        if (!articles || articles.length < 2) {
            return res
                .status(400)
                .json({ error: "Cluster needs at least 2 articles to interlink" });
        }

        // Determine which articles to process
        const targetIds = Array.isArray(article_ids) && article_ids.length > 0
            ? new Set(article_ids as string[])
            : null; // null = process all

        const articlesToProcess = targetIds
            ? articles.filter((a) => targetIds.has(a.id))
            : articles;

        // Build sibling info list
        const allSiblings: SiblingInfo[] = articles.map((a: any) => ({
            id: a.id,
            title: a.title,
            slug: a.slug,
            keyword: a.seo?.primary_keyword ?? a.title,
            role: a.cluster_role ?? "supporting",
            excerpt: a.excerpt,
        }));

        const results: {
            id: string;
            title: string;
            success: boolean;
            links_added: number;
            error?: string;
        }[] = [];

        // Process each article
        for (const article of articlesToProcess) {
            const articleData = article as any;
            if (!articleData.html) {
                results.push({
                    id: articleData.id,
                    title: articleData.title,
                    success: false,
                    links_added: 0,
                    error: "No HTML content",
                });
                continue;
            }

            // Siblings = all articles in cluster except this one
            const siblings = allSiblings.filter((s) => s.id !== articleData.id);

            // Count existing internal links (to siblings) to compare later
            const existingLinkCount = siblings.reduce((count, sib) => {
                const pattern = new RegExp(`href=["']/?${sib.slug}["']`, "gi");
                return count + (articleData.html.match(pattern)?.length ?? 0);
            }, 0);

            try {
                const prompt = buildInterlinkPrompt(
                    articleData.title,
                    articleData.cluster_role ?? "supporting",
                    articleData.html,
                    siblings
                );

                const updatedHtml = await getTextResponse(
                    "gpt-5.3-chat-latest",
                    "",
                    prompt,
                    { temperature: 0.3 }
                );

                if (!updatedHtml || updatedHtml.length < 100) {
                    results.push({
                        id: articleData.id,
                        title: articleData.title,
                        success: false,
                        links_added: 0,
                        error: "AI returned empty or too-short response",
                    });
                    continue;
                }

                // Clean up any markdown fencing the AI might have added
                let cleanHtml = updatedHtml
                    .replace(/^```html?\s*/i, "")
                    .replace(/\s*```$/i, "")
                    .trim();

                // Count new internal links
                const newLinkCount = siblings.reduce((count, sib) => {
                    const pattern = new RegExp(`href=["']/?${sib.slug}["']`, "gi");
                    return count + (cleanHtml.match(pattern)?.length ?? 0);
                }, 0);

                const linksAdded = newLinkCount - existingLinkCount;

                // Save updated HTML back to the article
                const { error: updateErr } = await supabase
                    .from("articles")
                    .update({ html: cleanHtml })
                    .eq("id", articleData.id);

                if (updateErr) throw updateErr;

                results.push({
                    id: articleData.id,
                    title: articleData.title,
                    success: true,
                    links_added: Math.max(0, linksAdded),
                });
            } catch (articleErr: any) {
                results.push({
                    id: articleData.id,
                    title: articleData.title,
                    success: false,
                    links_added: 0,
                    error: articleErr.message,
                });
            }
        }

        const totalLinksAdded = results.reduce((sum, r) => sum + r.links_added, 0);
        const successCount = results.filter((r) => r.success).length;

        return res.status(200).json({
            cluster_id: clusterId,
            articles_processed: results.length,
            articles_succeeded: successCount,
            total_links_added: totalLinksAdded,
            results,
        });
    } catch (err) {
        console.error(`API /api/clusters/${clusterId}/interlink error:`, err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
