/**
 * Generate best-in-class default editorial guidelines, SEO/GEO content guidelines,
 * and voice profile for a newly created company based on onboarding data.
 *
 * These are generated asynchronously after company creation so the user
 * always starts with high-quality, brand-aware prompts instead of blank fields.
 */

import { getStructuredResponse, getTextResponse } from "@/lib/ai-client";
import type { VoiceProfile } from "@/brand/engine";

// ── Types ────────────────────────────────────────────────────────────────

export type CompanyOnboardingData = {
    name: string;
    tagline?: string | null;
    mission?: string | null;
    archetype?: string | null;
    tone?: string | null;
    target_audiences?: string[] | null;
    photography_style?: string | null;
    avoid_phrases?: string | null;
};

export type GeneratedBrandDefaults = {
    editorial_guidelines: string;
    seo_content_guidelines: string;
    voice_profile: VoiceProfile;
};

// ── Archetype descriptions (for richer AI context) ───────────────────────

const ARCHETYPE_DESCRIPTIONS: Record<string, string> = {
    pathfinder: "The Pathfinder guides and supports. Content should feel like a knowledgeable companion walking the reader through complexity. Emphasis on clarity, next steps, and practical guidance.",
    innovator: "The Innovator is bold and forward-thinking. Content should feel cutting-edge, data-driven, and visionary. Emphasis on what's changing, what's next, and why it matters.",
    caregiver: "The Caregiver is warm and nurturing. Content should feel empathetic, supportive, and reassuring without being patronizing. Emphasis on the reader's well-being and practical help.",
    sage: "The Sage is an expert and trusted authority. Content should feel deeply researched, authoritative, and educational. Emphasis on depth, evidence, and nuanced analysis.",
    creator: "The Creator is imaginative and expressive. Content should feel inspired, original, and aesthetically minded. Emphasis on craft, creativity, and fresh perspectives.",
    hero: "The Hero is bold and empowering. Content should feel confident, action-oriented, and motivating. Emphasis on overcoming challenges and achieving results.",
    explorer: "The Explorer is adventurous and free-spirited. Content should feel curious, expansive, and discovery-oriented. Emphasis on new possibilities and unconventional approaches.",
    rebel: "The Rebel is disruptive and edgy. Content should feel provocative, honest, and anti-establishment. Emphasis on challenging the status quo and calling out industry problems.",
    guide: "The Guide is knowledgeable and helpful. Content should feel clear, practical, and trustworthy. Emphasis on simplifying complexity and providing actionable guidance.",
};

// ── Build the context string from onboarding data ────────────────────────

function buildBrandContext(data: CompanyOnboardingData): string {
    const parts: string[] = [
        `Company Name: ${data.name}`,
    ];

    if (data.tagline) parts.push(`Tagline: "${data.tagline}"`);
    if (data.mission) parts.push(`Mission: ${data.mission}`);
    if (data.archetype) {
        const desc = ARCHETYPE_DESCRIPTIONS[data.archetype] || data.archetype;
        parts.push(`Brand Archetype: ${data.archetype} — ${desc}`);
    }
    if (data.tone) parts.push(`Tone Descriptors: ${data.tone}`);
    if (data.target_audiences && data.target_audiences.length > 0) {
        parts.push(`Target Audiences: ${data.target_audiences.join(", ")}`);
    }
    if (data.photography_style) parts.push(`Visual/Photography Style: ${data.photography_style}`);
    if (data.avoid_phrases) parts.push(`Phrases to Avoid: ${data.avoid_phrases}`);

    return parts.join("\n");
}

// ── Generate Editorial Guidelines ────────────────────────────────────────

