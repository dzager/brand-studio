# 🌿 Organic Brand MCP

A unified [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that exposes your complete Organic brand toolkit — **voice**, **photography style**, and **blog generation** — to any compatible AI client.

> Replaces the separate `voice-mcp`, `photo-style-mcp`, and `blog-mcp` servers. One install, all 20 tools.

## Tools

### General

| Tool | Description |
|---|---|
| `list_companies` | List all brands configured in Organic |

### Voice (6 tools)

| Tool | Description |
|---|---|
| `get_voice_profile` | Full voice profile — tone, rhythm, vocabulary, POV, sample phrases |
| `get_banned_words` | Complete banned phrases list (base engine + company-specific) |
| `get_style_rules` | Editorial guidelines, SEO rules, structural dos/don'ts |
| `validate_tone` | Check text for banned phrases and voice violations |
| `compile_voice_prompt` | Generate a ready-to-inject system prompt clause for any LLM |

### Photo Style (6 tools)

| Tool | Description |
|---|---|
| `get_photography_style` | Photography style — realism, lighting, mood, composition, subjects |
| `get_color_palette` | Full color palette — primary, extended, and secondary hex values |
| `list_image_styles` | List all image style categories for a brand |
| `get_image_style` | Full details of a specific image style category |
| `generate_image_prompt` | Complete hero image prompt using brand style + article context |
| `get_composite_config` | Composite image settings (background prompt, product query) |

### Blog (8 tools)

| Tool | Description |
|---|---|
| `get_blog_system_prompt` | Full blog system prompt — editorial credibility, anti-AI rules, SEO, voice |
| `get_editorial_guidelines` | Company-specific editorial writing framework |
| `get_seo_guidelines` | Company-specific SEO content rules |
| `get_blog_schema` | JSON schema for structured blog output |
| `get_user_prompt_template` | User prompt template with output requirements and JSON mapping |
| `build_cluster_context` | Cluster-aware context for topical cluster articles |
| `list_articles` | List existing articles (internal linking, topic coverage) |
| `get_article` | Get a single article by slug (full content, SEO, FAQ) |

## Setup

### 1. Install dependencies

```bash
cd mcp/organic-brand-mcp
npm install
```

### 2. Environment variables

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run standalone

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... npx tsx src/index.ts
```

### 4. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "organic-brand": {
      "command": "npx",
      "args": ["tsx", "/Users/you/Sites/AutoMouse/brand-studio/mcp/organic-brand-mcp/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

### 5. Add to Cursor

Edit `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "organic-brand": {
      "command": "npx",
      "args": ["tsx", "./mcp/organic-brand-mcp/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

## Example Usage

### Write a branded blog post
```
"Write a blog post about dental implant costs for pacific-dental"
```

The AI calls `get_blog_system_prompt`, `get_user_prompt_template`, and `get_blog_schema` — all from the same server.

### Generate a branded hero image prompt
```
"Generate a hero image for a blog post about dental implants using pacific-dental's editorial style"
```

The AI calls `get_photography_style`, `list_image_styles`, and `generate_image_prompt`.

### Validate copy against brand voice
```
"Check this draft for banned phrases for pacific-dental"
```

The AI calls `validate_tone` with the text.

## Architecture

```
Organic App (Supabase)              Organic Brand MCP Server            AI Client
┌──────────────────────┐     ┌─────────────────────────────────┐    ┌──────────────┐
│ companies table       │────▶│                                 │◀───│ Claude       │
│ - voice_profile       │     │  VOICE                          │    │ Cursor       │
│ - avoid_phrases       │     │  get_voice_profile()            │    │ ChatGPT      │
│ - editorial_guidelines│     │  get_banned_words()             │    │ Windsurf     │
│ - seo_guidelines      │     │  get_style_rules()              │    │ Your App     │
│ - photography_style   │     │  validate_tone()                │    └──────────────┘
│ - color_primary/sec   │     │  compile_voice_prompt()         │
│ - image_style_cats    │     │                                 │
│ - target_audiences    │     │  PHOTO STYLE                    │
│ - reference_articles  │     │  get_photography_style()        │
│ - include_toc         │     │  get_color_palette()            │
│                       │     │  list_image_styles()            │
│ articles table        │────▶│  get_image_style()              │
│ - title, slug, html   │     │  generate_image_prompt()        │
│ - seo, faq, outline   │     │  get_composite_config()         │
│                       │     │                                 │
│                       │     │  BLOG                           │
│                       │     │  get_blog_system_prompt()       │
│                       │     │  get_editorial_guidelines()     │
│                       │     │  get_seo_guidelines()           │
│                       │     │  get_blog_schema()              │
│                       │     │  get_user_prompt_template()     │
│                       │     │  build_cluster_context()        │
│                       │     │  list_articles()                │
│                       │     │  get_article()                  │
└──────────────────────┘     └─────────────────────────────────┘
```

## Migration from separate servers

Remove the three old server entries from your MCP config and replace with the single `organic-brand` entry above. All tool names are identical — no client-side changes needed.
