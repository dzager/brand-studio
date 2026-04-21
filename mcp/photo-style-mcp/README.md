# 📸 Organic Photo Style MCP

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that exposes your Organic brand's photography style, image categories, color palette, and image prompt generation to any compatible AI client.

## Tools

| Tool | Description |
|---|---|
| `get_photography_style` | Get the brand's photography style — realism, lighting, mood, composition, subjects |
| `get_color_palette` | Get the full color palette — primary, extended, and secondary hex values |
| `list_image_styles` | List all image style categories for a brand |
| `get_image_style` | Get full details of a specific image style category |
| `generate_image_prompt` | Generate a complete hero image prompt using brand style + article context |
| `get_composite_config` | Get composite image settings (background prompt, product query, bg image URL) |

## Setup

### 1. Install dependencies

```bash
cd mcp/photo-style-mcp
npm install
```

### 2. Add to Claude Desktop

```json
{
  "mcpServers": {
    "organic-photo-style": {
      "command": "npx",
      "args": ["tsx", "/path/to/mcp/photo-style-mcp/src/index.ts"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

## Example Usage

```
"Generate a hero image prompt for a blog post titled 'Best Dental Implants in Seattle'
using pacific-dental's editorial style"
```

The AI will call:
1. `get_photography_style("pacific-dental")` — base photography rules
2. `list_image_styles("pacific-dental")` — available style categories
3. `generate_image_prompt("pacific-dental", title, excerpt, "editorial")` — complete prompt

## Architecture

```
Organic App (Supabase)         Photo Style MCP Server       AI Client
┌────────────────────┐     ┌─────────────────────────┐    ┌────────────┐
│ companies table     │────▶│ get_photography_style() │◀───│ Claude     │
│ - photography_style │     │ get_color_palette()     │    │ Cursor     │
│ - color_primary     │     │ list_image_styles()     │    │ DALL·E     │
│ - color_secondary   │     │ get_image_style()       │    │ Midjourney │
│ - image_style_cats  │     │ generate_image_prompt() │    │ Your App   │
│ - target_audiences  │     │ get_composite_config()  │    └────────────┘
└────────────────────┘     └─────────────────────────┘
```
