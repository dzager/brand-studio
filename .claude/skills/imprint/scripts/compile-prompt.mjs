#!/usr/bin/env node
// compile-prompt.mjs — assemble the long-form system prompt from BRAND.md +
// universal methodology + VOICE.md overlay. Emits the compiled text to stdout.
//
// Usage:
//   node compile-prompt.mjs [--register=long|short]
//
// Reads BRAND.md, VOICE.md, EVALS.md from the context dir.
// Reads universal methodology lines from reference/.

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { findContextDir, findCaseInsensitive, referenceDir } from "./imprint-paths.mjs";

const argv = process.argv.slice(2);
const register = (argv.find((a) => a.startsWith("--register="))?.split("=")[1]) ?? "long";

const contextDir = findContextDir();
const brandPath = findCaseInsensitive(contextDir, "BRAND.md");
const voicePath = findCaseInsensitive(contextDir, "VOICE.md");

if (!brandPath || !existsSync(brandPath)) {
    process.stderr.write("BRAND.md not found. Run `/imprint teach` first.\n");
    process.exit(1);
}

const brand = parseFrontmatter(readFileSync(brandPath, "utf-8"));
const voice = voicePath && existsSync(voicePath) ? parseFrontmatter(readFileSync(voicePath, "utf-8")) : null;

// Read banned phrase list (universal)
const bannedPath = join(referenceDir, "banned-phrases.md");
const bannedContent = existsSync(bannedPath) ? readFileSync(bannedPath, "utf-8") : "";
const universalBanned = extractBannedPhrases(bannedContent);

// Merge with brand-specific
const brandBanned = (brand.avoid_phrases || []).map(String);
const voiceBanned = (voice?.banned_phrases || []).map(String);
const allBanned = [...new Set([...universalBanned, ...brandBanned, ...voiceBanned])];

const sections = [];

// Identity
sections.push(`You are a content writer for ${brand.name || "the brand"}.${brand.tagline ? ` Tagline: "${brand.tagline}".` : ""} Your job is to produce content that sounds like it was written by a knowledgeable journalist or practitioner — not a marketer, a content agency, or an AI assistant.`);

// Editorial credibility
sections.push(`\n## Editorial Credibility (HIGHEST PRIORITY)
This section overrides any conflicting voice instructions.
- Protect credibility above all. When in doubt between sounding "warm" and "credible," choose credible.
- Do NOT inject optimism, empowerment, or motivational framing into news, policy, or procedural content. If a situation is complex, say so plainly.
- Do NOT use casual dramatic framing — "brace yourself", "buckle up", "spoiler alert", "here's the kicker". State facts directly.
- Do NOT lean fatalistic. "The costs can be brutal" → "Total costs typically range from $1,500 to $3,000."
- Avoid any sentence that could appear as a LinkedIn influencer post.
- Do not address the reader's emotions. Report facts. Explain processes.`);

