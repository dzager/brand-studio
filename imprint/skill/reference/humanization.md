# Humanization methodology

The shape of an AI-written sentence is detectable. Detectors aren't magic — they're pattern-matchers. The patterns are well-understood. This reference is the playbook.

Humanization is a separate pass. Don't try to bake it into generation; the model will smooth back toward the patterns it was trained on. Generate, then rewrite.

## First principles

Humanization isn't about adding casual phrases or sprinkling typos. It's about:

1. **Replacing AI rhetorical scaffolding with direct statement.**
2. **Letting personality leak through** — opinion, mixed feelings, specific detail.
3. **Varying rhythm.** AI flatlines. Humans don't.
4. **Cutting filler.** Most AI sentences carry 30% structural-puffery weight.

Don't confuse humanization with degrading the prose. The goal is *more* writing skill, not less.

## Personality and soul

Avoiding AI patterns is half the job. Sterile, voiceless writing is just as obvious as slop.

### Signs of soulless writing (even if technically "clean")

- Every sentence is the same length and structure
- No opinions, just neutral reporting
- No acknowledgment of uncertainty or mixed feelings
- No first-person perspective when appropriate
- Reads like a Wikipedia article or press release

### How to add voice

- **Have opinions.** Don't just report facts — react to them. "I genuinely don't know how to feel about this" is more human than a neutral pros-and-cons list.
- **Vary rhythm.** Short punchy sentences. Then longer ones that take their time. Mix it up.
- **Acknowledge complexity.** Real humans have mixed feelings.
- **Use "I" when it fits.** First person isn't unprofessional — it's honest.
- **Let some mess in.** Perfect structure feels algorithmic.
- **Be specific about feelings.** Not "this is concerning" but "there's something unsettling about this proposal that I can't quite put my finger on."

## First sentence (highest priority)

The opening sentence is the single highest-priority fix. AI-generated content almost always opens with generic framing.

Eliminate these openings:

- "When it comes to [topic]..." → Start with a specific fact.
- "If you're looking for / considering / planning..." → Start with what happened, not what the reader wants.
- "[Topic] is an important / complex / significant..." → Start with evidence of importance, not a claim of importance.
- "Understanding [topic] is crucial..." → Start with what there is to understand.
- "In today's world / landscape / environment..." → Start with a specific, dated fact.
- "Are you ready to / wondering about..." → Never address the reader in the opening.

A good first sentence states a specific verifiable fact, cites a surprising statistic, puts the reader in a concrete scenario, or demonstrates expertise in the first 15 words.

## Content patterns to fix

### 1. Undue emphasis on significance, legacy, and broader trends

**Watch:** *stands as / serves as, is a testament, is a reminder, a vital / significant / crucial / pivotal / key role / moment, underscores / highlights its importance, reflects broader, symbolizing its ongoing / enduring / lasting, contributing to the, setting the stage for, marking / shaping the, represents / marks a shift, key turning point, evolving landscape, focal point, indelible mark, deeply rooted.*

**Problem:** LLMs puff up importance by adding statements about how arbitrary aspects represent or contribute to a broader topic. Cut these phrases; state the fact.

### 2. Superficial analyses with -ing endings

**Watch:** *highlighting / underscoring / emphasizing..., ensuring..., reflecting / symbolizing..., contributing to..., cultivating / fostering..., encompassing..., showcasing...*

**Problem:** LLMs tack present-participle phrases onto sentences to add fake depth. The -ing phrase rarely says anything the main clause didn't.

### 3. Promotional / advertisement-like language

**Watch:** *boasts a, vibrant, rich (figurative), profound, enhancing its, showcasing, exemplifies, commitment to, natural beauty, nestled, in the heart of, groundbreaking (figurative), renowned, breathtaking, must-visit, stunning.*

**Problem:** LLMs default to a travel-brochure register, especially on "heritage" or "culture" topics. Replace with direct factual description.

### 4. Vague attributions and weasel words

**Watch:** *Industry reports, Observers have cited, Experts argue, Some critics argue, several sources / publications (when few are cited).*

**Problem:** LLMs attribute opinions to vague authorities without specific sources. Replace with a named, linked source. If no source exists, qualify the claim.

### 5. Formulaic "Challenges and Future Prospects" sections

**Watch:** *"Despite its... faces several challenges..." / "Despite these challenges..." / "Challenges and Legacy" / "Future Outlook."*

