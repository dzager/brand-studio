# Organic Brand Studio — Product Documentation

## Overview

Organic is an AI-powered content creation platform that generates brand-consistent blog articles, editorial images, and SEO-optimized content. It supports multi-company management, allowing each company to maintain its own editorial voice, image style, and content guidelines.

---

## Pages

### 1. Studio (`/studio`)

The main content creation interface with two modes: **Single Article** and **Content Cluster**.

**Mode Selector:**

A card-based mode switcher at the top of the page lets users choose their creation path. Each mode shows its own configuration form.

**Single Article Mode — Controls:**

| Control | Description |
|---|---|
| **Company Selector** | Choose which company's brand engine to use. Loads company-specific image styles, voice profile, and editorial guidelines. |
| **Prompt Textarea** | Free-text prompt with live character counter. |
| **Prompt Templates** | Pre-built topic templates (loaded from `/api/prompts`) for quick article creation. |
| **Advanced Options** | Collapsible disclosure block containing Image Style, Model, and Length selectors. |
| **Image Style** | Dropdown of the company's custom image styles (or "Default"). Controls the visual style of the generated featured image. |
| **✨ Recommend** | AI analyzes the prompt and recommends the best-fit image style from available options, with a reason. |
| **Model** | Select the LLM model (GPT-5.4, GPT-5.5, etc.). |
| **Length** | Target word count range (Short 300–500, Medium 800–1,200, Long 1,500–2,500, Deep Dive 2,500–4,000, No limit). |
| **Create Article** | Generates the article, excerpt, SEO metadata, FAQ, key takeaways, JSON-LD, and featured image. |

**Content Cluster Mode — Controls:**

| Control | Description |
|---|---|
| **Company Selector** | Choose which company's brand engine to use. |
| **Cluster Topic** | Free-text description of the topical cluster to generate. |
| **Model** | Select the LLM model for strategy generation. |
| **Generate Strategy** | Creates a structured cluster strategy with pillar, supporting, and long-tail pages. Navigates to Content Architecture on completion. |

**Post-Generation Actions (Single Article):**

| Action | Description |
|---|---|
| **Rich Editor** | Visual (WYSIWYG) and HTML editing modes for the generated article. |
| **✨ Humanize** | Rewrites the article through a separate AI pass (`gpt-4.1`) to remove AI writing patterns and inject natural voice. Rewrites title and excerpt too. |
| **🔍 Fact-Check** | Runs the article through `o3` to verify claims, flag unsupported statements, and score factual accuracy (0–100). |
| **Image Gallery** | Shows the featured image. Supports custom prompt regeneration and image search (Pexels integration). |
| **📋 Copy** | Copies the article HTML to clipboard with formatting preserved. |
| **Publish to WordPress** | Publishes the article directly to a configured WordPress site via REST API. |

---

### 2. Articles (`/articles`)

Lists all generated articles stored in Supabase.

**Features:**

| Feature | Description |
|---|---|
| **Article List** | Displays title, excerpt, company, creation date, and featured image thumbnail. |
| **Copy Content** | Copy article HTML to clipboard. |
| **Image Regeneration** | Enter a custom image prompt and regenerate the featured image for any existing article. |
| **Delete** | Remove articles from the database. |

---

### 3. Companies (`/companies`)

Multi-company management interface. Each company has its own brand identity, editorial voice, and image styles.

**Company Fields:**

| Section | Fields |
|---|---|
| **Identity** | Name, Tagline, Mission, Archetype, Industry |
| **Audience & Style** | Target Audiences, Photography Style |
| **Design Tokens** | Primary Color, Secondary Color |
| **Content Rules** | Avoid Phrases (comma-separated keywords) |
| **Editorial Guidelines** | Full-width textarea for company-specific voice, tone, citation rules, drafting rules, format requirements, and gold-standard examples. Injected into every article prompt with high priority. |
| **Reference Articles** | List of URLs to gold-standard articles. Auto-fetched and cached at generation time, injected as few-shot style references. |
| **Custom Image Styles** | Toggle to enable company-specific image style categories. Each style has: Label, ID, Narrative, Storytelling Cues, Image Prompt Style. Styles are collapsible and duplicatable. |

