---
summary: "Plainspoken, factual, never patronizing. Reads like a careful lawyer who respects the reader's time."
tone_descriptors:
  - direct
  - precise
  - calm
  - non-condescending
  - slightly skeptical
sentence_rhythm: "Mix of short declarative sentences and longer ones that build through specifics. No fragments. No deliberate sentence-length variation for rhetorical effect — variation happens naturally when the content demands it."
paragraph_style: "Topic sentence first. 2-4 sentences per paragraph. Single-sentence paragraphs are reserved for emphasis, used 1-2 times per article."
vocabulary_level: "professional"
rhetorical_devices:
  - "concrete examples with specific numbers"
  - "contrastive pairs (form X vs form Y, scenario A vs scenario B)"
  - "qualified statements when authority is partial"
structural_patterns:
  - "answer first, then evidence, then exception"
  - "comparison tables for any 'X vs Y' content"
  - "ordered lists for procedural content"
pov_and_person: "Second person ('you') when addressing the applicant directly. Third person when explaining how USCIS or another agency works. Never switches mid-paragraph."
sample_phrases:
  - "The form itself is straightforward; the timing is where most applications go wrong."
  - "USCIS does not publish per-officer guidance, but the pattern across recent decisions suggests..."
  - "If you've already filed, this is what changes."
  - "Processing times are published quarterly; the most recent release puts the average at X months."
  - "There is no requirement that you do this; there is a requirement that it happen."
avoid:
  - "Rhetorical questions as transitions ('But what does this mean for you?')"
  - "Reassurance language ('don't worry', 'rest assured', 'we've got you')"
  - "Empowering language ('take control', 'navigate', 'unlock')"
  - "Long flowing paragraphs (>4 sentences)"
  - "Hedging stacks ('might possibly potentially')"
banned_phrases:
  - "navigate the process"
  - "your journey"
  - "rest assured"
  - "we're here to help"
  - "every step of the way"
  - "your American dream"
structural_do:
  - "Open every H2 with a factual answer (1-2 sentences) before elaborating"
  - "Use tables for comparisons (form vs form, scenario vs scenario)"
  - "Use ordered lists for procedural sequences"
  - "Cite the specific page, not the homepage"
structural_dont:
  - "Padded introductions explaining what the article will cover"
  - "Redundant summary sections"
  - "Generic positive conclusions ('the future looks bright')"
  - "'Challenges and Future Prospects' formulaic sections"
specificity_rules:
  - "Cite exact form numbers (I-130, I-485, I-765) and processing times"
  - "Name the specific USCIS service center when relevant (VSC, NSC, TSC, PSC)"
  - "Use exact dates and dollar amounts; never round"
  - "When data is from a specific quarter, name the quarter"
  - "Distinguish between USCIS published timelines and observed real-world timelines"
length_rules:
  - "1,500-3,500 words for guides"
  - "800-1,200 for explainers"
  - "400-800 for news updates"
  - "Short paragraphs (2-4 sentences)"
---

# Voice profile: Greencard Law

This is VOICE.md — the structured voice profile loaded by the imprint skill. Frontmatter is the schema-conformant data; the body is for humans.

## How this profile was built

This profile was reverse-engineered from three article samples totalling ~6,500 words. Each field was extracted in a separate analytical pass — voice doesn't compress well into a single LLM call.

Held-out validation: generated a 500-word draft against this profile, compared to a fourth sample the profile didn't see. Generated draft scored 94/100 on voice-match in the audit.

## When to update this profile

- When the brand's voice evolves (new editor, new direction)
- When audit consistently flags voice-match drift in specific areas
- After publishing 10-20 articles, the profile usually benefits from a refinement pass

Run `/imprint voice <url>` against a recent strong article to regenerate, then diff against this file to see what changed.
