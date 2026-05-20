# audit

Quantitative content audit. Six dimensions, 0-100 per dimension, composite weighted score. See `evals.md` for the rubric details.

## Command workflow

When invoked as `/imprint audit <file>`:

1. Load BRAND.md + VOICE.md (the rubric needs the brand's specifics to score voice match and banned-phrase compliance)
2. Read the target file
3. Score each of six dimensions
4. Compute composite via weighted average
5. Identify top issues per dimension with line numbers
6. Emit structured report + chat summary

Audit is read-only. It does not modify the file.

## Inputs

- **Target file** (required): markdown or HTML
- **Weights override** (optional): a YAML file or inline JSON to override BRAND.md's eval_weights

## Six dimensions scored

| Dimension | Reference |
|---|---|
| Voice match | `voice.md`, `banned-phrases.md` |
| SEO compliance | `seo.md` |
| AEO readiness | `aeo.md` |
| GEO citation-worthiness | `geo.md` |
| Factuality | `factcheck.md` |
| Humanization | `humanization.md` |

Detailed scoring rubrics for each dimension are in `evals.md`. Don't duplicate them here — load `evals.md` when running audit.

## Composite score

Weighted average. Defaults:

```yaml
weights:
  voice: 20
  seo: 15
  aeo: 15
  geo: 20
  factuality: 20
  humanization: 10
```

Sum = 100. Overrideable via BRAND.md `eval_weights:` or CLI flag.

| Composite | Rating |
|---|---|
| 90-100 | Publish-ready |
| 80-89 | Strong; polish recommended |
| 70-79 | Solid draft; fix lowest dimensions before publishing |
| 60-69 | Multiple dimensions need work |
| <60 | Substantial rewrite |

## Factuality dimension

Factuality is the only dimension that requires LLM calls beyond the audit's own reasoning. The audit either:

- **Re-uses an existing `<file>.factcheck.json`** if one exists from a prior `/imprint factcheck` run
- **Skips factuality scoring** with a clear warning, if no factcheck has been run

The audit does not run a fresh fact-check pass unless explicitly requested with `--full`. Fact-checking is expensive; audit is cheap.

## Output

Structured report at `<file>.audit.json`:

```yaml
file: article.md
audited_at: 2026-05-14T10:30:00Z
composite_score: 78
weights: { voice: 20, seo: 15, aeo: 15, geo: 20, factuality: 20, humanization: 10 }
dimensions:
  voice_match:
    score: 82
    top_issues:
      - { line: 12, issue: "Banned phrase 'navigate the process'", suggestion: "Replace with 'apply for'" }
      - { line: 47, issue: "POV drift to first plural in section 'How USCIS handles...'", suggestion: "Restore third-person POV per VOICE.md" }
  seo:
    score: 91
    top_issues:
      - { issue: "meta_description 162 chars (target 150-160)" }
  aeo:
    score: 73
    top_issues:
      - { line: 89, issue: "Section 'Why It Matters' opens with throat-clearing", suggestion: "Lead with factual answer; move framing sentence to position 2-3" }
      - { issue: "FAQ section uses <h4> for questions; schema extraction expects <h3>" }
  geo:
    score: 68
    top_issues:
      - { issue: "Only 3 source citations; need 4+ for non-YMYL, 8+ for YMYL" }
      - { issue: "No unique-insight pattern present (decision framework, statistical breakdown, edge cases, etc.)" }
  factuality:
    score: 90
    source: "<file>.factcheck.json"
    top_issues:
      - { claim_id: claim-007, issue: "NEEDS_REVIEW — one model dissents on processing-time claim" }
  humanization:
    score: 76
    top_issues:
      - { line: 1, issue: "First sentence opens with 'When it comes to...'", suggestion: "Open with the specific fact from the article's third paragraph" }
      - { line: 64, issue: "Em dash used 7 times in 800 words", suggestion: "Replace 4 with commas or periods" }
priority_fixes:
  # Sorted by impact (which dimension gain you'd get from the fix)
  - { dimension: humanization, fix: "Rewrite first sentence per humanization.md" }
  - { dimension: geo, fix: "Add inline citations for cost figures (section 3) and timeline (section 4)" }
  - { dimension: aeo, fix: "Reformat FAQ section to use <h3> tags (schema extraction)" }
```

## Chat summary

After writing the JSON, summarize in chat:

```
audit complete — composite 78/100

  voice 82 · seo 91 · aeo 73 · geo 68 · factuality 90 · humanization 76

top fixes (highest impact first):
  1. [humanization] Rewrite first sentence (line 1)
  2. [geo] Add 1-2 inline citations
  3. [aeo] Reformat FAQ to <h3> tags

run `/imprint polish <file>` to apply these and rescore.
```

## Re-runs

`audit` is fast and free of side effects. Re-run after every revision to confirm score moved. Typical workflow:

1. Generate article → audit (composite 73)
2. Polish recommended fixes
3. Audit again (composite 86)
4. Optional second polish pass
5. Audit again (composite 92)
6. Publish

A composite of 90+ on the first generation is rare. 75-85 first pass, 88-95 after one polish round is typical.

## Cluster-level audit

`audit --cluster <cluster_id>` aggregates audit scores across every article in a cluster:

- Per-article composite scores
- Cluster average
- Standard deviation (consistency)
- Top-10 priority fixes across the cluster
- Cluster-level signals (coverage, link density, overlap risk — see `cluster.md`)
