---
photography_style:
  realism_base: "natural skin texture, realistic pores, slight facial asymmetry, candid moment, documentary photography, editorial realism, natural daylight, soft shadows, shallow depth of field, light film grain, avoid perfect symmetry, avoid stock photo look, avoid plastic skin"
  global_feel:
    - "documentary realism"
    - "calm and considered"
    - "ordinary people in real environments"
  narrative: "We photograph the real artifacts and environments of immigration: a passport on a kitchen table, hands filling out a form, a USCIS field office exterior, a family at home. Never staged office scenes, never stock-photo handshakes."
  storytelling_cues:
    - "subject is mid-action, not posed for camera"
    - "environmental context is visible and specific"
    - "natural light is the dominant light source"
    - "everyday objects are present (papers, mugs, keys)"
  lighting: "natural daylight, window-side, slightly overcast or late afternoon golden"
  mood: "calm, attentive, not anxious"
  composition: "editorial, off-center, eye-level"
  subjects:
    - "applicants in their own homes"
    - "documents and forms on real surfaces"
    - "USCIS field office exteriors"
    - "passport offices and immigration courts"
  avoid:
    - "stocky pose: smiling family hugging on a couch"
    - "any handshake"
    - "people pointing at laptops"
    - "people in business suits in a conference room"
    - "dramatic lighting"
    - "people in patriotic-American settings (flags, eagle imagery)"
    - "people of color used as the 'diversity shot'"
    - "exaggerated emotional expressions"

image_style_categories:
  - id: "default"
    label: "Default"
    narrative: "Base documentary style applied to all article hero images."
    storytelling_cues: []
    image_prompt_style: ""

  - id: "document-detail"
    label: "Document detail"
    narrative: "Close-up of immigration forms, paperwork, passports. Used when an article focuses on a specific document or filing requirement."
    storytelling_cues:
      - "tight framing on the document itself"
      - "a hand in frame, mid-action"
      - "a pen, a coffee mug, or a phone visible at the edge"
      - "natural daylight from a window, slightly overcast"
    image_prompt_style: "macro photography, shallow depth of field, paper texture visible, slight desaturation, editorial documentary"

  - id: "home-context"
    label: "Home context"
    narrative: "Applicants in their own homes — at the kitchen table, on the couch, in a home office. Used for articles about the applicant experience."
    storytelling_cues:
      - "subject is at home, in an everyday space"
      - "mid-30s to mid-50s subject, dressed for a Saturday morning"
      - "a laptop or papers visible nearby"
      - "the home looks lived-in, not staged"
    image_prompt_style: "natural light from a kitchen or living room window, shot on 35mm film, warm but not golden, slight grain"

  - id: "office-context"
    label: "Office context"
    narrative: "USCIS field offices, immigration court exteriors, attorney offices. Used for articles about agency procedures or in-person appearances."
    storytelling_cues:
      - "exterior or waiting-area framing"
      - "mid-day natural light"
      - "government-building architectural cues (without flags or eagles)"
      - "subject is incidental — a person walking through the frame, not the focal point"
    image_prompt_style: "documentary photography, neutral colors, slight overcast, architectural realism, no people centered"

design_tokens:
  colors:
    primary:
      - name: "ink"
        hex: "#2c2c2c"
        oklch: "oklch(26% 0 0)"
        role: "body text, navigation"
      - name: "marigold"
        hex: "#fdfe52"
        oklch: "oklch(97% 0.18 109)"
        role: "primary CTA"
      - name: "sky"
        hex: "#b8d4e8"
        oklch: "oklch(83% 0.05 230)"
        role: "soft accent, info backgrounds"
      - name: "paper"
        hex: "#fbfaf7"
        oklch: "oklch(98% 0.005 80)"
        role: "primary background"
    extended:
      - name: "juniper"
        hex: "#2d4a46"
        oklch: "oklch(35% 0.04 175)"
        role: "secondary accent, decisive moments"
      - name: "oat"
        hex: "#d5cfc7"
        oklch: "oklch(85% 0.008 70)"
        role: "muted background"
    secondary:
      - name: "rust"
        hex: "#a8385e"
        oklch: "oklch(45% 0.13 10)"
        role: "alert, deadline-related warning"
  usage_rules:
    cta: "marigold"
    backgrounds: ["paper", "oat"]
    navigation: ["ink"]
    accent: ["sky", "juniper"]
---

# Visual style: Greencard Law

VISUAL.md is the source of truth for everything the brand looks like. Photography style, image-style categories, design tokens. Plugged into every image and video prompt.

## Coherence

Photography style and design tokens both point toward the same brand attribute: *documentary realism without performative seriousness*. The marigold CTA, the muted backgrounds, the photographic preference for ordinary people in real environments — they all reinforce the same brand stance.

If you generate 5 hero images for 5 different articles using this VISUAL.md and the same image style category, they should look like they came from the same shoot.

## When to update

- After a brand refresh (new visual direction)
- When you add a new content type that needs its own photographic register (we added `office-context` when we started doing more procedure-focused articles)
- After 50-100 generated images, the avoid list usually needs additions based on patterns that the generator keeps producing