async function generateEditorialGuidelines(brandContext: string): Promise<string> {
    const system = `You are an expert editorial strategist who creates comprehensive writing guidelines for brands. You produce specific, actionable editorial frameworks — not generic advice. Every guideline should be grounded in the brand's identity, archetype, tone, and audience.

Your guidelines should cover:
1. Voice & Tone — how the brand sounds, with specific dos and don'ts
2. Content Depth & Structure — how thorough articles should be, section patterns, required elements
3. Source & Citation Standards — what kind of sources to use, how to cite them, authority hierarchy
4. Opening & Closing Patterns — how articles should begin and end (with examples)
5. Formatting Rules — paragraph length, subheading style, list usage, data presentation
6. Audience Calibration — reading level, assumed knowledge, explanation depth
7. Brand-Specific Rules — any unique requirements based on the brand's positioning

Do NOT include generic advice like "write clearly" or "be engaging." Every line should be specific to THIS brand.
Format as a clean, scannable document with ## headers and bullet points. Aim for 800-1200 words.`;

    const prompt = `Create comprehensive editorial guidelines for this brand:

${brandContext}

These guidelines will be injected into every AI writing prompt for this brand, so they must be specific, actionable, and directly inform content creation. The guidelines should feel like they were written by a senior editor who deeply understands this brand's identity and audience.`;

    return getTextResponse("gpt-5.4", system, prompt, { temperature: 0.4 });
}

// ── Generate SEO / GEO Content Guidelines ────────────────────────────────

async function generateSeoGuidelines(brandContext: string): Promise<string> {
    const system = `You are an expert SEO and GEO (Generative Engine Optimization) strategist who creates comprehensive, brand-specific SEO content guidelines. You understand modern search — including AI Overview panels, featured snippets, People Also Ask, and citation patterns in generative AI responses.

Your guidelines should cover:
1. Keyword Strategy — primary/secondary keyword patterns specific to this brand's industry and audiences. Include specific keyword format patterns (e.g., "[service] + [location]", "[product] vs [competitor]").
2. Content Architecture — how articles should be structured for maximum search visibility. Section requirements, heading hierarchy, content depth per section.
3. Featured Snippet Optimization — specific formats this brand should use to win snippets (paragraph answers, tables, numbered lists). Include word count targets for answer boxes.
4. Entity & E-E-A-T Signals — how to establish expertise, experience, authoritativeness, and trustworthiness in content. Which entities, credentials, and signals to emphasize.
5. Internal Linking Strategy — link density, anchor text patterns, cluster-to-pillar linking rules specific to this brand's content topology.
6. GEO / AI Citation Optimization — how to structure content so generative AI systems (Google AI Overview, Perplexity, ChatGPT Search) cite this brand. Source attribution patterns, quotable passages, structured data emphasis.
7. Local/Geographic Targeting — if relevant to the brand's audiences, include geo-targeting rules for content.
8. Competitive Differentiation — how content should go beyond standard SERP results. What unique angles, data, or analysis to include.

Do NOT include generic SEO advice like "use keywords naturally." Every line should be specific to THIS brand's industry, audience, and competitive landscape.
Format as a clean, scannable document with ## headers and bullet points. Aim for 600-900 words.`;

    const prompt = `Create comprehensive SEO and GEO content guidelines for this brand:

${brandContext}

These guidelines will be injected into every AI writing prompt as mandatory SEO rules, supplementing the platform's built-in SEO framework. Focus on brand-specific and industry-specific optimization strategies that go beyond generic SEO best practices.`;

    return getTextResponse("gpt-5.4", system, prompt, { temperature: 0.4 });
}

// ── Generate Voice Profile ───────────────────────────────────────────────

