# publish

Emit the final publishable bundle: HTML + frontmatter + JSON-LD + image-prompt bundle. CMS-agnostic.

## Command workflow

When invoked as `/imprint publish <file>`:

1. Load BRAND.md + VOICE.md
2. Read the target file + any associated artifacts (`<file>.audit.json`, `<file>.factcheck.json`, `<file>.images/`)
3. Validate: audit composite ≥ 80, factuality has zero FAIL claims (or refuse with explanation)
4. Generate final artifacts:
   - Clean HTML (no draft markers, no annotations)
   - YAML frontmatter (title, slug, meta_title, meta_description, dateModified, dateCreated, author, tags, etc.)
   - JSON-LD (Article + FAQPage + HowTo + Breadcrumb as applicable)
   - Image prompt bundle (if VISUAL.md present and images haven't been generated yet)
5. Emit to `out/<slug>/`

`publish` does NOT push to a CMS. It produces the bundle; the CMS integration is the user's responsibility (WordPress REST API, Webflow, manual paste, etc.).

## Validation gates

Block publish on:

- Audit composite below `BRAND.md publish_threshold` (default 80)
- Any factuality FAIL claims
- Missing required frontmatter fields (title, slug, meta_title, meta_description)
- Banned phrases present
- Broken internal link slugs (slugs referenced that don't exist in the linkmap)

Warn but don't block on:

- Audit composite 80-89 (suggest one more polish pass)
- More than 2 NEEDS_REVIEW factuality claims
- meta_title / meta_description outside target length ranges
- Image prompts not yet rendered (warn that hero image is missing)

## Output structure

```
out/<slug>/
├── article.html              # final article
├── article.md                # markdown source
├── frontmatter.yaml          # CMS-friendly metadata
├── schema.json               # JSON-LD as JSON
├── images/
│   ├── hero.png              # if generated
│   └── hero.prompt.txt       # always emitted
├── checksums.json            # SHA-256 of every artifact (for cache validation)
└── publish.json              # the bundle manifest
```

## Frontmatter format

```yaml
title: "How Marriage-Based Green Cards Are Processed in 2026"
slug: "marriage-based-green-card-2026"
meta_title: "Marriage-Based Green Cards 2026: Timeline & Cost"
meta_description: "Marriage-based green cards take 14-38 months in 2026. Service center, form combination, and three other factors drive the variance. Here's the breakdown."
excerpt: "Marriage-based green cards take 14 to 38 months in 2026. Service center makes the difference."
date_created: 2026-05-14
date_modified: 2026-05-14
author:
  name: "Sample Author"
  url: "/team/sample-author"
  job_title: "Senior Editor"
tags: [immigration, green-card, family-immigration]
canonical: "/marriage-based-green-card-2026"
og:
  title: "Marriage-Based Green Cards 2026: Timeline & Cost"
  description: "..."
  image: "/images/marriage-based-green-card-2026/hero.png"
cluster:
  id: marriage-based-green-cards
  role: pillar
content_type: guide
primary_keyword: "marriage-based green card"
secondary_keywords:
  - "I-130 processing time"
  - "marriage green card cost"
  - "AOS vs consular processing"
```

## JSON-LD bundle

Emit a `schema.json` containing all applicable schemas:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Article", "...": "..." },
    { "@type": "FAQPage", "...": "..." },
    { "@type": "HowTo", "...": "..." },
    { "@type": "BreadcrumbList", "...": "..." }
  ]
}
```

Embed the same JSON in the article's HTML `<head>`:

```html
<script type="application/ld+json">
  { ...same JSON... }
</script>
```

## Image bundle

If VISUAL.md is present and the hero image has been rendered (`<file>.images/hero.png` exists), copy it into the output bundle.

If the hero image is a prompt only (no provider was configured during generation), copy the prompt to `images/hero.prompt.txt`. The CMS integration is responsible for running the prompt through whatever tool the team uses.

## Cluster manifest

If the article is part of a cluster, publish also emits/updates `out/cluster-<cluster_id>/manifest.yaml`:

```yaml
cluster_id: marriage-based-green-cards
articles:
  - slug: marriage-based-green-card-2026
    role: pillar
    published_at: 2026-05-14
    audit_score: 92
  - slug: i-130-petition-processing-times
    role: supporting
    published_at: 2026-05-13
    audit_score: 88
  # ...
linkmap: { ... }   # from cluster.md
```

This manifest is read by `audit --cluster` and `cluster --score`.

## Confirmation flow

Before emitting the final bundle, summarize:

```
publish: marriage-based-green-card-2026

validation:
  ✓ audit composite 92/100 (threshold 80)
  ✓ factuality: pass (0 fail, 0 needs_review)
  ✓ all required frontmatter fields present
  ✓ no banned phrases
  ✓ all internal link slugs resolve

artifacts:
  article.html         18.4 KB
  article.md           14.7 KB
  frontmatter.yaml      1.2 KB
  schema.json           2.9 KB
  images/hero.png      842 KB
  publish.json          0.5 KB

confirm to write to out/marriage-based-green-card-2026/? [Y/n]
```

After confirmation, write the bundle and return the path. Print the next-step suggestions:

```
out/marriage-based-green-card-2026/ ready.

upload paths:
  WordPress: POST article.html + frontmatter to /wp-json/wp/v2/posts
  Webflow:   import via the CMS API with frontmatter as field values
  Markdown CMS: drop article.md into your content directory
```

## CMS integrations (future)

`publish --target=wordpress --url=https://example.com/wp-json/wp/v2/posts` is v1.1. The bundle as described above is the v1 deliverable; integrations consume it.
