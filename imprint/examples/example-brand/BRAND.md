---
name: "Greencard Law"
tagline: "Practical immigration help for people who would rather not need a lawyer."
mission: "Make immigration law legible to people going through it, without losing the precision lawyers need."
archetype: "guide"
tone_axes:
  - direct
  - precise
  - calm
  - non-condescending
  - slightly skeptical
audiences:
  applicant:
    needs:
      - "Plain-language explanation of what each form does"
      - "Realistic timelines, not best-case marketing numbers"
      - "Specific next steps they can take this week"
    positioning: "Treated as an adult who can handle real information."
  paralegal:
    needs:
      - "Citation-grade specifics"
      - "Edge-case coverage"
      - "Current processing-time data"
    positioning: "Treated as a working professional who needs reference-quality answers."
editorial_guidelines: |
  Every article is built around real specifics: exact form numbers, processing times by service center, dollar amounts, regulatory citations. We do not round; we use the actual number. When something varies, we say what it varies with.

  Voice is calm and direct. We never reassure, never patronize, never hype. The reader knows they have a problem; our job is to explain how the system actually works.

  Long-form articles run 2,000-3,500 words. Each section answers a specific question. We use H2s for major sections, H3s within. Every section opens with a factual answer that could be quoted independently.

  We link to USCIS, the Department of State, federal regulations (8 CFR), and adjudication policy memos. When a claim can't be sourced, we say so explicitly rather than making it sound definitive.

  Banned topics: aspirational framing ("your American dream"), reassurance ("don't worry"), travel-brochure phrasing ("land of opportunity"), urgency manipulation ("act now before policy changes"), and any sentence that could appear on a LinkedIn-influencer post.
seo_guidelines: |
  Primary keyword goes in H1, first 100 words, meta_title, slug, and at least one H2. Every secondary keyword that represents a distinct subtopic gets its own H2 or H3 with a header that matches the search query closely.

  Every long-form article ends with a Frequently Asked Questions section using <h3>Question?</h3><p>Answer.</p> immediately adjacent — that exact structure powers FAQPage schema extraction. At least one FAQ addresses regional variation (service center, state-level policy, or processing-time geography).

  Internal links use keyword-rich anchor text matching the target page's primary keyword. Never "click here", never "read more". 3-8 internal links per article.
avoid_phrases:
  - "navigate the process"
  - "navigate the complexities"
  - "your journey"
  - "your American dream"
  - "land of opportunity"
  - "we're here to help"
  - "rest assured"
  - "don't worry"
  - "embark on"
  - "groundbreaking"
reference_articles:
  - "https://example.com/sample-article-one"
  - "https://example.com/sample-article-two"
auto_humanize: true
include_toc: true
eval_weights:
  voice: 15
  seo: 10
  aeo: 15
  geo: 20
  factuality: 35
  humanization: 5
publish_threshold: 85
---

# Greencard Law

This is the BRAND.md for our example brand. The file's frontmatter is the structured profile that the imprint skill loads; the markdown body below is for humans (notes, context, links to related docs).

## About this example

This fixture demonstrates a real-world BRAND.md for a YMYL (your money, your life) brand serving immigration applicants. Note:

- `eval_weights` are tuned for YMYL: factuality at 35%, voice at 15%. For non-YMYL brands, use the defaults from the schema.
- `publish_threshold: 85` is higher than the default 80 because YMYL content has lower tolerance for borderline quality.
- `avoid_phrases` extends the universal banned list with brand-specific patterns ("your American dream", "navigate the complexities").
- `editorial_guidelines` and `seo_guidelines` are prose; they get injected as MANDATORY sections of the system prompt.

## Working with this brand

To generate an article for this brand:

```
/imprint article "I-130 processing times by service center in 2026"
```

The skill will:
1. Load this BRAND.md
2. Load VOICE.md (if present) for voice overlay
3. Compose the system prompt (universal methodology + brand overlays)
4. Generate, humanize, fact-check
5. Emit a complete article ready for `polish` and `publish`
