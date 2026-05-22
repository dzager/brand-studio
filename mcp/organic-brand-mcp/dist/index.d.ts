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
export {};
