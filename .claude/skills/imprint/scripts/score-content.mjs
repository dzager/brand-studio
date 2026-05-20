#!/usr/bin/env node
// score-content.mjs — deterministic scoring for the parts of the audit rubric
// that don't need an LLM. Outputs a partial audit JSON; the LLM-side audit
// can layer factuality + voice-match scores on top.
//
// Usage:
//   node score-content.mjs <file>

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { findContextDir, findCaseInsensitive, referenceDir } from "./imprint-paths.mjs";

const file = process.argv[2];
if (!file) {
    process.stderr.write("Usage: score-content.mjs <file>\n");
    process.exit(2);
}
if (!existsSync(file)) {
    process.stderr.write(`File not found: ${file}\n`);
    process.exit(1);
}

const content = readFileSync(file, "utf-8");
const contextDir = findContextDir();
const brandPath = findCaseInsensitive(contextDir, "BRAND.md");
const voicePath = findCaseInsensitive(contextDir, "VOICE.md");

const issues = [];
const scores = {};

// ─── Banned phrases ─────────────────────────────────────────────────────────
const bannedPath = join(referenceDir, "banned-phrases.md");
const bannedContent = existsSync(bannedPath) ? readFileSync(bannedPath, "utf-8") : "";
const universalBanned = extractBannedPhrases(bannedContent);

const lower = content.toLowerCase();
let bannedHits = 0;
for (const phrase of universalBanned) {
    if (lower.includes(phrase)) {
        bannedHits++;
        issues.push({
            dimension: "voice_match",
            severity: "high",
            issue: `Banned phrase: "${phrase}"`,
            suggestion: "Rewrite to remove the phrase.",
        });
    }
}

// ─── Em dashes ──────────────────────────────────────────────────────────────
const emDashes = (content.match(/—/g) || []).length;
const closedEmDashes = (content.match(/\S—\S/g) || []).length;
if (closedEmDashes > 0) {
    issues.push({
        dimension: "humanization",
        severity: "medium",
        issue: `${closedEmDashes} closed em dash(es) — should be spaced ("word — word")`,
    });
}
const words = (content.match(/\b\w+\b/g) || []).length;
const emPer500 = words > 0 ? (emDashes / words) * 500 : 0;
if (emPer500 > 1.5) {
    issues.push({
        dimension: "humanization",
        severity: "low",
        issue: `${emDashes} em dashes in ${words} words (target ≤1 per 500)`,
    });
}

