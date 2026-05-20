# Evaluation rubric

Scoring methodology for content quality. Six dimensions, 0-100 per dimension. Used by `audit` to produce a quantitative score and by `polish` to identify what to fix.

## Six dimensions

| Dimension | Owns | Reference |
|---|---|---|
| **Voice match** | How closely the output matches VOICE.md | `voice.md`, `banned-phrases.md` |
| **SEO compliance** | On-page SEO best practices | `seo.md` |
| **AEO readiness** | Extraction-readiness for AI summarizers | `aeo.md` |
| **GEO citation-worthiness** | Likelihood to be cited by generative engines | `geo.md` |
| **Factuality** | Claim-by-claim accuracy | `factcheck.md` |
| **Humanization** | Absence of AI patterns | `humanization.md` |

Each scored 0-100. Composite score is the weighted average (defaults below).

## Default weights

```yaml
weights:
  voice: 20
  seo: 15
  aeo: 15
  geo: 20
  factuality: 20
  humanization: 10
```

Total = 100. Weights are configurable in BRAND.md under `eval_weights:`.

For YMYL content, recommended weights:

```yaml
weights:
  voice: 10
  seo: 10
  aeo: 15
  geo: 20
  factuality: 35   # higher
  humanization: 10
```

## Per-dimension rubric

### Voice match

Measures how closely the output matches VOICE.md.

| Score | Definition |
|---|---|
| 90-100 | Reads exactly like the brand. Would pass a blind test against existing brand content. |
| 75-89 | Mostly on-brand. 1-2 fields from VOICE.md are weakly applied. |
| 60-74 | Recognizable as the brand but with noticeable AI-cream patterns. |
| 40-59 | Generic professional voice. The brand's specificity is absent. |
| 0-39 | No voice match. Reads like any AI content. |

Scoring inputs:

- **Banned phrase matches** (any in `banned-phrases.md` + VOICE.md `banned_phrases`): -3 per match
- **Tone descriptor adherence**: per-axis 0-10, summed and normalized
- **Sample phrase echo**: presence of phrases similar to VOICE.md `sample_phrases`: +5 per close match
- **Rhetorical device usage**: presence of VOICE.md `rhetorical_devices`: +2 per device
- **POV consistency**: penalize POV drift mid-article: -10 per drift
- **Sentence rhythm match**: compare actual rhythm to VOICE.md `sentence_rhythm`: 0-15

### SEO compliance

Measures on-page SEO best practices.

| Score | Definition |
|---|---|
| 90-100 | Every checkbox in `seo.md` audit passes. Top-3 SERP-competitive structure. |
| 75-89 | Most checkboxes pass. 1-3 minor misses. |
| 60-74 | Most basics covered, some structural gaps. |
| 40-59 | Major gaps (no FAQ, no structured headings, no inline citations). |
| 0-39 | Failed checklist. Unrankable as-is. |

Scoring inputs (each 0-10, summed and normalized):

- Primary keyword placement (H1, first 100 words, meta_title, slug, ≥1 H2)
- meta_title length 50-60 chars and click-optimized
- meta_description 150-160 chars with primary keyword
- H2/H3 hierarchy clean, descriptive headings
- Quotable openings on every H2
- 5-15 secondary keywords each with dedicated section
- Featured snippet target present in correct format
- 4+ inline hyperlinked source citations
- 3-8 internal links with keyword-rich anchor text
- FAQ section (H3 > p pairs)
- HowTo `<ol>` if procedural

### AEO readiness

Measures extraction-readiness for AI summarizers.

| Score | Definition |
|---|---|
| 90-100 | Every section starts with a quotable answer. All required schemas extractable. Entity graph clean. |
| 75-89 | Most sections inverted-pyramid; 1-2 sections need quotable openings. |
| 60-74 | Some inverted-pyramid; FAQ may be misformatted for schema. |
| 40-59 | Major structural gaps. Buried answers. FAQ missing or malformed. |
| 0-39 | Pre-AEO structure. Won't extract cleanly. |

Scoring inputs:

- Inverted pyramid (article-level + section-level): 0-25
- Quotable openings on every H2: 0-20
- Key Takeaways section present + 3-5 specific bullets: 0-10
- FAQ section format correctness (H3 > p pairs, immediately adjacent): 0-15
- Geo-targeted FAQ presence when topic warrants: 0-5
- HowTo `<ol>` for procedural content: 0-5
- Entity consistency (full names, no synonym cycling): 0-10
- Section self-sufficiency: 0-10

