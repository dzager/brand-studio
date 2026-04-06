// src/lib/compileClusterPrompt.ts
// Builds cluster-aware context for article generation within a topical cluster.

export type ClusterPage = {
    title: string;
    keyword: string;
    slug: string;
    description: string;
    word_count: string;
    links_to: string[];
};

export type ClusterStrategy = {
    pillar: ClusterPage;
    supporting: ClusterPage[];
    long_tail: ClusterPage[];
};

export type SiblingArticle = {
    title: string;
    slug: string;
    keyword: string;
    role: string;
};

export type ClusterContext = {
    /** Name of the cluster */
    cluster_name: string;
    /** This page's role in the cluster */
    role: "pillar" | "supporting" | "long_tail";
    /** The page plan from the strategy */
    page: ClusterPage;
    /** The pillar page of this cluster */
    pillar: ClusterPage;
    /** All pages in the cluster strategy (for keyword coordination) */
    all_pages: ClusterPage[];
    /** Sibling articles that have already been generated (for internal linking) */
    existing_siblings: SiblingArticle[];
    /** Base URL for internal links (empty string = relative links) */
    base_url?: string;
};

/**
 * Compiles cluster context into prompt text for injection into article generation.
 *
 * Handles:
 * - Keyword coordination (which keywords belong to which sibling)
 * - Internal linking targets (to already-generated sibling articles)
 * - Role-specific instructions (pillar vs supporting vs long-tail)
 * - Cross-page content deduplication guidance
 */
export function compileClusterContext(ctx: ClusterContext): string {
    const parts: string[] = [];

    // Role header
    const roleLabel =
        ctx.role === "pillar"
            ? "PILLAR PAGE (the hub)"
            : ctx.role === "supporting"
            ? "SUPPORTING PAGE (spoke)"
            : "LONG-TAIL PAGE (deep-dive spoke)";

    parts.push(`\n\n## Topical Cluster Context`);
    parts.push(`This article is part of the "${ctx.cluster_name}" content cluster.`);
    parts.push(`Role: **${roleLabel}**`);
    parts.push(`Target keyword: "${ctx.page.keyword}"`);
    parts.push(`Target slug: ${ctx.page.slug}`);

    // Role-specific guidance
    if (ctx.role === "pillar") {
        parts.push(`\nAs the pillar page, this article should:`);
        parts.push(`- Provide comprehensive coverage of the core topic`);
        parts.push(`- Link OUT to every supporting and long-tail page in the cluster`);
        parts.push(`- Serve as the main hub that other pages link back to`);
        parts.push(`- Cover each subtopic at a high level, deferring deep detail to the supporting pages`);
        parts.push(`- Use anchor text that matches the keyword target of each spoke page`);
    } else if (ctx.role === "supporting") {
        parts.push(`\nAs a supporting page, this article should:`);
        parts.push(`- Go deep on its specific subtopic: "${ctx.page.keyword}"`);
        parts.push(`- Link BACK to the pillar page ("${ctx.pillar.title}") at least once`);
        parts.push(`- Link to 2-3 related supporting/long-tail pages where relevant`);
        parts.push(`- Avoid repeating content covered in the pillar — add NEW depth and detail`);
    } else {
        parts.push(`\nAs a long-tail page, this article should:`);
        parts.push(`- Focus narrowly on the specific query: "${ctx.page.keyword}"`);
        parts.push(`- Link BACK to the pillar page ("${ctx.pillar.title}")`);
        parts.push(`- Link to at least 1 related supporting page`);
        parts.push(`- Answer the query directly and thoroughly — this page targets a very specific search intent`);
    }

    // Keyword coordination — prevent cannibalization
    parts.push(`\n### Keyword Coordination (prevent cannibalization)`);
    parts.push(`Other pages in this cluster target these keywords — do NOT compete with them. Mention them only in linking context:`);

    const otherPages = ctx.all_pages.filter(
        (p) => p.slug !== ctx.page.slug
    );
    for (const p of otherPages) {
        parts.push(`- "${p.keyword}" → handled by: "${p.title}" (/${p.slug})`);
    }

    // Internal linking targets — only for already-generated articles
    if (ctx.existing_siblings.length > 0) {
        parts.push(`\n### Internal Links (MANDATORY)`);
        parts.push(`The following sibling articles already exist. Include natural internal links to them using descriptive anchor text that matches their keyword:`);

        for (const sib of ctx.existing_siblings) {
            const href = ctx.base_url
                ? `${ctx.base_url}/${sib.slug}`
                : `/${sib.slug}`;
            parts.push(
                `- <a href="${href}">${sib.keyword}</a> — "${sib.title}" (${sib.role})`
            );
        }

        parts.push(`Link naturally within the content — do not dump all links in one section.`);
    }

    // Pages planned but not yet generated — mention for context only
    const plannedSlugs = new Set(ctx.existing_siblings.map((s) => s.slug));
    const planned = otherPages.filter((p) => !plannedSlugs.has(p.slug));
    if (planned.length > 0 && ctx.role === "pillar") {
        parts.push(`\n### Planned Pages (link with placeholder slugs)`);
        parts.push(`These pages are planned but not yet published. Still link to them using their planned slugs:`);
        for (const p of planned) {
            const href = ctx.base_url ? `${ctx.base_url}/${p.slug}` : `/${p.slug}`;
            parts.push(`- <a href="${href}">${p.keyword}</a> — "${p.title}"`);
        }
    }

    return parts.join("\n");
}
