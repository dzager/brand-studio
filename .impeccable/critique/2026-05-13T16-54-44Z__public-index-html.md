---
target: home page (public/index.html)
total_score: 23
p0_count: 0
p1_count: 3
timestamp: 2026-05-13T16-54-44Z
slug: public-index-html
---
# Critique — public/index.html

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Modal has states; no nav active-section indicator. |
| 2 | Match System / Real World | 2 | "AEO + GEO," "fact-check consul," "MCP," "bake-off" — unexplained jargon. |
| 3 | User Control and Freedom | 3 | Modal Esc + close + overlay-click all work. |
| 4 | Consistency and Standards | 2 | Five CTAs use four different verbs. |
| 5 | Error Prevention | 2 | Email field type="text" (1409); no mobile keyboard, no native validation. |
| 6 | Recognition Rather Than Recall | 2 | Terminal log decodes the pipeline; same info exists in Pipeline section, disconnected. |
| 7 | Flexibility and Efficiency | 2 | "GO" passphrase (1356) is the only power-user shortcut and is undocumented. |
| 8 | Aesthetic and Minimalist Design | 2 | Mono-eyebrow noise + 13 identical content blocks across two sections sap the minimalism. |
| 9 | Error Recovery | 2 | Error shown but no retry guidance. |
| 10 | Help and Documentation | 2 | Docs link exists; no inline tooltips for the jargon. |
| Total | | 23/40 | Mid band, not broken, not differentiated. |

## Anti-Patterns Verdict

Editorial-typographic aesthetic lane (explicit reflex-reject): display serif + italic <em> + mono eyebrows + hairline rules + monochromatic restraint. Section headlines at 956, 1036, 1073, 1151, 1245, 1287, 1402.

Repeated tiny uppercase tracked mono labels (absolute brand-register ban). ~25 visual zones of identical 11px JetBrains-Mono uppercase-tracked label.

Hero-metric template (absolute cross-register ban). Four big serif numbers + mono labels separated by hairline rules (965–982).

Identical card grids back-to-back (absolute cross-register ban). Why Organic 6 cards (1040–1046) + Pipeline 7 cards (1077–1088). Content overlaps: Brand engine / Brand, Humanization / Humanize, Fact-check consul / Verify.

Glassmorphism modal: backdrop-filter: blur(12px) (658).

Modal as first thought: every primary CTA opens a waitlist modal, not a destination.

Em dashes in hero lede (959) and slider after-text (1167) — banned by shared copy rules.

Fake-CLI hero motif (845–943) — single most-cloned AI/dev-tool landing motif of the era; mismatched to the actual buyer (content ops / brand manager).

Reflex fonts: Inter (body) + JetBrains Mono (labels) both on reflex-reject list. Deterministic detector confirmed Inter as overused-font.

## Overall Impression

Tasteful, anonymous, identifiable as AI-template within three seconds. Contradicts its own thesis ("Less AI. More Organic.") with the literal visual signature of AI-generated landing pages. Biggest opportunity: delete the terminal, promote the before/after slider into the hero.

## What's Working

- Before/after slider (1098–1199): the only piece that demonstrates the product instead of describing it. Drag interaction, italic-vs-roman, clay vs. moss tag colors.
- Palette discipline: cream + warm ink + moss, derived muted gray. Restrained color strategy genuinely well-executed.
- Honest IA spine: Hero → Why → Pipeline → Proof → Pricing → CTA. No padding sections.

## Priority Issues

[P1] Editorial-typographic lane + mono-eyebrow wallpaper. Strip section eyebrows or rewrite as small italic serif kicker. Keep mono only on real technical artifacts (terminal, pipeline chips, footer). Drop uppercase tracking. Suggested: /impeccable quieter, /impeccable typeset.

[P1] Fake terminal is the wrong centerpiece. Replace hero right-column with an article preview (with image — currently zero imagery on a visual-content product) or promote the slider into the hero. Suggested: /impeccable shape, /impeccable bolder.

[P1] Hero CTA opens a waitlist modal, not a destination. Pick one stance: real waitlist → rename CTAs "Request early access," inline form in hero, stop redirecting submissions to /studio. Or real free trial → send to /register, delete the modal. Currently the modal copy contradicts the redirect behavior (1383 vs 1433) — either bug or dark pattern. Suggested: /impeccable clarify, /impeccable shape.

[P2] Two identical card grids back-to-back. Keep Why as grid; convert Pipeline into a horizontal animated flow with connecting lines, OR merge: Pipeline becomes the spine, Why's six points annotate the relevant stages. Suggested: /impeccable layout, /impeccable distill.

[P2] Five CTAs, four different verbs, two different promises. One verb tied to the real stance (P1). Update modal copy to match. Suggested: /impeccable clarify.

[P3] Email type="text" (1409); footer href="#" dead links (1310–1312); leaf SVG (802–812) dead code; em-dash violations (959, 1167); CLS risk on logo (no width/height, 823); "All Organic, INC, a PSL Company" comma form inconsistent with wordmark. Suggested: /impeccable harden, /impeccable polish.

## Persona Red Flags

Maya (content-ops lead, actual buyer): page promises editorial imagery, shows zero. Clicks "Get started free," gets a waitlist modal. Terminal motif reads as "for engineers." Pricing seats are unexplained.

Devon (skeptical brand manager, gatekeeper): scans for proof the tool can sound like *their* brand. Slider addresses this but it's halfway down. "200+ banned AI phrases" stat reads as theater without an example. "Fact-check consul" parses as either a typo for "council" or unexplained jargon.

Riley (engineer evaluating API/MCP): terminal appeals; technical proof is thin. "MCP server" footer link is dead. Hero CTA opens modal instead of going to docs. No code sample on the homepage.

## Minor Observations

- "fact-check consul" (1009) — likely meant "council."
- Hero headline (956) parses ambiguously: "All Organic content generation & traffic."
- Mixed numerals in hero stats (200+, 6+, 3, 7) — either all + or none.
- Terminal cursor (939) floats orphaned, not inline at a prompt.
- Modal close button (738) relies on inline position:relative at 1395.
- Slider drag starts anywhere in container (1157) — accidental drag on text selection.
- "POPULAR" badge (1222) is the laziest label.
- Section padding 140px 0 on three consecutive sections — same vertical weight, no rhythm.
- Waitlist leak: submission redirects to /studio (1383) while modal copy says "we'll reach out" (1433).
