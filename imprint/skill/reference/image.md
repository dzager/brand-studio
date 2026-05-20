# image

Compose a brand-styled image prompt. Optional: call a provider and return the generated image.

See `image-prompts.md` for the full methodology — five layers, composite mode, provider abstraction.

## Command workflow

When invoked as `/imprint image <prompt>`:

1. Load VISUAL.md (if missing, fall back to BRAND.md's archetype-derived defaults and warn)
2. Compose the layered prompt:
   - Realism base (universal)
   - Brand photography style (from VISUAL.md)
   - Selected image style category (default `default`; user can specify `--style=editorial`)
   - User's scene brief (the `<prompt>` argument)
   - Color palette (from VISUAL.md design tokens)
   - Avoid list (universal + brand-specific)
3. If `IMPRINT_IMAGE_PROVIDER` is set, call the provider; return image + prompt
4. If not, emit the composed prompt for the user to run through any tool

## Inputs

- **Scene brief** (required): one or two sentences of what's happening
- **Style** (optional, default: `default`): one of the brand's image style categories
- **Aspect ratio** (optional, default: `16:9`)
- **Resolution** (optional, default: provider's recommended)
- **Reference image** (optional): a base64 image to use as a style reference (provider must support)

## Inputs the layered prompt uses

From VISUAL.md:

- `photography_style.realism_base` + extensions
- `photography_style.global_feel`
- `photography_style.lighting / mood / composition / subjects`
- `image_style_categories[<style>]`
- `design_tokens.colors`
- `photography_style.avoid` + universal avoid list

From the user:

- The scene brief
- Style selector (if any)
- Aspect ratio (if any)

## Output

```yaml
prompt: string                  # the full composed prompt
provider: string                # which provider was used (or "none")
image_url: string               # if provider called
seed: integer                   # for reproducibility (if provider supports)
metadata:
  style_used: string
  aspect_ratio: string
  resolution: string
```

If `--out=<path>` is set, save the image to disk. Default behavior with a provider configured: save to `./images/<slug>.png` and return the path.

## Provider configuration

| Provider | env var | Default model |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | gpt-image-1 |
| FAL | `FAL_API_KEY` | flux-pro |
| Replicate | `REPLICATE_API_TOKEN` | flux-1.1-pro |
| Stability | `STABILITY_API_KEY` | stable-diffusion-3.5 |

Override with `IMPRINT_IMAGE_PROVIDER=fal` etc. With no provider, the command emits the composed prompt only.

## Composite mode

For background+product compositions (product photography, scene-with-product hero shots):

```
/imprint image "<scene>" --style=composite --product=/path/to/product.png
```

Workflow:

1. Generate background from the layered prompt
2. Extract product (or use supplied product image)
3. Compose with the blend spec from VISUAL.md (or supplied)
4. Return the composite

See `image-prompts.md` for the composite specification format.

## Confirmation flow

Before calling a paid provider, surface:

- The composed prompt (so the user can edit before generation)
- The provider being called
- The estimated cost (per the provider's pricing)

Default: ask once. With `--yes`, skip confirmation.