const VoiceProfileSchema = {
    type: "object",
    additionalProperties: false,
    required: [
        "summary",
        "tone_descriptors",
        "sentence_rhythm",
        "paragraph_style",
        "vocabulary_level",
        "rhetorical_devices",
        "structural_patterns",
        "pov_and_person",
        "sample_phrases",
        "avoid",
        "banned_phrases",
        "structural_do",
        "structural_dont",
        "specificity_rules",
        "length_rules",
    ],
    properties: {
        summary: {
            type: "string",
            description: "A 2-3 sentence distillation of the ideal writing voice for this brand. Be specific — reference the brand archetype, tone, and audience.",
        },
        tone_descriptors: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 6,
            description: "Adjectives describing the ideal tone. Derived from the brand's stated tone and archetype.",
        },
        sentence_rhythm: {
            type: "string",
            description: "Describe the ideal sentence rhythm for this brand. e.g. 'Open with short, declarative statements (4-8 words). Follow with medium compound sentences (15-25 words) that add evidence or context. Vary rhythm to avoid monotony.'",
        },
        paragraph_style: {
            type: "string",
            description: "How paragraphs should be structured. e.g. '2-4 sentences per paragraph. One idea per paragraph. Use single-sentence paragraphs sparingly for emphasis.'",
        },
        vocabulary_level: {
            type: "string",
            description: "Vocabulary sophistication calibrated to the brand's audience. e.g. 'Industry-literate vocabulary. Use technical terms with brief inline definitions on first use. Avoid dumbing down but never use jargon for its own sake.'",
        },
        rhetorical_devices: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 6,
            description: "Rhetorical devices appropriate for this brand's voice. e.g. 'concrete analogies', 'data-driven claims', 'direct address'.",
        },
        structural_patterns: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 6,
            description: "Article structural patterns. e.g. 'fact-first openings', 'evidence-backed sections', 'actionable closing with specific next steps'.",
        },
        pov_and_person: {
            type: "string",
            description: "Point of view and grammatical person. e.g. 'Second person (you) for guides. Third person for analysis pieces. Occasional first-person plural (we) when representing the brand.'",
        },
        sample_phrases: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 5,
            description: "3-5 example phrases that capture the brand's ideal voice. These should sound like they belong on this brand's blog — not generic filler.",
        },
        avoid: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 8,
            description: "Writing patterns to avoid. Include both brand-specific avoidances and common AI tells.",
        },
        banned_phrases: {
            type: "array",
            items: { type: "string" },
            minItems: 5,
            maxItems: 15,
            description: "Specific phrases that should never appear. Include common AI clichés, brand-inappropriate language, and competitor-associated phrases.",
        },
        structural_do: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 6,
            description: "Structural elements the writing should use. e.g. 'fact-first section openings', 'comparison tables for alternatives', 'specific cost breakdowns'.",
        },
        structural_dont: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 6,
            description: "Structural anti-patterns to avoid. e.g. 'padded introductions', 'filler transitions between sections', 'restating the obvious'.",
        },
        specificity_rules: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 6,
            description: "Rules about maintaining specificity. e.g. 'always include specific numbers, dates, and source names', 'never use vague quantifiers like many or several'.",
        },
        length_rules: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 6,
            description: "Rules about content length and density. e.g. 'every sentence must add new information', 'no transitional filler between sections'.",
        },
    },
} as const;

async function generateVoiceProfile(brandContext: string): Promise<VoiceProfile> {
    const system = `You are an expert editorial voice designer. Given a brand's identity information, you create a detailed, actionable voice profile that an AI writer can use to produce on-brand content consistently.

Your voice profile should feel like it was created by a senior editor who has studied this brand extensively. Every field must be specific to THIS brand — not generic writing advice.

Key principles:
- The voice should reflect the brand's archetype, tone descriptors, and audience
- Sample phrases should sound authentic to this brand's industry and positioning
- Banned phrases should include both common AI tells AND brand-inappropriate language
- Structural patterns should match the brand's content goals and audience expectations
- Be specific enough that two different AI writers using this profile would produce similar-sounding content`;

    const prompt = `Create a detailed voice profile for this brand:

${brandContext}

This voice profile will be used to instruct AI writers. It must be specific enough to produce consistent, on-brand content across hundreds of articles. Tailor every field to this brand's unique identity, audience, and positioning.`;

    return getStructuredResponse<VoiceProfile>(
        "gpt-5.4",
        system,
        prompt,
        VoiceProfileSchema as any,
        { schemaName: "voice_profile", temperature: 0.4 }
    );
}

// ── Main: Generate All Defaults ──────────────────────────────────────────

/**
 * Generate all brand defaults (editorial guidelines, SEO guidelines, voice profile)
 * in parallel. Returns the generated defaults.
 *
 * This should be called asynchronously after company creation — don't block
 * the response waiting for these.
 */
export async function generateBrandDefaults(
    data: CompanyOnboardingData
): Promise<GeneratedBrandDefaults> {
    const brandContext = buildBrandContext(data);

    // Run all three generations in parallel
    const [editorial_guidelines, seo_content_guidelines, voice_profile] = await Promise.all([
        generateEditorialGuidelines(brandContext),
        generateSeoGuidelines(brandContext),
        generateVoiceProfile(brandContext),
    ]);

    return {
        editorial_guidelines,
        seo_content_guidelines,
        voice_profile,
    };
}
