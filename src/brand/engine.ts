// src/brand/engine.ts

export type FewShotPair = {
    neutral: string;
    brand: string;
};

export type DesignTokens = {
    colors: {
        primary: {
            obsidian: string;
            marigold: string;
            sky: string;
            white: string;
        };
        extended: {
            juniper: string;
            oat: string;
            oat_dark: string;
            oat_light: string;
        };
        secondary: {
            jade: string;
            pomelo: string;
            currant: string;
            nightshade: string;
        };
    };
    usage_rules: {
        cta: string;
        backgrounds: string[];
        navigation: string[];
        accent: string[];
    };
};

export type PhotographyStyle = {
    realism_base: string;
    global_feel: string[];
    narrative: string;
    storytelling_cues: string[];
    lighting: string;
    mood: string;
    composition: string;
    subjects: string[];
    avoid: string[];
};

export type ImageStyleCategory = {
    id: string;
    label: string;
    narrative: string;
    storytelling_cues: string[];
    image_prompt_style: string;
};

export type VoiceProfile = {
    summary: string;
    tone_descriptors: string[];
    sentence_rhythm: string;
    paragraph_style: string;
    vocabulary_level: string;
    rhetorical_devices: string[];
    structural_patterns: string[];
    pov_and_person: string;
    sample_phrases: string[];
    avoid: string[];
    // Blog-specific criteria
    banned_phrases: string[];
    structural_do: string[];
    structural_dont: string[];
    specificity_rules: string[];
    length_rules: string[];
};

export const IMAGE_STYLE_CATEGORIES: ImageStyleCategory[] = [
    {
        id: "default",
        label: "Default",
        narrative: "",
        storytelling_cues: [],
        image_prompt_style: "",
    },
];

export type BrandEngine = {
    design_tokens: DesignTokens;
    photography_style: PhotographyStyle;

    engine_meta: {
        engine_name: string;
        version: string;
        source_doc: string;
        brand_name: string;
        tagline: string;
    };

    latent_brand_profile: {
        archetype: string;
        attributes: string[];
        tone_axes: string[];
        core_intents: string[];
        language_style: {
            default_case: string;
            voice: string;
            paragraphs: string;
            avoid: string[];
        };
    };

    brand_knowledge_pack: {
        mission: string;
        value_proposition: string;
        vision_principles: string[];
        values: string[];
        design_ethos: Array<{
            name: string;
            signals: string[];
            practices: string[];
        }>;
        audiences: Record<
            string,
            {
                needs: string[];
                positioning: string;
            }
        >;
        headline_examples: Record<string, string>;
    };

    prompt_layers: {
        system: {
            core: string;
            safety: string;
        };
        developer_overlays: Record<string, string>;
        few_shot_style: FewShotPair[];
    };

    rewrite_policy: {
        goals: string[];
        operations: string[];
        banned_phrasing: string[];
    };

    guardrails: {
        allowed_tone: string[];
        disallowed_tone: string[];
        avoid_content_patterns: string[];
        required_response_elements: string[];
    };

    rag_chunks: Array<{
        id: string;
        text: string;
        tags: string[];
    }>;

    evals?: {
        rubric: Array<{
            metric: string;
            scale: string;
            pass_definition: string;
        }>;
        test_cases?: Array<{
            id: string;
            input: string;
            expected_traits: string[];
            red_flags: string[];
        }>;
        golden_rewrites?: Array<{
            off_brand: string;
            on_brand: string;
        }>;
    };

    templates?: Record<string, unknown>;
    image_style_categories?: ImageStyleCategory[];
    voice_profile?: VoiceProfile;
    editorial_guidelines?: string;
    seo_content_guidelines?: string;
    reference_articles?: string[];
};

