# 📝 Organic Blog MCP

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that exposes Organic's complete blog generation pipeline — system prompts, editorial guidelines, SEO rules, content schema, cluster strategy, and article retrieval.

## Tools

| Tool | Description |
|---|---|
| `get_blog_system_prompt` | Compile the full blog system prompt — editorial credibility, anti-AI rules, SEO, FAQ schema, voice profile |
| `get_editorial_guidelines` | Get company-specific editorial writing framework |
| `get_seo_guidelines` | Get company-specific SEO content rules |
| `get_blog_schema` | Get the JSON schema for structured blog output |
| `get_user_prompt_template` | Get the user prompt template with output requirements and JSON field mapping |
| `build_cluster_context` | Build cluster-aware context for topical cluster articles (pillar/supporting/long-tail) |
| `list_articles` | List existing articles for a brand (internal linking, topic coverage) |
| `get_article` | Get a single article by slug (full content, SEO, FAQ) |

## Setup

```bash
cd mcp/blog-mcp
npm install
```

### Add to Claude Desktop

```json
{
  "mcpServers": {
    "organic-blog": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp/blog-mcp/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

## Example Usage

### Single Article
```
"Write a blog post about dental implant costs in Seattle for pacific-dental"
```

The AI calls:
1. `get_blog_system_prompt("pacific-dental")` — full system prompt
2. `get_user_prompt_template("pacific-dental", topic, "2500")` — user prompt
3. `get_blog_schema()` — output format

### Topical Cluster
```
"Generate the pillar page for a dental implants cluster"
```

The AI calls:
1. `list_articles("pacific-dental")` — existing content for internal links
2. `build_cluster_context(...)` — keyword coordination + linking
3. `get_blog_system_prompt("pacific-dental")` — editorial rules

## Architecture

```
Organic App (Supabase)           Blog MCP Server              AI Client
┌──────────────────────┐     ┌───────────────────────────┐   ┌──────────┐
│ companies table       │────▶│ get_blog_system_prompt()  │◀──│ Claude   │
│ - editorial_guidelines│     │ get_editorial_guidelines()│   │ Cursor   │
│ - seo_guidelines      │     │ get_seo_guidelines()      │   │ ChatGPT  │
│ - voice_profile       │     │ get_blog_schema()         │   │ Your App │
│ - reference_articles  │     │ get_user_prompt_template()│   └──────────┘
│                       │     │ build_cluster_context()   │
│ articles table        │────▶│ list_articles()           │
│ - title, slug, html   │     │ get_article()             │
│ - seo, faq, outline   │     └───────────────────────────┘
└──────────────────────┘
```
