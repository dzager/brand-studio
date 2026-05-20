# article — generate a long-form article

End-to-end pipeline: brand engine → write → humanize → fact-check → emit. The signature command.

## Setup

BRAND.md required. VOICE.md strongly recommended (the article will be visibly worse without it). VISUAL.md optional (only matters if hero image is requested).

If BRAND.md is missing, run `teach` first and resume.

## Pipeline

```
1. Compose system prompt from BRAND.md + universal methodology + VOICE.md overlay
2. Compose user prompt from topic + content type + length target
3. Generate draft via the target model
4. Humanize (separate pass — see humanization.md)
5. Fact-check via three-model council (see factcheck.md)
6. Compose hero image prompt (see image-prompts.md) — if VISUAL.md is present
7. Emit final HTML + frontmatter + image prompt
```

Each stage is a separate model call. Don't try to do it in one — generation, humanization, and verification each have their own goals and the model performs differently when focused.

## Inputs

User supplies:

- **Topic** (required): one-line description of what the article covers
- **Primary keyword** (optional, auto-derived from topic if absent): the search query to rank for
- **Content type** (optional, default: `guide`): one of `guide`, `how_to`, `comparison`, `news_explainer`, `case_study`, `listicle`
- **Length target** (optional): `short` (300-500), `medium` (800-1,200), `long` (1,500-2,500), `deep_dive` (2,500-4,000), or `no_limit`
- **Image style** (optional, from VISUAL.md): named style category for the hero image

## System prompt composition

The system prompt is built in this order (the assembly is in `reference/brand.md`):

1. Identity (brand name + tagline)
2. Editorial credibility (highest priority — overrides voice)
3. First sentence quality
4. Specificity over generality
5. Length & padding rules
6. On-page architecture
7. Structure & extraction
8. SEO targeting
9. Sources & attribution
10. Freshness signals
11. Structured data
12. Unique insight
13. Internal linking
14. Company SEO guidelines (from BRAND.md)
15. Company editorial guidelines (from BRAND.md)
16. Banned phrases (universal + brand-specific, merged + de-duped)
17. Voice profile clause (from VOICE.md)

## User prompt composition

The user prompt carries:

- The topic and content type
- Length target
- Primary + secondary keywords (auto-derived or supplied)
- Reference article context (few-shot) if BRAND.md lists reference articles
- Cluster context (if the article is part of a cluster — see `cluster.md`)
- Required output schema (article HTML, title, excerpt, meta_title, meta_description, slug, FAQ section, key takeaways, image prompt)

## Output schema

```yaml
title: string
slug: string
meta_title: string         # 50-60 chars
meta_description: string   # 150-160 chars
excerpt: string            # 1-2 sentences for cards / previews
html: string               # full article HTML
key_takeaways: [string]    # 3-5 bullets
faq:
  - q: string
    a: string
content_type: string       # echoed back
primary_keyword: string
secondary_keywords: [string]
image_prompt: string       # if VISUAL.md present
image_style: string        # which style category
seo:
  json_ld: object          # Schema.org JSON-LD
  structured_data: object  # FAQPage + Article + optionally HowTo
```

The exact JSON schema is in `schemas/article.schema.json`.

## Humanization pass

Runs after generation, before fact-check. See `humanization.md` for the methodology.

If BRAND.md sets `auto_humanize: true`, runs automatically. Otherwise the user is prompted: "Run humanization? (recommended)".

## Fact-check pass

Runs after humanization, before final emit. See `factcheck.md`.

If the council returns FAIL, the affected claims surface to the user. The article does not auto-publish; the user must rewrite or cut the failed claims and re-check.

If the council returns NEEDS_REVIEW, the disputed claims surface as inline annotations. The user can accept (article publishes with annotations stripped) or rewrite.

## Image pass (optional)

If VISUAL.md is present and the user requested a hero image (default: yes for long-form):

1. Compose image prompt per `image-prompts.md` using BRAND.md + VISUAL.md + the article's topic
2. If `IMPRINT_IMAGE_PROVIDER` is set, call out and embed the image
3. If not, emit the prompt for the user to run through any image tool

## Polish (recommended after emit)

Run `polish` on the output. It does the final brand sweep: voice match score, banned-phrase check, schema validation. Most articles need one polish pass; some need two.

## Confirmation flow

Before generation, confirm:

- Topic understood correctly
- Content type and length target
- Image style (if applicable)
- Estimated cost (if calling external models)

After generation, surface:

- Composite audit score (see `evals.md`)
- Any NEEDS_REVIEW claims from the council
- Suggested polish dimensions

If composite score is below 75, recommend a polish pass before declaring done.

## Error cases

| Error | Handling |
|---|---|
| BRAND.md missing | Run `teach`, resume article |
| BRAND.md placeholder values | Tell the user what fields are missing; ask to complete via `teach` |
| Topic too vague | Ask for clarification before generating |
| Model refuses / safety filter | Surface the refusal; suggest tightening the topic |
| Image provider error | Emit the prompt anyway; flag the image as missing |
| Fact-check FAIL | Block emit; surface failures; offer rewrite assistance |