// ─── First sentence ──────────────────────────────────────────────────────────
const firstSentenceMatch = content.match(/^[#\s>]*([^\n.!?]+[.!?])/m);
const firstSentence = firstSentenceMatch ? firstSentenceMatch[1].trim() : "";
const aiOpeners = [
    /^when it comes to/i,
    /^if you('re| are) (looking|considering|planning|wondering)/i,
    /^in today'?s (world|landscape|environment|fast-paced)/i,
    /^understanding .+ is (crucial|important|essential)/i,
    /^are you (ready|wondering|considering)/i,
    /^let'?s (dive|explore|break)/i,
];
const opener = aiOpeners.find((re) => re.test(firstSentence));
if (opener) {
    issues.push({
        dimension: "humanization",
        severity: "high",
        issue: "First sentence matches an AI opening pattern",
        suggestion: "Open with a specific factual statement; demonstrate expertise in the first 15 words.",
        snippet: firstSentence,
    });
}

// ─── -ing pattern scaffolding ───────────────────────────────────────────────
const ingPatterns = [
    /\bhighlighting (the|its|a)\b/gi,
    /\bunderscoring (the|its|a)\b/gi,
    /\bemphasizing (the|its|a)\b/gi,
    /\bensuring (that|the)\b/gi,
    /\breflecting (the|its|a)\b/gi,
    /\bsymbolizing (the|its|a)\b/gi,
    /\bcontributing to (the|its|a)\b/gi,
    /\bcultivating (a|the)\b/gi,
    /\bfostering (a|the)\b/gi,
];
let ingHits = 0;
for (const re of ingPatterns) {
    const matches = content.match(re) || [];
    ingHits += matches.length;
}
if (ingHits > 0) {
    issues.push({
        dimension: "humanization",
        severity: "medium",
        issue: `${ingHits} -ing scaffolding pattern(s) detected`,
        suggestion: "Cut or rewrite. -ing phrases rarely add information.",
    });
}

// ─── SEO: headings + meta ────────────────────────────────────────────────────
const h1Count = (content.match(/^# /gm) || []).length + (content.match(/<h1\b/gi) || []).length;
const h2Count = (content.match(/^## /gm) || []).length + (content.match(/<h2\b/gi) || []).length;
if (h1Count === 0) issues.push({ dimension: "seo", severity: "high", issue: "No H1 found" });
if (h1Count > 1) issues.push({ dimension: "seo", severity: "medium", issue: `${h1Count} H1s found (target 1)` });
if (h2Count < 2) issues.push({ dimension: "seo", severity: "medium", issue: `${h2Count} H2(s) found; long-form needs at least 3-5` });

// ─── AEO: FAQ structure ──────────────────────────────────────────────────────
const hasFaq = /faq|frequently asked|questions/i.test(content);
const faqHasH3PairFormat = /<h3>[^<]+<\/h3>\s*<p>/i.test(content) || /(^### [^\n]+\?\n\n[^\n]+)/m.test(content);
if (hasFaq && !faqHasH3PairFormat) {
    issues.push({
        dimension: "aeo",
        severity: "high",
        issue: "FAQ section present but doesn't use <h3>Q?</h3><p>A.</p> format (FAQPage schema won't extract cleanly)",
    });
}
if (!hasFaq) {
    issues.push({ dimension: "aeo", severity: "high", issue: "No FAQ section detected (long-form needs one)" });
}

// ─── GEO: citation density ───────────────────────────────────────────────────
const externalLinks = (content.match(/<a\s+href="https?:\/\/(?!.*(?:greencard-law|organic\.dev))/gi) || []).length
    + (content.match(/\[[^\]]+\]\(https?:\/\/(?!.*(?:greencard-law|organic\.dev))/g) || []).length;
const wordsForCitationDensity = words;
if (wordsForCitationDensity > 1000 && externalLinks < 4) {
    issues.push({
        dimension: "geo",
        severity: "high",
        issue: `Only ${externalLinks} external citation(s) in ${wordsForCitationDensity} words (target 4+ for non-YMYL, 8+ for YMYL)`,
    });
}

// ─── Dimension subscores ─────────────────────────────────────────────────────
scores.voice_match = clamp(100 - bannedHits * 6, 0, 100);
scores.humanization = clamp(100 - (opener ? 15 : 0) - ingHits * 2 - Math.max(0, emPer500 - 1) * 5 - closedEmDashes * 3, 0, 100);
scores.seo = clamp(100 - (h1Count !== 1 ? 15 : 0) - (h2Count < 2 ? 10 : 0), 0, 100);
scores.aeo = clamp(100 - (!hasFaq ? 25 : 0) - (hasFaq && !faqHasH3PairFormat ? 15 : 0), 0, 100);
scores.geo = clamp(100 - Math.max(0, 4 - externalLinks) * 10, 0, 100);
// factuality is left blank — requires LLM council
scores.factuality = null;

const compositeWeights = { voice_match: 20, seo: 15, aeo: 15, geo: 20, factuality: 20, humanization: 10 };
const compositeDenom = Object.entries(compositeWeights).reduce((s, [k, w]) => scores[k] === null ? s : s + w, 0);
const compositeNumer = Object.entries(compositeWeights).reduce((s, [k, w]) => scores[k] === null ? s : s + (scores[k] * w), 0);
const composite = compositeDenom > 0 ? Math.round(compositeNumer / compositeDenom) : null;

const result = {
    file,
    audited_at: new Date().toISOString(),
    deterministic_scoring: true,
    note: "factuality requires the three-model council; run `/imprint factcheck` separately for a complete score.",
    composite_score: composite,
    scores,
    issues,
    metrics: {
        words,
        h1_count: h1Count,
        h2_count: h2Count,
        em_dashes: emDashes,
        closed_em_dashes: closedEmDashes,
        external_links: externalLinks,
        banned_phrase_hits: bannedHits,
        ing_scaffolding_hits: ingHits,
        first_sentence_ai_opener: !!opener,
    },
};

process.stdout.write(JSON.stringify(result, null, 2));
process.stdout.write("\n");

// ─────────────────────────────────────────────────────────────────────────

function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}

function extractBannedPhrases(content) {
    const lines = content.split("\n");
    const phrases = new Set();
    for (const line of lines) {
        const tableMatch = line.match(/^\|\s*([^|]+?)\s*\|/);
        if (tableMatch) {
            const candidate = tableMatch[1].trim().toLowerCase();
            if (candidate && candidate !== "phrase" && !candidate.startsWith("---") && candidate.length < 80 && !candidate.startsWith("|")) {
                phrases.add(candidate);
            }
        }
        const bullet = line.match(/^\s*-\s+([^*`].+?)$/);
        if (bullet) {
            const c = bullet[1].trim();
            if (c.length > 2 && c.length < 60 && !c.includes(":") && !c.includes("**") && !c.startsWith("[") && !c.includes("|")) {
                phrases.add(c.toLowerCase());
            }
        }
    }
    return [...phrases];
}
