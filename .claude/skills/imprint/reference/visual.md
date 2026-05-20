# Visual style methodology

VISUAL.md is the source of truth for everything the brand looks like. Photography style, image-style categories, design tokens. Plugged into every image and video prompt.

## Three layers

| Layer | What it controls |
|---|---|
| **Photography style** | Universal brand-image rules: lighting, mood, composition, subjects, avoid list. Same for every image the brand produces. |
| **Image style categories** | Named variations on the photography style. "Editorial", "lifestyle", "clinical", "documentary". A brand has 1-6 of these. |
| **Design tokens** | Brand colors, with usage rules (CTA, background, accent). Referenced in image prompts to align hue to brand. |

## Photography style schema

```yaml
photography_style:
  realism_base: string         # universal, set by the skill, brand can extend
  global_feel: [string]        # 3-5 short phrases ("light-filled and natural")
  narrative: string            # optional: what the photography is *about*
  storytelling_cues: [string]  # patterns the photography uses
  lighting: string             # one phrase ("natural, soft")
  mood: string                 # one phrase ("warm, human")
  composition: string          # one phrase ("editorial, candid")
  subjects: [string]           # who/what appears
  avoid: [string]              # what the photography never does
```

The `realism_base` is universal:

> natural skin texture, realistic pores, slight facial asymmetry, candid moment, documentary photography, editorial realism, natural daylight, soft shadows, shallow depth of field, light film grain, avoid perfect symmetry, avoid stock photo look, avoid plastic skin

Brands may add to it, never weaken it.

## Image style categories schema

```yaml
image_style_categories:
  - id: string                     # kebab-case unique key
    label: string                  # display name
    narrative: string              # one paragraph: what this style is about
    storytelling_cues: [string]    # 2-5 patterns specific to this style
    image_prompt_style: string     # the prompt addendum (technical specs)
    thumbnail_url: string          # optional: example image
    type: "prompt" | "composite"   # default "prompt"
    composite_bg_prompt: string    # for composite mode
    composite_product_query: string # for composite mode
```

A brand typically has:

- `default` — the universal photography style applied directly
- 1-3 named styles for distinct use cases ("editorial" for articles, "product" for ecommerce, "team" for portraits)
- 0-2 composite styles for background-plus-product compositions

## Design tokens schema

```yaml
design_tokens:
  colors:
    primary:
      - name: string         # "obsidian"
        hex: string          # "#2c2c2c"
        role: string         # "navigation, body text"
    extended:
      - name: string
        hex: string
        role: string
    secondary:
      - name: string
        hex: string
        role: string
  usage_rules:
    cta: string              # name of color for CTAs
    backgrounds: [string]    # list of color names
    navigation: [string]
    accent: [string]
```

The names are intentionally not generic ("primary-1", "primary-2"). Real names ("obsidian", "marigold", "sky", "juniper") help the team and the AI both speak about the brand consistently.

Hex values get injected verbatim into image prompts so generators pull the actual brand hues. Generic prompts ("dark and warm colors") produce generic output; named hex codes anchor the result.

## OKLCH preferred for new brands

For new brands authoring VISUAL.md from scratch, OKLCH is the recommended color space:

- Perceptually uniform — equal numeric steps look equal to the eye
- Easier to generate harmonious scales
- Better for accessibility (predictable contrast at given lightness)

```yaml
primary:
  - name: "obsidian"
    oklch: "oklch(26% 0 0)"
    hex: "#2c2c2c"
    role: "navigation, body text"
```

Include both for backward compatibility with hex-only tooling.

## Photography style by brand archetype

Different archetypes lean different ways. Use the table as a starting point; tune per brand.

| Archetype | Mood | Lighting | Composition | Subjects |
|---|---|---|---|---|
| Guide (informational) | calm, clear | even, natural | editorial, balanced | real practitioners, real artifacts |
| Hero (aspirational) | warm, momentum | golden hour, directional | dynamic, centered | individuals in motion, achievement moments |
| Sage (authoritative) | composed, contemplative | even, slight shadow | classical, symmetric | experts at work, environments of expertise |
| Caregiver (supportive) | warm, soft | window light | intimate, close | hands, gestures, shared moments |
| Creator (artistic) | bold, intentional | mixed, sometimes dramatic | unconventional | makers and their tools, process |
| Explorer (adventurous) | bright, expansive | natural, often outdoor | wide, environment-led | landscapes, transit, gear in use |
| Magician (transformative) | mysterious, refined | low-key, controlled | minimal, focal | one subject, isolated, intentional |
| Outlaw (challenging) | gritty, edged | high-contrast, hard | confrontational, askew | unconventional subjects, raw moments |

## The universal avoid list

Every brand's photography avoids:

- Stock photo look
- Generic smiling models
- Plastic skin, perfect teeth
- Perfectly symmetrical compositions
- Overly saturated colors
- Vignette filters
- Blurred backgrounds with bokeh balls (the "AI-image fingerprint")
- Business-cliche scenes: handshakes, pointing at laptops, conference rooms with no subjects
- AI-generated artifacts in faces
- 1990s-stock-photography poses
- Identical compositions across multiple images in a series

Brands extend this with their own avoid list.

## When to define a new style category

Add a named style category when the brand has a use case that the default style doesn't handle. Examples:

- **Article hero images** are different from **homepage hero images**. Add an "editorial" style with article-specific cues.
- **Product photography** needs different lighting than **lifestyle photography**. Add a "product" style.
- **Team portraits** need consistent framing across photos. Add a "team" style.

Don't add a style category for one-off needs. If you'd use it on fewer than 5 images, write a one-off prompt instead.

## Coherence test

After defining VISUAL.md, generate 5 images using the brand's defaults for 5 different scenes. Do they look like they came from the same brand? Same eye, same hand, same lighting feel?

If no, the photography style is under-specified. Add specifics until the answer is yes.

## What gets pushed to providers

When a brand has VISUAL.md and the skill calls an image provider, the request includes:

- The composed prompt (all five layers from `image-prompts.md`)
- Aspect ratio (per the requested use)
- Reference images (if the provider supports them — base64 thumbnails of past brand work)
- Negative prompt (the avoid list)

Some providers accept brand-specific tuning (style references, IP-Adapter inputs). VISUAL.md can include those in extension fields the provider abstraction reads.

## Coordinating with VOICE.md

VOICE.md and VISUAL.md should reference the same archetype, audiences, and brand attributes. Cross-check:

- Same archetype in both
- Same audiences in both
- Same `avoid` patterns in spirit (a voice that bans "navigate" should have photography that bans "subjects pointing at signs")
- Same level of formality

If voice and visual diverge, the brand will produce articles that feel inconsistent with their hero images. Fix by aligning archetype first, then derivative fields.
