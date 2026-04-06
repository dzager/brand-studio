// src/lib/embeddings.ts
// Shared embedding utility — generate, compare, and detect overlaps using OpenAI text-embedding-3-small.

import OpenAI from "openai";

// ── Types ────────────────────────────────────────────────────────────────

export type OverlapPair = {
    slug_a: string;
    keyword_a: string;
    slug_b: string;
    keyword_b: string;
    similarity: number;
    severity: "low" | "warning" | "danger";
};

export type SimilarityResult = {
    id: string;
    title: string;
    slug: string;
    cluster_id: string | null;
    cluster_role: string | null;
    similarity: number;
};

export type PageEmbedding = {
    slug: string;
    keyword: string;
    title: string;
    embedding: number[];
};

export type OverlapWarnings = {
    intra_cluster: OverlapPair[];
    existing_content: {
        planned_slug: string;
        planned_keyword: string;
        existing_article_id: string;
        existing_title: string;
        existing_slug: string;
        similarity: number;
        severity: "low" | "warning" | "danger";
    }[];
};

// ── Constants ────────────────────────────────────────────────────────────

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

/** Similarity thresholds */
export const THRESHOLD_LOW = 0.80;
export const THRESHOLD_WARNING = 0.85;
export const THRESHOLD_DANGER = 0.92;

// ── OpenAI Client ────────────────────────────────────────────────────────

let _client: OpenAI | null = null;
function getClient(): OpenAI {
    if (!_client) {
        _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _client;
}

// ── Core Functions ───────────────────────────────────────────────────────

/**
 * Generate a single embedding vector for a text string.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const resp = await getClient().embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
        encoding_format: "float",
    });
    return resp.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single API call.
 * OpenAI supports batch input — more efficient than individual calls.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // OpenAI batch limit is ~2048 inputs; we're well under that for cluster pages
    const resp = await getClient().embeddings.create({
        model: EMBEDDING_MODEL,
        input: texts,
        encoding_format: "float",
    });

    // Sort by index to maintain input order
    const sorted = resp.data.sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
}

/**
 * Compute cosine similarity between two vectors.
 * Returns a value between -1 and 1 (1 = identical, 0 = orthogonal).
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    if (denom === 0) return 0;
    return dot / denom;
}

/**
 * Classify a similarity score into severity level.
 */
export function classifySeverity(
    similarity: number
): "low" | "warning" | "danger" {
    if (similarity >= THRESHOLD_DANGER) return "danger";
    if (similarity >= THRESHOLD_WARNING) return "warning";
    return "low";
}

// ── Text Builders ────────────────────────────────────────────────────────

/**
 * Build embedding text for a planned cluster page (strategy-time).
 * Combines title, keyword, and description for semantic representation.
 */
export function buildPageEmbeddingText(page: {
    title: string;
    keyword: string;
    description: string;
}): string {
    return [
        `Title: ${page.title}`,
        `Target keyword: ${page.keyword}`,
        `Description: ${page.description}`,
    ].join("\n");
}

/**
 * Build embedding text for a generated article (post-generation).
 * Uses title + plain text content (truncated to ~8000 chars).
 */
export function buildArticleEmbeddingText(
    title: string,
    html: string
): string {
    const plainText = stripHtml(html);
    const truncated = plainText.slice(0, 8000);
    return `Title: ${title}\n\nContent: ${truncated}`;
}

/**
 * Strip HTML tags to extract plain text.
 */
export function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}

// ── Overlap Detection ────────────────────────────────────────────────────

/**
 * Find all pairs of items with similarity above threshold.
 * Used for intra-cluster cannibalization detection.
 */
export function findOverlaps(
    items: { slug: string; keyword: string; vector: number[] }[],
    threshold: number = THRESHOLD_LOW
): OverlapPair[] {
    const overlaps: OverlapPair[] = [];

    for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
            const sim = cosineSimilarity(items[i].vector, items[j].vector);
            if (sim >= threshold) {
                overlaps.push({
                    slug_a: items[i].slug,
                    keyword_a: items[i].keyword,
                    slug_b: items[j].slug,
                    keyword_b: items[j].keyword,
                    similarity: Math.round(sim * 1000) / 1000,
                    severity: classifySeverity(sim),
                });
            }
        }
    }

    // Sort by similarity descending (most concerning first)
    return overlaps.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Format an embedding vector for Supabase pgvector storage.
 * pgvector expects the format: [0.1, 0.2, ...]
 */
export function formatVectorForSupabase(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
}