**Problem:** Many LLM articles include a stock challenges-and-future section. Cut it unless you have specific, sourced challenges and a specific, dated forecast.

### 5b. Casual dramatic framing and negative editorial coloring

**Watch:** *brace yourself, buckle up, steel yourself, here's the kicker, spoiler alert, the harsh reality, the hard truth, hate to break it to you, not for the faint of heart, sticker shock, can be brutal, painfully slow.*

**Problem:** Reads like a Reddit commenter, not a professional writer. Replace dramatic framing with direct factual statement.

| Bad | Good |
|---|---|
| If you're applying for a marriage-based green card in 2026, brace yourself for a wait. | If you're applying for a marriage-based green card in 2026, expect the process to take a year or more. |
| The costs can be brutal — especially if your case gets complicated. | Total costs typically range from $1,500 to $3,000, with additional expenses if complications arise. |

## Language and grammar patterns to fix

### 6. Overused "AI vocabulary" words

**High-frequency AI words:** *Additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight (verb), interplay, intricate / intricacies, key (adjective), landscape (abstract), pivotal, showcase, tapestry, testament, underscore (verb), valuable, vibrant.*

**Problem:** These appear far more frequently in AI text. Replace with simpler alternatives or just delete.

### 7. Copula avoidance

**Watch:** *serves as / stands as / marks / represents [a], boasts / features / offers [a].*

**Problem:** LLMs substitute elaborate constructions for "is" and "are". Use the copula.

### 8. Negative parallelisms

**Problem:** Constructions like "Not only... but..." or "It's not just about..., it's..." are overused. Replace with positive statement.

### 9. Rule-of-three overuse

**Problem:** LLMs force ideas into groups of three to appear comprehensive. Not everything needs three items. Two is fine. Five is fine. Don't pad to three.

### 10. Elegant variation (synonym cycling)

**Problem:** LLM repetition penalty causes excessive synonym substitution. It's fine to repeat important words. Forced variation introduces vagueness.

### 11. False ranges

**Problem:** "From X to Y" constructions where X and Y aren't on a meaningful scale. "From local bakeries to international conglomerates" is a false range; "from $99 to $999/month" is real.

## Style patterns to fix

### 12. Em dash overuse and spacing

**Problem:** LLMs use em dashes (—) more than humans. Replace most with commas, periods, or parentheses.

**Spacing rule:** when an em dash IS used, always place a space on either side — like this. Never closed (word—word).

### 13. Filler phrases

| Replace | With |
|---|---|
| In order to achieve this goal | To achieve this |
| Due to the fact that | Because |
| At this point in time | Now |
| In the event that | If |
| Has the ability to | Can |
| It is important to note that | (just state the thing) |

### 14. Excessive hedging

Cut chains like "could potentially possibly be argued that might have some effect." Hedge once if needed, not three times.

### 15. Generic positive conclusions

**Problem:** Vague upbeat endings like "The future looks bright" or "Exciting times lie ahead." End with specific facts.

## Communication artifacts to remove

### 16. Collaborative communication artifacts

**Watch:** *I hope this helps, Of course!, Certainly!, You're absolutely right!, Would you like..., let me know, here is a...*

These leak in when a chat-tuned model isn't told it's writing an article. Strip them all.

### 17. Sycophantic / servile tone

**Problem:** Overly positive, people-pleasing language. Remove "Great question!", "Excellent point!", and similar.

## Application

When humanizing existing content, the workflow is:

1. **Read the first sentence.** Fix it first if it matches any AI opening pattern.
2. **Scan for the 17 patterns** in order of severity. Cut the worst offenders.
3. **Vary rhythm** — find any block of 4+ same-length sentences and break it.
4. **Inject voice** — find any block of pure neutral reporting and add a small note of opinion, mixed feeling, or specific detail.
5. **Re-read aloud.** If it sounds like a press release, do another pass.

Humanization is one prompt invocation away from feeling formulaic itself. Don't run the same pass twice on the same content; the second pass will start adding *its own* patterns (over-casual phrases, fake personality). One pass, then judge with human eyes.

## Output rules

When the skill produces a humanized version:

- Return ONLY the humanized text. No explanations, no commentary, no summary of changes.
- Preserve HTML tags, links, lists, heading hierarchy.
- Match the intended tone (warm, neighborly, informative — whatever VOICE.md specifies).
- Roughly preserve length. Don't double the wordcount; don't halve it.