**Company Actions:**

| Action | Description |
|---|---|
| **Create / Update / Delete** | Full CRUD for company records. |
| **🎙️ Voice Profile** | Slide-out panel for managing the company's analyzed voice profile. |
| **Duplicate Style** | Clone an image style card with all its data and a unique ID. |

---

## Voice Profile System

Each company can have a **Voice Profile** — a structured analysis of a writing style that the LLM uses to match tone, rhythm, and editorial patterns.

**Voice Profile Fields:**

| Category | Fields |
|---|---|
| **Voice & Tone** | Summary, Tone Descriptors, POV & Person, Sentence Rhythm, Paragraph Style, Vocabulary Level, Rhetorical Devices, Sample Phrases, Patterns to Avoid |
| **Banned Phrases** | Specific phrases that should never appear (e.g., "You're not alone", "Navigate the process") |
| **Structure** | Structural Patterns, Structural Do (elements to use), Structural Don't (anti-patterns) |
| **Specificity & Length** | Specificity Rules, Length Rules |

**Workflow:**
1. Open Voice Profile panel for a company
2. Choose an input method:
   - **Paste text** — Paste sample article content directly into the analysis box
   - **Import from URL** — Enter a URL and Organic fetches and extracts the article text automatically via `/api/fetch-article-text`
3. Click **Analyze Voice** — AI extracts a structured voice profile
4. Review and edit any field
5. Click **Save Changes** — profile is persisted and used in all future article generation
6. **Clear Profile** removes the voice profile entirely

---

## AI Engine Architecture

### Base Engine (Universal — All Companies)

Applied to every article regardless of company:

| Module | Purpose |
|---|---|
| **Editorial Credibility** | Anti-AI guardrails: no motivational framing, no reassuring language, no AI giveaways. Credibility over warmth. |
| **Specificity Over Generality** | Preserves exact facts, dates, numbers. Never replaces specifics with vague language. |
| **Length & Padding** | Every sentence earns its place. Removes filler but preserves depth. Defers to company editorial guidelines for content richness. |
| **Structure** | H2/H3 subheadings, step-by-step guidance, checklists. Prohibits padded intros and redundant summaries. |
| **AEO (Answer Engine Optimization)** | Inverted pyramid structure, Key Takeaways section, FAQ section, entity emphasis, comparison tables, procedural steps. |
| **GEO (Generative Engine Optimization)** | Fluency optimization, cited claims, quotation integration, statistical anchoring. |
| **Banned Phrases** | Global + company-specific banned phrase enforcement. |

### Company-Specific Layers

| Layer | Source | Priority |
|---|---|---|
| **Editorial Guidelines** | `editorial_guidelines` field on company | Overrides base length/depth rules |
| **Voice Profile** | `voice_profile` field on company | Appended as "WRITING VOICE PROFILE — match this voice closely" |
| **Reference Articles** | `reference_articles` URLs on company | Auto-fetched, cached 24h, injected as "Gold-Standard Reference Articles" |
| **Image Styles** | `image_style_categories` on company | Controls image generation prompt and style |

### Prompt Assembly Order

```
1. Identity (brand name, tagline)
2. Editorial Credibility (HIGHEST PRIORITY — anti-AI rules)
3. Specificity Over Generality
4. Length & Padding (universal, defers to editorial guidelines)
5. Structure
6. Company Editorial Guidelines (takes precedence for voice/tone/depth)
7. AEO Content Structuring
8. GEO Optimization
9. Banned Phrases
10. Voice Profile Overlay
11. Reference Articles (few-shot examples)
```

---

## API Endpoints

### Content Generation

