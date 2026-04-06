// src/lib/jsonld.ts
// Generates Schema.org JSON-LD structured data for AEO/GEO optimization.

type FaqItem = { question: string; answer: string };

type ArticleData = {
    title: string;
    slug: string;
    excerpt: string;
    html: string;
    keywords?: string[];
    featured_image_url?: string;
    date_published?: string;
    date_modified?: string;
    author_name?: string;
    publisher_name?: string;
};

/**
 * Schema.org Article structured data.
 * Covers both standard search and AI answer engines.
 */
export function buildArticleJsonLd(article: ArticleData): Record<string, unknown> {
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        description: article.excerpt,
        ...(article.keywords?.length && { keywords: article.keywords.join(", ") }),
        ...(article.featured_image_url && { image: article.featured_image_url }),
        datePublished: article.date_published || new Date().toISOString(),
        ...(article.date_modified && { dateModified: article.date_modified }),
        author: {
            "@type": article.author_name ? "Person" : "Organization",
            name: article.author_name || article.publisher_name || "Editorial Team",
        },
        ...(article.publisher_name && {
            publisher: {
                "@type": "Organization",
                name: article.publisher_name,
            },
        }),
        mainEntityOfPage: {
            "@type": "WebPage",
            "@id": `https://example.com/${article.slug}`,
        },
    };
}

/**
 * Schema.org FAQPage structured data.
 * AI search engines heavily cite FAQ-structured content.
 */
export function buildFaqJsonLd(faqs: FaqItem[]): Record<string, unknown> | null {
    if (!faqs?.length) return null;

    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
            },
        })),
    };
}

/**
 * Schema.org HowTo structured data.
 * Extracts steps from HTML ordered lists for procedural content.
 */
export function buildHowToJsonLd(
    title: string,
    description: string,
    steps: string[]
): Record<string, unknown> | null {
    if (!steps?.length) return null;

    return {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: title,
        description,
        step: steps.map((text, i) => ({
            "@type": "HowToStep",
            position: i + 1,
            text,
        })),
    };
}

/**
 * Combines all relevant JSON-LD blocks into an array for injection.
 */
export function buildAllJsonLd(opts: {
    article: ArticleData;
    faq?: FaqItem[];
    content_type?: string;
    how_to_steps?: string[];
}): Record<string, unknown>[] {
    const blocks: Record<string, unknown>[] = [];

    blocks.push(buildArticleJsonLd(opts.article));

    const faqLd = buildFaqJsonLd(opts.faq || []);
    if (faqLd) blocks.push(faqLd);

    // Generate HowTo schema for any article with procedural steps,
    // not just content_type "how_to" — non-how_to articles with
    // step-by-step sections also benefit from HowTo rich results.
    if (opts.how_to_steps?.length) {
        const howToLd = buildHowToJsonLd(
            opts.article.title,
            opts.article.excerpt,
            opts.how_to_steps
        );
        if (howToLd) blocks.push(howToLd);
    }

    return blocks;
}
