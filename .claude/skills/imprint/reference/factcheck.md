# factcheck

Three independent models read the article and verify every claim. Loaded by the `factcheck` slash command and referenced by `article` (which runs factcheck as a pipeline stage) and `publish` (which refuses on FAIL).

The council exists because single-model fact-checking inherits the model's biases and blind spots; three different model families catch what one misses.

## Command workflow

When invoked as `/imprint factcheck <file>`:

1. Load the file (markdown or HTML)
2. Extract claims (one model call to a claim-extraction prompt)
3. Query each of the three council models in parallel, per claim
4. Aggregate verdicts into per-claim council ruling
5. Aggregate council rulings into article verdict
6. Emit structured report at `<file>.factcheck.json` and summarize in chat

Surface FAIL and NEEDS_REVIEW claims with all three rationales side-by-side. The skill does NOT rewrite failed claims; the author decides.

## Required env

At least three of:

- `OPENAI_API_KEY` — slot A
- `ANTHROPIC_API_KEY` — slot B
- `GOOGLE_API_KEY` or `XAI_API_KEY` — slot C

If fewer than three are available, fall back to two-model with an explicit warning that the council is incomplete.

## Protocol

### 1. Convene the council

Pick three model families with meaningful diversity:

| Slot | Recommended | Why |
|---|---|---|
| Slot A | OpenAI GPT-5 family | Strong general fact recall, conservative |
| Slot B | Anthropic Claude family | Strong reasoning, calibrated uncertainty |
| Slot C | Google Gemini or xAI Grok | Independent training data, different blind spots |

The names matter less than the diversity. Two OpenAI models are not a council; they are one vote twice.

### 2. Extract claims

Before running the council, the article is parsed into discrete claims. Each claim is a single verifiable statement. A paragraph with five claims becomes five council inputs.

Claim types:

| Type | Example |
|---|---|
| Statistical | "Processing times increased from 6 to 14 months between 2023 and 2025" |
| Procedural | "Applicants must file Form I-130 before Form I-485" |
| Regulatory | "8 CFR §245.1(c)(1) requires..." |
| Quantitative | "The average cost is $1,500-3,000" |
| Categorical | "EB-2 priority dates moved faster than EB-3 in Q1 2026" |
| Citational | "According to the ADA, dental implants have a 95% success rate" |

Opinion statements, brand statements, and qualified claims ("typically", "in most cases") are excluded from fact-checking — they are judgment calls, not facts.

### 3. Per-claim verdict

Each model returns a structured verdict per claim:

```yaml
claim: "Processing times increased from 6 to 14 months between 2023 and 2025"
model: claude-opus-4-7
verdict: accurate | unverifiable | misleading | inaccurate
confidence: high | medium | low
sources: [list of URLs the model used to verify]
rationale: brief explanation (1-3 sentences)
```

### 4. Council vote

Combine the three verdicts into one ruling:

| Council ruling | Triggered by |
|---|---|
| PASS | All three return `accurate` with high or medium confidence |
| NEEDS_REVIEW | One model dissents OR all three return `unverifiable` |
| FAIL | Two or more models return `misleading` or `inaccurate` |

`NEEDS_REVIEW` claims surface to the author with all three model rationales side-by-side. `FAIL` claims block publication until rewritten.

### 5. Article-level verdict

Roll the per-claim verdicts up:

| Article verdict | Threshold |
|---|---|
| Pass | 95%+ claims PASS, zero FAIL |
| Needs review | 80-94% PASS, 0-5% FAIL, rest NEEDS_REVIEW |
| Fail | <80% PASS or any FAIL claim |

Thresholds are configurable per brand in BRAND.md (`eval_weights:` or a dedicated `factcheck_thresholds:` field). Defaults above are calibrated for YMYL content.

## Per-claim verdict definitions

Use these definitions strictly. Calibration matters more than raw accuracy.

### accurate

The claim is supported by at least one authoritative source, and no contradicting authoritative source was found. The model can name the source.

### unverifiable

The model cannot find an authoritative source either supporting or contradicting the claim. Treat as a yellow flag — the claim may still be true, but the article needs to (a) add a source, (b) qualify the claim, or (c) cut it.

### misleading

The claim is technically true but framed in a way that produces a wrong impression. Common patterns:

- True statistic with omitted context that changes meaning
- Cherry-picked data point that misrepresents a trend
- Outdated specific that has been superseded

### inaccurate

The claim is contradicted by authoritative sources. The model can name the source contradicting it.

## Citation requirements

For every `accurate` verdict, the model names at least one source. The source must be:

- A specific page, not a homepage
- From the GEO source hierarchy (government, regulations, official data, peer-reviewed research, established reference sites)
- Linkable

Sources collected during fact-check feed into the article's citation pool. The article's published version embeds these as inline `<a>` tags.

## The model prompts

Each council model receives an identical prompt:

```
You are a fact-checker for an editorial publication. You are given:
1. The article body (HTML)
2. A list of claims extracted from the article

For each claim, return a verdict in the format:
  - claim_id
  - verdict (accurate | unverifiable | misleading | inaccurate)
  - confidence (high | medium | low)
  - sources (list of specific URLs)
  - rationale (1-3 sentences)

Do not return verdicts for claims you cannot evaluate from authoritative sources.
Return `unverifiable` if you cannot find a source either way; do not guess.
Do not return verdicts for opinion statements or brand statements.
```

Diversity comes from the model families, not the prompt.

## When the council disagrees

Council disagreement is signal, not noise. Common patterns:

| Disagreement | What it means |
|---|---|
| Two PASS, one MISLEADING | Re-read the claim; the dissenting model usually found a context the others missed |
| All three UNVERIFIABLE | The claim may be true but the article cannot demonstrate it. Add a source or qualify |
| Mixed FAIL/PASS on a statistic | A model is using stale data. Identify which year each model is referencing |
| Mixed verdicts on a regulatory claim | Regulations change; check the citation's effective date |

Surface all three rationales to the human reviewer; do not try to pick a winner algorithmically.

## What the council does not do

- Does not check brand voice (that is `polish`)
- Does not check SEO/AEO/GEO compliance (that is `audit`)
- Does not check stylistic patterns (that is `humanize`)
- Does not write the article

Fact-check is one pass in the pipeline. Do not ask it to do more than verify claims.

## Output format

```yaml
article_verdict: pass | needs_review | fail
claim_count: integer
verdict_counts:
  accurate: integer
  unverifiable: integer
  misleading: integer
  inaccurate: integer
claims:
  - id: claim-001
    text: "Processing times increased from 6 to 14 months..."
    location: { paragraph: 3, sentence: 2 }
    council_ruling: pass | needs_review | fail
    verdicts:
      - model: gpt-5
        verdict: accurate
        confidence: high
        sources: [...]
        rationale: "..."
      - model: claude-4-7
        verdict: accurate
        confidence: high
        sources: [...]
        rationale: "..."
      - model: gemini-3.1
        verdict: unverifiable
        confidence: medium
        sources: []
        rationale: "..."
    action_required: none | qualify | add_source | rewrite | cut
```

`publish` refuses an article with any FAIL claim. NEEDS_REVIEW claims surface as inline annotations the editor resolves.

## Re-runs

Re-runs after revision are encouraged. Each run is a fresh council vote. Stop when the article-level verdict is PASS.