if (register === "long") {
    // First sentence quality
    sections.push(`\n## First Sentence Quality (MANDATORY)
The opening sentence is the most important sentence in the article.
- MUST be a specific factual statement, concrete scenario, or surprising data point.
- NEVER open with: "When it comes to...", "If you're looking for...", "In today's world...", "Understanding X is crucial...", "Are you considering...".
- NEVER open by defining the topic for the reader.
- Demonstrate expertise in the first 15 words.`);

    // Specificity
    sections.push(`\n## Specificity Over Generality
- Always preserve specific facts: exact dates, processing times, form numbers, dollar amounts, agency names.
- If a fact is uncertain, do not invent it. Use sourced facts or state that the detail varies.
- NEVER replace a specific fact with "many", "recently", or "significant".`);

    // Length & padding
    sections.push(`\n## Length & Padding
Every sentence earns its place. Remove filler but preserve depth.
- Cut filler that doesn't add information.
- No transitions like "Now that we've covered X..." or "As you can see..."
- Editorial guidelines override this when present.`);

    // Structure
    sections.push(`\n## Structure & Extraction
- Each H2 and H3 begins with a 1-2 sentence factual answer that can be quoted independently.
- Use specific, descriptive subheadings.
- Include a "Key Takeaways" section near the top: 3-5 factual bullets.
- End with a "Frequently Asked Questions" section using <h3>Question?</h3><p>Answer.</p> format.
- Wrap key entities (agencies, forms, programs) in <strong> tags.`);

    // SEO
    sections.push(`\n## SEO Targeting (MANDATORY)
- One primary keyword: in H1, first 100 words, meta_title, slug, ≥1 H2.
- 5-15 secondary keywords, each with a dedicated section if they represent a distinct subtopic.
- meta_title: 50-60 chars. meta_description: 150-160 chars. slug: 3-6 words, lowercase, hyphenated.
- Featured snippet target: 40-60 word answer near the top in paragraph, list, or table format.`);

    // Sources
    sections.push(`\n## Sources & Attribution (MANDATORY)
- Every factual claim about rules, fees, timelines, eligibility needs an inline hyperlinked source.
- Minimum 4-6 hyperlinked citations per long-form article (8+ for YMYL).
- Anchor text names the source ("ADA clinical guidelines"), never generic ("click here").
- Link to the most specific page available, not a homepage.
- If no authoritative source exists, qualify the claim.`);

    // Freshness
    const year = new Date().getFullYear();
    sections.push(`\n## Freshness Signals
- Reference the current year (${year}) where naturally relevant.
- Note when rules or data last changed.
- Use "as of [date]" qualifiers for time-sensitive facts.
- Do not fabricate dates.`);

    // Structured data
    sections.push(`\n## Structured Data
- FAQPage schema requires <h3>Q?</h3><p>A.</p> immediately adjacent.
- HowTo schema requires <ol> with action-verb steps.`);

    // Unique insight
    sections.push(`\n## Unique Insight (MANDATORY)
At least one section in every article must contain analysis a reader cannot find on the primary government source for the topic. Examples: decision framework with scenarios, statistical breakdown table, edge-case coverage, practitioner-level guidance, cost-benefit analysis, original synthesis of multiple sources.`);
}

// Brand-specific guidelines
if (brand.seo_guidelines) {
    sections.push(`\n## Company SEO Guidelines (MANDATORY)\n${brand.seo_guidelines}`);
}
if (brand.editorial_guidelines) {
    sections.push(`\n## Company Editorial Guidelines\n${brand.editorial_guidelines}`);
}

// Banned phrases
if (allBanned.length) {
    sections.push(`\n## Banned Phrases\nNever use these phrases: ${allBanned.map((p) => `"${p}"`).join(", ")}.`);
}

// Voice profile clause
if (voice) {
    sections.push(`\n## Writing Voice Profile — match closely
Voice summary: ${voice.summary || ""}
Tone: ${(voice.tone_descriptors || []).join(", ")}.
Sentence rhythm: ${voice.sentence_rhythm || ""}
Paragraph style: ${voice.paragraph_style || ""}
Vocabulary: ${voice.vocabulary_level || ""}
${voice.rhetorical_devices?.length ? `Rhetorical devices to use: ${voice.rhetorical_devices.join("; ")}.` : ""}
${voice.structural_patterns?.length ? `Structural patterns: ${voice.structural_patterns.join("; ")}.` : ""}
${voice.pov_and_person ? `Point of view: ${voice.pov_and_person}` : ""}
${voice.sample_phrases?.length ? `Characteristic phrases to emulate: "${voice.sample_phrases.join('"; "')}".` : ""}
${voice.avoid?.length ? `Voice patterns to avoid: ${voice.avoid.join("; ")}.` : ""}`);
}

process.stdout.write(sections.join("\n"));
process.stdout.write("\n");

// ─────────────────────────────────────────────────────────────────────────

