# polish

Final brand pass. Voice match, banned phrase sweep, schema validation, schema markup check. Apply the recommended fixes from `audit`.

## Command workflow

When invoked as `/imprint polish <file>`:

1. Load BRAND.md + VOICE.md
2. If `<file>.audit.json` exists and is recent, use its priority_fixes; otherwise run audit inline first
3. Apply fixes systematically, dimension by dimension
4. Re-run audit on the polished version
5. Emit polished file + new audit report
6. Summarize in chat: composite score before/after, what changed

Polish modifies the file in place by default. Use `--out=<path>` to write a sibling.

## What polish fixes

In priority order:

### 1. Banned phrases (zero-tolerance)

Sweep the article for any phrase in:

- Universal banned list (`banned-phrases.md`)
- BRAND.md `avoid_phrases`
- VOICE.md `banned_phrases`

For each match: rewrite the sentence preserving meaning, using VOICE.md as the voice anchor.

### 2. First sentence quality

If the opening matches any AI pattern from `humanization.md`, rewrite. The replacement must:

- Be specific and verifiable
- Demonstrate expertise in the first 15 words
- Match VOICE.md tone

### 3. Em dashes

Replace closed em dashes (`word—word`) with spaced em dashes (`word — word`) OR swap most for commas/periods. Target: at most 1 em dash per 500 words.

### 4. AEO structure

- FAQ uses `<h3>` for questions and `<p>` for answers, immediately adjacent (no nested elements between)
- Each H2 opens with a quotable factual answer
- Key Takeaways present if length warrants

### 5. Source citation density

If GEO score is below threshold, add inline citations for:

- Cost figures (with year)
- Timelines (with effective date)
- Statistics (with source)
- Regulatory claims (with citation)

Use the source hierarchy from `geo.md`.

### 6. Schema markup

Generate JSON-LD for:

- Article schema (always)
- FAQPage schema (if FAQ present)
- HowTo schema (if procedural content with `<ol>` present)
- Breadcrumb schema (if cluster context available)

Embed in `<script type="application/ld+json">` tags in the HTML head.

### 7. Voice patterns

If VOICE.md `sample_phrases` are present and the article uses none, attempt to inject 1-2 in natural positions (typically section openings or transition moments). Do NOT force.

## What polish does NOT do

- Does not change the article's substance or argument
- Does not add new sources (only embeds existing claims with citations if the source URL is in BRAND.md `reference_articles` or detectable from the text)
- Does not run the fact-check council (use `factcheck` separately)
- Does not regenerate sections wholesale (use `humanize` or regenerate the article)

## Output

Polished file + `<file>.audit.json` (updated). Summary in chat:

```
polish complete

before: composite 73/100 (voice 82 / seo 91 / aeo 73 / geo 68 / factuality 90 / humanization 76)
after:  composite 88/100 (voice 89 / seo 94 / aeo 91 / geo 84 / factuality 90 / humanization 87)

fixes applied:
  - 3 banned phrases rewritten
  - first sentence rewritten (was "When it comes to...")
  - 7 em dashes replaced with commas/periods
  - FAQ reformatted to <h3> tags
  - 4 inline citations added (CDC, ADA, BLS, USCIS)
  - schema markup generated (FAQPage + Article)

run `/imprint publish <file>` to emit final HTML + JSON-LD bundle.
```

## Re-runs

Polish is idempotent for most fixes — running twice produces the same result. The only place re-running helps is if VOICE.md was updated between runs.

If polish is recommended a second time (composite still <85 after first polish), the article likely needs `humanize` or a regeneration pass, not another polish.

## Confirmation flow

Before applying fixes that change article semantics (banned-phrase rewrites, first-sentence rewrite), surface the diff per fix:

```
fix 1 of 3 — banned phrase "navigate the process"

  before: "...help applicants navigate the process of filing an I-130..."
  after:  "...help applicants file an I-130..."

apply? [Y/n/edit]
```

Auto-apply mode (`--yes`) skips per-fix confirmation. Default: confirm.

## Confirmation flow for schema embedding

Schema markup is automatically generated and embedded. No confirmation needed — it's mechanical translation of existing content into JSON-LD.
