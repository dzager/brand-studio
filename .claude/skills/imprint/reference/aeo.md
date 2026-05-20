# AEO methodology — Answer Engine Optimization

AEO is the structural discipline that makes content extract well into Google's SGE, ChatGPT, Perplexity, Claude search, and every other AI summarization layer. The engines pull text-and-structure; structure that's pull-ready wins.

## What AEO actually optimizes for

AI summarizers behave like extraction systems with a quotation budget. They scan, find clean answers, and lift them. The article that wrote the cleanest answer wins the citation.

Three patterns matter most:

1. **Inverted pyramid.** Most important information first. Each H2 begins with the answer.
2. **Quotable openings.** Every H2/H3 starts with a 1-2 sentence factual answer that stands alone.
3. **Structured data formats.** FAQ schema, HowTo schema, Article schema.

## Inverted pyramid structure

Lead with the answer. Always. The engine scans top-down and stops when it finds an extractable answer; if your answer is in paragraph 4, it gets the wrong one from paragraph 1.

### Article-level

The opening 2-3 sentences should answer: what this article covers, why it matters now, what specific value the reader will get. Specifics, not generics.

### Section-level

Each H2 opens with the answer to its own question. Elaboration follows. Example:

> ### How long does an I-130 petition take?
>
> Current processing times for the I-130 petition range from 14 to 38 months, depending on the service center handling the case and whether the petitioner is a U.S. citizen or lawful permanent resident.
>
> [Then elaborate: which centers, which categories, why the variance...]

Bad version (buried answer):

> ### How long does an I-130 petition take?
>
> Many factors affect how long an I-130 takes to process, and applicants are often surprised by the complexity of the timeline. There are several things to understand before we get to specific numbers...

## Required sections for long-form

| Section | Position | Format |
|---|---|---|
| **Hero / lede** | Top | 2-3 sentence answer to the article's promise |
| **Key Takeaways** | After intro | 3-5 bullets with specific facts, numbers, actionable steps |
| **TOC** (optional) | After Key Takeaways | `<nav class="toc">` with anchor links to all H2s |
| **Body sections** | Main | Each H2 starts with a quotable answer, then elaborates |
| **Frequently Asked Questions** | Near bottom | 3-5 `<h3>Question?</h3><p>Answer.</p>` pairs |

Key Takeaways are heavily indexed by AI extraction. Don't skip; don't pad.

## FAQ schema (the most underused AEO tool)

FAQPage schema produces rich SERP features that dramatically increase real estate. To extract cleanly, the HTML must be:

```html
<h3>Question text?</h3>
<p>Answer text.</p>
<h3>Next question?</h3>
<p>Next answer.</p>
```

Do not nest other elements between the H3 and its paragraph. Do not split the answer across multiple paragraphs (you can — and should — write longer answers, but for schema extraction, keep the first paragraph self-contained and complete).

The JSON-LD emitted by `publish` looks like:

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question text?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer text."
      }
    }
  ]
}
```

### Geo-targeted FAQs

When the topic involves location-dependent information (real estate, legal, medical, regulatory), include at least one FAQ that addresses regional or location-specific variation.

| Generic FAQ | Geo-targeted FAQ |
|---|---|
| How much do dental implants cost? | How much do dental implants cost in Seattle vs. national average? |
| What's the timeline for adjustment of status? | How does I-485 timing vary between the Vermont and Nebraska service centers? |
| What permits do I need for a home renovation? | What permits does Seattle require beyond standard state regulations? |

## HowTo schema

Required when content_type is `how_to`. Format the step section as an ordered list:

```html
<ol>
  <li>Action verb sentence describing step 1.</li>
  <li>Action verb sentence describing step 2.</li>
  <li>...</li>
</ol>
```

Each `<li>` is a single complete instruction. Start with the action verb. No filler.

JSON-LD:

```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to file an I-130 petition",
  "step": [
    { "@type": "HowToStep", "text": "Gather supporting documents..." },
    { "@type": "HowToStep", "text": "Complete Form I-130..." }
  ]
}
```

For non-how_to articles that include procedural content, still use ordered lists; the schema extraction will pull HowTo from them as well.

## Entity optimization

Search engines build knowledge graphs around entities (agencies, forms, programs, products, places). Articles that clearly identify and relate entities rank better.

### Rules

- **Full official name on first use**, abbreviation thereafter. "U.S. Citizenship and Immigration Services (USCIS)" then "USCIS".
- **Wrap key entities in `<strong>`** on first occurrence in each major section. Schema extractors weight strong-tagged terms.
- **Make entity relationships explicit.** "Form I-130, administered by USCIS under the Immigration and Nationality Act, is..." beats "I-130 is...".
- **Avoid synonym cycling** for the same entity. Use the same name consistently; don't swap "USCIS" with "the immigration agency" mid-article for variety.

## Entity clusters per section

Each H2 should establish 2-4 entities relevant to that section and use them consistently within. The article as a whole should establish a coherent entity graph: form names, agency names, regulation citations, dollar figures, dates.

The article that names entities is the article that gets cited. Engines find "X form is administered by Y agency under Z statute" infinitely more useful than "you'll need to file some paperwork with the government."

## Section self-sufficiency

Each H2 should be a self-contained topical unit targeting its own keyword. This is what allows search engines to index individual sections for their respective queries.

To test: extract just the H2 + its body. Can a reader who hasn't seen the rest of the article get the answer? If no, fix.

Self-sufficient sections also mean the engine can pull just that section into an AI summary without needing context.

## What NOT to do

- **Don't bury the answer.** No throat-clearing intros. No "we'll get to the timing in a moment."
- **Don't use vague headings.** "The Process" tells the engine nothing. "Filing the I-130: Step-by-Step Timeline" tells it everything.
- **Don't fragment the FAQ.** H3 > p pairs, immediately adjacent. No interstitials.
- **Don't synonym-cycle entity names.** Consistency wins.
- **Don't omit the FAQ.** Every long-form article has one. No exceptions.

## AEO audit checklist

- [ ] Article opens with the answer (specific, factual, first 2-3 sentences)
- [ ] Key Takeaways section present, 3-5 specific bullets
- [ ] Every H2 begins with a quotable factual answer
- [ ] H2 headings match real search queries
- [ ] Each H2 is self-sufficient (extractable without context)
- [ ] FAQ section present, H3 > p pair format, 3-5 pairs
- [ ] At least one geo-targeted FAQ if topic has regional variation
- [ ] HowTo `<ol>` if content is procedural
- [ ] Entities named in full on first use, consistent thereafter
- [ ] Key entities wrapped in `<strong>` on first occurrence
- [ ] No throat-clearing or padded intros
- [ ] Featured snippet target placed near the top in the right format
