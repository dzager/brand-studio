import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";
import type { VoiceProfile } from "@/brand/engine";
import { getStructuredResponse } from "@/lib/ai-client";

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
            description: "A 1-2 sentence distillation of the overall writing voice.",
        },
        tone_descriptors: {
            type: "array",
            items: { type: "string" },
            minItems: 2,
            maxItems: 8,
            description: "Adjectives describing the tone, e.g. 'conversational', 'authoritative', 'warm'.",
        },
        sentence_rhythm: {
            type: "string",
            description: "Describe the sentence length patterns. e.g. 'Short punchy openers followed by longer explanatory sentences.'",
        },
        paragraph_style: {
            type: "string",
            description: "How paragraphs are structured. e.g. '2-4 sentences, one idea per paragraph, frequent single-sentence paragraphs for emphasis.'",
        },
        vocabulary_level: {
            type: "string",
            description: "Describe vocabulary sophistication and register. e.g. 'accessible, avoids jargon, occasional technical terms with inline definitions.'",
        },
        rhetorical_devices: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 8,
            description: "Rhetorical devices the writer uses, e.g. 'direct address', 'rhetorical questions', 'analogies', 'anaphora'.",
        },
        structural_patterns: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 8,
            description: "How articles are structured. e.g. 'strong hook opening', 'numbered steps in body', 'CTA closing'.",
        },
        pov_and_person: {
            type: "string",
            description: "Point of view and grammatical person. e.g. 'Second person (you), occasional first-person plural (we).'",
        },
        sample_phrases: {
            type: "array",
            items: { type: "string" },
            minItems: 3,
            maxItems: 5,
            description: "3-5 characteristic phrases or sentence fragments pulled directly from the source that capture the voice.",
        },
        avoid: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 8,
            description: "Writing patterns the source does NOT use that should be avoided. e.g. 'formal academic language', 'passive voice', 'exclamation marks'.",
        },
        banned_phrases: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 15,
            description: "Specific phrases that should never appear in output. e.g. 'You\\'re not alone', 'Navigate the process', 'Let\\'s dive in', 'This comprehensive guide'.",
        },
        structural_do: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 8,
            description: "Structural elements the writing uses well. e.g. 'Before You Start sections', 'step-by-step guidance', 'document checklists', 'specific H2/H3 subheadings'.",
        },
        structural_dont: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 8,
            description: "Structural anti-patterns to avoid. e.g. 'padded introductions', 'redundant summaries', 'rhetorical question transitions', 'generic FAQ sections'.",
        },
        specificity_rules: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 8,
            description: "Rules about maintaining specificity. e.g. 'preserve exact dates and numbers', 'cite form numbers', 'use policy names not generalizations'.",
        },
        length_rules: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 8,
            description: "Rules about length and padding. e.g. 'cut sentences that restate the previous one', 'no transitional filler', 'get to substance within 2-3 sentences'.",
        },
    },
} as const;

type SuccessResponse = {
    voice_profile: VoiceProfile;
};

type ErrorResponse = {
    error: string;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SuccessResponse | ErrorResponse>
) {
    try {

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed. Use POST." });
        }

        const { html, company_id } = req.body ?? {};

        if (!html || typeof html !== "string" || html.trim().length < 50) {
            return res
                .status(400)
                .json({ error: "html is required and must be at least 50 characters of article content." });
        }

        if (!company_id || typeof company_id !== "string") {
            return res.status(400).json({ error: "company_id is required." });
        }

        // Verify company exists
        const { data: company, error: companyErr } = await getSupabase()
            .from("companies")
            .select("id, name")
            .eq("id", company_id)
            .single();

        if (companyErr || !company) {
            return res.status(404).json({ error: "Company not found." });
        }

        // Strip HTML tags for cleaner analysis
        const plainText = html
            .replace(/<[^>]+>/g, " ")
            .replace(/&[a-z]+;/gi, " ")
            .replace(/\s+/g, " ")
            .trim();

        const systemPrompt = `You are an expert editorial voice analyst. Given a blog article, you analyze its writing style in precise, actionable detail. Your analysis will be used to instruct an AI writer to replicate this voice in future articles.

Focus on SPECIFIC, CONCRETE observations — not generic descriptions. For example, instead of "uses varied sentence lengths" say "Opens paragraphs with 4-8 word declarative sentences, then follows with 15-25 word compound sentences that add context."

Extract real phrases from the text as sample_phrases. Be specific about what the writer avoids.

For banned_phrases: identify any cliché, filler, or AI-sounding phrases the article does NOT use that should be explicitly prohibited. Include common AI tells like "You're not alone", "Navigate the process", "Let's dive in", "This comprehensive guide", "Everything you need to know".

For structural_do and structural_dont: analyze the structural patterns the writer uses effectively vs. anti-patterns they avoid.

For specificity_rules: note how the writer handles facts, numbers, and concrete details.

For length_rules: note the writer's approach to conciseness and filler avoidance.`;

        const userPrompt = `Analyze the following article and produce a structured voice profile:

---

${plainText}

---

Produce a voice profile that captures how this writer writes — their rhythm, word choices, structural habits, tone, editorial standards, and content rules — so that future AI-generated articles can closely match this voice and quality.`;

        const voiceProfile = await getStructuredResponse<VoiceProfile>(
            "gpt-5.4",
            systemPrompt,
            userPrompt,
            VoiceProfileSchema as any,
            { schemaName: "voice_profile" }
        );

        // Return the profile for preview — saving is done separately via PUT /api/companies/:id

        return res.status(200).json({ voice_profile: voiceProfile });
    } catch (err) {
        console.error("API /api/analyze-voice error:", err);
        const message =
            err instanceof Error ? err.message : "Unknown server error";
        return res.status(500).json({ error: message });
    }
}
