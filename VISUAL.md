---
photography_style:
  realism_base: "natural skin texture, realistic pores, slight facial asymmetry, candid moment, documentary photography, editorial realism, natural daylight, soft shadows, shallow depth of field, light film grain, avoid perfect symmetry, avoid stock photo look, avoid plastic skin"
  global_feel:
    - "documentary realism"
    - "composed and considered"
    - "monochromatic with paper warmth"
    - "real artifacts of content work"
  narrative: "We photograph the tools and rooms of the trade: a typewriter that no one will use, paper drafts marked up with a pen, an editor's screen with a real article open, a hand holding a printed proof. The subjects are intentional and the lighting is honest. Editorial register, never advertising register."
  storytelling_cues:
    - "subject is mid-action, not posed for camera"
    - "natural light is the dominant light source"
    - "everyday tools of the writing trade are visible (notebooks, pens, screens, paper)"
    - "off-center compositions, generous negative space"
    - "any people in frame are real working professionals, not models"
  lighting: "natural daylight, window-side, slightly overcast or late afternoon"
  mood: "composed, attentive, slightly skeptical"
  composition: "editorial, off-center, eye-level, generous negative space"
  subjects:
    - "writers and editors in their actual workspaces"
    - "paper drafts, notebooks, printed proofs"
    - "editor screens with real content visible"
    - "hand-and-tool details (pen on paper, mouse on a draft)"
    - "the physical artifacts of editorial work"
  avoid:
    - "stock office: people pointing at laptops, conference rooms, handshakes"
    - "AI-tool visual cliches: chip glow, brain-with-circuits, neural-net mesh, holographic interfaces"
    - "smooth-skinned AI portrait look (the giveaway 'AI face')"
    - "diversity-stock-photo: assorted people looking at one screen"
    - "travel-brochure register on any topic"
    - "heavy color grading, vignettes, lens flares"
    - "any subject that suggests the brand is excited about being AI"
    - "people in business suits in a conference room"
    - "smiling-into-camera marketing portraits"
    - "screenshots floated on gradient backgrounds"

image_style_categories:
  - id: "default"
    label: "Default"
    narrative: "Base monochrome documentary style. Applied to all image generation when no specific style is selected. Used for general marketing surfaces, social posts, and miscellaneous editorial moments."
    storytelling_cues:
      - "natural daylight, paper-warm tones"
      - "real working environment visible"
      - "single subject, intentional composition"
    image_prompt_style: "documentary editorial photography, natural daylight, restrained palette, slight film grain, slight desaturation toward warm gray, intentional composition with generous negative space"

  - id: "editorial"
    label: "Editorial"
    narrative: "Article hero images. Subject is mid-thought, mid-action, or mid-edit. The frame includes the physical artifacts of writing or editing. Used for long-form articles, pillar pages, and cluster content."
    storytelling_cues:
      - "subject is at their workspace, mid-task"
      - "a draft, a notebook, or a screen is in frame"
      - "natural light from a window or skylight"
      - "37mm-equivalent focal length, slight off-center framing"
      - "no eye contact with camera"
    image_prompt_style: "documentary editorial photography, shot on Leica Q3 with 37mm equivalent, natural daylight from a window, slight film grain, monochromatic with paper warmth, subject at a workspace mid-task, no eye contact with camera, intentional negative space"

  - id: "product"
    label: "Product"
    narrative: "Screenshots of the Organic studio, generated article previews, comparison demos. Used in feature pages, changelog, docs. Different register from editorial — clean, precise, screen-accurate."
    storytelling_cues:
      - "actual product UI, accurate to the current build"
      - "no fake screenshots or composited UIs"
      - "shown on a real device when device context matters, otherwise standalone"
      - "neutral backdrop, no gradient soup"
    image_prompt_style: "clean screenshot mockup on a paper-warm background, slight drop shadow, no gradient backgrounds, no holographic effects, monospace caption beneath if context needed"

  - id: "documentary"
    label: "Documentary"
    narrative: "Customer stories, case studies, podcast guest photos, team photos. Real people in real environments. The most journalistic register Organic uses."
    storytelling_cues:
      - "real subject in their own environment"
      - "permission-based portrait or candid"
      - "natural daylight, no studio lighting"
      - "37-50mm equivalent focal length"
      - "subject is doing or has just done something specific (working, walking out of a meeting, holding a print)"
    image_prompt_style: "documentary portrait photography, natural daylight, shot on Leica Q3 with 37mm, real working environment, subject mid-action, monochromatic with paper warmth, slight film grain, no posed marketing portraits"

