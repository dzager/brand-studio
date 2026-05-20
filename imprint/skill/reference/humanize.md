# humanize — strip AI patterns from existing content

The 17-pattern humanizer pass. See `humanization.md` for the full methodology.

## When to run

- Automatic, after every `article` generation, if BRAND.md sets `auto_humanize: true`
- Manual, on any existing markdown/HTML file: `/imprint humanize <file>`
- As part of a polish workflow: `audit` → fix → `humanize` → `factcheck` → `publish`

## Inputs

- **Target file**: markdown or HTML
- **Brand context**: BRAND.md + VOICE.md, loaded automatically

## Output

The humanized version, written either to a sibling file (`<name>.humanized.md`) or printed to stdout for the user to review.

By default writes to a sibling. Flag `--in-place` overwrites the original (requires confirmation).

## How it works

Single model pass with the humanization system prompt (see `humanization.md`). The brand voice clause from VOICE.md is appended so the humanized version matches brand voice, not the model's default neutral voice.

## What it preserves

- HTML structure (tags, attributes, hierarchy)
- Links exactly as-is (URLs unchanged)
- Lists where they genuinely help readability
- Heading hierarchy

## What it changes

- AI-pattern openings → specific factual openings
- Banned phrases → rewritten
- -ing scaffolding → cut or rewritten
- Em dash overuse → mixed punctuation
- Empty rule-of-three → varied list lengths
- Generic closings → specific endings
- Sycophantic / collaborative artifacts → removed

## What it does NOT change

- The factual content
- The article's overall structure
- The length (within ~10% of original)

If the input is already humanized, the pass should be largely a no-op. If it's a heavily AI-cream draft, the pass may rewrite 40-60% of sentences. Either is fine.

## Re-runs

Do not run `humanize` twice on the same content. The second pass starts introducing the model's own patterns (over-casual phrases, fake personality, performative imperfection). One pass, then judge with human eyes.

If the first pass produced a result that still feels AI-flavored, fix VOICE.md (the model is defaulting to its own voice when yours is under-specified) and re-generate, not re-humanize.

## Confirmation flow

Show the user a diff (or summary of changes: patterns removed, banned phrases caught, openings rewritten). Ask to apply.

If `--in-place`, require confirmation. Default to sibling output.