| Endpoint | Method | Description |
|---|---|---|
| `/api/create` | POST | Generate a full article (HTML, title, excerpt, image, SEO, FAQ, key takeaways, JSON-LD) |
| `/api/humanize` | POST | Rewrite article content, title, and excerpt to remove AI patterns |
| `/api/fact-check` | POST | Verify factual claims and score accuracy |
| `/api/regenerate-image` | POST | Generate a new featured image with a custom prompt |
| `/api/recommend-style` | POST | AI-recommend the best image style for a given prompt |
| `/api/analyze-voice` | POST | Analyze article text and extract a structured voice profile |

### Content Management

| Endpoint | Method | Description |
|---|---|---|
| `/api/articles` | GET | List all articles |
| `/api/articles/[id]` | GET, PUT, DELETE | Read, update, or delete a specific article |
| `/api/publish` | POST | Publish article to WordPress via REST API |

### Company Management

| Endpoint | Method | Description |
|---|---|---|
| `/api/companies` | GET, POST | List companies or create a new one. POST auto-populates editorial guidelines, SEO guidelines, and voice profile defaults. |
| `/api/companies/[id]` | GET, PUT, DELETE | Read, update, or delete a company |

### Invitations & Collaboration

| Endpoint | Method | Description |
|---|---|---|
| `/api/invitations` | POST | Create a new invitation. Sends a branded email with a unique token link. Supports re-inviting the same email. |
| `/api/invitations/[token]` | GET, POST | GET validates the token. POST accepts the invitation — creates the user's account membership scoped to the invitation's company. |

### Utilities

| Endpoint | Method | Description |
|---|---|---|
| `/api/prompts` | GET | List prompt templates |
| `/api/prompts/[id]` | GET | Get a specific prompt template |
| `/api/image-search` | GET | Search Pexels for stock images |
| `/api/image-proxy` | GET | Proxy external images to avoid CORS issues |
| `/api/fetch-article-text` | POST | Extract article text from a URL for voice profile analysis |

---

## Data Model

### Supabase Tables

**`companies`**

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `name` | text | Company name |
| `tagline` | text | Brand tagline |
| `mission` | text | Mission statement |
| `archetype` | text | Brand archetype |
| `industry` | text | Industry category |
| `target_audiences` | text | Target audience description |
| `photography_style` | text | Photography style description |
| `color_primary` | text | Primary brand color (hex) |
| `color_secondary` | text | Secondary brand color (hex) |
| `avoid_phrases` | text | Comma-separated phrases to avoid |
| `image_style_categories` | jsonb | Custom image style categories array |
| `voice_profile` | jsonb | Analyzed voice profile JSON |
| `editorial_guidelines` | text | Company-specific editorial playbook |
| `reference_articles` | text[] | URLs of gold-standard reference articles |
| `created_at` | timestamptz | Creation timestamp |

**`articles`**

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `title` | text | Article title |
| `slug` | text | URL slug |
| `html` | text | Article HTML content |
| `excerpt` | text | Short excerpt |
| `image_base64` | text | Featured image (base64) |
| `image_prompt` | text | Prompt used to generate the image |
| `seo` | jsonb | SEO metadata + AEO data (FAQ, key takeaways, content type) |
| `company_id` | uuid | Foreign key to companies |
| `created_at` | timestamptz | Creation timestamp |

**`invitations`**

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `email` | text | Invitee email address |
| `token` | text | Unique invitation token (used in URL) |
| `account_id` | uuid | Foreign key to accounts |
| `company_id` | uuid | Foreign key to companies (scopes access) |
| `cluster_id` | uuid | Foreign key to clusters (optional, for cluster sharing) |
| `role` | text | Role to assign on acceptance (owner, member) |
| `status` | text | Invitation status (pending, accepted, expired) |
| `invited_by` | uuid | Foreign key to auth.users |
| `created_at` | timestamptz | Creation timestamp |
| `accepted_at` | timestamptz | Acceptance timestamp |

**`account_members`**

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `account_id` | uuid | Foreign key to accounts |
| `user_id` | uuid | Foreign key to auth.users |
| `company_id` | uuid | Foreign key to companies (scopes member to a specific company, nullable for full-account access) |
| `role` | text | Member role (owner, member) |
| `created_at` | timestamptz | Creation timestamp |