### GEO citation-worthiness

Measures likelihood of being cited by generative engines.

| Score | Definition |
|---|---|
| 90-100 | Strong citation pool. Fresh data. Unique insight clear. Author + credentials visible. |
| 75-89 | Good citations. One of (freshness, unique insight, author markup) is light. |
| 60-74 | Adequate citations. Limited unique insight; weak freshness signals. |
| 40-59 | Few citations or generic ones. Pure synthesis with no unique angle. |
| 0-39 | Unsourced or weakly sourced. Will not be cited. |

Scoring inputs:

- Source count (4+ for non-YMYL, 8+ for YMYL): 0-15
- Source quality (per the source hierarchy in `geo.md`): 0-15
- Anchor text specificity: 0-5
- Linked-to-specific-pages-not-homepages: 0-10
- Freshness signals (current year, "as of" dates, last-change notes): 0-10
- Unique insight pattern present (decision framework / statistical breakdown / edge cases / practitioner guidance / cost-benefit table / original synthesis): 0-25
- Author markup + visible byline + credentials: 0-15
- `dateModified` accuracy: 0-5

### Factuality

Measures claim-by-claim accuracy via the three-model council (see `factcheck.md`).

| Score | Definition |
|---|---|
| 95-100 | Council PASS: 95%+ claims accurate, zero fails |
| 80-94 | NEEDS_REVIEW: 80-94% accurate, 0-5% fails |
| 60-79 | One or more fails, requires substantive rewrite |
| 0-59 | Multiple fails or majority unverifiable |

The factuality score is the article-verdict mapped to a 0-100 scale; it's not a separate calculation.

### Humanization

Measures absence of AI patterns.

| Score | Definition |
|---|---|
| 90-100 | Reads as human-written. No detectable AI patterns. Voice varies. |
| 75-89 | 1-2 minor AI patterns. Easily fixable. |
| 60-74 | Several AI patterns. Article reads as AI-edited but recognizable. |
| 40-59 | Heavy AI patterns. Reads as AI-generated. |
| 0-39 | Unhumanized AI output. |

Scoring inputs (per `humanization.md`):

- First sentence quality: 0-15
- Banned phrase matches: -3 per match (cap -30)
- -ing pattern overuse: -2 per match (cap -10)
- Em dash usage: -1 per unspaced em dash, -0.5 per em dash beyond 1 per 500 words
- Rule-of-three forced lists: -2 per match (cap -10)
- Sentence rhythm variance (standard deviation of sentence length): 0-15
- Negative parallelism overuse: -2 per match (cap -8)
- Generic positive conclusion present: -10
- "Challenges and Future Prospects" formulaic section present: -10
- Collaborative artifacts (I hope this helps, Of course!, Great question!): -5 per match (cap -20)

## Composite scoring

```
composite_score = 
  (voice_match × 0.20) +
  (seo × 0.15) +
  (aeo × 0.15) +
  (geo × 0.20) +
  (factuality × 0.20) +
  (humanization × 0.10)
```

| Composite | Rating |
|---|---|
| 90-100 | Publish-ready. Ship. |
| 80-89 | Strong. Polish recommended; nothing blocking. |
| 70-79 | Solid draft. Fix the lowest-dimension issues before publishing. |
| 60-69 | Needs work. Multiple dimensions below threshold. |
| <60 | Substantial rewrite required. |

## What audit produces

The `audit` command emits a structured report:

```yaml
file: article.md
composite_score: 78
dimensions:
  voice_match: { score: 82, top_issues: [...] }
  seo: { score: 91, top_issues: [...] }
  aeo: { score: 73, top_issues: [...] }
  geo: { score: 68, top_issues: [...] }
  factuality: { score: 90, top_issues: [...] }
  humanization: { score: 76, top_issues: [...] }
priority_fixes:
  - { dimension: geo, issue: "Only 3 source citations; need 4+", fix: "Add inline citations for the cost figures in section 3 and the timeline in section 4" }
  - { dimension: aeo, issue: "Section 'Why It Matters' opens with throat-clearing", fix: "Lead with the factual answer; move the framing sentence to position 2-3" }
  ...
```

Each `top_issue` is line-numbered when possible.

## Iterating to a target

A common workflow: run `audit`, get a composite of 73, target 90+. The skill suggests the highest-impact dimension to improve. Re-run `audit` after each polish pass to confirm the score moved.

A composite of 90+ on the first pass is rare. 75-85 first pass, 88-95 after one polish round is typical.
