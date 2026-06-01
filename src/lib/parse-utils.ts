/**
 * Shared parsing utilities — extracted from rate-quality, fact-check-consul,
 * compare-article, and freshnessEngine to eliminate 4x duplication.
 */

/**
 * Robustly extract a JSON object from text that may contain markdown fences,
 * preamble text, or trailing content. Includes repair for trailing commas.
 */
export function extractJSON(raw: string): any {
    let text = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    const start = text.indexOf("{");
    if (start < 0) throw new Error("No JSON object found in model response.");

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { escaped = false; continue; }
        if (ch === "\\") { escaped = true; continue; }
        if (ch === '"' && !escaped) { inString = !inString; continue; }
        if (inString) continue;
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) { end = i; break; }
        }
    }

    if (end < 0) throw new Error("Unterminated JSON object in model response.");

    const jsonStr = text.slice(start, end + 1);
    try {
        return JSON.parse(jsonStr);
    } catch {
        // Attempt repair: remove trailing commas before closing braces/brackets
        const repaired = jsonStr.replace(/,\s*([}\]])/g, "$1");
        return JSON.parse(repaired);
    }
}

/**
 * Strip HTML tags and decode common entities to produce plain text.
 * Removes style and script blocks first for cleaner extraction.
 */
export function htmlToText(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
}