---

## MCP Server — Organic Brand MCP

The platform exposes its complete brand toolkit as a unified [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server at `mcp/organic-brand-mcp/`. This single server replaces the original three separate servers (`voice-mcp`, `photo-style-mcp`, `blog-mcp`) and provides **21 tools** that any MCP-compatible AI client (Claude Desktop, Cursor, ChatGPT, Windsurf, etc.) can use to generate brand-consistent content.

### Tool Groups

| Group | Tools | Purpose |
|---|---|---|
| **General** | `list_companies` | List all brands configured in Organic |
| **Voice** (5) | `get_voice_profile`, `get_banned_words`, `get_style_rules`, `validate_tone`, `compile_voice_prompt` | Voice profile, editorial rules, and tone validation |
| **Photo Style** (6) | `get_photography_style`, `get_color_palette`, `list_image_styles`, `get_image_style`, `generate_image_prompt`, `get_composite_config` | Photography style, colors, and image prompt generation |
| **Blog** (9) | `get_blog_system_prompt`, `get_editorial_guidelines`, `get_seo_guidelines`, `get_blog_schema`, `get_user_prompt_template`, `build_cluster_context`, `list_articles`, `get_article`, `create_article` | Full blog generation pipeline, article management, and article creation |

### Setup

```bash
cd mcp/organic-brand-mcp
npm install
SUPABASE_URL=... SUPABASE_ANON_KEY=... npx tsx src/index.ts
```

See [`mcp/organic-brand-mcp/README.md`](mcp/organic-brand-mcp/README.md) for full configuration (Claude Desktop, Cursor, environment variables) and usage examples.

### Prompt Templates

The server includes guided workflow prompts accessible via `/` in Claude Desktop:

| Prompt | Parameters | Description |
|---|---|---|
| `write_article` | company, topic | Full article generation with post-creation follow-ups (fact-check, tone validation, hero image, save) |
| `brand_review` | company, text | Validate text against brand voice, banned phrases, and editorial rules with alignment rating |
| `onboard_brand` | company | Step-by-step guided setup for a new brand profile |

---

## Technology Stack

| Component | Technology |
|---|---|
| **Framework** | Next.js (Pages Router) |
| **Language** | TypeScript |
| **Database** | Supabase (PostgreSQL) |
| **AI Models** | OpenAI GPT-5.4, GPT-4.1, GPT-4.1-mini, o3, gpt-image-2 |
| **MCP Server** | `@modelcontextprotocol/sdk` (unified organic-brand-mcp) |
| **Image Search** | Pexels API |
| **Publishing** | WordPress REST API |
| **HTML Parsing** | cheerio (for reference article scraping) |
| **Rich Editor** | React-based WYSIWYG with HTML mode |

---

## Key Design Decisions

1. **Base Engine vs. Company-Specific**: Universal rules (anti-AI, AEO/GEO, specificity) apply to all companies. Voice, tone, content depth, and formatting are company-specific via editorial guidelines and voice profiles.

2. **Editorial Guidelines Take Precedence**: The base engine's length rules explicitly defer to company editorial guidelines when present, allowing companies to demand rich, long-form content while others may prefer brevity.

3. **Reference Articles as Few-Shot Examples**: Instead of manually copying article excerpts, companies can add URLs. The system auto-fetches, parses (via cheerio), caches (24h TTL), and injects article content as gold-standard references in the system prompt.

4. **Voice Profile as Structured Data**: Voice profiles are not free-text — they're structured JSON with specific fields (tone descriptors, sentence rhythm, banned phrases, specificity rules, etc.) that compile into deterministic prompt instructions.

5. **Image Styles are Company-Owned**: No hardcoded global image styles. Each company defines its own styles via the Custom Image Styles section, giving full control over visual brand identity.

6. **Unified MCP Server**: A single `organic-brand-mcp` server exposes all brand tools (voice, photo style, blog) over the Model Context Protocol. This consolidation from three separate servers simplifies configuration, deployment, and maintenance while keeping all tool names backward-compatible.
