#!/usr/bin/env node

/**
 * @organic/brand-mcp
 *
 * Unified MCP server that exposes a company's complete Organic brand toolkit:
 *   • Voice  — voice profiles, banned words, style rules, tone validation
 *   • Photo  — photography style, color palette, image style categories, image prompts
 *   • Blog   — system prompts, editorial/SEO guidelines, article schema, cluster strategy, articles
 *
 * One server per company install — replaces the separate voice-mcp, photo-style-mcp, and blog-mcp servers.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... npx tsx src/index.ts
 *
 * Claude Desktop / Cursor config:
 *   {
 *     "mcpServers": {
 *       "organic-brand": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/mcp/organic-brand-mcp/src/index.ts"],
 *         "env": {
 *           "SUPABASE_URL": "...",
 *           "SUPABASE_ANON_KEY": "..."
 *         }
 *       }
 *     }
 *   }
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════
// Supabase Client
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// Types (mirrored from brand/engine.ts)
// ═══════════════════════════════════════════════════════════════════════════

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
  headline_style?: string;
  article_blueprint?: string;
  target_length?: string;
};

type ImageStyleCategory = {
  id: string;
  label: string;
  narrative: string;
  storytelling_cues: string[];
  image_prompt_style: string;
  type?: "prompt" | "composite";
  composite_bg_prompt?: string;
  composite_product_query?: string;
  composite_bg_image_url?: string;
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
  photography_style: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  target_audiences: string[] | null;
  image_style_categories: ImageStyleCategory[] | null;
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

// ═══════════════════════════════════════════════════════════════════════════
// Base Defaults
// ═══════════════════════════════════════════════════════════════════════════

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
  "in today's digital world", "it is important to note",
  "navigate the landscape", "game-changing", "revolutionary",
  "groundbreaking", "comprehensive guide", "ultimate guide",
  "everything you need to know", "seamlessly", "leverage", "robust",
];

const BASE_PHOTOGRAPHY = {
  realism_base:
    "natural skin texture, realistic pores, slight facial asymmetry, candid moment, documentary photography, editorial realism, natural daylight, soft shadows, shallow depth of field, light film grain, avoid perfect symmetry, avoid stock photo look, avoid plastic skin.",
  global_feel: [
    "authentic and approachable",
    "light-filled and natural",
    "grounded in real moments",
  ],
  lighting: "natural, soft",
  mood: "warm, human",
  composition: "editorial, candid",
  subjects: [] as string[],
  avoid: ["stocky poses", "heavy filters", "dark or dramatic lighting"],
};

const BASE_COLORS = {
  primary: {
    obsidian: "#2c2c2c",
    marigold: "#fdfe52",
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
};

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

async function fetchCompany(
  supabase: SupabaseClient,
  companyName: string
): Promise<CompanyRow | null> {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, tagline, mission, archetype, tone, avoid_phrases, voice_profile, editorial_guidelines, seo_content_guidelines, photography_style, color_primary, color_secondary, target_audiences, image_style_categories, reference_articles, include_toc"
    )
    .ilike("name", companyName)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as CompanyRow;
}

async function listCompanies(
  supabase: SupabaseClient
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name")
    .order("name");

  if (error || !data) return [];
  return data;
}

function getAllBannedPhrases(company: CompanyRow): string[] {
  const companyAvoid = company.avoid_phrases
    ? company.avoid_phrases.split(",").map((p) => p.trim()).filter(Boolean)
    : [];
  const voiceBanned = company.voice_profile?.banned_phrases ?? [];
  const voiceAvoid = company.voice_profile?.avoid ?? [];
  return [
    ...new Set([
      ...BASE_BANNED_PHRASES,
      ...companyAvoid,
      ...voiceBanned,
      ...voiceAvoid,
    ]),
  ];
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
  if (vp.headline_style)
    parts.push(`Headline style: ${vp.headline_style}`);
  if (vp.article_blueprint)
    parts.push(`Article blueprint: ${vp.article_blueprint}`);
  if (vp.target_length)
    parts.push(`Target length: ${vp.target_length}`);

  return parts.join(" ");
}

function buildPhotographyStyle(company: CompanyRow) {
  const photo = { ...BASE_PHOTOGRAPHY };
  if (company.photography_style) {
    photo.realism_base = company.photography_style;
  }
  if (company.target_audiences && company.target_audiences.length > 0) {
    photo.subjects = company.target_audiences;
  }
  return photo;
}

function buildColorPalette(company: CompanyRow) {
  const colors = structuredClone(BASE_COLORS);
  if (company.color_primary) {
    colors.primary.obsidian = company.color_primary;
  }
  if (company.color_secondary) {
    colors.primary.marigold = company.color_secondary;
  }
  return colors;
}

function getStyleCategories(company: CompanyRow): ImageStyleCategory[] {
  const defaultCategory: ImageStyleCategory = {
    id: "default",
    label: "Default",
    narrative: "Uses base brand photography style",
    storytelling_cues: [],
    image_prompt_style: "",
  };

  const categories = company.image_style_categories ?? [];
  const hasDefault = categories.some((c) => c.id === "default");
  return hasDefault ? categories : [defaultCategory, ...categories];
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP Server
// ═══════════════════════════════════════════════════════════════════════════

const server = new McpServer({
  name: "organic-brand",
  version: "1.0.0",
});

const supabase = getSupabase();

// ─────────────────────────────────────────────────────────────────────────
// GENERAL
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "list_companies",
  "List all brands/companies configured in Organic.",
  {},
  async () => {
    const companies = await listCompanies(supabase);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(companies, null, 2),
        },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────
// VOICE TOOLS
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "get_voice_profile",
  "Get the full voice profile for a brand — tone, sentence rhythm, vocabulary, POV, rhetorical devices, sample phrases, and avoid patterns.",
  {
    company: z.string().describe("The company/brand name (e.g. 'greencard-law')"),
  },
  async ({ company: companyName }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [{ type: "text" as const, text: `Company "${companyName}" not found.` }],
        isError: true,
      };
    }

    const profile = {
      brand: company.name,
      tagline: company.tagline,
      archetype: company.archetype,
      tone: company.tone,
      voice_profile: company.voice_profile || null,
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(profile, null, 2) }],
    };
  }
);

server.tool(
  "get_banned_words",
  "Get the complete banned words/phrases list for a brand. Merges base Organic bans with company-specific avoid phrases and voice profile bans.",
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

    const allBanned = getAllBannedPhrases(company);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              brand: company.name,
              total_count: allBanned.length,
              base_engine_count: BASE_BANNED_PHRASES.length,
              company_specific_count: allBanned.length - BASE_BANNED_PHRASES.length,
              phrases: allBanned,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "get_style_rules",
  "Get the editorial and writing style rules for a brand — editorial guidelines, SEO content guidelines, structural dos/don'ts, specificity rules, and length rules.",
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

    const vp = company.voice_profile;

    const rules = {
      brand: company.name,
      editorial_guidelines: company.editorial_guidelines || null,
      seo_content_guidelines: company.seo_content_guidelines || null,
      structural_do: vp?.structural_do ?? [],
      structural_dont: vp?.structural_dont ?? [],
      specificity_rules: vp?.specificity_rules ?? [],
      length_rules: vp?.length_rules ?? [],
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(rules, null, 2) }],
    };
  }
);

server.tool(
  "validate_tone",
  "Check a piece of text for banned phrases and voice profile violations. Returns any matches found.",
  {
    company: z.string().describe("The company/brand name"),
    text: z.string().describe("The text to validate against the brand's voice rules"),
  },
  async ({ company: companyName, text }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [{ type: "text" as const, text: `Company "${companyName}" not found.` }],
        isError: true,
      };
    }

    const allBanned = getAllBannedPhrases(company);
    const lower = text.toLowerCase();
    const violations = allBanned.filter((phrase) =>
      lower.includes(phrase.toLowerCase())
    );

    const result = {
      brand: company.name,
      text_length: text.length,
      violations_found: violations.length,
      violations,
      passed: violations.length === 0,
      suggestion:
        violations.length > 0
          ? `Found ${violations.length} banned phrase(s). Rewrite to remove: ${violations.map((v) => `"${v}"`).join(", ")}.`
          : "Text passes all voice profile checks.",
    };

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "compile_voice_prompt",
  "Compile a ready-to-use system prompt clause from a brand's voice profile. Inject this into any LLM prompt to write in the brand's voice.",
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

    const vp = company.voice_profile;
    if (!vp) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No voice profile configured for "${company.name}". Use the Organic app to analyze reference articles and generate one.`,
          },
        ],
      };
    }

    const parts: string[] = [
      `You are writing as ${company.name}.${company.tagline ? ` Tagline: "${company.tagline}".` : ""}${company.mission ? ` Mission: ${company.mission}.` : ""}`,
      "",
      "WRITING VOICE PROFILE — match this voice closely:",
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
      parts.push(
        `Characteristic phrases to emulate: "${vp.sample_phrases.join('"; "')}".`
      );
    }
    if (vp.avoid.length) {
      parts.push(`Voice patterns to avoid: ${vp.avoid.join("; ")}.`);
    }
    if (vp.headline_style) {
      parts.push(`Headline style: ${vp.headline_style}`);
    }
    if (vp.article_blueprint) {
      parts.push(`Article blueprint: ${vp.article_blueprint}`);
    }
    if (vp.target_length) {
      parts.push(`Target length: ${vp.target_length}`);
    }

    // Banned phrases
    const companyAvoid = company.avoid_phrases
      ? company.avoid_phrases.split(",").map((p) => p.trim()).filter(Boolean)
      : [];
    const allBanned = [
      ...new Set([...BASE_BANNED_PHRASES, ...companyAvoid, ...(vp.banned_phrases ?? [])]),
    ];
    parts.push(`\nNever use these phrases: ${allBanned.join(", ")}.`);

    return {
      content: [{ type: "text" as const, text: parts.join("\n") }],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────
// PHOTO STYLE TOOLS
// ─────────────────────────────────────────────────────────────────────────

server.tool(
  "get_photography_style",
  "Get the brand's photography style — realism settings, lighting, mood, composition, subjects, and things to avoid.",
  {
    company: z.string().describe("The company/brand name (e.g. 'greencard-law')"),
  },
  async ({ company: companyName }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [{ type: "text" as const, text: `Company "${companyName}" not found.` }],
        isError: true,
      };
    }

    const photo = buildPhotographyStyle(company);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            { brand: company.name, photography_style: photo },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "get_color_palette",
  "Get the brand's full color palette — primary, extended, and secondary colors with hex values.",
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

    const colors = buildColorPalette(company);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ brand: company.name, colors }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "list_image_styles",
  "List all available image style categories for a brand — each with an id, label, narrative, and visual cues.",
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

    const categories = getStyleCategories(company);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              brand: company.name,
              total_styles: categories.length,
              styles: categories.map((c) => ({
                id: c.id,
                label: c.label,
                type: c.type ?? "prompt",
                narrative: c.narrative,
                storytelling_cues: c.storytelling_cues,
                has_composite: !!(c.composite_bg_prompt || c.composite_bg_image_url),
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

server.tool(
  "get_image_style",
  "Get the full details of a specific image style category — including the detailed prompt style, storytelling cues, and composite settings.",
  {
    company: z.string().describe("The company/brand name"),
    style_id: z.string().describe("The style category id (e.g. 'editorial', 'lifestyle')"),
  },
  async ({ company: companyName, style_id }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [{ type: "text" as const, text: `Company "${companyName}" not found.` }],
        isError: true,
      };
    }

    const categories = getStyleCategories(company);
    const style = categories.find((c) => c.id === style_id);

    if (!style) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Style "${style_id}" not found for "${company.name}". Available styles: ${categories.map((c) => c.id).join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ brand: company.name, style }, null, 2),
        },
      ],
    };
  }
);

server.tool(
  "generate_image_prompt",
  "Generate a complete image generation prompt for a blog post hero image, incorporating the brand's photography style, color palette, and selected image style category.",
  {
    company: z.string().describe("The company/brand name"),
    title: z.string().describe("The article title for context"),
    excerpt: z.string().describe("A brief description or excerpt of the article"),
    style_id: z
      .string()
      .optional()
      .describe("Image style category id (omit for default)"),
  },
  async ({ company: companyName, title, excerpt, style_id }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [{ type: "text" as const, text: `Company "${companyName}" not found.` }],
        isError: true,
      };
    }

    const photo = buildPhotographyStyle(company);
    const colors = buildColorPalette(company);
    const categories = getStyleCategories(company);
    const styleId = style_id ?? "default";
    const category = categories.find((c) => c.id === styleId);

    const parts: string[] = [];

    // Category-specific style (FIRST — primacy effect)
    if (category && styleId !== "default") {
      if (category.image_prompt_style) {
        parts.push("MANDATORY VISUAL STYLE — follow this exactly:");
        parts.push(category.image_prompt_style);
        parts.push("");
      }
      if (category.storytelling_cues?.length) {
        parts.push(
          `Visual cues the image MUST convey: ${category.storytelling_cues.join("; ")}.`
        );
        parts.push("");
      }
    }

    // Article context
    parts.push(`Article title: ${title}`);
    parts.push(`Article excerpt: ${excerpt}`);
    parts.push("");
    parts.push(
      "Write one image generation prompt for the hero image of this article."
    );
    parts.push("");

    // General photography defaults
    parts.push("General photography guidance:");
    parts.push(`- Feel: ${photo.global_feel.join(", ")}`);
    parts.push(`- Lighting: ${photo.lighting}`);
    parts.push(`- Mood: ${photo.mood}`);
    parts.push(`- Composition: ${photo.composition}`);
    if (photo.subjects.length) {
      parts.push(`- Subjects: ${photo.subjects.join(", ")}`);
    }
    parts.push(`- Avoid: ${photo.avoid.join(", ")}`);
    parts.push(`- Realism: ${photo.realism_base}`);

    // Color palette
    parts.push(
      `- Brand colors: ${colors.primary.obsidian}, ${colors.primary.marigold}, ${colors.primary.sky}`
    );

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              brand: company.name,
              style_used: styleId,
              system_prompt: `You are an art director for ${company.name}. Your job is to write a single image generation prompt for a blog post hero image. The image must precisely follow any MANDATORY VISUAL STYLE provided. Output ONLY the image prompt text — no explanation, no JSON, no commentary.`,
              user_prompt: parts.join("\n"),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "get_composite_config",
  "Get the composite image configuration for a style category — background prompt, product query, and background image URL used by Organic's image compositing engine.",
  {
    company: z.string().describe("The company/brand name"),
    style_id: z.string().describe("The style category id"),
  },
  async ({ company: companyName, style_id }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [{ type: "text" as const, text: `Company "${companyName}" not found.` }],
        isError: true,
      };
    }

    const categories = getStyleCategories(company);
    const style = categories.find((c) => c.id === style_id);

    if (!style) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Style "${style_id}" not found. Available: ${categories.map((c) => c.id).join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    const composite = {
      brand: company.name,
      style_id: style.id,
      style_label: style.label,
      type: style.type ?? "prompt",
      is_composite: style.type === "composite",
      composite_bg_prompt: style.composite_bg_prompt ?? null,
      composite_product_query: style.composite_product_query ?? null,
      composite_bg_image_url: style.composite_bg_image_url ?? null,
    };

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(composite, null, 2) },
      ],
    };
  }
);

// ─────────────────────────────────────────────────────────────────────────
// BLOG TOOLS
// ─────────────────────────────────────────────────────────────────────────

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
    const bannedPhrases = getAllBannedPhrases(company);
    const includeToc = company.include_toc === true;
    const currentYear = new Date().getFullYear();

    const sections: string[] = [
      // Identity
      `You are a content writer for ${brand}.${company.tagline ? ` Tagline: "${company.tagline}".` : ""} Your job is to produce content that sounds like it was written by a knowledgeable journalist or practitioner — not a marketer, a content agency, or an AI assistant.`,

      // Content Quality Philosophy
      `\n\n## Content Quality Philosophy (MANDATORY)`,
      `- Produce non-commodity content. Do not write generic summaries, rewritten competitor content, or surface-level listicles.`,
      `- Add interpretation, explain WHY things matter, explain HOW decisions actually get made, surface hidden tradeoffs.`,
      `- Every section must answer: What actually matters here? What would an experienced operator know? What nuance is usually missing?`,
      `- Content must feel experienced, specific, credible, nuanced, and human — not assembled from search results.`,

      // Editorial credibility
      `\n\n## Editorial Credibility (HIGHEST PRIORITY)`,
      `- ${brand} content must protect credibility above all.`,
      `- Do NOT inject optimism, empowerment, or motivational framing into procedural content.`,
      `- Do NOT use casual dramatic framing — "brace yourself," "buckle up," etc.`,
      `- Avoid any sentence that sounds like it was written by an AI assistant or LinkedIn influencer.`,
      `- Do not address the reader's emotions. Report facts. Explain processes.`,

      // Write for humans first
      `\n\n## Write for Humans First`,
      `- Content must feel natural and flow conversationally. Avoid robotic phrasing, repetitive cadence, and filler transitions.`,
      `- Do not keyword stuff, write for bots, or force long-tail keyword variants unnaturally into sentences.`,
      `- Do not overexplain simple concepts. Trust the reader's intelligence.`,
      `- Google systems understand semantic meaning and related concepts. Write naturally and comprehensively.`,

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

    // GEO & Answer Engine Optimization
    sections.push(
      `\n\n## GEO & Answer Engine Optimization (MANDATORY)`,
      `- Structure content so AI systems can extract answers, quote sections, and attribute expertise.`,
      `- Every major section should contain: (1) a direct answer, (2) expanded nuance, (3) strategic interpretation, (4) practical implications.`,
      `- Use direct definitions, clear topical hierarchy, strong headings, and concise answer-first paragraphs.`,
      `- Assume content may appear in Google AI Overviews, AI Mode, chat-based retrieval systems, voice assistants, and RAG systems.`,
      `- Make sections independently understandable. Maintain factual clarity and strong semantic structure.`,
    );

    // Semantic Depth & Topical Coverage
    sections.push(
      `\n\n## Semantic Depth & Topical Coverage`,
      `- Cover adjacent concepts necessary for topical authority. Demonstrate ecosystem-level understanding.`,
      `- For any core topic, proactively address related subtopics, variations, exceptions, and commonly confused alternatives.`,
    );

    // E-E-A-T Compliance
    sections.push(
      `\n\n## E-E-A-T Compliance (MANDATORY)`,
      `- Demonstrate Experience, Expertise, Authoritativeness, and Trustworthiness in every article.`,
      `- Use real-world reasoning, specific examples, and operational detail. Show practitioner-level knowledge.`,
      `- Acknowledge tradeoffs, regional variation, exceptions, and situational context. Avoid unsupported certainty.`,
    );

    // Procedural Depth
    sections.push(
      `\n\n## Procedural Depth (MANDATORY)`,
      `- When explaining processes: include exact steps, operational realities, edge cases, timing, costs/fees, documents/forms/agencies, and common mistakes.`,
      `- Do not vaguely reference processes. Be specific enough that a reader could follow the steps without consulting another source.`,
    );

    // Media & Visual Recommendations
    sections.push(
      `\n\n## Media & Visual Recommendations`,
      `- Where relevant, suggest comparison tables, timelines, charts, diagrams, or visual breakdowns using HTML comments (e.g., \`<!-- Suggest: comparison table of X vs Y -->\`).`,
      `- Visuals should support comprehension, add information value, and increase AI extractability.`,
    );

    // Quality Self-Check
    sections.push(
      `\n\n## Quality Self-Check (MANDATORY)`,
      `- Before finalizing, verify: Does this contain original insight? Does this sound human? Is there strategic depth?`,
      `- Is procedural detail sufficient? Is the article extractable by AI systems? Would a domain expert respect this?`,
      `- Does this avoid commodity content? Does it answer the "why" and "how"? Is it more useful than top-ranking competitors?`,
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
          description: "3-8 FAQ pairs matching the FAQ section in the HTML",
        },
        key_takeaways: {
          type: "array",
          items: { type: "string" },
          description: "4-8 concise factual takeaways",
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

server.tool(
  "create_article",
  "Save a new article to the Organic database. Accepts pre-generated article data (matching the blog schema from get_blog_schema) and inserts it into the articles table. Use get_blog_system_prompt + get_user_prompt_template to generate the content first, then use this tool to persist it.",
  {
    company: z.string().describe("The company/brand name"),
    title: z.string().describe("Article title"),
    slug: z.string().describe("URL slug (3-6 words, lowercase, hyphenated)"),
    excerpt: z.string().describe("1-2 sentence factual excerpt"),
    html: z.string().describe("Full blog HTML content (publication-ready)"),
    outline: z
      .array(z.string())
      .describe("List of H2 section headings (3-12)"),
    seo: z
      .object({
        meta_title: z.string(),
        meta_description: z.string(),
        keywords: z.array(z.string()),
        primary_keyword: z.string(),
        secondary_keywords: z.array(z.string()),
        slug: z.string(),
      })
      .describe("SEO metadata"),
    faq: z
      .array(
        z.object({
          question: z.string(),
          answer: z.string(),
        })
      )
      .optional()
      .describe("FAQ pairs (3-5)"),
    key_takeaways: z
      .array(z.string())
      .optional()
      .describe("3-5 concise factual takeaways"),
    how_to_steps: z
      .array(z.string())
      .optional()
      .describe("Ordered how-to steps (empty array if none)"),
    content_type: z
      .enum(["article", "how_to", "comparison", "listicle"])
      .optional()
      .describe("Content type classification"),
    model_used: z
      .string()
      .optional()
      .describe("Model identifier used for generation (e.g. 'gpt-5.4')"),
    image_style: z
      .string()
      .optional()
      .describe("Image style category id used"),
    image_prompt: z
      .string()
      .optional()
      .describe("The image generation prompt used"),
    image_base64: z
      .string()
      .optional()
      .describe("Base64-encoded hero image (data URI or raw base64)"),
  },
  async ({
    company: companyName,
    title,
    slug,
    excerpt,
    html,
    outline,
    seo,
    faq,
    key_takeaways,
    how_to_steps,
    content_type,
    model_used,
    image_style,
    image_prompt,
    image_base64,
  }) => {
    const company = await fetchCompany(supabase, companyName);
    if (!company) {
      return {
        content: [
          { type: "text" as const, text: `Company "${companyName}" not found.` },
        ],
        isError: true,
      };
    }

    // Merge AEO data into the seo column (matching Organic's convention)
    const seoWithAeo = {
      ...seo,
      faq: faq ?? [],
      key_takeaways: key_takeaways ?? [],
      content_type: content_type ?? "article",
    };

    const { data: savedArticle, error } = await supabase
      .from("articles")
      .insert({
        title,
        slug,
        excerpt,
        html,
        outline,
        seo: seoWithAeo,
        model_used: model_used ?? null,
        image_style: image_style ?? null,
        image_prompt: image_prompt ?? null,
        image_base64: image_base64 ?? null,
        company_id: company.id,
      })
      .select("id, title, slug, created_at")
      .single();

    if (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to save article: ${error.message}`,
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
              success: true,
              brand: company.name,
              article: savedArticle,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

server.prompt(
  "write_article",
  "Generate a brand-consistent blog article using the full Organic pipeline, with post-creation follow-up options.",
  {
    company: z.string().describe("The company/brand name (e.g. 'pacific-dental')"),
    topic: z.string().describe("What the article should be about"),
  },
  async ({ company, topic }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Write a blog article about "${topic}" for the brand "${company}".

**Step 1 — Fetch brand context using these MCP tools:**
1. Call \`get_blog_system_prompt\` with company="${company}" to get the full system prompt (editorial credibility, anti-AI rules, SEO, voice overlay).
2. Call \`get_voice_profile\` with company="${company}" to get the brand's tone, rhythm, vocabulary, and sample phrases.
3. Call \`get_user_prompt_template\` with company="${company}" to get the structured output format and JSON schema.
4. Call \`get_banned_words\` with company="${company}" to get the full banned phrases list.
5. Call \`get_editorial_guidelines\` with company="${company}" to get company-specific writing rules.

**Step 2 — Generate the article:**
Use the system prompt from step 1 as your system instructions. Write the article following the voice profile, editorial guidelines, and banned phrases. Output in the structured format from the user prompt template.

**Step 3 — After the article is complete, ask the user:**
- "Would you like me to **fact-check** this article? I'll verify all factual claims."
- "Would you like me to **validate the tone** against ${company}'s brand voice to check for banned phrases?"
- "Would you like me to **generate a hero image prompt** using ${company}'s photography style?"
- "Would you like me to **save this article** to your Organic library?"

Wait for the user's response before proceeding with any of these actions.`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "brand_review",
  "Review and validate text against a brand's voice, tone, and editorial rules.",
  {
    company: z.string().describe("The company/brand name"),
    text: z.string().describe("The text to review"),
  },
  async ({ company, text }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Review the following text against the "${company}" brand guidelines.

**Text to review:**
${text}

**Step 1 — Fetch brand context:**
1. Call \`validate_tone\` with company="${company}" and the text above to find banned phrase violations.
2. Call \`get_voice_profile\` with company="${company}" to understand the target voice.
3. Call \`get_style_rules\` with company="${company}" to check editorial and structural rules.

**Step 2 — Provide a brand review report:**
- List any banned phrase violations found
- Assess how well the text matches the brand's tone descriptors, sentence rhythm, and vocabulary level
- Flag any structural patterns that violate the brand's dos/don'ts
- Rate the overall brand alignment (Strong / Moderate / Weak)

**Step 3 — Offer follow-up actions:**
- "Would you like me to **rewrite this text** to better match ${company}'s voice?"
- "Would you like me to **highlight specific sentences** that need revision?"`,
          },
        },
      ],
    };
  }
);

server.prompt(
  "onboard_brand",
  "Walk through setting up a new company's brand profile in Organic — voice, style, and editorial guidelines.",
  {
    company: z.string().describe("The company/brand name to set up"),
  },
  async ({ company }) => {
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `I want to set up the brand profile for "${company}" in Organic. Guide me through the process step by step.

**Step 1 — Check if the brand already exists:**
Call \`list_companies\` to see if "${company}" is already configured.

**Step 2 — If the brand exists, show its current profile:**
Call \`get_voice_profile\`, \`get_style_rules\`, \`get_photography_style\`, and \`list_image_styles\` to display what's already configured. Ask if they want to update anything.

**Step 3 — If the brand is new (or needs setup), ask these questions one at a time:**
1. "What is ${company}'s **tagline** and **mission**?"
2. "Which **brand archetype** best fits? (Pathfinder, Innovator, Caregiver, Sage, Creator, Hero, Explorer, or Rebel)"
3. "Describe the brand's **tone** in 3-5 adjectives (e.g. confident, clear, modern, helpful)"
4. "Who are the **target audiences**?"
5. "Do you have a **sample article** I can analyze to extract a voice profile? (paste the text)"
6. "Any **words or phrases** the brand should never use?"
7. "Describe the brand's **photography style** — lighting, mood, composition preferences"
8. "What are the **primary and secondary brand colors** (hex values)?"

Wait for the user to answer each question before moving to the next. After collecting all answers, summarize the complete brand profile and suggest they create it in the Organic app at the Companies page.`,
          },
        },
      ],
    };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🌿 Organic Brand MCP server running on stdio — voice + photo + blog + prompts");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
