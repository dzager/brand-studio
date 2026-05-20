# video

Generate a brand-consistent video: script + storyboard + per-scene image prompts + motion spec. With provider configured, render the actual motion clips. Final assembly is downstream (a video editor).

See `video-spec.md` for the full methodology (the four artifacts, motion vocabulary, audio handling).

## Command workflow

When invoked as `/imprint video <topic>`:

1. Load BRAND.md + VOICE.md (script writes in brand voice) + VISUAL.md (scene images use brand visual style)
2. Generate the script — N scenes, each with VO + caption + duration
3. For each scene, generate a storyboard description
4. For each scene, compose an image prompt (via `image-prompts.md` methodology)
5. If `IMPRINT_IMAGE_PROVIDER` is set, generate the per-scene image
6. For each scene, compose the motion spec (motion type + intensity + duration + camera + audio notes)
7. If `IMPRINT_VIDEO_PROVIDER` is set, call the motion provider per scene (passing the scene image + motion spec)
8. Emit: script.md + storyboard.md + scene-images/ + scene-clips/ + spec.json
9. Hand off to user for final assembly

## Inputs

- **Topic** (required): one-line description of the video subject
- **Duration target** (optional, default: 60 seconds): total target length
- **Content type** (optional, default: `explainer`): one of `explainer`, `testimonial`, `product_demo`, `brand_film`, `tutorial`
- **Aspect ratio** (optional, default: 16:9): also accepts 9:16 (vertical), 1:1 (square)
- **Image style** (optional, default: VISUAL.md `default`): which named style category

## Provider configuration

### Image provider (per-scene scene images)

Same as `image` command. With no image provider, scene images are emitted as prompts only — the user generates them downstream.

### Video / motion provider

| Provider | env var | Default model | Notes |
|---|---|---|---|
| OpenAI Sora | `OPENAI_API_KEY` | sora-2 | Cinematic motion |
| Runway | `RUNWAY_API_KEY` | gen-4 | Image-to-motion |
| Google Veo | `GOOGLE_API_KEY` | veo-3 | Natural motion physics |
| Luma | `LUMA_API_KEY` | dream-machine-2 | Stylized motion |

Override with `IMPRINT_VIDEO_PROVIDER=sora` etc. With no video provider, the spec is emitted and the user calls a provider downstream.

## Script generation

Script generation is brand-voiced — uses the full system prompt from `brand.md` (including VOICE.md overlay). Constraints:

- Each scene: 3-8 seconds
- VO is short — 12-25 words per scene
- Caption (optional): the 3-7 word version of the VO key fact
- No "Hi, today we're going to talk about..." openings — same first-sentence-quality rules apply

For a 60-second video, expect 8-15 scenes.

## Storyboard generation

For each scene, generate a written description:

- Subject (who/what is on screen)
- Action (what they're doing)
- Environment (where, what's visible in frame)
- Lighting (natural daylight, golden hour, indoor warm, low-key, etc.)
- Mood (per BRAND.md tone)

The storyboard description is the scene-brief slot in the image prompt.

## Motion spec composition

For each scene:

```yaml
motion_type: dolly_in | pan_left | pan_right | static | tilt_up | tilt_down | parallax | zoom_in | zoom_out
motion_intensity: subtle | moderate | strong
duration_seconds: integer
camera_notes: string
audio_notes: string
```

Default to `subtle` intensity. Default to `static` motion for talking-head shots and `dolly_in` for product/emphasis shots.

One motion per scene; no combinations.

## Audio

Audio is part of the spec but generation is downstream in v1. The spec captures:

- VO recording (human-supplied or TTS)
- Music (genre, mood, intensity)
- Ambient (location-appropriate room tone)
- SFX (action sound effects, if any)

The audio mix is the human's job. The spec describes it; the motion render produces silent footage.

## End-to-end render flow

When both `IMPRINT_IMAGE_PROVIDER` and `IMPRINT_VIDEO_PROVIDER` are set:

```
1.  Generate script (1 LLM call)
2.  For each scene:
    a. Compose image prompt
    b. Generate scene image
    c. Compose motion spec
    d. Call video provider with image + motion spec
    e. Receive clip
3.  Emit: script.md, storyboard.md, scene-images/, scene-clips/, spec.json
4.  Hand off to user for final assembly
```

A 60-second video with 12 scenes runs ~12 image generations + 12 motion generations. Budget accordingly.

## Output structure

```
out/<video-slug>/
├── script.md
├── storyboard.md
├── spec.json
├── scene-images/
│   ├── scene-01.png
│   ├── scene-02.png
│   └── ...
└── scene-clips/
    ├── scene-01.mp4
    ├── scene-02.mp4
    └── ...
```

`spec.json` follows the schema in `schemas/video-spec.schema.json` — the canonical artifact.

## Provider failure handling

| Failure | Handling |
|---|---|
| Image provider fails on one scene | Emit scene image as prompt only; flag in spec.json |
| Video provider fails on one scene | Save scene image; flag scene as `clip_missing` |
| All providers fail | Emit script + storyboard + per-scene image prompts + motion specs. User runs the rest manually. |

The script and spec are always emitted regardless of provider availability.

## Confirmation flow

Before calling paid providers, surface:

- The full script
- Per-scene image prompts (or the first 3 as a sample)
- Provider being called and estimated cost
- Confirm to proceed

With `--yes`, skip confirmation.

## Final assembly

The skill stops at scene clips. The user assembles in their video editor:

- Drop scene clips on a timeline
- Add VO recording
- Add music + ambient + SFX
- Color-grade if needed
- Export

A finished 60-second video typically takes 15-30 minutes of assembly time after the skill's output is ready.

## What NOT to do

- Don't try to render the final cut from the skill
- Don't combine motion types per scene
- Don't use `strong` motion as the default
- Don't ignore VISUAL.md for video — the same visual style powers every scene
- Don't pretend a 30-second AI-generated piece is a finished video without color, audio, and a human cut