export const BRAND_ENGINE: BrandEngine = {
    design_tokens: {
        colors: {
            primary: {
                obsidian: "#1a1a1a",
                marigold: "#e5a00d",
                sky: "#b8d4e8",
                white: "#FFFFFF",
            },
            extended: {
                juniper: "#2d4a46",
                oat: "#d5cfc7",
                oat_dark: "#b5ada3",
                oat_light: "#f5f3ef",
            },
            secondary: {
                jade: "#4caf7d",
                pomelo: "#d94c3f",
                currant: "#a8385e",
                nightshade: "#504060",
            },
        },
        usage_rules: {
            cta: "marigold",
            backgrounds: ["white", "oat_light"],
            navigation: ["obsidian"],
            accent: ["sky", "juniper"],
        },
    },

    photography_style: {
        realism_base:
            "natural skin texture, realistic pores, slight facial asymmetry, candid moment, documentary photography, editorial realism, natural daylight, soft shadows, shallow depth of field, light film grain, avoid perfect symmetry, avoid stock photo look, avoid plastic skin.",
        global_feel: [
            "authentic and approachable",
            "light-filled and natural",
            "grounded in real moments",
        ],
        narrative: "",
        storytelling_cues: [],
        lighting: "natural, soft",
        mood: "warm, human",
        composition: "editorial, candid",
        subjects: [],
        avoid: ["stocky poses", "heavy filters", "dark or dramatic lighting"],
    },

    engine_meta: {
        engine_name: "brand_studio_ai_engine",
        version: "1.0",
        source_doc: "",
        brand_name: "Untitled Brand",
        tagline: "",
    },

    latent_brand_profile: {
        archetype: "guide",
        attributes: ["knowledgeable", "helpful", "clear", "human"],
        tone_axes: ["confident", "clear", "modern"],
        core_intents: [
            "simplify complexity",
            "guide the next step",
            "build trust through clarity",
        ],
        language_style: {
            default_case: "sentence_case",
            voice: "active",
            paragraphs: "short",
            avoid: ["jargon", "bureaucratic phrasing", "transactional tone"],
        },
    },

    brand_knowledge_pack: {
        mission: "",
        value_proposition: "",
        vision_principles: [],
        values: [],
        design_ethos: [],
        audiences: {},
        headline_examples: {},
    },

    prompt_layers: {
        system: {
            core:
                "You are a professional content writer. Write in plain language with an active voice. Be clear, helpful, and specific. Provide actionable information. Avoid filler, jargon, and vague generalizations.",
            safety:
                "If the user requests professional advice outside your expertise, provide general information and encourage consulting a qualified professional.",
        },
        developer_overlays: {
            support_agent:
                "Prioritize clarity and next-step guidance. Keep responses concise and helpful.",
            marketing_agent:
                "Write aspirational, human, and modern copy. Keep claims measured and grounded.",
            b2b_sales_agent:
                "Emphasize value, efficiency, and confidence. Avoid hype. Use direct, benefit-led language.",
            content_editor:
                "Rewrite to increase clarity, warmth, and momentum. Remove bureaucratic or stiff phrasing.",
        },
        few_shot_style: [],
    },

    rewrite_policy: {
        goals: [
            "increase clarity",
            "increase warmth",
            "increase momentum",
            "reduce jargon",
        ],
        operations: [
            "replace jargon with plain language",
            "split long paragraphs",
            "convert passive voice to active voice",
            "add a clear next step",
            "remove filler and padding",
        ],
        banned_phrasing: [
            // AI giveaway phrases
            "you're not alone",
            "you are not alone",
            "your journey",
            "navigate this process",
            "navigate the complexities",
            "it's important to remember",
            "it's worth noting",
            "it's crucial to",
            "in today's world",
            "in today's landscape",
            "let's dive in",
            "let's explore",
            "let's break it down",
            "without further ado",
            "game-changer",
            "game changer",
            "a beacon of",
            "tapestry of",
            "at the end of the day",
            "the bottom line is",
            "rest assured",
            "don't worry",
            "take a deep breath",
            "you've got this",
            "every step of the way",
            "embark on",
            "are you ready",
            "empower you",
            "empowering you",
            "your dream",
            "exciting news",
            "here's the good news",
            "the good news is",
            "imagine a world",
            "picture this",
            "unlock your",
            "level up",
            "deep dive",
            // Content writer blacklist
            "delve",
            "cutting-edge",
            "low-hanging fruit",
            "synergy",
            "critical",
            "aligned",
            "stakeholders",
            "unlock the power",
            "navigate the ever-evolving landscape",
            "in today's fast-paced world",
            "critical tool",
            "revolutionizing",
        ],
    },

    guardrails: {
        allowed_tone: ["confident", "clear", "modern", "helpful", "calm"],
        disallowed_tone: [
            "bureaucratic",
            "cold",
            "condescending",
            "fear-based",
            "hyperbolic",
        ],
        avoid_content_patterns: [
            "dense blocks of text",
            "overuse of disclaimers",
            "overpromising outcomes",
            "vague generalizations without specifics",
        ],
        required_response_elements: [
            "plain-language summary",
            "what happens next (a step or option)",
        ],
    },

    rag_chunks: [],
};

