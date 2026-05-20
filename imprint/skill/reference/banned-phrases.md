# Banned phrases

Two hundred phrases that AI writes more than humans do. Plus rationale, so you understand why they're banned and don't argue with the list.

## Top tier — never, never

These are the AI-content cliches. If output contains any of these, it gets rewritten.

| Phrase | Why |
|---|---|
| delve | LLM signature word. Far higher frequency in AI than human writing. |
| crucial | Generic emphasis word, overused as filler |
| critical (as filler) | Same as crucial |
| cutting-edge | Marketing cliche with zero specificity |
| game-changer / game changer | Empty enthusiasm |
| in today's world / landscape | Generic time-anchor, says nothing |
| in today's fast-paced world | Worse version |
| navigate (figurative) | "Navigate the process", "navigate the complexities" — AI-cream |
| navigate the ever-evolving landscape | The worst stack of AI words |
| journey | "Your journey", "embark on a journey" — empowerment cliche |
| embark on | Adventure-brochure register |
| empower / empowering | Coachy, hollow |
| unlock the power / unlock your | "Unlock" anything is suspect |
| level up | Casual-pep cliche |
| tapestry | "Rich tapestry of..." — pure LLM register |
| testament | "Stands as a testament to..." — never |
| beacon of | "A beacon of hope/innovation/etc." |
| underscore (verb) | "This underscores..." — empty connective |
| highlight (verb, figurative) | "Highlights the importance of..." |
| landscape (figurative noun) | "Evolving landscape", "regulatory landscape" |
| vibrant | Travel-brochure word |
| stunning | Same |
| breathtaking | Same |
| pivotal | Filler emphasis |
| pivotal moment / key moment / pivotal role | Phrase versions |
| stand as / serves as / marks / represents (a) | Copula avoidance |
| boasts a / features a / offers a | More copula avoidance |
| commitment to | Brand-page filler |
| natural beauty | Travel cliche |
| nestled / nestled in | Real-estate-listing cliche |
| in the heart of | Same family |
| groundbreaking (figurative) | Generic praise |
| renowned | Generic praise |
| must-visit | Listicle cliche |
| revolutionizing | Almost always overstatement |
| game-changing | Same |
| seamless / seamlessly | Vague positive, says nothing |
| seamless integration | Tech-marketing classic |
| holistic approach | Consultant-speak |
| at the end of the day | Filler |
| the bottom line is | Filler |
| it goes without saying | If it does, don't say it |
| needless to say | Same |

## Reassurance / coachy register (cut from any professional content)

| Phrase | Why |
|---|---|
| you're not alone / you are not alone | Empathy-bot opening |
| rest assured | Marketing reassurance |
| don't worry | Same |
| take a deep breath | Same |
| you've got this | Pep-talk register |
| every step of the way | Filler |
| we're here to help | Brand-cream |
| your dream / your dream home / your dream career | Aspirational filler |
| your journey | See above |

## Casual dramatic framing (cut from any professional content)

These read like Reddit commentary, not professional writing. Replace with direct factual statements.

| Phrase | Better |
|---|---|
| brace yourself | (state the fact) |
| buckle up | (state the fact) |
| steel yourself | (state the fact) |
| here's the kicker | (state the fact) |
| spoiler alert | (state the fact) |
| the harsh reality | (state the fact) |
| the hard truth | (state the fact) |
| hate to break it to you | (state the fact) |
| not for the faint of heart | (state the fact) |
| sticker shock | (state the actual range) |
| can be brutal | (state the actual range) |
| painfully slow | (state the actual time) |

## Generic openings (cut, replace with specifics)

| Opening | Why |
|---|---|
| When it comes to [topic] | Most common AI opening; says nothing |
| If you're looking for / considering / planning | Reader-state opening, weak |
| In today's world / landscape / environment | Generic time-anchor |
| Understanding [topic] is crucial | Generic importance-claim |
| [Topic] is an important / complex / significant | Topic-importance claim |
| Are you ready to / wondering about | Direct address |
| Let's dive in / let's explore / let's break it down | Conversational filler |
| Without further ado | Filler |
| Imagine a world / picture this | Hypothetical framing as opener |

## Conversational artifacts (cut from any article)

These leak in when a chat-tuned model isn't told it's writing an article.

- I hope this helps
- Of course!
- Certainly!
- You're absolutely right!
- Would you like…
- Let me know if…
- Here is a…
- Great question!
- Excellent point!

## -ing endings (rewrite, cut, or replace)

The present-participle phrase is AI scaffolding to add fake depth. Most can be cut entirely.

- ...highlighting [the importance of]
- ...underscoring [the need for]
- ...emphasizing [the role of]
- ...ensuring [that]
- ...reflecting [the trend toward]
- ...symbolizing [a shift]
- ...contributing to [the broader]
- ...cultivating [a sense of]
- ...fostering [a culture of]
- ...encompassing [a range of]
- ...showcasing [the brand's commitment to]

## Vague attribution (replace with specific named sources)

- Industry reports suggest
- Observers have noted
- Experts argue
- Some critics argue
- Several sources / publications
- Many believe
- It is widely held that
- Research has shown (without naming the research)

## Promotional weasel words

- Boasts a
- Vibrant culture / community / scene
- Rich (figurative) — "rich history", "rich tapestry"
- Profound
- Enhancing its / enhanced
- Exemplifies
- Showcases / showcasing
- Renowned for
- Stands out as

## Filler phrases (replace or cut)

| Replace | With |
|---|---|
| In order to achieve this goal | To achieve this |
| Due to the fact that | Because |
| At this point in time | Now |
| In the event that | If |
| Has the ability to | Can |
| It is important to note that | (just state the thing) |
| It should be noted | (just state the thing) |
| It is worth noting | (just state the thing) |
| Needless to say | (just state the thing) |

## Generic conclusions

- The future looks bright
- Exciting times lie ahead
- The possibilities are endless
- Only time will tell
- One thing is certain (then a generic claim)
- As we move forward
- The journey continues

## Hedging stacks

A hedge is fine. A stack is not.

- Could potentially possibly
- May or may not be
- Might be considered to be
- It could be argued that some might say

## How to extend the list per brand

`BRAND.md` carries an `avoid_phrases` field. Anything specific to the brand's voice that should never appear goes here. The skill merges this list with the universal list at prompt-compile time.

A brand-specific entry should include rationale in a comment, so future authors don't undo it without thinking:

```yaml
avoid_phrases:
  - "navigate the immigration process"   # too generic, masks the actual steps
  - "your case"                          # presumptuous when applicant hasn't filed
  - "expert"                             # we don't claim expertise; we cite sources
```

## How the list is enforced

Three places:

1. **Generation time**: the universal + brand-specific list is included in the system prompt as "Never use these phrases".
2. **Humanization time**: the humanizer scans for the list and rewrites every match.
3. **Audit time**: `audit` and `polish` flag every match in the output with a line number. Zero matches is the bar.

The list is a floor, not a ceiling. A brand can ban more; it cannot ban less.