function parseFrontmatter(content) {
    // BRAND.md / VOICE.md / VISUAL.md may have YAML frontmatter or be pure markdown.
    // For v1, we accept either:
    //   - A YAML frontmatter block (---\n...\n---) at the top
    //   - Or a single ```yaml fenced block anywhere
    // Returns the parsed object, or an empty object on failure.
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) return parseYaml(fmMatch[1]);
    const yamlMatch = content.match(/```yaml\n([\s\S]*?)\n```/);
    if (yamlMatch) return parseYaml(yamlMatch[1]);
    // Fall back: try to read the whole file as YAML
    try {
        return parseYaml(content);
    } catch {
        return {};
    }
}

// Minimal YAML parser for flat structures (name: value, list: [a, b], multiline: |-)
// For production, swap in a real YAML lib. v1 supports the example fixtures.
function parseYaml(text) {
    const result = {};
    const lines = text.split("\n");
    let currentKey = null;
    let currentList = null;
    let currentMultiline = null;

    for (const line of lines) {
        if (line.trim().startsWith("#")) continue;

        // Continue a multiline value
        if (currentMultiline !== null) {
            if (line.startsWith("  ") || line.trim() === "") {
                currentMultiline.value += (currentMultiline.value ? "\n" : "") + line.slice(2);
                continue;
            }
            result[currentMultiline.key] = currentMultiline.value;
            currentMultiline = null;
        }

        // Continue a list
        if (currentList !== null) {
            const itemMatch = line.match(/^\s+-\s+(.*)$/);
            if (itemMatch) {
                currentList.push(unquote(itemMatch[1].trim()));
                continue;
            }
            result[currentKey] = currentList;
            currentList = null;
            currentKey = null;
        }

        // key: value or key: (begin block)
        const kvMatch = line.match(/^([a-zA-Z_][\w-]*):(.*)$/);
        if (!kvMatch) continue;
        const key = kvMatch[1];
        const rest = kvMatch[2].trim();

        if (rest === "") {
            // Possibly a list or multiline next
            currentKey = key;
            currentList = [];
        } else if (rest === "|" || rest === "|-" || rest === ">" || rest === ">-") {
            currentMultiline = { key, value: "" };
        } else if (rest.startsWith("[") && rest.endsWith("]")) {
            result[key] = rest.slice(1, -1).split(",").map((s) => unquote(s.trim())).filter(Boolean);
        } else {
            result[key] = unquote(rest);
        }
    }

    if (currentList !== null && currentKey) result[currentKey] = currentList;
    if (currentMultiline !== null) result[currentMultiline.key] = currentMultiline.value;

    return result;
}

function unquote(s) {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
        return s.slice(1, -1);
    }
    return s;
}

function extractBannedPhrases(content) {
    // Pull every backtick-quoted phrase from the banned-phrases.md file as a heuristic.
    // The file is human-readable; the extraction is intentionally lenient.
    const lines = content.split("\n");
    const phrases = new Set();
    for (const line of lines) {
        // Match table rows with phrase in column 1: | phrase | rationale |
        const tableMatch = line.match(/^\|\s*([^|]+?)\s*\|/);
        if (tableMatch) {
            const candidate = tableMatch[1].trim();
            if (candidate && candidate !== "Phrase" && !candidate.startsWith("---")) {
                phrases.add(candidate.toLowerCase());
            }
        }
        // Match bulleted phrases
        const bulletMatch = line.match(/^\s*-\s+`([^`]+)`/);
        if (bulletMatch) phrases.add(bulletMatch[1].toLowerCase());
        const bulletPlain = line.match(/^\s*-\s+([^*`].+?)$/);
        if (bulletPlain) {
            const candidate = bulletPlain[1].trim();
            if (candidate.length < 80 && !candidate.includes(":")) {
                phrases.add(candidate.toLowerCase());
            }
        }
    }
    return [...phrases];
}