export type AgentMode =
    | "support_agent"
    | "marketing_agent"
    | "b2b_sales_agent"
    | "content_editor";

export function compileSystemPrompt(
    engine: BrandEngine = BRAND_ENGINE,
    mode?: AgentMode
): string {
    const overlay = mode ? engine.prompt_layers.developer_overlays[mode] : "";
    const avoid = engine.latent_brand_profile.language_style.avoid.join(", ");
    const banned = engine.rewrite_policy.banned_phrasing.join(", ");

    return [
        engine.prompt_layers.system.core,
        overlay ? `Mode: ${overlay}` : "",
        `Archetype: ${engine.latent_brand_profile.archetype}.`,
        `Tone: ${engine.latent_brand_profile.tone_axes.join(", ")}.`,
        "Write style: plain language, short paragraphs, active voice, sentence case.",
        `Avoid: ${avoid}.`,
        `Never use: ${banned}.`,
        compileVoiceProfileClause(engine),
    ]
        .filter(Boolean)
        .join(" ");
}

/**
 * Compiles the voice profile into a string for injection into LLM prompts.
 * Returns an empty string if no voice profile is set.
 */
export function compileVoiceProfileClause(
    engine: BrandEngine = BRAND_ENGINE
): string {
    const vp = engine.voice_profile;
    if (!vp) return "";

    const parts: string[] = [
        "\n\nWRITING VOICE PROFILE — match this voice closely:",
        `Voice summary: ${vp.summary}`,
        `Tone: ${vp.tone_descriptors.join(", ")}.`,
        `Sentence rhythm: ${vp.sentence_rhythm}`,
        `Paragraph style: ${vp.paragraph_style}`,
        `Vocabulary: ${vp.vocabulary_level}`,
    ];

    if (vp.rhetorical_devices.length) {
        parts.push(`Rhetorical devices to use: ${vp.rhetorical_devices.join("; ")}.`);
    }
    if (vp.structural_patterns.length) {
        parts.push(`Structural patterns: ${vp.structural_patterns.join("; ")}.`);
    }
    if (vp.pov_and_person) {
        parts.push(`Point of view: ${vp.pov_and_person}`);
    }
    if (vp.sample_phrases.length) {
        parts.push(`Characteristic phrases to emulate: "${vp.sample_phrases.join('"; "')}".`);
    }
    if (vp.avoid.length) {
        parts.push(`Voice patterns to avoid: ${vp.avoid.join("; ")}.`);
    }
    // NOTE: banned_phrases, specificity_rules, length_rules, and
    // structural_do/dont are intentionally omitted here — they are
    // already handled by dedicated sections in compileBlogSystemPrompt()
    // (Banned Phrases, Specificity, Length & Padding, Structure).

    return parts.join(" ");
}

/**
 * Compiles a blog-specific system prompt.
 *
 * **Base engine (universal):** Anti-AI rules, specificity, structure, AEO/GEO, banned phrases.
 * **Company-specific:** Voice, tone, identity, citations, drafting rules, format —
 * injected from engine.editorial_guidelines (editable per company).
 */
