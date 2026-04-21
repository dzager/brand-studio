#!/usr/bin/env node

/**
 * @organic/blog-mcp
 *
 * MCP server that exposes Organic's blog generation pipeline — editorial
 * guidelines, SEO rules, blog system prompts, article schema, cluster
 * strategy, and existing article retrieval.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... npx tsx src/index.ts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ── Supabase client ────────────────────────────────────────────────────

function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables."
    );
  }
  return createClient(url, key);
}

// ── Types ──────────────────────────────────────────────────────────────

type VoiceProfile = {
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
  banned_phrases: string[];
  structural_do: string[];
  structural_dont: string[];
  specificity_rules: string[];
  length_rules: string[];
};

type CompanyRow = {
  id: string;
  name: string;
  tagline: string | null;
  mission: string | null;
  archetype: string | null;
  tone: string | null;
  avoid_phrases: string | null;
  voice_profile: VoiceProfile | null;
  editorial_guidelines: string | null;
  seo_content_guidelines: string | null;
  reference_articles: string[] | null;
  include_toc: boolean | null;
};

type ArticleRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  seo: Record<string, unknown> | null;
  outline: string[] | null;
  model_used: string | null;
  image_style: string | null;
  company_id: string | null;
  created_at: string;
};

// ── Base banned phrases ────────────────────────────────────────────────

const BASE_BANNED_PHRASES = [
  "you're not alone", "your journey", "navigate this process",
  "navigate the complexities", "it's important to remember",
  "it's worth noting", "it's crucial to", "in today's world",
  "in today's landscape", "let's dive in", "let's explore",
  "let's break it down", "without further ado", "game-changer",
  "game changer", "a beacon of", "tapestry of", "at the end of the day",
  "the bottom line is", "rest assured", "don't worry", "take a deep breath",
  "you've got this", "every step of the way", "embark on", "are you ready",
  "empower you", "empowering you", "your dream", "exciting news",
  "here's the good news", "the good news is", "imagine a world",
  "picture this", "unlock your", "level up", "deep dive",
  "brace yourself", "buckle up", "steel yourself", "here's the kicker",
  "spoiler alert", "the harsh reality", "the hard truth",
  "hate to break it to you", "not for the faint of heart", "sticker shock",
  "delve", "cutting-edge", "low-hanging fruit", "synergy", "critical",
  "aligned", "stakeholders", "unlock the power",
  "navigate the ever-evolving landscape", "in today's fast-paced world",
  "critical tool", "revolutionizing",
];

// ── Helpers ─────────────────────────────────────────────────────────────

async function fetchCompany(
  supabase: SupabaseClient,
  companyName: string
): Promise<CompanyRow | null> {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, tagline, mission, archetype, tone, avoid_phrases, voice_profile, editorial_guidelines, seo_content_guidelines, reference_articles, include_toc"
    )
    .ilike("name", companyName)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as CompanyRow;
}

function compileVoiceClause(company: CompanyRow): string {
  const vp = company.voice_profile;
  if (!vp) return "";

  const parts: string[] = [
    "\n\nWRITING VOICE PROFILE — match this voice closely:",
    `Voice summary: ${vp.summary}`,
    `Tone: ${vp.tone_descriptors.join(", ")}.`,
    `Sentence rhythm: ${vp.sentence_rhythm}`,
    `Paragraph style: ${vp.paragraph_style}`,
    `Vocabulary: ${vp.vocabulary_level}`,
  ];

  if (vp.rhetorical_devices.length)
    parts.push(`Rhetorical devices: ${vp.rhetorical_devices.join("; ")}.`);
  if (vp.structural_patterns.length)
    parts.push(`Structural patterns: ${vp.structural_patterns.join("; ")}.`);
  if (vp.pov_and_person) parts.push(`POV: ${vp.pov_and_person}`);
  if (vp.sample_phrases.length)
    parts.push(`Sample phrases: "${vp.sample_phrases.join('"; "')}".`);
  if (vp.avoid.length)
    parts.push(`Avoid: ${vp.avoid.join("; ")}.`);

  return parts.join(" ");
}

function getAllBannedPhrases(company: CompanyRow): string[] {
  const companyAvoid = company.avoid_phrases
    ? company.avoid_phrases.split(",").map((p) => p.trim()).filter(Boolean)
    : [];
  const voiceBanned = company.voice_profile?.banned_phrases ?? [];
  return [...new Set([...BASE_BANNED_PHRASES, ...companyAvoid, ...voiceBanned])];
}

// ── MCP Server ──────────────────────────────────────────────────────────

const server = new McpServer({
  name: "organic-blog",
  version: "1.0.0",
});

const supabase = getSupabase();

// ── Tool: get_blog_system_prompt ────────────────────────────────────────

server.tool(
  "get_blog_system_prompt",
  "Compile the full blog system prompt for a brand — includes editorial credibility rules, anti-AI patterns, specificity rules, SEO targeting, FAQ/HowTo schema, sourcing rules, freshness signals, and the brand's voice profile. This is the exact prompt Organic uses internally.",
  {
    company: z.string().describe("The company/brand name"),
  },
  async ({ company: companyName }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [{ type: "text" as const, text: `Company "${companyName}" not found.` }],
        isError: true,
      };
    }

    const brand = company.name;
    const vp = company.voice_profile;
    const bannedPhrases = getAllBannedPhrases(company);
    const includeToc = company.include_toc === true;
    const currentYear = new Date().getFullYear();

    // Build the full system prompt — same architecture as compileBlogSystemPrompt()
    const sections: string[] = [
      // Identity
      `You are a content writer for ${brand}.${company.tagline ? ` Tagline: "${company.tagline}".` : ""} Your job is to produce content that sounds like it was written by a knowledgeable journalist or practitioner — not a marketer, a content agency, or an AI assistant.`,

      // Editorial credibility
      `\n\n## Editorial Credibility (HIGHEST PRIORITY)`,
      `- ${brand} content must protect credibility above all.`,
      `- Do NOT inject optimism, empowerment, or motivational framing into procedural content.`,
      `- Do NOT use casual dramatic framing — "brace yourself," "buckle up," etc.`,
      `- Avoid any sentence that sounds like it was written by an AI assistant or LinkedIn influencer.`,
      `- Do not address the reader's emotions. Report facts. Explain processes.`,

      // First sentence quality
      `\n\n## First Sentence Quality (MANDATORY)`,
      `- The first sentence MUST be a specific factual statement, concrete scenario, or surprising data point.`,
      `- NEVER open with "When it comes to...", "If you're looking for...", "In today's world...", etc.`,
      `- The first paragraph (2-3 sentences max) should establish what, why now, and what value.`,

      // Specificity
      `\n\n## Specificity Over Generality`,
      `- Always preserve specific facts: dates, times, form numbers, dollar amounts.`,
      `- NEVER replace a specific fact with vague language like "many," "recently," or "significant."`,

      // Length & Padding
      `\n\n## Length & Padding`,
      `- Every sentence should earn its place. Remove filler but do not sacrifice depth.`,
      `- Do not use transitional filler like "Now that we've covered X, let's turn to Y..."`,

      // On-Page Architecture
      `\n\n## On-Page Architecture`,
    ];

    // TOC
    if (includeToc) {
      sections.push(`- Include a clickable Table of Contents nav element after the intro.`);
    } else {
      sections.push(`- Do NOT generate a Table of Contents.`);
    }

    sections.push(
      `- Reinforce the primary keyword in the first 100 words, conclusion, and at least two H2s.`,

      // Structure & Extraction
      `\n\n## Structure & Extraction`,
      `- Each H2/H3 must open with a 1-2 sentence factual answer quotable independently.`,
      `- Include "Key Takeaways" section (3-5 bullets) near the top.`,
      `- End with "Frequently Asked Questions" section (3-5 Q&A pairs as H3+p). MANDATORY.`,
      `- Em dash spacing: always "word — word", never "word—word".`,

      // SEO
      `\n\n## SEO Targeting (MANDATORY)`,
      `- Identify one primary keyword and 5-15 secondary keywords.`,
      `- Match H2/H3 headings to real search queries.`,
      `- Win featured snippets: provide a direct 40-60 word answer for the primary keyword.`,
      `- meta_title: 50-60 chars, keyword + urgency/clarity.`,
      `- meta_description: 150-160 chars, keyword + value preview.`,
      `- slug: 3-6 words, lowercase, hyphenated.`,

      // Sources
      `\n\n## Sources & Attribution (MANDATORY)`,
      `- Use "According to [linked source]" attributions. Minimum 4-6 hyperlinked citations per article.`,
      `- Link to the most specific page available, not homepages.`,

      // Freshness
      `\n\n## Freshness Signals`,
      `- Reference ${currentYear} where relevant. Use "as of [date]" for time-sensitive facts.`,

      // Structured data guidance
      `\n\n## Structured Data Guidance (MANDATORY)`,
      `- FAQ section: H3 > p pairing (for FAQPage schema).`,
      `- HowTo content: use ordered lists (for HowTo schema).`,

      // Unique insight
      `\n\n## Unique Insight & Original Analysis (MANDATORY)`,
      `- Include decision frameworks, statistical breakdowns, edge cases, and practitioner-level guidance.`,
      `- At least one section must contain analysis not found on the primary government/reference source.`,
    );

    // Company SEO guidelines
    if (company.seo_content_guidelines) {
      sections.push(
        `\n\n## Company SEO Content Guidelines (MANDATORY)\n${company.seo_content_guidelines}`
      );
    }

    // Company editorial guidelines
    if (company.editorial_guidelines) {
      sections.push(
        `\n\n## Company Editorial Guidelines (FOLLOW CLOSELY)\n${company.editorial_guidelines}`
      );
    }

    // Banned phrases
    if (bannedPhrases.length) {
      sections.push(
        `\n\n## Banned Phrases\nNever use: ${bannedPhrases.map((p) => `"${p}"`).join(", ")}.`
      );
    }

    // Voice profile
    const voiceClause = compileVoiceClause(company);
    if (voiceClause) sections.push(voiceClause);

    return {
      content: [{ type: "text" as const, text: sections.join("\n") }],
    };
  }
);

// ── Tool: get_editorial_guidelines ──────────────────────────────────────

server.tool(
  "get_editorial_guidelines",
  "Get the company-specific editorial guidelines — the custom writing framework that shapes voice, structure, depth, and content requirements.",
  {
    company: z.string().describe("The company/brand name"),
  },
  async ({ company: companyName }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [{ type: "text" as const, text: `Company "${companyName}" not found.` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              brand: company.name,
              editorial_guidelines:
                company.editorial_guidelines || "No custom editorial guidelines configured.",
              include_toc: company.include_toc === true,
              reference_articles: company.reference_articles ?? [],
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool: get_seo_guidelines ────────────────────────────────────────────

server.tool(
  "get_seo_guidelines",
  "Get the company-specific SEO content guidelines — keyword strategy, content depth rules, and search optimization framework.",
  {
    company: z.string().describe("The company/brand name"),
  },
  async ({ company: companyName }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [{ type: "text" as const, text: `Company "${companyName}" not found.` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              brand: company.name,
              seo_content_guidelines:
                company.seo_content_guidelines || "No custom SEO guidelines configured.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool: get_blog_schema ───────────────────────────────────────────────

server.tool(
  "get_blog_schema",
  "Get the JSON schema that Organic uses for structured blog generation output — title, excerpt, html, seo, faq, key_takeaways, how_to_steps, content_type. Use this to format your blog output correctly.",
  {},
  async () => {
    const schema = {
      type: "object",
      required: [
        "title",
        "excerpt",
        "outline",
        "html",
        "seo",
        "faq",
        "key_takeaways",
        "how_to_steps",
        "content_type",
      ],
      properties: {
        title: { type: "string", description: "Blog post title" },
        excerpt: {
          type: "string",
          description: "1-2 sentence factual excerpt",
        },
        outline: {
          type: "array",
          items: { type: "string" },
          description: "List of H2 section headings (3-12)",
        },
        html: {
          type: "string",
          description:
            "Full blog HTML content using h2/h3, lists, tables. Publication-ready.",
        },
        seo: {
          type: "object",
          properties: {
            meta_title: {
              type: "string",
              description: "Click-optimized, 50-60 chars",
            },
            meta_description: {
              type: "string",
              description: "Compelling, 150-160 chars",
            },
            keywords: {
              type: "array",
              items: { type: "string" },
              description: "3-12 keywords",
            },
            primary_keyword: {
              type: "string",
              description: "The exact search query this article targets",
            },
            secondary_keywords: {
              type: "array",
              items: { type: "string" },
              description: "5-15 long-tail variations",
            },
            slug: {
              type: "string",
              description: "3-6 words, lowercase, hyphenated",
            },
          },
        },
        faq: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              answer: { type: "string" },
            },
          },
          description: "3-5 FAQ pairs matching the FAQ section in the HTML",
        },
        key_takeaways: {
          type: "array",
          items: { type: "string" },
          description: "3-5 concise factual takeaways",
        },
        how_to_steps: {
          type: "array",
          items: { type: "string" },
          description:
            "Ordered steps from procedural sections. Empty array if no steps.",
        },
        content_type: {
          type: "string",
          enum: ["article", "how_to", "comparison", "listicle"],
        },
      },
    };

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(schema, null, 2) },
      ],
    };
  }
);

// ── Tool: get_user_prompt_template ──────────────────────────────────────

server.tool(
  "get_user_prompt_template",
  "Get the user prompt template that Organic uses for article generation — includes output requirements, JSON field mapping, and optional cluster context injection point.",
  {
    company: z.string().describe("The company/brand name"),
    topic: z.string().describe("The article topic or creation prompt"),
    word_count: z
      .string()
      .optional()
      .describe("Target word count (e.g. '2000')"),
  },
  async ({ company: companyName, topic, word_count }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [
          { type: "text" as const, text: `Company "${companyName}" not found.` },
        ],
        isError: true,
      };
    }

    const parts = [
      `Creation prompt: ${topic.trim()}`,
      "",
      `Brand: ${company.name}`,
      `Tagline: ${company.tagline || ""}`,
      "",
      "Output requirements:",
      `- Write a comprehensive, in-depth blog post${word_count ? ` (target: ${word_count} words)` : ""} that matches the voice and editorial guidelines in the system prompt.`,
      '- Include multiple H2/H3 sections with detailed explanations, specific data points, real-world examples, and actionable guidance.',
      '- Each major section should contain substantive detail — facts, statistics, policy specifics, or concrete examples.',
      '- Include a short, factual excerpt.',
      '- Produce clean HTML using h2/h3, lists, and tables. Publication-ready.',
      '- Do not mention internal brand rules.',
      "",
      "JSON output field mapping (return valid JSON only — no commentary):",
      '- "faq": array of {question, answer} matching the FAQ section.',
      '- "key_takeaways": array of 3-5 concise strings.',
      '- "content_type": one of "article", "how_to", "comparison", or "listicle".',
      '- "how_to_steps": array of step strings (empty if no steps).',
      '- "seo.primary_keyword": exact search query target.',
      '- "seo.secondary_keywords": 5-15 long-tail variations.',
      '- "seo.slug": keyword-rich URL slug.',
    ];

    return {
      content: [{ type: "text" as const, text: parts.join("\n") }],
    };
  }
);

// ── Tool: build_cluster_context ─────────────────────────────────────────

server.tool(
  "build_cluster_context",
  "Build cluster-aware context for article generation within a topical cluster. Handles keyword coordination, internal linking targets, and role-specific instructions (pillar vs supporting vs long-tail).",
  {
    cluster_name: z.string().describe("Name of the content cluster"),
    role: z
      .enum(["pillar", "supporting", "long_tail"])
      .describe("This page's role in the cluster"),
    page_title: z.string().describe("The title of the page being generated"),
    page_keyword: z.string().describe("Target keyword for this page"),
    page_slug: z.string().describe("Target URL slug for this page"),
    pillar_title: z.string().describe("The pillar page title"),
    pillar_slug: z.string().describe("The pillar page slug"),
    sibling_pages: z
      .array(
        z.object({
          title: z.string(),
          keyword: z.string(),
          slug: z.string(),
          role: z.string(),
        })
      )
      .describe("All other pages in the cluster (for keyword coordination and linking)"),
  },
  async ({ cluster_name, role, page_title, page_keyword, page_slug, pillar_title, pillar_slug, sibling_pages }) => {
    const parts: string[] = [];

    const roleLabel =
      role === "pillar"
        ? "PILLAR PAGE (the hub)"
        : role === "supporting"
        ? "SUPPORTING PAGE (spoke)"
        : "LONG-TAIL PAGE (deep-dive spoke)";

    parts.push(`\n\n## Topical Cluster Context`);
    parts.push(
      `This article is part of the "${cluster_name}" content cluster.`
    );
    parts.push(`Role: **${roleLabel}**`);
    parts.push(`Target keyword: "${page_keyword}"`);
    parts.push(`Target slug: ${page_slug}`);

    // Role-specific guidance
    if (role === "pillar") {
      parts.push(`\nAs the pillar page, this article should:`);
      parts.push(
        `- Provide comprehensive coverage of the core topic`
      );
      parts.push(
        `- Link OUT to every supporting and long-tail page`
      );
      parts.push(`- Cover each subtopic at a high level, deferring deep detail to spokes`);
      parts.push(
        `- Use anchor text matching each spoke's keyword target`
      );
    } else if (role === "supporting") {
      parts.push(`\nAs a supporting page:`);
      parts.push(
        `- Go deep on: "${page_keyword}"`
      );
      parts.push(
        `- Link BACK to the pillar: "${pillar_title}" (/${pillar_slug})`
      );
      parts.push(`- Link to 2-3 related siblings`);
      parts.push(`- Add NEW depth — don't repeat pillar content`);
    } else {
      parts.push(`\nAs a long-tail page:`);
      parts.push(`- Focus narrowly on: "${page_keyword}"`);
      parts.push(
        `- Link BACK to the pillar: "${pillar_title}" (/${pillar_slug})`
      );
      parts.push(`- Link to at least 1 related supporting page`);
      parts.push(`- Answer the query directly and thoroughly`);
    }

    // Keyword coordination
    parts.push(`\n### Keyword Coordination`);
    parts.push(
      `Other pages target these keywords — do NOT compete:`
    );
    for (const sib of sibling_pages) {
      parts.push(
        `- "${sib.keyword}" → "${sib.title}" (/${sib.slug})`
      );
    }

    // Internal linking
    parts.push(`\n### Internal Links (MANDATORY)`);
    parts.push(
      `Include natural links to these sibling pages using keyword-rich anchor text:`
    );
    for (const sib of sibling_pages) {
      parts.push(
        `- <a href="/${sib.slug}">${sib.keyword}</a> — "${sib.title}" (${sib.role})`
      );
    }
    parts.push(
      `Distribute links naturally — do not cluster in one section.`
    );

    return {
      content: [{ type: "text" as const, text: parts.join("\n") }],
    };
  }
);

// ── Tool: list_articles ─────────────────────────────────────────────────

server.tool(
  "list_articles",
  "List existing articles for a brand — useful for finding internal linking targets, understanding content coverage, and avoiding topic duplication.",
  {
    company: z.string().describe("The company/brand name"),
    limit: z.number().optional().describe("Max articles to return (default 25)"),
  },
  async ({ company: companyName, limit }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [
          { type: "text" as const, text: `Company "${companyName}" not found.` },
        ],
        isError: true,
      };
    }

    const { data, error } = await supabase
      .from("articles")
      .select("id, title, slug, excerpt, seo, outline, model_used, image_style, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);

    if (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error fetching articles: ${error.message}`,
          },
        ],
        isError: true,
      };
    }

    const articles = (data || []) as ArticleRow[];

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              brand: company.name,
              total_articles: articles.length,
              articles: articles.map((a) => ({
                id: a.id,
                title: a.title,
                slug: a.slug,
                excerpt: a.excerpt,
                primary_keyword:
                  (a.seo as any)?.primary_keyword ?? null,
                content_type:
                  (a.seo as any)?.content_type ?? null,
                created_at: a.created_at,
              })),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Tool: get_article ───────────────────────────────────────────────────

server.tool(
  "get_article",
  "Get a single article by slug — returns full content, SEO data, FAQ, and outline. Useful for reviewing existing content or building internal link context.",
  {
    company: z.string().describe("The company/brand name"),
    slug: z.string().describe("The article's URL slug"),
  },
  async ({ company: companyName, slug }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [
          { type: "text" as const, text: `Company "${companyName}" not found.` },
        ],
        isError: true,
      };
    }

    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("company_id", company.id)
      .eq("slug", slug)
      .single();

    if (error || !data) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Article "${slug}" not found for "${company.name}".`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              brand: company.name,
              article: {
                id: data.id,
                title: data.title,
                slug: data.slug,
                excerpt: data.excerpt,
                html: data.html,
                outline: data.outline,
                seo: data.seo,
                model_used: data.model_used,
                image_style: data.image_style,
                created_at: data.created_at,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ── Start server ────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("📝 Organic Blog MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
