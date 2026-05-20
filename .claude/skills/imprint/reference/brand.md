# Brand methodology

The big picture: how the pieces fit together. Every other reference doc plugs into a stage of the pipeline described here. When in doubt, this is the spine.

## Prompt assembly order

The order matters. Each layer shapes what comes next. This sequence is what makes the output sound like a knowledgeable practitioner instead of a content agency.

```
1.  Identity              ← brand name + tagline + archetype
2.  Editorial credibility ← anti-AI rules (HIGHEST PRIORITY — overrides voice)
3.  First sentence quality
4.  Specificity over generality
5.  Length & padding      ← no filler, depth preserved
6.  On-page architecture  ← TOC, headings, ID strategy
7.  Structure & extraction← quotable openings, FAQ, Key Takeaways
8.  SEO targeting
9.  Sources & attribution ← inline hyperlinks, source hierarchy
10. Freshness signals
11. Structured data       ← FAQ schema, HowTo schema
12. Unique insight        ← what no other source provides
13. Internal linking
14. Company editorial guidelines  ← from BRAND.md
15. Company SEO guidelines        ← from BRAND.md
16. Banned phrases        ← merged base + company-specific
17. Voice profile overlay ← from VOICE.md
18. Reference articles    ← few-shot RAG (optional)
```

The base layers (1–13) are universal. Layers 14–18 are company-specific overlays. Editorial credibility (layer 2) and banned phrases (layer 16) are the only places where company input can *block* base rules — and even there, only to add restrictions, never to remove the credibility floor.

## Roles and inputs

| Input | Owns | Mutable? |
|---|---|---|
| `reference/*.md` | Universal methodology. The 200+ banned phrases, the AEO/GEO/SEO rules, the humanization patterns. | Versioned with the skill; users don't edit. |
| `BRAND.md` | Brand identity: name, tagline, mission, archetype, audiences, editorial guidelines, SEO guidelines, additional banned phrases. | Authored once per brand via `teach`. |
| `VOICE.md` | Structured voice profile: tone descriptors, sentence rhythm, vocab, POV, sample phrases, voice-specific bans. | Authored once per brand via `voice`. |
| `VISUAL.md` | Photography style, image-style categories, design tokens. | Authored once per brand via `style`. |

The skill loads all three, layers them onto the universal methodology, and compiles a context that's specific enough to ship and durable enough to reuse.

## Editorial credibility (the floor)

This is the part that distinguishes `imprint` from generic AI content. Every other layer can be tuned per brand; credibility cannot be tuned down.

### What credibility means in practice

- **Report facts, not feelings.** "The cost is $1,500" beats "Don't worry, it's affordable."
- **Specifics, not generalities.** "Processing times increased from 6 to 14 months" never becomes "processing has slowed significantly."
- **Sourced or qualified.** Every factual claim about rules, fees, or timelines has an inline link to the authoritative source — or it's qualified ("varies by state," "check the official site").
- **No dramatic framing.** "Brace yourself for a wait" → "Expect the process to take a year or more."
- **No motivational framing.** Save it for the homepage. Articles report, they don't pep-talk.
- **No emotional address.** "You've got this," "Don't worry," "Rest assured" — all out.

### The LinkedIn test

If you can imagine the sentence appearing as a LinkedIn influencer post — with light-bulb emojis, vague urgency, and zero specifics — cut it. The test catches more AI tells than any pattern-matcher.

## First sentence quality

Single highest-leverage edit in the article. AI almost always opens with generic framing. Fix this aggressively.

### Patterns to eliminate

- "When it comes to [topic]..."
- "If you're looking for / considering / planning..."
- "[Topic] is an important / complex / significant..."
- "Understanding [topic] is crucial..."
- "In today's world / landscape / environment..."
- "Are you ready to / wondering about..."

### What a good first sentence does

- States a specific, verifiable fact
- Cites a surprising statistic or recent change
- Puts the reader in the middle of a concrete scenario
- Demonstrates expertise in the first 15 words

### Example fixes

| Bad | Good |
|---|---|
| Solar energy is an important pathway for homeowners looking to reduce their electricity bills. | Residential solar installations in Washington state dropped 22% in cost since 2023, but permitting delays now average 47 days — triple the national median. |
| If you're considering a home renovation, understanding your options is essential. | The average kitchen remodel in Seattle costs $38,400 in 2026, but three overlooked permit requirements add $4,000–$7,000 that most contractors don't mention upfront. |

## Structure & extraction

Long-form content needs structure that aids both readers and AI extraction systems (Google's SGE, ChatGPT, Perplexity).

### Quotable section openings (MANDATORY)

Each H2 and H3 begins with a 1-2 sentence factual answer that can be quoted independently. Then elaborate. This is what gets pulled into AI-generated summaries.

### Required sections

| Section | Where | Why |
|---|---|---|
| **Key Takeaways** | After intro, before TOC | 3-5 factual bullets. AI extraction systems index these heavily. |
| **Table of Contents** (optional, brand toggle) | After intro / Key Takeaways | Anchor-linked H2s. Improves dwell time and section-level indexing. |
| **Frequently Asked Questions** | Bottom of article | MANDATORY for long-form. 3-5 H3 questions + paragraph answers. Powers FAQPage schema. |

### Each H2 is a self-contained topical unit

It should target its own keyword and answer its own question without requiring context from neighboring sections. This is how search engines index sections independently for their respective queries.

### Bans

- Padded introductions ("In this article, we'll cover...")
- Redundant summary sections
- Rhetorical-question transitions ("But what does this mean for you?")
- Restated headings

## Where to go next

| You want to... | Read |
|---|---|
| Author a brand profile | `reference/teach.md`, `examples/example-brand/BRAND.md` |
| Analyze voice from samples | `reference/voice.md` |
| Write a single article | `reference/article.md`, then `seo.md`, `aeo.md`, `geo.md`, `humanization.md` |
| Generate a topical cluster | `reference/cluster.md` |
| Compose an image prompt | `reference/image-prompts.md`, `visual.md` |
| Compose a video spec | `reference/video-spec.md` |
| Humanize existing content | `reference/humanization.md` |
| Three-model fact-check | `reference/factcheck.md` |
| Score content quality | `reference/evals.md` |
| Understand the banned phrase list | `reference/banned-phrases.md` |