export function compileBlogSystemPrompt(
    engine: BrandEngine = BRAND_ENGINE
): string {
    const brand = engine.engine_meta.brand_name;
    const vp = engine.voice_profile;

    // Build banned phrases list — merge engine rewrite_policy with voice profile
    const bannedPhrases = [
        ...engine.rewrite_policy.banned_phrasing,
        ...(vp?.banned_phrases ?? []),
    ];
    const uniqueBanned = [...new Set(bannedPhrases)];

    // ── BASE ENGINE (applies to ALL companies) ──────────────────────────

    const sections: string[] = [
        // Minimal identity (overridden by editorial_guidelines if present)
        `You are a content writer for ${brand}.${engine.engine_meta.tagline ? ` Tagline: "${engine.engine_meta.tagline}".` : ""} Your job is to produce content that sounds like it was written by a knowledgeable journalist or practitioner — not a marketer, a content agency, or an AI assistant.`,

        // Anti-AI & Credibility (universal)
        `\n\n## Editorial Credibility (HIGHEST PRIORITY)\nThis section overrides any conflicting brand voice instructions.`,
        `- ${brand} content must protect credibility above all. When in doubt between sounding "warm" and sounding "credible," always choose credible.`,
        `- Do NOT inject optimism, empowerment, motivational framing, or reassuring language into news, policy, or procedural content. If a situation is complex, say so plainly.`,
        `- Avoid any sentence that sounds like it was written by an AI assistant, a life coach, or a content agency. If you can imagine a LinkedIn influencer posting it, cut it.`,
        `- Do not address the reader's emotions. Report facts. Explain processes.`,

        // First Sentence Quality (universal — critical for credibility)
        `\n\n## First Sentence Quality (MANDATORY)\nThe opening sentence is the single most important sentence in the article. It determines whether readers — and AI extraction systems — take the content seriously.`,
        `- The first sentence MUST be a specific, factual statement, a concrete scenario, or a surprising data point. It should immediately signal expertise and relevance.`,
        `- NEVER open with: "When it comes to...", "If you're looking for...", "In today's world...", "Understanding [topic] is important...", "Are you considering...", "[Topic] can be a complex process...", or any generic framing.`,
        `- NEVER open by defining the topic for the reader ("Solar panels are..."). Start with a fact, a statistic, a recent change, or a specific insight that demonstrates you have something new to say.`,
        `- Good examples: "The average cost of a full-mouth dental restoration dropped 18% between 2023 and 2025 — but wait times at top clinics doubled." / "Google's March 2026 core update penalized 40% of sites using AI-generated content without editorial review."`,
        `- Bad examples: "If you're considering investing in solar panels, you may be wondering about the installation process." / "Solar energy is an important pathway for homeowners looking to save money."`,
        `- The first paragraph (2-3 sentences max) should establish: what this article covers, why it matters right now, and what specific value the reader will get.`,

        // Specificity (universal)
        `\n\n## Specificity Over Generality\nLLMs default to vagueness. Fight this instinct aggressively.`,
        `- Always preserve specific facts: exact dates, processing times, form numbers, dollar amounts, agency names, standards.`,
        `- If a specific fact is uncertain, do not invent it. Use only sourced facts or state that the detail varies.`,
        `- NEVER replace a specific fact with vague language like "many," "recently," or "significant." Example: "Processing times increased from 6 months to 14 months" must never become "processing times have increased significantly."`,

        // Length & Padding (universal — does NOT mean short; means no filler)
        `\n\n## Length & Padding\nEvery sentence should earn its place. Remove filler, but do not sacrifice depth or detail.`,
        `- Cut filler sentences that don't add information, but keep substantive detail, examples, and evidence.`,
        `- Do not use transitional filler like: "Now that we've covered X, let's turn to Y..." or "As you can see..." or "In conclusion..."`,
        `- If company editorial guidelines specify content depth, richness, or section requirements, follow those — they override this section.`,

        // On-Page Architecture (universal — critical for long-form)
        `\n\n## On-Page Architecture (MANDATORY for Long-Form Content)\nLong articles dilute page-level keyword signals unless properly architected. Use these techniques to maintain topical focus and improve user navigation.`,
        `- **Clickable Table of Contents (MANDATORY)**: At the very top of the HTML, immediately after the intro paragraph, generate a \`<nav>\` element with the class \`toc\` containing an ordered list of all H2 sections as clickable anchor links. Each H2 in the body must have a corresponding \`id\` attribute (lowercase, hyphenated) that the TOC links to.`,
        `- Example TOC format: \`<nav class="toc"><h2>Table of Contents</h2><ol><li><a href="#section-id">Section Title</a></li>...</ol></nav>\``,
        `- Each H2 id must match its TOC link exactly (e.g., id="cost-breakdown" → href="#cost-breakdown").`,
        `- The TOC H2 itself should NOT appear in the TOC list.`,
        `- **Keyword signal concentration**: Reinforce the primary keyword in the first 100 words, the conclusion, and at least two H2 headings. Use secondary keywords as H2/H3 headings to create focused topical clusters.`,
        `- **Section self-sufficiency**: Each H2 section should be a self-contained topical unit targeting its own keyword. This helps search engines index individual sections for their respective queries.`,

        // Structure & Extraction (universal — one section, no duplication)
        `\n\n## Structure & Extraction\nUse structured content that aids both readers and AI extraction systems.`,
        `- **Quotable section openings (MANDATORY)**: Each H2 and H3 must begin with a 1–2 sentence factual answer that can be quoted independently without surrounding context. Then elaborate.`,
        `- Use specific, descriptive subheadings — not vague labels.`,
        `- Use numbered lists for procedural content; checklists and timelines where appropriate.`,
        `- Include a "Key Takeaways" section near the top (after the intro, before the TOC): 3-5 factual bullet points with specific facts, numbers, or actionable steps.`,
        `- End with a "Frequently Asked Questions" section (MANDATORY — DO NOT OMIT): 3-5 Q&A pairs as H3 questions with paragraph answers. This section is critical for SEO and geo-targeting. Answers must be factual, specific, and include location-relevant details when the topic has geographic variation (e.g., regional pricing differences, state-specific regulations, local market conditions). Format each FAQ pair as: \`<h3>Question text?</h3><p>Answer text.</p>\` — this exact structure is required for FAQ schema extraction. Every article MUST include this section — no exceptions.`,
        `- **FAQ geo-targeting**: When the topic involves location-dependent information (real estate, legal, medical, regulatory), include at least one FAQ that addresses regional or location-specific variation. Example: "How much does a dental implant cost in Seattle vs. national average?" rather than generic "How much do dental implants cost?"`,
        `- **Entity optimization**: Include relevant entities (agencies, forms, legal terms, programs, standards) by their full official name on first use, then consistently thereafter. Wrap key entities in <strong> tags. Make entity relationships clear and contextual (e.g., which agency administers which form, which program falls under which law).`,
        `- Each section should fully answer the question it introduces, without requiring the reader to infer missing steps or context.`,
        `Do NOT use:`,
        `- Padded introductions explaining what the article will cover`,
        `- Redundant summary sections that repeat what was already said`,
        `- Rhetorical questions as transitions ("But what does this mean for you?")`,
    ];

    // ── SEO TARGETING (universal) ───────────────────────────────────────

    sections.push(`\n\n## SEO Targeting (MANDATORY)\nDerive keyword targets from the article topic and optimize placement.`);
    sections.push(`- Identify one primary keyword — the exact search query this article should rank for.`);
    sections.push(`- Identify 5–15 secondary keywords — long-tail variations, related queries, and "People Also Ask" style follow-ups.`);
    sections.push(`- Match H2/H3 headings to real search queries and common follow-up questions.`);
    sections.push(`- Include the primary keyword in: the H1 (title), the first 100 words, and at least one H2.`);
    sections.push(`- Use secondary keywords naturally throughout — no keyword stuffing.`);
    sections.push(`- **Win featured snippets intentionally**: For the primary keyword, provide a direct 40–60 word definition or answer that Google can extract as a snippet. Use paragraph, list, or table format depending on the query type.`);

    // Metadata & CTR optimization
    sections.push(`- **meta_title**: Write a click-optimized title (50–60 chars) that includes the primary keyword and creates urgency or clarity. Not just the article title — optimize for CTR.`);
    sections.push(`- **meta_description**: Write a compelling description (150–160 chars) that previews value, includes the primary keyword, and encourages clicks.`);
    sections.push(`- **slug**: Generate a short, keyword-rich URL slug (3–6 words, lowercase, hyphenated). Include the primary keyword.`);

    // SERP competition alignment
    sections.push(`- Structure content to outperform top-ranking pages for the primary keyword.`);
    sections.push(`- Ensure all major competing headings and subtopics are covered — do not leave obvious gaps.`);
    sections.push(`- Add at least one section that goes deeper than typical results (original analysis, edge cases, or expert-level detail).`);

    // Secondary keyword coverage — dedicated sections
    sections.push(`\n\n## Secondary Keyword Coverage (MANDATORY)\nHigh-value secondary keywords from the keyword strategy must have dedicated sections — not just passing mentions.`);
    sections.push(`- For every secondary keyword that represents a distinct subtopic or comparison (e.g., "implants vs. bridges", "Invisalign timeline by age"), create a dedicated H2 or H3 section that directly addresses it.`);
    sections.push(`- The section heading should closely match the search query (e.g., H2: "Dental Implants vs. Bridges: Key Differences" for the keyword "implants vs bridges").`);
    sections.push(`- Do not bury high-value keyword topics inside unrelated sections. Give them standalone visibility so search engines can index and surface them independently.`);
    sections.push(`- Comparison keywords should use tables or side-by-side breakdowns. Timeline/process keywords should use ordered lists or step-by-step formats.`);

    // ── SOURCES & ATTRIBUTION (universal — critical for YMYL & GEO) ──────

    sections.push(`\n\n## Sources & Attribution (MANDATORY)\nGenerative engines use source credibility signals when deciding which content to cite. Vague references without links get deprioritized. Explicit, hyperlinked attributions are essential.`);
    sections.push(`- **"According to" attributions (MANDATORY)**: Use explicit inline attributions — e.g., "According to <a href=\"https://www.ada.org/...\">the American Dental Association</a>, the average cost is $1,500." Do not merely mention a source name without linking to the specific page.`);
    sections.push(`- Every factual claim about rules, fees, timelines, eligibility, or statistics must have an inline hyperlinked attribution to the authoritative source. Minimum 4–6 hyperlinked source citations per article.`);
    sections.push(`- Use descriptive anchor text that names the source and context — e.g., <a href="...">ADA clinical guidelines for dental implants</a>, not "click here" or "this page."`);
    sections.push(`- Link to the most specific page available. Link to a specific resource page, not a homepage. Link to a specific regulation section, not a general FAQ.`);
    sections.push(`- Preferred source hierarchy: (1) official industry or government pages, (2) regulations and standards, (3) official data releases, (4) peer-reviewed research, (5) established authoritative reference sites.`);
    sections.push(`- If no authoritative source is available for a claim, qualify it ("timelines may vary," "check the official site for current fees") — do not present unsourced claims as definitive.`);

    // ── FRESHNESS SIGNALS (universal) ───────────────────────────────────

    const currentYear = new Date().getFullYear();
    sections.push(`\n\n## Freshness Signals\nSearch engines and AI systems favor current content. Signal recency without forcing it.`);
    sections.push(`- Reference the current year (${currentYear}) where naturally relevant.`);
    sections.push(`- Note when rules, policies, or data last changed — e.g., "updated in March ${currentYear}" or "effective since October ${currentYear - 1}."`);
    sections.push(`- Use "as of [date]" qualifiers for time-sensitive facts like processing times, fees, or eligibility rules.`);
    sections.push(`- Do not fabricate dates. If you are unsure when something last changed, omit the date rather than guessing.`);

    // ── STRUCTURED DATA GUIDANCE (universal) ────────────────────────────

    sections.push(`\n\n## Structured Data Guidance (MANDATORY)\nFormat specific content sections so they can be automatically converted to Schema.org structured data for enhanced SERP features.`);
    sections.push(`- **FAQ Schema**: The "Frequently Asked Questions" section MUST use exact H3 > p pairing. Each question as an H3 element, immediately followed by its answer as a paragraph. This structure is parsed to generate FAQPage schema markup. Do not nest additional elements between the H3 and its answer paragraph.`);
    sections.push(`- **HowTo Schema**: If the content_type is "how_to", include a clearly labeled step-by-step section with numbered steps using an \`<ol>\` element. Each \`<li>\` should contain a single, complete instruction. This ordered list is extracted to generate HowTo schema markup. Start each step with an action verb.`);
    sections.push(`- **Step-by-step summaries**: For non-how_to articles that include procedural content (timelines, application processes, multi-step guides), still use ordered lists — these will also be extracted for HowTo schema when applicable.`);
    sections.push(`- Both FAQ and HowTo schema significantly increase SERP real estate through rich results. Prioritize clean, parseable formatting for these sections.`);

    // ── UNIQUE INSIGHT & ORIGINAL ANALYSIS (universal — GEO differentiator) ──

    sections.push(`\n\n## Unique Insight & Original Analysis (MANDATORY)\nGenerative engines increasingly weight "unique insight" — information that cannot be easily synthesized from ten other sources. Government pages and established reference sites already cover standard procedures. Your content must go beyond what those sources offer.`);
    sections.push(`- **Decision frameworks with scenarios**: When comparing options (e.g., different treatment plans, product tiers, service packages), build a structured decision framework with specific scenarios — not just a feature list. Example: "If your primary concern is durability and you plan to keep the restoration 15+ years, implants typically offer better long-term value because..."`);
    sections.push(`- **Statistical breakdowns**: Include data-driven analysis where available — cost ranges by region, success rates by method, satisfaction scores by provider type, historical trend data. Present data in tables for scannability.`);
    sections.push(`- **Edge cases and exceptions**: Cover scenarios that standard sources skip — what happens when complications arise, how to handle unexpected delays, when a less common approach is actually the better choice, or how specific conditions change the typical recommendation.`);
    sections.push(`- **Practitioner-level guidance**: Include the kind of analysis a subject-matter expert would offer in a consultation — not just "what" the options are, but "what this means in practice" with concrete examples. E.g., "While the manufacturer states a 10-year warranty, real-world data from ${currentYear} shows an average lifespan of 15–20 years with proper maintenance."`);
    sections.push(`- **Cost-benefit and timeline analysis**: For process-oriented content, build comparison tables that include total costs (direct + ancillary), realistic timeline ranges, and practical trade-offs — not just the list price.`);
    sections.push(`- **Original synthesis**: Combine information from multiple authoritative sources into analysis that no single source provides. If one agency publishes cost data and another publishes quality ratings, connect them into a unified value assessment.`);
    sections.push(`- At least one section in every article must contain analysis, frameworks, or data synthesis that a reader cannot find on the primary government source page for the topic.`);

    // ── INTERNAL LINKING & TOPICAL AUTHORITY (universal — cluster support) ──

    sections.push(`\n\n## Internal Linking & Topical Authority\nWhen this article is part of a topical cluster, internal linking is critical for establishing topical authority and distributing page rank.`);
    sections.push(`- **Cluster context links**: If cluster context is provided in the user prompt, follow all internal linking instructions exactly. Link to every specified sibling page using the provided slugs and descriptive anchor text.`);
    sections.push(`- **Anchor text strategy**: Use keyword-rich anchor text that matches the target page's primary keyword. Do not use generic anchors like \"click here\" or \"read more.\" Example: <a href="/dental-implants-vs-bridges-comparison">dental implants vs. bridges comparison</a>.`);
    sections.push(`- **Link placement**: Distribute internal links naturally throughout the content — in context where the linked topic is relevant. Do not cluster all internal links in one section or paragraph.`);
    sections.push(`- **Link density**: Aim for 3-8 internal links per article depending on length. Pillar pages should link to all supporting pages. Supporting pages link to the pillar + 2-3 related spokes.`);
    sections.push(`- **Avoid keyword cannibalization**: When cluster context lists sibling keywords, do NOT try to rank for those keywords in this article. Mention them only as linking opportunities.`);
    sections.push(`- **Standalone articles**: If no cluster context is provided, still include 1-2 internal links to related content if logical slugs can be inferred from the topic. Use placeholder slugs and descriptive anchor text.`);

    // ── COMPANY SEO CONTENT GUIDELINES (company-specific) ────────────────

    if (engine.seo_content_guidelines) {
        sections.push(`\n\n## Company SEO Content Guidelines (MANDATORY — FOLLOW CLOSELY)\nThe following SEO content guidelines are specific to ${brand}. These guidelines supplement and may override the base SEO rules above. When in conflict, these company-specific guidelines take precedence.\n\n${engine.seo_content_guidelines}`);
    }

    // ── COMPANY EDITORIAL GUIDELINES (company-specific) ─────────────────

    if (engine.editorial_guidelines) {
        sections.push(`\n\n## Company Editorial Guidelines (FOLLOWS THESE CLOSELY)\nThe following editorial guidelines are specific to ${brand}. These guidelines take precedence over base rules for voice, tone, content depth, formatting, and section structure. Produce thorough, detailed, richly sourced articles as described below.\n\n${engine.editorial_guidelines}`);
    }

    // Banned phrases (universal)
    if (uniqueBanned.length) {
        sections.push(`\n\n## Banned Phrases\nNever use these phrases: ${uniqueBanned.map(p => `"${p}"`).join(", ")}.`);
    }

    // Voice profile overlay (company-specific, from voice_profile field)
    const voiceClause = compileVoiceProfileClause(engine);
    if (voiceClause) {
        sections.push(voiceClause);
    }

    return sections.join("\n");
}

