---
name: "Organic"
tagline: "Sound like your brand. Not like AI."
mission: "Turn one prompt into on-brand articles, content clusters, and editorial images — without the AI cream. Voice profiles, three-model fact-checking, and visual style matching, in one studio."
archetype: "creator"
tone_axes:
  - direct
  - plainspoken
  - slightly skeptical
  - confident
  - editorial
audiences:
  content_ops:
    needs:
      - "A toolchain that scales across multiple brand voices without breaking each one"
      - "Real proof the output won't sound like every other AI tool"
      - "Operational answers: per-article cost, throughput, multi-brand seat economics"
      - "Integrations that fit existing CMS and publishing workflows"
    positioning: "Treated as operators, not buyers. Their problem is throughput and brand fidelity at the same time. Show the pipeline, show the math, show real generated artifacts — not feature lists."
  founders_executives:
    needs:
      - "The 60-second version of why this beats hand-rolled stacks or generic AI"
      - "Clear understanding of what's open source (imprint methodology) vs hosted (Organic SaaS)"
      - "Conviction that the underlying methodology has real depth"
      - "ROI framing that holds up under scrutiny"
    positioning: "Time-poor, scan-first. The hero answers their question before they finish reading it. Specifics anchor everything; the methodology behind the claims is one click away (imprint repo, PRODUCT.md, docs)."
editorial_guidelines: |
  Every Organic article, post, or marketing surface is built around real specifics: model names, exact processing times, exact pipeline stages, exact dollar amounts, exact source citations. We do not round; we use actual numbers. When something varies, we say what it varies with.

  Voice is direct, plainspoken, and slightly skeptical — particularly of the AI-content industry's clichés and the patterns we explicitly humanize against. We never reassure, never patronize, never hype. We never sound like a LinkedIn influencer post. We don't address the reader's emotions; we report facts and explain processes.

  Long-form articles run 1,800-3,500 words. Each section answers a specific question with a quotable opening sentence. We use H2s for major sections, H3s within. Every section opens with a factual answer that could be quoted independently — both because that's good writing and because that's how AI summarizers extract.

  We link to source documentation: the imprint repo for methodology claims, OpenAI/Anthropic/Google model cards for model-behavior claims, BLS/agency pages for market data. When a claim can't be sourced, we say so explicitly rather than making it sound definitive.

  Editorial typography uses ABC Arizona Flare for display headlines (italic emphasis carries the em weight), Arizona Sans for body, Arizona Mix italic for the rare kicker. Section bands alternate between paper and stone gray. The color system is intentionally restrained — paper, ink, with one optional accent at a time. Loud color choices belong on campaign surfaces, not in editorial flow.

  Banned topics for Organic content: "the future of AI content" hand-waving, "transform your content strategy" hype, "your AI journey" anything, before/after comparisons that aren't real, motivational framing about content marketing.
seo_guidelines: |
  Primary keyword goes in H1, first 100 words, meta_title, slug, and at least one H2. Every secondary keyword that represents a distinct subtopic ("voice profile vs voice clone", "AEO vs SEO", "GEO ranking factors") gets its own H2 or H3 with a header that matches the search query closely.

  Every long-form article ends with a Frequently Asked Questions section using <h3>Question?</h3><p>Answer.</p> immediately adjacent — that exact structure powers FAQPage schema extraction. At least one FAQ addresses the imprint-vs-Organic distinction so search-driven readers understand the open-source-to-hosted path.

  Internal links use keyword-rich anchor text matching the target page's primary keyword. Never "click here", never "read more". 3-8 internal links per article. Internal link map for a piece on "voice profiles" should connect to: imprint's voice.md reference, the voice analysis API page, the model bake-off page, and one cluster page on humanization.

  Inline citations to the imprint GitHub repo, our changelog, and external sources (model providers, research papers, industry data). Aim for 4-8 hyperlinked sources per long-form article.
avoid_phrases:
  - "your AI journey"
  - "the future of AI content"
  - "AI-powered" # (we ARE AI; this is empty)
  - "transform your content strategy"
  - "unlock the power of"
  - "game-changing"
  - "revolutionizing content"
  - "your content needs"
  - "elevate your brand"
  - "supercharge"
  - "boost your"
  - "next-generation"
  - "cutting-edge AI"
reference_articles: []
auto_humanize: true
include_toc: true
eval_weights:
  voice: 25
  seo: 15
  aeo: 15
  geo: 15
  factuality: 20
  humanization: 10
publish_threshold: 85
---

# Organic — Brand Profile

This is BRAND.md for Organic, PSL's AI content platform. The frontmatter is the structured profile that the imprint skill loads at runtime; this body is for human readers.

## At a glance

- **Archetype**: Creator. Editorial confidence, typographic risk welcome, opinionated about what AI content should and shouldn't look like.
- **Audience**: Content ops + founders/executives. Both are time-poor; both need specifics.
- **Voice**: Direct, plainspoken, slightly skeptical (especially of AI-content clichés), confident without hedging, editorial in its sensibility.
- **Threshold**: 85/100 composite audit score required to publish (vs the default 80). Organic's whole pitch is content quality; our own content has to clear a higher bar.

## What's NOT in this file (and where to go for it)

- **Voice profile**: run `/imprint voice https://organic.dev/blog/<good-piece>` once we have a published gold-standard article. Until then, the archetype + tone_axes here are the fallback.
- **Visual style**: run `/imprint style` on the new homepage. The visual system there (ABC Arizona super-family, paper + stone surfaces, italic-as-emphasis) is the source.
- **Pricing, features, MCP catalog, engine architecture**: see `PRODUCT.md` at the repo root. That's the product description; this BRAND.md is the editorial direction layered on top.

## Why eval_weights are tuned this way

- Voice match weighted 25% (above default 20%): Organic's reputation IS the voice. If our content sounds like other AI tools, we've failed the pitch.
- Factuality 20% (default): we make specific claims about pipeline stages, model behavior, performance — those need to be right.
- SEO/AEO/GEO 15% each: important but secondary to voice + factuality for a brand whose product IS content quality.
- Humanization 10%: lower than default because the universal humanization list is already applied; this dimension catches what slipped through.

## How this BRAND.md gets used

Every `/imprint` command loads this file. The system prompt assembly order is in `imprint/skill/reference/brand.md` (skill methodology). Specifically:

1. Identity (name, tagline) → from this file
2. Editorial credibility (universal anti-AI rules)
3. First-sentence quality (universal)
4. Specificity (universal)
5. Length, structure, SEO, sources, freshness, schemas (universal)
6. Unique insight (universal)
7. **Company SEO guidelines** → from this file (`seo_guidelines`)
8. **Company editorial guidelines** → from this file (`editorial_guidelines`)
9. **Banned phrases** → universal list + `avoid_phrases` from this file (merged + de-duped)
10. **Voice profile overlay** → from VOICE.md when present
