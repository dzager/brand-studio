// src/pages/api/clusters/[id]/download.ts
// GET: Download all articles in a cluster as a ZIP file
// Each article gets its own subfolder containing:
//   - article.html       (full styled HTML document)
//   - seo-geo.json       (SEO + GEO/AEO metadata: meta tags, keywords, FAQ, key
//                         takeaways, HowTo steps, and Schema.org JSON-LD blocks)
//   - featured-image.png (if available)
//   - Any inline images extracted from the HTML

import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import JSZip from "jszip";
import { buildAllJsonLd } from "@/lib/jsonld";

export const config = {
    api: {
        responseLimit: false,
    },
};

/**
 * Wraps article HTML content in a styled, standalone HTML document
 */
function buildStandaloneHtml(article: {
    title: string;
    slug: string;
    excerpt: string | null;
    html: string | null;
    image_base64: string | null;
    cluster_role: string | null;
}): string {
    const featuredImg = article.image_base64
        ? `<div class="featured-image"><img src="featured-image.png" alt="${article.title.replace(/"/g, '&quot;')}" /></div>`
        : "";

    // Replace inline base64 images with local file references
    let bodyHtml = article.html ?? "";
    const inlineImages: { index: number; data: string; ext: string }[] = [];
    bodyHtml = bodyHtml.replace(
        /src="data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,([^"]+)"/g,
        (_match, ext, data) => {
            const idx = inlineImages.length;
            const cleanExt = ext.replace("+xml", "").replace("jpeg", "jpg");
            inlineImages.push({ index: idx, data, ext: cleanExt });
            return `src="inline-image-${idx}.${cleanExt}"`;
        }
    );

    const roleLabel = article.cluster_role
        ? `<span class="role-badge">${article.cluster_role.replace("_", " ")}</span>`
        : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.title}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
            max-width: 780px;
            margin: 0 auto;
            padding: 40px 24px;
            color: #1a1a1a;
            line-height: 1.7;
            background: #fff;
        }
        h1 {
            font-size: 32px;
            font-weight: 700;
            line-height: 1.25;
            margin-bottom: 12px;
            color: #111;
        }
        .meta {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
            color: #666;
            font-size: 14px;
        }
        .role-badge {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 999px;
            background: #f0f0f0;
            color: #444;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .excerpt {
            font-size: 18px;
            color: #555;
            font-style: italic;
            margin-bottom: 28px;
            padding-bottom: 24px;
            border-bottom: 1px solid #eee;
        }
        .featured-image {
            margin-bottom: 32px;
        }
        .featured-image img {
            width: 100%;
            height: auto;
            border-radius: 12px;
            display: block;
        }
        h2 { font-size: 24px; font-weight: 700; margin: 36px 0 16px; color: #222; }
        h3 { font-size: 20px; font-weight: 600; margin: 28px 0 12px; color: #333; }
        h4 { font-size: 17px; font-weight: 600; margin: 24px 0 10px; color: #333; }
        p { margin: 0 0 16px; }
        ul, ol { margin: 0 0 16px; padding-left: 28px; }
        li { margin-bottom: 6px; }
        img { max-width: 100%; height: auto; border-radius: 10px; margin: 16px 0; }
        figure { margin: 24px 0; text-align: center; }
        figcaption { font-size: 14px; color: #888; margin-top: 8px; }
        blockquote {
            border-left: 4px solid #ddd;
            padding: 12px 20px;
            margin: 20px 0;
            color: #555;
            font-style: italic;
            background: #fafafa;
            border-radius: 0 8px 8px 0;
        }
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px 14px; border: 1px solid #e0e0e0; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 14px;
            font-family: 'SF Mono', 'Consolas', monospace;
        }
        pre {
            background: #f5f5f5;
            padding: 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 20px 0;
        }
        pre code { background: none; padding: 0; }
        hr { border: none; border-top: 1px solid #eee; margin: 32px 0; }
    </style>
</head>
<body>
    <article>
        <h1>${article.title}</h1>
        <div class="meta">
            ${roleLabel}
            <span>/${article.slug}</span>
        </div>
        ${article.excerpt ? `<p class="excerpt">${article.excerpt}</p>` : ""}
        ${featuredImg}
        <div class="content">
            ${bodyHtml}
        </div>
    </article>
</body>
</html>`;
}

function sanitizeFolderName(name: string): string {
    return name
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase()
        .slice(0, 80);
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const supabase = getSupabase();
    const { id } = req.query;

    if (typeof id !== "string") {
        return res.status(400).json({ error: "Invalid cluster id" });
    }

    try {
        // Get cluster info
        const { data: cluster, error: clusterErr } = await supabase
            .from("clusters")
            .select("id, name, pillar_topic, strategy, status")
            .eq("id", id)
            .single();

        if (clusterErr) throw clusterErr;
        if (!cluster) return res.status(404).json({ error: "Cluster not found" });

        // Get all articles in the cluster with full content
        const { data: articles, error: articlesErr } = await supabase
            .from("articles")
            .select("id, title, slug, excerpt, html, image_base64, cluster_role, created_at, seo")
            .eq("cluster_id", id)
            .order("cluster_role", { ascending: true });

        if (articlesErr) throw articlesErr;

        if (!articles || articles.length === 0) {
            return res.status(400).json({ error: "No articles found in this cluster" });
        }

        // Build the ZIP
        const zip = new JSZip();
        const clusterFolderName = sanitizeFolderName(cluster.name || cluster.pillar_topic || "cluster");

        // Add a cluster-info.html with the strategy overview
        const strategy = cluster.strategy as any;
        if (strategy) {
            const strategyHtml = buildClusterOverviewHtml(cluster.name, strategy, articles);
            zip.file(`${clusterFolderName}/cluster-overview.html`, strategyHtml);
        }

        // Build a lookup from slug → sanitized folder name for relative linking
        const slugToFolder = new Map<string, string>();
        for (const a of articles) {
            const folder = sanitizeFolderName(a.slug || a.title);
            slugToFolder.set(a.slug, folder);
            // Also map the sanitized version in case links use that form
            slugToFolder.set(folder, folder);
        }

        // Process each article
        for (const article of articles) {
            const articleFolderName = sanitizeFolderName(article.slug || article.title);
            const folderPath = `${clusterFolderName}/${articleFolderName}`;

            // Extract inline base64 images from HTML and save as separate files
            let processedHtml = article.html ?? "";
            const inlineImages: { filename: string; data: Buffer }[] = [];

            processedHtml = processedHtml.replace(
                /src="data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,([^"]+)"/g,
                (_match: string, ext: string, data: string) => {
                    const idx = inlineImages.length;
                    const cleanExt = ext.replace("+xml", "").replace("jpeg", "jpg");
                    const filename = `inline-image-${idx}.${cleanExt}`;
                    try {
                        inlineImages.push({
                            filename,
                            data: Buffer.from(data, "base64"),
                        });
                    } catch {
                        // Skip malformed base64
                    }
                    return `src="${filename}"`;
                }
            );

            // Rewrite all internal hyperlinks to relative paths
            // Handles: href="/slug", href="/slug/", href="https://...com/slug", etc.
            processedHtml = processedHtml.replace(
                /href="([^"]+)"/g,
                (_match: string, href: string) => {
                    // Extract the slug from the href
                    let targetSlug: string | null = null;

                    // Case 1: Absolute path like /slug or /slug/
                    if (href.startsWith("/")) {
                        targetSlug = href.replace(/^\/+/, "").replace(/\/+$/, "");
                    }
                    // Case 2: Full URL — extract last path segment as slug
                    else if (href.startsWith("http://") || href.startsWith("https://")) {
                        try {
                            const url = new URL(href);
                            targetSlug = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
                        } catch {
                            // Malformed URL — leave as-is
                            return `href="${href}"`;
                        }
                    }
                    // Case 3: Already relative (e.g., "other-slug" or "../other/article.html")
                    // — leave as-is unless it matches a known slug
                    else {
                        targetSlug = href.replace(/\/+$/, "");
                    }

                    if (targetSlug && slugToFolder.has(targetSlug)) {
                        const targetFolder = slugToFolder.get(targetSlug)!;
                        return `href="../${targetFolder}/article.html"`;
                    }

                    // Not a cluster-internal link — leave unchanged
                    return `href="${href}"`;
                }
            );

            // Build standalone HTML document with local image references
            const standaloneHtml = buildStandaloneHtml({
                ...article,
                html: processedHtml,
            });
            zip.file(`${folderPath}/article.html`, standaloneHtml);

            // ── SEO + GEO metadata file ──────────────────────────────────
            // Combines all signals that search crawlers and AI answer engines
            // (GEO / AEO) look for: meta tags, keywords, structured FAQ,
            // key takeaways, and full Schema.org JSON-LD blocks.
            const seo = (article.seo ?? {}) as Record<string, unknown>;
            const faqItems = (seo.faq as { question: string; answer: string }[] | undefined) ?? [];
            const howToSteps = (seo.how_to_steps as string[] | undefined) ?? [];
            const keywords = (seo.keywords as string[] | undefined) ?? [];

            const jsonldBlocks = buildAllJsonLd({
                article: {
                    title: article.title,
                    slug: article.slug,
                    excerpt: article.excerpt ?? "",
                    html: processedHtml,
                    keywords,
                    date_published: article.created_at,
                },
                faq: faqItems,
                content_type: seo.content_type as string | undefined,
                how_to_steps: howToSteps,
            });

            const seoGeo = {
                // ── On-page meta ─────────────────────────────────────────
                meta_title: seo.meta_title ?? article.title,
                meta_description: seo.meta_description ?? article.excerpt,
                canonical_slug: article.slug,

                // ── Keyword targeting ────────────────────────────────────
                primary_keyword: seo.primary_keyword ?? null,
                secondary_keywords: seo.secondary_keywords ?? [],
                keywords,

                // ── GEO / AEO signals ────────────────────────────────────
                // These sections are highly cited by AI search engines
                // (Google SGE, Perplexity, ChatGPT Browse, Bing Copilot)
                faq: faqItems,
                key_takeaways: seo.key_takeaways ?? [],
                how_to_steps: howToSteps,
                content_type: seo.content_type ?? "article",

                // ── Schema.org JSON-LD ───────────────────────────────────
                // Drop these as <script type="application/ld+json"> blocks
                // in the page <head> to unlock rich results and AEO citations
                structured_data: jsonldBlocks,
            };

            zip.file(
                `${folderPath}/seo-geo.json`,
                JSON.stringify(seoGeo, null, 2)
            );

            // Add featured image
            if (article.image_base64) {
                try {
                    const imgBuffer = Buffer.from(article.image_base64, "base64");
                    zip.file(`${folderPath}/featured-image.png`, imgBuffer);
                } catch {
                    // Skip malformed image
                }
            }

            // Add inline images
            for (const img of inlineImages) {
                zip.file(`${folderPath}/${img.filename}`, img.data);
            }
        }

        // Generate ZIP buffer
        const zipBuffer = await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
        });

        // Send as downloadable file
        const filename = `${clusterFolderName}.zip`;
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", zipBuffer.length.toString());
        return res.send(zipBuffer);
    } catch (err) {
        console.error(`API /api/clusters/${id}/download error:`, err);
        const message = err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}

function buildClusterOverviewHtml(
    clusterName: string,
    strategy: any,
    articles: any[]
): string {
    const generatedSlugs = new Set(articles.map((a) => a.slug));

    function renderPageRow(page: any, type: string): string {
        const isGenerated = generatedSlugs.has(page.slug);
        const statusBadge = isGenerated
            ? '<span style="color:#16a34a;font-weight:600">✓ Generated</span>'
            : '<span style="color:#999">Pending</span>';
        return `
            <tr>
                <td style="padding:10px 14px;border:1px solid #e0e0e0">
                    <strong>${page.title}</strong><br/>
                    <span style="font-size:13px;color:#666">/${page.slug}</span>
                </td>
                <td style="padding:10px 14px;border:1px solid #e0e0e0;text-transform:capitalize">${type.replace("_", " ")}</td>
                <td style="padding:10px 14px;border:1px solid #e0e0e0">${page.keyword}</td>
                <td style="padding:10px 14px;border:1px solid #e0e0e0">${page.word_count}</td>
                <td style="padding:10px 14px;border:1px solid #e0e0e0;text-align:center">${statusBadge}</td>
            </tr>`;
    }

    const rows: string[] = [];
    if (strategy.pillar) rows.push(renderPageRow(strategy.pillar, "pillar"));
    if (strategy.supporting) strategy.supporting.forEach((p: any) => rows.push(renderPageRow(p, "supporting")));
    if (strategy.long_tail) strategy.long_tail.forEach((p: any) => rows.push(renderPageRow(p, "long_tail")));

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cluster Overview: ${clusterName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 24px;
            color: #1a1a1a;
            line-height: 1.6;
            background: #fff;
        }
        h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
        .subtitle { color: #666; font-size: 16px; margin-bottom: 32px; }
        .stats { display: flex; gap: 24px; margin-bottom: 32px; }
        .stat { background: #f8f8f8; padding: 16px 24px; border-radius: 12px; flex: 1; text-align: center; }
        .stat-value { font-size: 28px; font-weight: 700; color: #111; }
        .stat-label { font-size: 13px; color: #888; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #f5f5f5; font-weight: 600; padding: 10px 14px; border: 1px solid #e0e0e0; text-align: left; }
        h2 { font-size: 20px; font-weight: 600; margin: 32px 0 16px; }
        .article-link { color: #2563eb; text-decoration: none; }
        .article-link:hover { text-decoration: underline; }
        ul { padding-left: 24px; }
        li { margin-bottom: 8px; }
    </style>
</head>
<body>
    <h1>📋 ${clusterName}</h1>
    <p class="subtitle">Cluster Strategy Overview</p>

    <div class="stats">
        <div class="stat">
            <div class="stat-value">${rows.length}</div>
            <div class="stat-label">Total Pages</div>
        </div>
        <div class="stat">
            <div class="stat-value">${articles.length}</div>
            <div class="stat-label">Generated</div>
        </div>
        <div class="stat">
            <div class="stat-value">${rows.length - articles.length}</div>
            <div class="stat-label">Pending</div>
        </div>
    </div>

    <h2>Content Plan</h2>
    <table>
        <thead>
            <tr>
                <th>Page</th>
                <th>Type</th>
                <th>Target Keyword</th>
                <th>Word Count</th>
                <th style="text-align:center">Status</th>
            </tr>
        </thead>
        <tbody>
            ${rows.join("\n")}
        </tbody>
    </table>

    <h2>Generated Articles</h2>
    <ul>
        ${articles.map((a) => `<li><a class="article-link" href="${sanitizeFolderName(a.slug || a.title)}/article.html">${a.title}</a> <span style="color:#999">(${a.cluster_role || "unassigned"})</span></li>`).join("\n")}
    </ul>
</body>
</html>`;
}