/**
 * Returns the image style categories for a given brand engine.
 * Uses the engine's custom styles if set, otherwise falls back to global defaults.
 */
export function getImageStyleCategories(
    engine: BrandEngine = BRAND_ENGINE
): ImageStyleCategory[] {
    const styles = engine.image_style_categories ?? IMAGE_STYLE_CATEGORIES;
    // Always ensure "Default" (base photography style) is the first option
    const hasDefault = styles.some((s) => s.id === "default");
    if (!hasDefault) {
        return [
            { id: "default", label: "Default", narrative: "Uses base brand photography style", storytelling_cues: [], image_prompt_style: "" },
            ...styles,
        ];
    }
    return styles;
}

export function compileImageStyleClause(
    engine: BrandEngine = BRAND_ENGINE,
    styleId?: string
): string {
    const colors = engine.design_tokens.colors.primary;
    const extended = engine.design_tokens.colors.extended;
    const photo = engine.photography_style;

    const base = [
        photo.realism_base,
        "Photography style:",
        `Overall feel: ${photo.global_feel.join(", ")}.`,
        `Narrative: ${photo.narrative}`,
        `Storytelling cues: ${photo.storytelling_cues.join("; ")}.`,
        `Lighting: ${photo.lighting}.`,
        `Mood: ${photo.mood}.`,
        `Composition: ${photo.composition}.`,
        `Subjects: ${photo.subjects.join(", ")}.`,
        `Avoid: ${photo.avoid.join(", ")}.`,
        `Color palette emphasis: obsidian ${colors.obsidian}, marigold ${colors.marigold}, sky ${colors.sky}, white ${colors.white}, with subtle support from juniper ${extended.juniper} and oat ${extended.oat}.`,
    ].join(" ");

    if (!styleId || styleId === "default") return base;

    const categories = getImageStyleCategories(engine);
    const category = categories.find((c) => c.id === styleId);
    if (!category) return base;

    const overlay = [
        category.narrative ? `Category context: ${category.narrative}` : "",
        category.storytelling_cues.length
            ? `Visual cues: ${category.storytelling_cues.join("; ")}.`
            : "",
        category.image_prompt_style
            ? `Detailed style: ${category.image_prompt_style}`
            : "",
    ]
        .filter(Boolean)
        .join(" ");

    return `${base} ${overlay}`;
}

