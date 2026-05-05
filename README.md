# 🌿 Organic — Brand Studio

AI-powered content creation platform that generates brand-consistent blog articles, editorial images, and SEO-optimized content across multiple companies.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## Stack

- **Framework:** Next.js (Pages Router) + TypeScript
- **Database:** Supabase (PostgreSQL)
- **AI:** OpenAI GPT-5.4, GPT-4.1, gpt-image-2
- **Editor:** Tiptap (WYSIWYG + Markdown + HTML)
- **MCP:** Unified Organic Brand MCP server (21 tools)

## Project Structure

```
src/
  brand/          → Brand engine logic (prompt assembly, voice profiles)
  pages/          → Next.js pages (studio, articles, companies)
  pages/api/      → API routes (create, humanize, fact-check, etc.)
  lib/            → Shared libraries (Supabase client, AI client)
  components/     → React components (ArticleEditor, TaskPanel, ClusterPanel)
  hooks/          → Custom hooks (useTaskRunner, useModelDefaults)
public/           → Static assets and landing page
mcp/
  organic-brand-mcp/  → Unified MCP server (21 tools for voice, photo style, blog)
```

## MCP Server

The `mcp/organic-brand-mcp/` directory contains a unified [Model Context Protocol](https://modelcontextprotocol.io) server that exposes the full brand toolkit — voice profiles, photography styles, and blog generation — to any MCP-compatible AI client (Claude Desktop, Cursor, ChatGPT, Windsurf).

```bash
cd mcp/organic-brand-mcp
npm install
SUPABASE_URL=... SUPABASE_ANON_KEY=... npx tsx src/index.ts
```

See [`mcp/organic-brand-mcp/README.md`](mcp/organic-brand-mcp/README.md) for full setup, client configuration, and tool reference.

## Documentation

- [`PRODUCT.md`](PRODUCT.md) — Full product documentation (pages, API, data model, architecture)
- [`CLAUDE.md`](CLAUDE.md) — AI coding assistant instructions
- [`mcp/organic-brand-mcp/README.md`](mcp/organic-brand-mcp/README.md) — MCP server setup and 21-tool reference

## Deploy

The app deploys to [Vercel](https://vercel.com). See the [Next.js deployment docs](https://nextjs.org/docs/app/building-your-application/deploying) for details.
