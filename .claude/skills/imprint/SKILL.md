---
name: imprint
description: Use when the user wants to generate, audit, or refine on-brand content — articles, posts, image prompts, video specs — with brand voice, SEO/AEO/GEO, humanization, fact-checking, and visual style. Covers single-article and topical-cluster generation, before/after humanization, three-model fact-checking, image-prompt assembly, and video script + storyboard + motion spec. Not for non-content tasks.
argument-hint: "[{{command_hint}}] [target]"
user-invocable: true
allowed-tools:
  - Bash(npx imprint *)
  - WebFetch
license: Apache-2.0
---

# imprint

Brand-content methodology, distilled into slash commands. Voice, SEO, AEO, GEO, humanization, fact-check council, image prompts, video specs. Drop into any harness, work against any model, hold the same standard.

This file routes commands. The actual methodology lives in `reference/`. Sub-commands load their reference doc; shared methodology docs (`voice.md`, `seo.md`, `aeo.md`, `geo.md`, `humanization.md`, `banned-phrases.md`, `factcheck.md`, `cluster.md`, `image-prompts.md`, `video-spec.md`, `evals.md`, `brand.md`) get pulled in by whichever command needs them.

## Setup

Before any content work, two bookkeeping steps. Don't skip; they're what makes the rest of the methodology kick in.

### 1. Context gathering

Three files, case-insensitive. The loader scans cwd first, then `.agents/context/`, then `docs/`. Override with `IMPRINT_CONTEXT_DIR=path/to/dir`.

- **BRAND.md** *(required)*: identity, mission, tagline, archetype, audiences, banned phrases, editorial guidelines.
- **VOICE.md** *(optional, strongly recommended)*: structured voice profile (tone, rhythm, vocab, POV, sample phrases, patterns to avoid).
- **VISUAL.md** *(optional)*: photography style, image-style categories, design tokens.

Load all three in one call:

```bash
node {{scripts_path}}/load-context.mjs
```

Consume the full JSON output. Never pipe through `head`, `tail`, `grep`, or `jq`. The output's `contextDir` field tells you where the files resolved from.

If the output is already in this session's conversation history, don't re-run. Exceptions requiring a fresh load: you just ran `{{command_prefix}}imprint teach` or `{{command_prefix}}imprint voice` (they rewrite the files), or the user manually edited them.

**If BRAND.md is missing, empty, or placeholder (`[TODO]` markers, <200 chars):** run `{{command_prefix}}imprint teach`, then resume the user's original task with the fresh context. If the original task was `{{command_prefix}}imprint article`, the brand context is non-negotiable — teach first.

If VOICE.md is missing: nudge once per session (*"Run `{{command_prefix}}imprint voice <url>` for sharper voice match"*), then proceed using BRAND.md's archetype + tone axes as a fallback.

### 2. Register

Every content task has a **register**:

- **long** — feature articles, pillar pages, in-depth guides. 600-5,000+ words (pillar: 2,500-5,000+; supporting: 1,200-2,500; long-tail/FAQ: 600-1,200; definition/glossary: 400-800; comparison: 1,500-3,000; how-to: 1,500-3,500). Editorial credibility paramount.
- **short** — social posts, newsletters, summaries. <500 words. Voice match paramount.
- **visual** — image prompts. Brand visual style + photography rules apply.
- **video** — video scripts + storyboard + motion spec.

Identify before producing. Priority: (1) explicit cue in the user's request ("a long article", "a Tweet"); (2) the file extension or surface in focus; (3) sensible default based on the command (e.g. `article` defaults to long).

If unclear, the article and short paths both invoke their reference; if the user said neither, ask in one line and default to the command's natural register.

## Shared content laws

Apply to every output, every register. Source: the brand-content methodology distilled from a production engine that has shipped tens of thousands of articles. These laws are non-negotiable — they're what separates `imprint` output from generic AI content.

### Editorial credibility (highest priority)

This section overrides any conflicting brand voice instructions.

- Protect credibility above all. When in doubt between sounding "warm" and sounding "credible," always choose credible.
- Do NOT inject optimism, empowerment, motivational framing, or reassuring language into news, policy, or procedural content. If a situation is complex, say so plainly.
- Do NOT use casual dramatic framing — phrases like "brace yourself," "buckle up," "spoiler alert" belong in conversational blogs, not professional content. State facts directly.
- Do NOT lean fatalistic. Report challenges factually without editorial coloring. "The costs can be brutal" → "Total costs typically range from $1,500 to $3,000." Let readers draw conclusions.
- If a sentence sounds like a LinkedIn influencer post, cut it.
- Do not address the reader's emotions. Report facts. Explain processes.

### First sentence quality (MANDATORY)

The opening sentence is the single highest-leverage edit. AI almost always opens with generic framing. Fix this aggressively.

**Eliminate**: "When it comes to...", "If you're looking for...", "In today's world...", "Understanding X is crucial...", "Are you considering...".

**Replace with**: a specific verifiable fact, a surprising statistic, a recent change, a concrete scenario, evidence of expertise in the first 15 words.