export function selectFewShots(
    engine: BrandEngine = BRAND_ENGINE,
    opts?: { count?: number }
): FewShotPair[] {
    const count = Math.max(
        0,
        Math.min(opts?.count ?? 2, engine.prompt_layers.few_shot_style.length)
    );
    return engine.prompt_layers.few_shot_style.slice(0, count);
}

/**
 * Format few-shot style pairs into a text block for prompt injection.
 */
export function buildFewShotText(fewShots: FewShotPair[]): string {
    if (!fewShots.length) return "";

    return fewShots
        .map(
            (shot, index) =>
                `Example ${index + 1}:\nNeutral: ${shot.neutral}\nOn-brand: ${shot.brand}`
        )
        .join("\n\n");
}

export function getRagContext(
    engine: BrandEngine = BRAND_ENGINE,
    tags: string[],
    opts?: { maxChunks?: number }
): string {
    const maxChunks = Math.max(
        1,
        Math.min(opts?.maxChunks ?? 3, engine.rag_chunks.length)
    );
    const wanted = new Set(tags.map((tag) => tag.toLowerCase()));

    const ranked = engine.rag_chunks
        .map((chunk) => {
            const score = chunk.tags.reduce((sum, tag) => {
                return sum + (wanted.has(tag.toLowerCase()) ? 1 : 0);
            }, 0);

            return { chunk, score };
        })
        .sort((a, b) => b.score - a.score)
        .filter((item) => item.score > 0)
        .slice(0, maxChunks)
        .map((item) => item.chunk.text);

    return ranked.join("\n");
}

export function compileRewriteInstruction(
    engine: BrandEngine = BRAND_ENGINE
): string {
    return [
        "Rewrite the draft to match brand voice.",
        `Goals: ${engine.rewrite_policy.goals.join(", ")}.`,
        `Operations: ${engine.rewrite_policy.operations.join("; ")}.`,
        `Required elements: ${engine.guardrails.required_response_elements.join("; ")}.`,
        `Avoid patterns: ${engine.guardrails.avoid_content_patterns.join("; ")}.`,
        `Disallowed tone: ${engine.guardrails.disallowed_tone.join(", ")}.`,
        `Never use banned phrases: ${engine.rewrite_policy.banned_phrasing.join(", ")}.`,
        "Keep meaning intact. Keep it concise.",
    ].join(" ");
}

export function getThemeTokens(engine: BrandEngine = BRAND_ENGINE) {
    const { primary, extended, secondary } = engine.design_tokens.colors;

    return {
        brand: {
            primary,
            extended,
            secondary,
        },
        ui: {
            text: primary.obsidian,
            background: primary.white,
            cta: primary.marigold,
            accent: primary.sky,
            mutedBackground: extended.oat_light,
            navigation: primary.obsidian,
        },
    };
}