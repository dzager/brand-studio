# Boundless Brand Studio — Product Documentation

## Overview

Boundless Brand Studio is an AI-powered content creation platform that generates brand-consistent blog articles, editorial images, and SEO-optimized content. It supports multi-company management, allowing each company to maintain its own editorial voice, image style, and content guidelines.

---

## Pages

### 1. Content Generator (`/`)

The main article creation interface. Users write a prompt and the system generates a full blog article with featured image.

**Controls:**

| Control | Description |
|---|---|
| **Company Selector** | Choose which company's brand engine to use. Loads company-specific image styles, voice profile, and editorial guidelines. |
| **Prompt Templates** | Pre-built topic templates (loaded from `/api/prompts`) for quick article creation. |
| **Image Style** | Dropdown of the company's custom image styles (or "Default"). Controls the visual style of the generated featured image. |
| **✨ Recommend** | AI analyzes the prompt and recommends the best-fit image style from available options, with a reason. |
| **Model** | Select the LLM model (GPT-5.1, Nano Banano 2). |
| **Length** | Target word count range (Short 300–500, Medium 800–1,200, Long 1,500–2,500, Deep Dive 2,500–4,000, No limit). |
| **Create Article** | Generates the article, excerpt, SEO metadata, FAQ, key takeaways, JSON-LD, and featured image. |

**Post-Generation Actions:**

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
2. Paste sample article content into the analysis box
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
| `/api/companies` | GET, POST | List companies or create a new one |
| `/api/companies/[id]` | GET, PUT, DELETE | Read, update, or delete a company |

### Utilities

| Endpoint | Method | Description |
|---|---|---|
| `/api/prompts` | GET | List prompt templates |
| `/api/prompts/[id]` | GET | Get a specific prompt template |
| `/api/image-search` | GET | Search Pexels for stock images |
| `/api/image-proxy` | GET | Proxy external images to avoid CORS issues |

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

---

## Technology Stack

| Component | Technology |
|---|---|
| **Framework** | Next.js (Pages Router) |
| **Language** | TypeScript |
| **Database** | Supabase (PostgreSQL) |
| **AI Models** | OpenAI GPT-5.1, GPT-4.1, GPT-4.1-nano, GPT-4o-mini, o3, gpt-image-1 |
| **Image Search** | Pexels API |
| **Publishing** | WordPress REST API |
| **HTML Parsing** | cheerio (for reference article scraping) |
| **Rich Editor** | React-based WYSIWYG with HTML mode |

---

## Key Design Decisions

1. **Base Engine vs. Company-Specific**: Universal rules (anti-AI, AEO/GEO, specificity) apply to all companies. Voice, tone, content depth, and formatting are company-specific via editorial guidelines and voice profiles.

2. **Editorial Guidelines Take Precedence**: The base engine's length rules explicitly defer to company editorial guidelines when present, allowing companies like Boundless to demand rich, long-form content while others may prefer brevity.

3. **Reference Articles as Few-Shot Examples**: Instead of manually copying article excerpts, companies can add URLs. The system auto-fetches, parses (via cheerio), caches (24h TTL), and injects article content as gold-standard references in the system prompt.

4. **Voice Profile as Structured Data**: Voice profiles are not free-text — they're structured JSON with specific fields (tone descriptors, sentence rhythm, banned phrases, specificity rules, etc.) that compile into deterministic prompt instructions.

5. **Image Styles are Company-Owned**: No hardcoded global image styles. Each company defines its own styles via the Custom Image Styles section, giving full control over visual brand identity.