| Bad | Good |
|---|---|
| Solar energy is an important pathway for homeowners. | Residential solar installations in Washington dropped 22% in cost since 2023, but permitting now averages 47 days. |
| If you're considering a home renovation, understanding your options is essential. | The average kitchen remodel in Seattle costs $38,400 in 2026, but three overlooked permit requirements add $4,000–$7,000 that most contractors don't mention. |

### Specificity over generality

LLMs default to vagueness. Fight aggressively.

- Always preserve specific facts: exact dates, processing times, form numbers, dollar amounts, agency names, standards.
- If a specific fact is uncertain, do not invent it. Use sourced facts or state that the detail varies.
- NEVER replace a specific fact with vague language like "many," "recently," or "significant." "Processing times increased from 6 months to 14 months" must never become "processing times have increased significantly."

### Banned phrases (cross-register)

The methodology's banned list lives in `reference/banned-phrases.md` — 200+ entries with rationale. The 30-second version: never write *delve*, *crucial*, *journey*, *navigate*, *unlock*, *empower*, *embark*, *tapestry*, *testament*, *cutting-edge*, *vibrant*, *enhance*, *fostering*, *underscores*, *highlights*, *landscape* (figurative), *brace yourself*, *here's the kicker*, *spoiler alert*. Full list applies.

### Em dashes

Em dashes (—) are overused by LLMs. Replace most with commas, periods, or parentheses. When you do use one, always spaced — like this. Never closed (word—word).

### Sources and attribution (MANDATORY for long-form)

Every factual claim about rules, fees, timelines, eligibility, or statistics needs an inline hyperlinked attribution. Minimum 4-6 hyperlinked source citations per long-form article. Anchor text names the source and context, not "click here". Link to the most specific page available, not homepages.

### Em sentence rhythm

Sterile rhythm is its own AI tell. Vary sentence length. Short. Then longer ones that take their time. Mix it up.

### Output bans

- No em dashes. No closed em dashes (`word—word`).
- No "Challenges and Future Prospects" formulaic sections.
- No generic positive conclusions ("The future looks bright").
- No "I hope this helps", "Of course!", "Certainly!", "Great question!" — strip all collaborative communication artifacts.
- No restated headings or padded intros.
- No rule-of-three forced into every list.
- No false ranges ("from X to Y" where X and Y aren't on a meaningful scale).

## Commands

| Command | Category | Description |
|---|---|---|
| `teach` | Setup | Write BRAND.md (and optional VOICE.md / VISUAL.md) via interview |
| `voice [url\|text]` | Setup | Reverse-engineer a structured voice profile from samples |
| `style [url\|dir]` | Setup | Reverse-engineer a visual style spec from a site or image folder |
| `article [topic]` | Build | Long-form article. Full pipeline: brand → write → humanize → verify → emit |
| `short [topic]` | Build | Short-form post (LinkedIn, X, threads) |
| `cluster [topic]` | Build | Pillar + supporting articles + internal link map |
| `image [prompt]` | Build | Brand-styled image prompt (model-agnostic) |
| `video [topic]` | Build | Script + storyboard + per-scene image prompts + motion spec |
| `humanize [file]` | Refine | Strip AI patterns and banned phrases, re-rhythm |
| `factcheck [file]` | Refine | Three-model council, claim-by-claim verdict with citations |
| `shorten [file]` | Refine | Extract short-form post from a long article |
| `polish [file]` | Refine | Final brand pass: voice match, banned-phrase sweep, schema check |
| `audit [file]` | Evaluate | Score 0-100 across SEO, AEO, GEO, voice, factuality |
| `critique [file]` | Evaluate | Qualitative critique with prioritized issues |
| `bakeoff [topic]` | Evaluate | Same topic across N models, side-by-side diff |
| `seo [file]` | Distribute | Extract/inject SEO metadata + FAQ schema |
| `aeo [file]` | Distribute | Restructure for answer engines |
| `geo [file]` | Distribute | Generative engine optimization pass |
| `publish [file]` | Distribute | Emit HTML + JSON-LD + image-prompt bundle |
| `evals` | Manage | Run eval rubric against existing content |

Plus management commands: `pin <command>` and `unpin <command>`.

### Routing rules

1. **No argument**: render the table above as a user-facing menu grouped by category. Ask what they'd like to do.
2. **First word matches a command**: load its reference file (`reference/<command>.md`) and follow its instructions. Everything after the command name is the target/topic.
3. **First word doesn't match**: general content-help invocation. Apply the setup steps, shared content laws, and propose the most likely command for what they're describing.

Setup (context gathering, register) is loaded by then; sub-commands don't re-invoke `{{command_prefix}}imprint`.

If the first word is `article` or `cluster`, setup still runs first; the reference takes over after. If setup invokes `teach` as a blocker, finish teach, refresh context, then resume the original command.

## Pin / Unpin

`pin` creates a standalone alias so `{{command_prefix}}<command>` invokes `{{command_prefix}}imprint <command>` directly. `unpin` removes it. The script writes to every harness directory present in the project.

```bash
node {{scripts_path}}/pin.mjs <pin|unpin> <command>
```

Valid `<command>` is any command from the table above. Report the script's result concisely. Confirm the new shortcut on success; relay stderr verbatim on error.

## Versioning

This file pairs with `reference/`. Major changes to methodology bump the version in `package.json` at the repo root. Pinned harnesses re-read this file on every load, so updates propagate automatically — no migration required.
