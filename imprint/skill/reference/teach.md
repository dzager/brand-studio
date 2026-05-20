# teach — set up brand context

Interview-style. Produces BRAND.md (required), and optionally VOICE.md and VISUAL.md. Run once per brand; re-run when the brand evolves.

## Discovery (one round, 4-6 questions)

Adaptively ask, don't dump a form. Use the harness's structured question tool if one exists; otherwise ask in chat and stop after each round.

Cover:

1. **Identity.** What is the brand? One sentence of what it is and who it's for.
2. **Audiences.** Who reads this? Be specific — role, context, frequency. Not "everyone interested in X".
3. **Archetype + tone axes.** Pick one archetype (guide, hero, sage, caregiver, creator, explorer, magician, outlaw). Pick 3-5 tone axes (e.g., direct, calm, precise, non-condescending, slightly skeptical).
4. **Editorial guidelines.** Anything specific to this brand's content rules — depth, citation style, format requirements, must-haves, must-not-haves.
5. **Banned phrases.** Brand-specific phrases that should never appear, beyond the universal list. Optional.
6. **Reference articles.** 2-5 URLs of gold-standard articles in the brand's voice. Optional but valuable for few-shot.

If anything is genuinely unclear, ask a follow-up. If PRODUCT.md or a similar file already exists in the repo, read it first and skip questions it answers.

## Write BRAND.md

Use `schemas/brand.schema.json` for shape. Required fields:

- `name`
- `tagline`
- `mission`
- `archetype`
- `tone_axes` (3-5)
- `audiences` (named, with needs + positioning)
- `editorial_guidelines` (free text)
- `avoid_phrases` (extends the universal list)
- `reference_articles` (0-5 URLs)

Optional fields (recommended but not required at teach time):

- `eval_weights` (override the default rubric weights)
- `seo_guidelines` (brand-specific SEO rules)
- `auto_humanize: true` (run humanizer after every generation)

Example BRAND.md lives at `examples/example-brand/BRAND.md` — copy structure, fill values.

## Suggest VOICE.md and VISUAL.md

After BRAND.md is written, prompt the user:

> Want me to analyze a sample article to build a structured voice profile? Run `/imprint voice <url>`.
>
> Want to define photography style? Run `/imprint style <url>` or skip if image generation isn't part of the workflow yet.

Don't write VOICE.md or VISUAL.md in `teach` itself — those have their own commands and their own discovery flow.

## Confirm

Show the user the BRAND.md you wrote (or a summary). Ask if anything needs revision before saving. Save when confirmed.

Tell the user where to find it (`./BRAND.md` or `.agents/context/BRAND.md` depending on where the loader expects it).
