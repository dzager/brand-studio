/**
 * Crawl Cache — short-lived cache for DeepCrawlResult objects
 *
 * Prevents duplicate crawls when running multiple audit types (freshness + links)
 * against the same site within a short window.
 *
 * Cache is backed by the `crawl_cache` Supabase table with a 15-minute TTL.
 */

import { getSupabase } from "@/lib/supabase";
import type { DeepCrawlResult } from "@/lib/freshnessCrawler";

const DEFAULT_TTL_MINUTES = 15;

/**
 * Normalize a URL for cache key matching.
 * Strips protocol, trailing slashes, and lowercases.
 */
function normalizeCacheKey(url: string): string {
    let key = url.trim().toLowerCase();
    key = key.replace(/^https?:\/\//, "");
    key = key.replace(/\/+$/, "");
    return key;
}

/**
 * Look up a cached crawl result.
 * Returns null if no valid (unexpired) cache entry exists.
 */
export async function getCachedCrawl(
    accountId: string,
    siteUrl: string,
    scope: string = "deep"
): Promise<DeepCrawlResult | null> {
    const sb = getSupabase();
    const normalizedUrl = normalizeCacheKey(siteUrl);

    const { data, error } = await sb
        .from("crawl_cache")
        .select("result")
        .eq("account_id", accountId)
        .eq("site_url", normalizedUrl)
        .eq("scope", scope)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !data?.result) return null;

    console.log(`[crawl-cache] Cache HIT for ${normalizedUrl} (scope: ${scope})`);
    return data.result as DeepCrawlResult;
}

/**
 * Store a crawl result in the cache.
 * Existing entries for the same key are replaced.
 */
export async function setCrawlCache(
    accountId: string,
    siteUrl: string,
    scope: string = "deep",
    result: DeepCrawlResult,
    ttlMinutes: number = DEFAULT_TTL_MINUTES
): Promise<void> {
    const sb = getSupabase();
    const normalizedUrl = normalizeCacheKey(siteUrl);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

    // Delete any existing entries for this key (replace strategy)
    await sb
        .from("crawl_cache")
        .delete()
        .eq("account_id", accountId)
        .eq("site_url", normalizedUrl)
        .eq("scope", scope);

    const { error } = await sb
        .from("crawl_cache")
        .insert({
            account_id: accountId,
            site_url: normalizedUrl,
            scope,
            result,
            pages_crawled: result.pages_crawled,
            expires_at: expiresAt,
        });

    if (error) {
        console.warn(`[crawl-cache] Failed to cache crawl result:`, error.message);
    } else {
        console.log(`[crawl-cache] Cached ${result.pages_crawled} pages for ${normalizedUrl} (expires in ${ttlMinutes}min)`);
    }
}

/**
 * Clean up expired cache entries.
 * Call this periodically or lazily to prevent unbounded table growth.
 */
export async function cleanExpiredCache(): Promise<void> {
    const sb = getSupabase();
    await sb
        .from("crawl_cache")
        .delete()
        .lt("expires_at", new Date().toISOString());
}
