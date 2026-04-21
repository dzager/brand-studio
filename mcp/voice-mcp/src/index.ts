#!/usr/bin/env node

/**
 * @organic/voice-mcp
 *
 * MCP server that exposes a brand's voice profile, banned words, style rules,
 * and tone settings from Organic's Supabase database.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... npx tsx src/index.ts
 *
 * Or via Claude Desktop / Cursor MCP config:
 *   {
 *     "mcpServers": {
 *       "organic-voice": {
 *         "command": "npx",
 *         "args": ["tsx", "/path/to/mcp/voice-mcp/src/index.ts"],
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
};

// ── Helpers ─────────────────────────────────────────────────────────────

async function fetchCompany(
  supabase: SupabaseClient,
  companyName: string
): Promise<CompanyRow | null> {
  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, tagline, mission, archetype, tone, avoid_phrases, voice_profile, editorial_guidelines, seo_content_guidelines"
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

// Default banned phrases from the base engine
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

// ── MCP Server ──────────────────────────────────────────────────────────

const server = new McpServer({
  name: "organic-voice",
  version: "1.0.0",
});

const supabase = getSupabase();

// ── Tool: list_companies ────────────────────────────────────────────────

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

// ── Tool: get_voice_profile ─────────────────────────────────────────────

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

// ── Tool: get_banned_words ──────────────────────────────────────────────

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

    // Merge all banned phrase sources
    const companyAvoid = company.avoid_phrases
      ? company.avoid_phrases.split(",").map((p) => p.trim()).filter(Boolean)
      : [];
    const voiceBanned = company.voice_profile?.banned_phrases ?? [];
    const voiceAvoid = company.voice_profile?.avoid ?? [];

    const allBanned = [
      ...new Set([
        ...BASE_BANNED_PHRASES,
        ...companyAvoid,
        ...voiceBanned,
        ...voiceAvoid,
      ]),
    ];

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

// ── Tool: get_style_rules ───────────────────────────────────────────────

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

// ── Tool: validate_tone ─────────────────────────────────────────────────

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

    const companyAvoid = company.avoid_phrases
      ? company.avoid_phrases.split(",").map((p) => p.trim()).filter(Boolean)
      : [];
    const voiceBanned = company.voice_profile?.banned_phrases ?? [];
    const voiceAvoid = company.voice_profile?.avoid ?? [];

    const allBanned = [
      ...new Set([...BASE_BANNED_PHRASES, ...companyAvoid, ...voiceBanned, ...voiceAvoid]),
    ];

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

// ── Tool: compile_voice_prompt ──────────────────────────────────────────

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

    // Compile the same voice clause the Organic engine uses
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

// ── Start server ────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("🌿 Organic Voice MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
