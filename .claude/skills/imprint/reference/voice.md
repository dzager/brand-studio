# voice

Two purposes in one file: the methodology for authoring a voice profile (used by `article`, `short`, `polish`, `audit`) and the workflow for the `voice` command which reverse-engineers a profile from samples.

## Command workflow

When invoked as `/imprint voice <url|text>`:

1. Fetch the URL (or accept pasted text) — minimum 800 words across 1+ samples
2. Extract the article body cleanly (skip nav, sidebars, comments)
3. Run six separate analytical passes (one per profile field group)
4. Assemble into VOICE.md against `schemas/voice.schema.json`
5. Validate by generating one paragraph in the new voice; compare to a held-out sample
6. Save to `./VOICE.md` (or wherever the loader expects)
7. Show the user the profile and offer to revise specific fields

Don't write the schema in one pass. Separate passes are how to avoid the LLM smoothing every field toward a generic "professional but approachable" voice.

## Voice profile schema

```yaml
summary: string                # one-sentence voice in plain language
tone_descriptors: [string]     # 3-7 axes ("confident", "direct", "warm")
sentence_rhythm: string        # describe the cadence
paragraph_style: string        # describe the paragraph shape
vocabulary_level: string       # plain / professional / technical / academic
rhetorical_devices: [string]   # devices to use
structural_patterns: [string]  # how the brand structures arguments
pov_and_person: string         # first / second / third + plural?
sample_phrases: [string]       # 5-15 characteristic phrases from real samples
avoid: [string]                # voice-level patterns to avoid (separate from banned-phrases)
banned_phrases: [string]       # brand-specific bans beyond the universal list
structural_do: [string]        # structural elements the brand uses
structural_dont: [string]      # structural anti-patterns
specificity_rules: [string]    # what kinds of specifics the brand insists on
length_rules: [string]         # length preferences
```

The full JSON schema lives at `schemas/voice.schema.json` and is loaded by `voice` and `polish`.

## Authoring methodology (used both manually and by the command)

### What each field captures

| Field | What to look for |
|---|---|
| `summary` | One sentence someone could use to describe the brand to a friend |
| `tone_descriptors` | Adjectives that appear consistently. Reject generic ones (professional, engaging). Favor specific ones (skeptical, dryly funny, plainspoken) |
| `sentence_rhythm` | Sentence lengths in the samples. Patterns of short-then-long. Use of fragments. Use of clauses |
| `paragraph_style` | Average paragraph length. Topic-sentence-first or argument-builds. Use of single-sentence paragraphs for emphasis |
| `vocabulary_level` | Plain language? Industry jargon? When does the brand reach for a less common word? |
| `rhetorical_devices` | Anaphora, parallelism, rule of three, concrete metaphor. Find what is actually present, do not invent |
| `pov_and_person` | First singular / first plural / second / third. Mixed? When does the brand switch? |
| `sample_phrases` | 5-15 phrases pulled verbatim from the samples |
| `avoid` | Patterns the brand consistently does NOT use that another brand would |
| `banned_phrases` | Specific phrases that should never appear |
| `structural_do` / `structural_dont` | Section structures, list usage, headline conventions |
| `specificity_rules` | What kinds of specifics the brand insists on |
| `length_rules` | Short paragraphs, dense sections, no walls of text, target article length |

### Validation

Take one sample the analysis did not see. Ask: would the profile generate output that fits this sample? If yes, ship. If no, revise the fields that miss.

The minimum viable profile is `summary` + `tone_descriptors` + `pov_and_person`. Add the rest as you observe patterns.

## How the profile injects into prompts

The skill compiles the profile into a clause appended to the system prompt:

```
WRITING VOICE PROFILE — match this voice closely:
Voice summary: {summary}
Tone: {tone_descriptors joined}.
Sentence rhythm: {sentence_rhythm}
Paragraph style: {paragraph_style}
Vocabulary: {vocabulary_level}
Rhetorical devices to use: {rhetorical_devices joined}.
Structural patterns: {structural_patterns joined}.
Point of view: {pov_and_person}
Characteristic phrases to emulate: "{sample_phrases joined with quotes}".
Voice patterns to avoid: {avoid joined}.
```

Fields handled elsewhere (`banned_phrases`, `specificity_rules`, `length_rules`, `structural_do/dont`) are intentionally NOT injected here — they are handled by dedicated sections in the system prompt to avoid duplication.

## Example: a strong profile

A snippet from a real one (a legal-content brand serving immigration applicants):

```yaml
summary: "Plainspoken, factual, never patronizing. Reads like a careful lawyer who respects the reader's time."

tone_descriptors:
  - direct
  - precise
  - calm
  - non-condescending
  - slightly skeptical

sentence_rhythm: "Mix of short declarative sentences and longer ones that build through specifics. No fragments. No deliberate sentence-length variation for rhetorical effect."

paragraph_style: "Topic sentence first. 2-4 sentences per paragraph. Single-sentence paragraphs are reserved for emphasis (1-2 per article)."

vocabulary_level: "Professional, but explains every technical term on first use. Never uses legal jargon as a shortcut."

pov_and_person: "Second person ('you') when addressing the applicant. Third person when explaining how the agency works."

sample_phrases:
  - "The form itself is straightforward; the timing is where most applications go wrong."
  - "USCIS does not publish per-officer guidance, but the pattern across recent decisions suggests..."
  - "If you've already filed, this is what changes."

avoid:
  - "Rhetorical questions as transitions"
  - "Reassurance ('don't worry', 'rest assured')"
  - "Empowering language ('take control', 'navigate')"
  - "Long flowing paragraphs"

banned_phrases:
  - "navigate the process"
  - "your journey"
  - "rest assured"
  - "we're here to help"

specificity_rules:
  - "Cite exact form numbers (I-130, I-485) and processing times"
  - "Name the specific USCIS service center when relevant"
  - "Use exact dates and dollar amounts; never round"

length_rules:
  - "1,500-3,500 words for guides. 800-1,200 for explainers."
  - "Short paragraphs (2-4 sentences)"
```

## When the profile is wrong

If output sounds off-brand even with a profile present, debug in this order:

1. Read the latest output. Identify 2-3 specific sentences that do not fit.
2. Trace each to a profile field. Is the field present? Is it specific? Or does it say "professional and approachable" (i.e., nothing)?
3. Tighten the field. Add a sample phrase that demonstrates what you want. Add an `avoid` entry for the pattern you do not want.
4. Regenerate one paragraph, not the whole article. Then judge.

The profile is a tool. Iterate it like one.
