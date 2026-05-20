# imprint

**The brand-content methodology that makes your AI harness better at on-brand content.**

Voice profiles, SEO/AEO/GEO, humanization, three-model fact-checking, brand-styled image and video prompts. Distilled into slash commands. Drop into Claude Code, Cursor, Codex, or any harness that loads skill folders.

```
/imprint teach          ← sit down once, write BRAND.md / VOICE.md / VISUAL.md
/imprint article        ← long-form, brand-voiced, fact-checked, SEO+AEO+GEO
/imprint cluster        ← pillar + supporting + interlink map
/imprint image          ← brand-styled image prompt
/imprint video          ← script, storyboard, image-per-scene, motion spec
/imprint humanize       ← strip the AI tells
/imprint factcheck      ← three-model council
/imprint audit          ← score 0–100 across SEO, AEO, GEO, voice, factuality
/imprint polish         ← final brand pass
/imprint publish        ← emit HTML + JSON-LD + image-prompt bundle
```

## Install

```bash
npx imprint install
```

Detects every supported harness directory (`.claude/`, `.cursor/`, `.codex/`, `.gemini/`, `.opencode/`, `.agents/`, …) and drops the skill into each. Re-run after upgrades.

Manual install:
```bash
git clone https://github.com/psl-labs/imprint.git
cp -r imprint/skill ~/.claude/skills/imprint
```

## CLI

```bash
npx imprint detect <file>   # scan markdown / HTML for AI tells, banned phrases, weak openings
npx imprint score <file>    # 0–100 score per dimension (SEO, AEO, GEO, voice, factuality)
npx imprint install         # install skill into every detected harness directory
npx imprint version
```

The CLI is the deterministic counterpart to the LLM-side skill. Same methodology, two different consumers.

## Philosophy

Most AI content tools sell you a black box. `imprint` ships the methodology in plain markdown so you can read it, edit it, and run it through any model. It is what we learned shipping a content platform at scale, distilled into something any team can use without an account, an API key, or a vendor.

If you want it managed, [Organic](https://organic.dev) is the hosted version.

## Repo layout

```
imprint/
├── skill/                  ← what gets installed
│   ├── SKILL.md            ← entry point + command routing
│   ├── reference/          ← methodology docs (voice, seo, aeo, geo, …)
│   ├── scripts/            ← Node helpers loaded by the harness
│   └── schemas/            ← JSON schemas (brand, voice, visual, video, evals)
├── cli/imprint.mjs         ← npx imprint
├── examples/example-brand/ ← BRAND.md / VOICE.md / VISUAL.md fixture
├── tests/
├── LICENSE                 ← Apache 2.0
├── package.json
└── README.md
```

## License

Apache 2.0. See `LICENSE`.

## Credits

Distilled from the production content engine behind [Organic](https://organic.dev), built at [Pioneer Square Labs](https://psl.com).
