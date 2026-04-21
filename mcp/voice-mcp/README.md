# 🌿 Organic Voice MCP

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that exposes your Organic brand's voice profile, banned words, style rules, and tone validation to any compatible AI client.

## Tools

| Tool | Description |
|---|---|
| `list_companies` | List all brands configured in Organic |
| `get_voice_profile` | Get a brand's full voice profile — tone, rhythm, vocabulary, POV, sample phrases |
| `get_banned_words` | Get the complete banned phrases list (base engine + company-specific) |
| `get_style_rules` | Get editorial guidelines, SEO rules, structural dos/don'ts |
| `validate_tone` | Check text for banned phrases and voice violations |
| `compile_voice_prompt` | Generate a ready-to-inject system prompt clause for any LLM |

## Setup

### 1. Install dependencies

```bash
cd mcp/voice-mcp
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
    "organic-voice": {
      "command": "npx",
      "args": ["tsx", "/Users/you/Sites/AutoMouse/brand-studio/mcp/voice-mcp/src/index.ts"],
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
    "organic-voice": {
      "command": "npx",
      "args": ["tsx", "./mcp/voice-mcp/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

## Example Usage

Once connected, any MCP-compatible AI client can:

```
"Write a blog post about dental implants using voice-mcp to get the brand voice for pacific-dental"
```

The AI will call `get_voice_profile("pacific-dental")` and `get_banned_words("pacific-dental")` to shape its output.

## Architecture

```
Organic App (Supabase)         Voice MCP Server          AI Client
┌──────────────────┐     ┌──────────────────────┐    ┌──────────────┐
│ companies table   │────▶│ get_voice_profile()  │◀───│ Claude       │
│ - voice_profile   │     │ get_banned_words()   │    │ Cursor       │
│ - avoid_phrases   │     │ get_style_rules()    │    │ ChatGPT      │
│ - editorial_guide │     │ validate_tone()      │    │ Your App     │
│ - seo_guidelines  │     │ compile_voice_prompt()│    └──────────────┘
└──────────────────┘     └──────────────────────┘
```