design_tokens:
  colors:
    primary:
      - name: "paper"
        oklch: "oklch(94% 0.003 80)"
        hex: "#F0EEE9"
        role: "primary background, body surface"
      - name: "paper-deep"
        oklch: "oklch(87% 0.005 80)"
        hex: "#DAD7D1"
        role: "section bands, alternating surface"
      - name: "ink"
        oklch: "oklch(10% 0.005 30)"
        hex: "#1B130C"
        role: "body text, navigation, primary CTA, final-CTA background"
      - name: "ink-soft"
        oklch: "oklch(28% 0.006 30)"
        hex: "#3F3530"
        role: "secondary text, ledes, muted UI"
    extended:
      - name: "muted"
        oklch: "oklch(46% 0.008 70)"
        hex: "#6B6055"
        role: "tertiary text, captions, the 'before' state in comparisons"
    secondary: []
  usage_rules:
    cta: "ink"
    backgrounds: ["paper", "paper-deep"]
    navigation: ["ink"]
    accent: []

typography:
  display:
    family: "ABC Arizona Flare"
    weights: [300, 400, 500]
    italic: true
    role: "All headlines, display moments, em emphasis. Italic + medium weight (500) carries em without color."
  body:
    family: "ABC Arizona Sans"
    weights: [300, 400, 500, 700]
    role: "All body copy, button labels, navigation."
  kicker:
    family: "ABC Arizona Mix"
    weights: [400]
    italic: true
    role: "Small italic labels, byline metadata, image captions. Replaces uppercase-tracked-mono eyebrows."
  mono:
    family: "ui-monospace, 'SF Mono', Menlo, monospace"
    role: "Real technical chips only (model names, version strings, file extensions). Never decorative."
  rules:
    - "Em emphasis: italic + weight 500 against light (300) body. No color shift."
    - "Headlines tight-tracked: -0.04em to -0.058em depending on size."
    - "No uppercase tracked labels above section headings. Italic Mix is the section eyebrow."
    - "Mono is for actual technical labels, never decoration."
---

# Organic — Visual style

Source of truth for everything the brand looks like, plugged into every image and video prompt. Photography style, image-style categories, design tokens, typography.

## Where this came from

This VISUAL.md was extracted from the current homepage redesign (`public/index.html`), the brand archetype set in BRAND.md (Creator), and the explicit decisions made in the most recent design session: monochrome palette, ABC Arizona super-family, no uppercase tracked eyebrows, italic emphasis without color.

If the homepage moves, this file moves with it. Re-run `/imprint style http://localhost:3001/` after any visual refresh.

## Coherence with BRAND.md

The visual style mirrors the voice profile:

| Voice | Visual |
|---|---|
| Direct | Generous negative space, no decorative noise |
| Plainspoken | Monochrome — no rainbow palette pretending to add personality |
| Slightly skeptical | No AI-tool visual cliches (chip glow, brain-with-circuits) |
| Confident | Italic display headlines with tight kerning, no hedge in the type |
| Editorial | Off-center compositions, paper warmth, documentary register |

If voice and visual diverge, the brand reads as inconsistent. Cross-check before publishing any visual asset.

## Image style category sequencing

For a typical Organic article, the visual flow looks like:

| Surface | Style category | Why |
|---|---|---|
| Homepage hero (article preview card) | `editorial` | Demonstrates the editorial register the product produces |
| Article body images | `editorial` | Same register, applied at scale |
| Customer case study | `documentary` | Real subject, real environment |
| Product screenshots | `product` | Screen-accurate, no gradient soup |
| Social posts (X, LinkedIn) | `editorial` for long-form announcements, `product` for feature reveals | Match the surface |

The `default` style exists as a fallback when none of the above applies. Most marketing surfaces shouldn't need it.

## What to do when generating an image

When `/imprint image` runs, the layered prompt assembles:

```
[realism_base] + [global_feel] + [selected style narrative] + [storytelling_cues] + [scene brief] + [color palette in hex] + [avoid list]
```

Provider abstraction is set in env: `IMPRINT_IMAGE_PROVIDER=openai|fal|replicate|stability`. With none set, the prompt is emitted for paste-into-any-tool use.

## What to do when generating video

The video pipeline uses VISUAL.md to compose per-scene image prompts (one per scene, in the chosen style category) before passing each to the motion provider. The default video style for Organic content is `editorial`; documentary register is reserved for customer stories.

## Avoid list — why each entry exists

- **Stock office scenes**: Organic is positioned against generic content/agency clichés. Photography that looks like an agency stock library says the wrong thing.
- **AI-tool visual cliches** (chip glow, brain mesh, neural-net visualizations): Organic's pitch is "less AI in your AI content." Surfaces that visually announce "this is an AI tool" undermine the pitch.
- **Smooth-skinned AI portrait look**: The exact thing the humanizer is rewriting in text. Visuals shouldn't fall into the same fingerprint.
- **Diversity-stock-photo**: Performative composition. We work with real customers or skip the photo.
- **Travel-brochure register**: We're not selling experiences. Editorial register only.
- **Smiling-into-camera marketing portraits**: Subject mid-action, no eye contact. Documentary register.
- **Screenshots on gradient backgrounds**: This is the SaaS-marketing fingerprint. Paper-warm flat backgrounds with subtle drop shadow.
- **Suit-in-conference-room imagery**: The reader is not in this scene.

If the generator produces an image matching any avoid entry, regenerate. If the same pattern shows up across regenerations, add it to the avoid list with a note.
