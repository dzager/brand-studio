# PLAN: a brand-content skill for AI harnesses

**Status:** draft for review. Nothing built yet. Once you approve direction, the skill goes in `.claude/skills/<name>/` and gets prepped for a standalone GitHub repo. The companion GTM doc lands after build.

**Reference for structure:** [pbakaus/impeccable](https://github.com/pbakaus/impeccable). The local copy in `.claude/skills/impeccable/` is what we'll mirror.

---

## 1. What this is, and what it isn't

**What it is:** a Claude-Code-and-friends skill that codifies the Organic content engine's methodology (brand voice, SEO/AEO/GEO, humanization, fact-check council, photography style, image-prompt assembly) into reusable slash commands an AI harness can run against any company's content.

**What it isn't:** a wrapper around the Organic SaaS. It does not require an account, an API key, or a Supabase connection. It ships the prompts, schemas, banned-phrase lists, evals rubric, and prompt-assembly order as plain markdown + scripts. Any LLM in any harness can execute it. *Organic-the-product* and *<skill>-the-methodology* become a deliberate split: SaaS for teams who want it managed, skill for teams who want to run it themselves.

This split is the same one that made impeccable work. Methodology > tooling. PSL portfolio companies adopting the skill become warm leads for Organic later.

---

## 2. Naming

Three candidates. I'd pick **`onbrand`** as the working title — direct, two-syllable, the action verb is already what people say ("is this on-brand?"). The others are stronger if you want a more abstract mark.

| Slug | Type | Vibe |
|---|---|---|
| **`onbrand`** *(recommended)* | direct | "Generate content that is on-brand." The literal verb. |
| `imprint` | metaphor | A brand mark stamped on every artifact. Works across text + image + video. |
| `canon` | metaphor | The authoritative version of a brand's voice. Slightly literary. |
| `marque` | metaphor | Identity-mark / signature. Fashion/auto association. Feels premium. |

**Action requested:** pick one. The rest of this doc uses `<skill>` as placeholder.

---

## 3. Architecture: methodology-first

```
┌───────────────────────────────────────────────────────────────┐
│  <skill>/                                                     │
│  ├── SKILL.md          ← single entry point, routes commands  │
│  ├── reference/        ← 14 markdown docs, the methodology    │
│  ├── scripts/          ← Node ESM helpers, the harness glue   │
│  ├── schemas/          ← JSON schemas (voice, visual, eval)   │
│  └── cli/              ← optional `npx <skill> detect|score`  │
└───────────────────────────────────────────────────────────────┘
```

**Manifest** (`SKILL.md` front-matter, copying impeccable's pattern):
```yaml
---
name: <skill>
description: "Use when the user wants to generate, audit, or refine
  on-brand content — articles, posts, image prompts, video specs —
  with brand voice, SEO/AEO/GEO, humanization, and fact-checking."
argument-hint: "[{{command_hint}}] [target]"
user-invocable: true
allowed-tools: [Bash(npx <skill> *), WebFetch]
license: MIT
---
```

**Context contract** (mirrors impeccable's `load-context.mjs`):
- `BRAND.md` (required) — name, mission, tagline, archetype, audiences, banned phrases, editorial guidelines
- `VOICE.md` (optional but recommended) — structured voice profile (JSON in frontmatter or inline)
- `VISUAL.md` (optional) — photography style + image-style categories
- `EVALS.md` (optional) — custom eval rubric overrides

Loader scans cwd, then `.agents/context/`, then `docs/`. Override via `<SKILL>_CONTEXT_DIR`. Same JSON-to-stdout pattern as impeccable — the model consumes the full payload.

**Template variables** the harness substitutes: `{{scripts_path}}`, `{{command_prefix}}`, `{{command_hint}}`, `{{model}}`, `{{ask_instruction}}`. Same as impeccable so the install pattern is identical.

---

## 4. Command map

Grouped like impeccable does it. v1 ships the **bold** rows; the rest follow in v1.1.

### Build
| Command | Argument | Description |
|---|---|---|
| **`teach`** | — | Interview-style setup: writes BRAND.md, optional VOICE.md / VISUAL.md |
| **`voice`** | `<url \| text>` | Analyze brand voice from a URL or pasted samples, write VOICE.md |
| `style` | `<url \| dir>` | Analyze visual style from a site or image folder, write VISUAL.md |
| **`article`** | `<topic>` | Long-form article. Full pipeline: brand → write → humanize → verify → emit |
| `short` | `<topic>` | Short-form post (LinkedIn / Twitter / threads) |
| **`cluster`** | `<topic>` | Pillar + supporting articles + interlink map |
| **`image`** | `<prompt>` | Brand-styled image prompt (model-agnostic; emit or call provider) |
| `video` | `<topic>` | Script + storyboard + structured video spec (see §6) |

### Refine
| Command | Argument | Description |
|---|---|---|
| **`humanize`** | `<file>` | Strip AI patterns, ban-phrase sweep, re-rhythm |
| **`factcheck`** | `<file>` | Three-model council: claim-by-claim verdict |
| `shorten` | `<file>` | Extract short-form post from a long article |
| **`polish`** | `<file>` | Final brand pass: voice match, banned-phrase sweep, schema check |

### Evaluate
| Command | Argument | Description |
|---|---|---|
| **`audit`** | `<file>` | Quantitative score 0-100 across SEO, AEO, GEO, voice match, factuality |
| `critique` | `<file>` | Qualitative critique, prioritized issues, persona red flags |
| `bakeoff` | `<topic>` | Same topic across N models, side-by-side diff |

### Distribute
| Command | Argument | Description |
|---|---|---|
| `seo` | `<file>` | Extract/inject SEO metadata + FAQ schema |
| `aeo` | `<file>` | Restructure for answer engines (inverted pyramid, Q&A blocks) |
| `geo` | `<file>` | Generative engine optimization (citations, freshness, unique insight) |
| **`publish`** | `<file>` | Emit final HTML + JSON-LD + image-prompt bundle |

### Manage
| Command | Argument | Description |
|---|---|---|
| `evals` | — | Run eval rubric against existing content |
| `pin` / `unpin` | `<command>` | Alias `/<skill> command` → `/command` across harnesses |

**v1 ships 10 commands** (bolded). That's enough to write, refine, audit, and publish. Everything else slots in once the core flow has shipped.

---

## 5. Reference docs (the actual methodology)

Each command loads a `reference/<command>.md` plus zero or more shared domain docs. The shared docs are the durable IP — they're what makes adopting the skill valuable independent of any single command:

| File | Owns |
|---|---|
| `reference/voice.md` | Voice profile schema, how to author one, sample extractions |
| `reference/visual.md` | Photography style + image-style category schema |
| `reference/seo.md` | On-page SEO best practices, schema markup, meta hygiene |
| `reference/aeo.md` | Answer-engine optimization: inverted pyramid, Q&A blocks, FAQ schema, citation patterns |
| `reference/geo.md` | Generative engine optimization: source-attribution, freshness signals, unique-insight differentiation |
| `reference/humanization.md` | The 17 AI patterns + how to detect and rewrite them |
| `reference/factcheck.md` | Three-model council protocol, claim taxonomy, verdict format |
| `reference/cluster.md` | Topical cluster architecture, internal linking, overlap detection |
| `reference/banned-phrases.md` | The 200+ cliche list with rationale per entry |
| `reference/image-prompts.md` | Brand-consistent prompt assembly for image models |
| `reference/video-spec.md` | Structured video specification (§6) |
| `reference/evals.md` | Evaluation rubric: voice match, SEO, AEO, GEO, factuality, banned-phrase compliance |
| `reference/brand.md` | Brand methodology overview, where each ref slots in |
| `reference/product.md` | Companion overview for product-marketing content |

**Source for content:** `src/brand/engine.ts` is the canonical material. The `BRAND_ENGINE` const, `compileBlogSystemPrompt`, the humanizer module, and the MCP server's tool descriptions all map directly into these refs. Estimate: ~80% of the prose can be lifted with light editing; the new work is restructuring it for skill-consumption shape (focused per-file, ≤500 lines each).

---

## 6. Video, which is greenfield

There is **no video generation code** in the existing repo. Only YouTube embed/search for the editor. Three options for v1:

| Option | Effort | Output | When it's the right call |
|---|---|---|---|
| **A. Script + spec only** *(recommended)* | low | Markdown script, storyboard outline, structured JSON video-spec (scenes, shots, captions, brand tokens). Hand off to any video tool. | v1 — ships fast, matches the methodology-first stance, doesn't bet on one provider |
| B. Script + image-per-scene | medium | A above + a brand-styled hero frame per scene via the existing image pipeline | If we want a visually scrubbable preview without committing to motion |
| C. Full motion generation | high | A above + Sora / Runway / Veo / Luma calls per scene, stitched | Only if a portfolio company needs end-to-end and is willing to be the pilot |

**Recommendation: A** for v1. It's consistent with how impeccable doesn't ship a renderer. The video output is a *spec* a human or downstream tool turns into video. Once a real customer needs motion, B/C become a v1.1 question. Tell me if a portfolio company is already asking and we should jump to B.

---

## 7. What gets reused from Organic, and what gets rewritten

| Source in this repo | Destination in skill |
|---|---|
| `src/brand/engine.ts` — `BRAND_ENGINE` const + module docstrings | `reference/{seo,aeo,geo,humanization,...}.md` (one ref per module) |
| `src/brand/engine.ts` — `compileBlogSystemPrompt` order | `reference/brand.md` (prompt assembly section) |
| `src/brand/humanizer.ts` — pattern list, rewrites | `reference/humanization.md` |
| `src/lib/buildBrandEngine.ts` — overlay logic | `scripts/compile-prompt.mjs` (model-agnostic equivalent) |
| `mcp/organic-brand-mcp/src/index.ts` — 21 tools | Command list in §4; tool docstrings become per-command intros |
| `src/pages/api/create.ts` — generation flow | `reference/article.md` (the pipeline as documentation, not as code) |
| `src/pages/api/humanize.ts` — humanizer prompts | `reference/humanization.md` |
| `src/pages/api/fact-check.ts` — claim taxonomy + council protocol | `reference/factcheck.md` |
| `src/pages/api/analyze-voice.ts` — voice schema + analysis prompt | `reference/voice.md` + `schemas/voice.schema.json` |
| Photography style + composite engine code | `reference/visual.md` + `reference/image-prompts.md` |
| Banned-phrase list (in engine.ts) | `reference/banned-phrases.md` (verbatim with rationale column) |

The skill repo doesn't ship Organic source code. It ships the *methodology distilled from it*. Organic stays as the hosted SaaS, the skill is the give-away. If a portfolio company outgrows the skill, they upgrade to Organic — same way teams outgrow self-hosted whatever and adopt the managed version.

---

## 8. Distribution & install (preview — full GTM lands after build)

| Channel | How users install |
|---|---|
| **GitHub repo** (canonical) | `git clone` + drop `skill/` folder into `.claude/skills/<name>/`. Same as impeccable. |
| **npm CLI** | `npx <skill> install` writes the skill into every detected harness dir (`.claude/`, `.cursor/`, `.codex/`, `.gemini/`, …) |
| **ZIP from a one-page marketing site** (later) | One-click download, drag-drop install. Same as impeccable.style |

The repo lives at `github.com/<psl-org>/<skill>`. Apache 2.0 or MIT — pick at build time; my default for a marketing-leverage open-source release is MIT (lower friction). Apache 2.0 if there's any patent posture to protect.

---

## 9. Open questions for you before I build

1. **Name** — pick from §2 or propose another.
2. **Video scope for v1** — confirm Option A (script + spec only) from §6, or request B/C.
3. **GitHub org** — what's the canonical repo home? `github.com/psl-labs/<skill>`? Or under one of the portfolio companies? Or under your personal namespace for now and transferred later?
4. **License** — MIT (recommended for adoption) or Apache 2.0 (recommended for IP posture)?
5. **CLI scope** — does v1 ship a Node CLI (`npx <skill> detect|score|install`) like impeccable does, or skill-only for v1 and CLI later? Impeccable's CLI is its anti-pattern detector — for us it'd be a content-audit scorer (`npx <skill> audit ./article.md → JSON`). I'd ship the CLI in v1.1, but say so if you want it at launch.
6. **Where to develop** — build into `.claude/skills/<skill>/` here in `brand-studio`, then extract to its own repo at publish time? Or set up the standalone repo immediately and develop there? I'd recommend the former — your harness already loads it for in-flight testing.

---

## 10. Out of scope for v1

- Live browser HMR variant exploration (impeccable's `live` mode) — too costly to bring up, skip for v1
- Multi-harness install scripts beyond `.claude/` — write them once the Claude flow proves out
- A marketing site at `<skill>.[tld]` — that lands with the GTM doc
- Telemetry / usage analytics — out of scope; impeccable doesn't have any either
- Plugin-system integrations (Vercel AI SDK, LangChain) — v2

---

## 11. Build sequence after approval

1. Scaffold `.claude/skills/<skill>/` with SKILL.md, reference/, scripts/, schemas/
2. Port engine.ts modules into reference docs (one PR per ref so they're reviewable)
3. Write the 10 v1 commands' reference files
4. Wire `load-context.mjs`, `pin.mjs`, `compile-prompt.mjs`
5. Author BRAND.md / VOICE.md / VISUAL.md schemas + example fixtures
6. End-to-end smoke test on one of PSL's portfolio companies' real content
7. Extract to standalone GitHub repo
8. Write `SKILL-GTM.md` (distribution strategy, portfolio rollout, content calendar, announcement plan)

Estimated time-to-v1 (just the skill, not the CLI or marketing site): **3-5 focused days of build**, depending on how much per-ref editing the existing engine prose needs.

---

**Reply with answers to §9 and I'll start.** If anything in §1-8 is wrong, flag it before §9 — those are the load-bearing decisions.
