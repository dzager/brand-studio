#!/usr/bin/env node

/**
 * @organic/photo-style-mcp
 *
 * MCP server that exposes a brand's photography style, image style categories,
 * color palette, and image prompt generation from Organic's Supabase database.
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

// ── Types (mirrored from brand/engine.ts) ──────────────────────────────

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
  photography_style: string | null;
  color_primary: string | null;
  color_secondary: string | null;
  target_audiences: string[] | null;
  image_style_categories: ImageStyleCategory[] | null;
};

// Default photography style from the base engine
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
};

// ── Helpers ─────────────────────────────────────────────────────────────

async function fetchCompany(
  supabase: SupabaseClient,
  companyName: string
): Promise<CompanyRow | null> {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, tagline, photography_style, color_primary, color_secondary, target_audiences, image_style_categories"
    )
    .ilike("name", companyName)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data as CompanyRow;
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

// ── MCP Server ──────────────────────────────────────────────────────────

const server = new McpServer({
  name: "organic-photo-style",
  version: "1.0.0",
});

const supabase = getSupabase();

// ── Tool: get_photography_style ─────────────────────────────────────────

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

// ── Tool: get_color_palette ─────────────────────────────────────────────

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

// ── Tool: list_image_styles ─────────────────────────────────────────────

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

// ── Tool: get_image_style ───────────────────────────────────────────────

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

// ── Tool: generate_image_prompt ─────────────────────────────────────────

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

// ── Tool: get_composite_config ──────────────────────────────────────────

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

// ── Start server ────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("📸 Organic Photo Style MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
