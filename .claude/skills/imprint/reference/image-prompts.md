# Image prompt methodology

Brand-consistent image generation is about prompt structure, not prompt creativity. The structure is:

```
[realism base] + [global brand feel] + [style category context] + [scene-specific brief] + [color palette emphasis] + [avoid list]
```

Each layer is reusable. Set them once in VISUAL.md, compose for each image.

## The five layers

### 1. Realism base

Universal instructions that prevent the AI-stock-photo look. Same for every brand.

> natural skin texture, realistic pores, slight facial asymmetry, candid moment, documentary photography, editorial realism, natural daylight, soft shadows, shallow depth of field, light film grain, avoid perfect symmetry, avoid stock photo look, avoid plastic skin

The realism base is the floor. Brands can extend it but not weaken it.

### 2. Global brand feel

The brand's photography signature, set in VISUAL.md. Three to five short phrases.

```yaml
photography_style:
  global_feel:
    - "authentic and approachable"
    - "light-filled and natural"
    - "grounded in real moments"
  lighting: "natural, soft"
  mood: "warm, human"
  composition: "editorial, candid"
  subjects: ["families at home", "professionals in their workspace"]
  avoid: ["stocky poses", "heavy filters", "dark or dramatic lighting"]
```

This becomes a clause appended to every image prompt:

> Photography style: authentic and approachable, light-filled and natural, grounded in real moments. Lighting: natural, soft. Mood: warm, human. Composition: editorial, candid. Subjects: families at home, professionals in their workspace. Avoid: stocky poses, heavy filters, dark or dramatic lighting.

### 3. Style category

VISUAL.md defines named image styles per brand. Each style has its own narrative + storytelling cues + prompt-style addendum.

```yaml
image_style_categories:
  - id: "editorial"
    label: "Editorial"
    narrative: "Magazine-quality lifestyle photography. The subject is doing something meaningful, captured in a real environment."
    storytelling_cues:
      - "subject is mid-action, not posed"
      - "environmental context visible (room, street, workspace)"
      - "natural light is the dominant light source"
    image_prompt_style: "shot on 35mm film, medium format quality, soft natural lighting from a window, warm color grading"
  - id: "clinical"
    label: "Clinical"
    narrative: "Healthcare or technical contexts. Calm, precise, trustworthy. No medical-stock cliches."
    storytelling_cues:
      - "subject is a real professional, not an actor"
      - "equipment is realistic and present but not foregrounded"
      - "soft, even lighting"
    image_prompt_style: "documentary medical photography, soft daylight, muted but not desaturated colors, single subject focus"
```

The selected style's narrative + cues + prompt-style get injected into the prompt.

### 4. Scene-specific brief

The actual subject of this image: what's happening, who's in it, where, what they're doing.

> A first-time homebuyer in their early thirties walking through an empty Seattle craftsman home, late afternoon, holding a clipboard, looking up at a high beamed ceiling. Real estate agent visible in the background, mid-explanation. Warm hardwood floors, large bay windows letting in golden hour light.

The scene brief is the part that's unique to this image. Specific. Place. Time. Action. Visible context.

### 5. Color palette emphasis

The brand's design tokens, named in the prompt so the image generator pulls the brand's actual hues.

> Color palette emphasis: obsidian (#1a1a1a), marigold (#e5a00d), sky (#b8d4e8), white (#FFFFFF), with subtle support from juniper (#2d4a46) and oat (#d5cfc7).

When the prompt names hex codes, the generator skews toward those hues. Combined with the realism base and the brand feel, this is what makes a series of generated images feel like they came from the same shoot.

## The avoid list

Every prompt ends with an explicit avoid list — what NOT to produce.

Universal avoid list:

```
avoid: stock photo look, generic smiling models, plastic skin, perfect teeth, perfectly symmetrical compositions, overly saturated colors, vignette filters, blurred backgrounds with bokeh balls, business-cliche scenes (handshakes, pointing at laptops), AI-generated artifacts in faces
```

Brand-specific avoid list (VISUAL.md) adds to this. Examples:

- A wellness brand might add "no clinical-pharmacy environments, no white coats"
- A consumer-tech brand might add "no people in business suits, no boardroom scenes"
- A travel brand might add "no posed couple-on-beach, no tropical sunset cliches"

## Prompt template

```
{realism_base}.

Photography style: {brand.global_feel | joined}.
Lighting: {brand.lighting}.
Mood: {brand.mood}.
Composition: {brand.composition}.
Subjects: {brand.subjects | joined}.

{style.narrative}

Storytelling cues: {style.storytelling_cues | joined}.

{style.image_prompt_style}.

Scene: {scene_brief}

Color palette emphasis: {colors | hex-named, joined}.

Avoid: {brand.avoid + universal.avoid | joined}.
```

The `image` command composes this from VISUAL.md + the user's scene brief.

## Composite mode (background + product)

Some images compose a brand-styled background with a separate product image. The composite mode produces:

1. A background prompt (using the layers above)
2. A product crop/extract step (if the product image is supplied)
3. A blend specification (how the product sits in the scene — natural placement, lighting harmonization, shadow generation)

The composite spec emitted by `image` looks like:

```yaml
mode: composite
background:
  prompt: "<full layered prompt>"
  aspect_ratio: "16:9"
  resolution: "1344x768"
product:
  source: "/path/to/product.png" | "search: <query>"
  scale: 0.4              # fraction of background width
  position: "center-bottom" | "left-third" | "right-third"
  lighting_match: true     # apply background lighting to product
blend:
  shadow: cast | none
  edge: feather | hard
```

The composite is generated by the provider (or emitted as a spec the human runs through any image tool).

## Provider abstraction

The `image` command is provider-agnostic by default. Set `IMPRINT_IMAGE_PROVIDER` env to one of:

| Provider | env var | Default model |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | gpt-image-1 |
| FAL | `FAL_API_KEY` | flux-pro |
| Replicate | `REPLICATE_API_TOKEN` | flux-1.1-pro |
| Stability | `STABILITY_API_KEY` | stable-diffusion-3.5 |
| None | unset | emit prompt only |

With no provider, `image` emits the composed prompt and the user can paste it into any tool. With a provider configured, the skill calls out and returns the generated image.

## Voice and style alignment

The image system intentionally mirrors the text system:

| Text | Image |
|---|---|
| BRAND.md | VISUAL.md |
| Voice profile (VOICE.md) | Style categories (in VISUAL.md) |
| Tone descriptors | Mood + lighting |
| Banned phrases | Avoid list |
| Sample phrases | Sample images (optional, base64 in VISUAL.md) |

A brand that has both a voice profile AND a visual style produces text and images that visibly belong to the same brand. That coherence is the point.

## What NOT to do

- **Don't use generic image style names.** "Cinematic", "professional", "modern" mean nothing to a generator. Use specific narratives.
- **Don't omit the realism base.** This is what prevents the AI-stock look.
- **Don't omit the avoid list.** Models default to the cliches; you have to explicitly reject them.
- **Don't change style per-article on a whim.** Brand coherence requires the same style applied consistently. Use named style categories for the variations that exist.
- **Don't generate images without a scene brief.** Generic prompts produce generic images.
