# GEO methodology — Generative Engine Optimization

GEO is what makes content get cited by generative engines (ChatGPT, Claude, Perplexity, Gemini). Where AEO is *extraction-readiness*, GEO is *citation-worthiness*. The engine has to decide: of the ten sources I could cite, which two will I name? GEO tilts the answer.

## What generative engines cite

Generative engines learn to prefer:

1. **Sources with explicit, named attribution.** They can audit the source, see it cites others, and trust it.
2. **Sources with freshness signals.** They favor recently updated content for time-sensitive queries.
3. **Sources with unique insight.** They deprioritize content that's synthesizable from ten other sources.
4. **Sources with structured data.** Schema-marked content is mechanically easier to extract.

GEO optimizes for all four.

## Sources and attribution (MANDATORY)

Generative engines use source credibility signals when deciding which content to cite. Vague references without links get deprioritized. Explicit, hyperlinked attributions are essential.

### Inline "according to" attributions

Use explicit inline attributions on every factual claim about rules, fees, timelines, eligibility, or statistics.

> According to <a href="https://www.uscis.gov/policy-manual/volume-7-part-a">USCIS Policy Manual Volume 7</a>, the average processing time for an I-485 is currently 12.5 months.

NOT:

> According to USCIS, the average processing time is currently 12.5 months.

The link is the credibility signal. Without it, the claim is unsourced.

### Source hierarchy (preferred order)

1. Official government / agency pages (uscis.gov, hhs.gov, ada.org)
2. Regulations, statutes, and standards (CFR, USC, ISO, IEEE)
3. Official data releases (BLS, Census, agency-published statistics)
4. Peer-reviewed research (PubMed, primary literature)
5. Established authoritative reference sites (Mayo Clinic, Investopedia for finance basics)

Avoid: random blogs, marketing pages from competitors, AI-generated content farms, content with no clear authorship.

### Minimum citation density

Long-form articles need at least 4-6 hyperlinked source citations. Articles on YMYL topics (your money, your life — health, legal, financial) need more, typically 8-15.

### Anchor text rules

- Names the source and context: "ADA clinical guidelines for dental implants"
- Never generic: "click here", "this page", "learn more"
- Links to the most specific page available (a regulation section, not the agency homepage)

### When no source exists

Qualify the claim. "Timelines vary by region" or "check the official site for current fees" beats presenting an unsourced specific as fact.

## Freshness signals

Search and generative engines favor current content. Signal recency without forcing it.

### Where to add freshness

- **Reference the current year** where naturally relevant. "The 2026 update changed..." beats "The recent update changed..."
- **Note when rules, policies, or data last changed.** "Updated in March 2026" or "effective since October 2025".
- **Use "as of [date]" qualifiers** for time-sensitive facts (processing times, fees, eligibility rules).
- **In the article metadata**, keep `dateModified` accurate. Update on every substantive revision.

### Don't fabricate dates

If you don't know when something last changed, omit the date rather than guessing. A fabricated date is worse than no date.

### When freshness is a differentiator

For topics with shifting rules (immigration, tax, FDA approvals, college admissions), freshness is the entire game. Articles that reference last quarter's data beat articles that reference last year's. Build a content-refresh cadence into the cluster strategy.

## Unique insight (the GEO differentiator)

Generative engines increasingly weight "unique insight" — information that cannot be easily synthesized from ten other sources. Government pages and established reference sites already cover standard procedures. Your content must go beyond what those sources offer.

### Six patterns that produce unique insight

#### 1. Decision frameworks with scenarios

When comparing options, build a structured decision framework with specific scenarios — not just a feature list.

> If your primary concern is durability and you plan to keep the restoration 15+ years, implants typically offer better long-term value because the alveolar bone is preserved and the failure rate after year 10 is under 3%.
>
> If your primary concern is upfront cost and you're comfortable with a 7-10 year replacement cycle, a fixed bridge is the practical choice — particularly if the adjacent teeth are already crowned.

#### 2. Statistical breakdowns

Data-driven analysis where available — cost ranges by region, success rates by method, satisfaction scores by provider type, historical trend data. Present in tables.

#### 3. Edge cases and exceptions

Cover scenarios standard sources skip:

- What happens when complications arise
- How to handle unexpected delays
- When a less common approach is actually the better choice
- How specific conditions change the typical recommendation

#### 4. Practitioner-level guidance

The kind of analysis a subject-matter expert would offer in a consultation. Not just *what* the options are, but *what this means in practice* with concrete examples.

> While the manufacturer states a 10-year warranty, real-world data from 2026 shows an average lifespan of 15-20 years with proper maintenance.

#### 5. Cost-benefit and timeline analysis

For process-oriented content, build comparison tables that include total costs (direct + ancillary), realistic timeline ranges, and practical trade-offs — not just the list price.

| Option | Direct cost | Ancillary cost | Timeline | Lifespan | Best for |
|---|---|---|---|---|---|
| Implant | $3,000-5,000 | $500-1,500 (bone graft if needed) | 6-9 months | 15-25 years | Long-term, single tooth |
| Bridge | $1,500-3,000 | $0-500 | 3-4 weeks | 7-10 years | Cost-sensitive, adjacent teeth already crowned |
| Partial denture | $1,000-2,500 | $0-300 | 1-2 weeks | 5-7 years | Multiple missing teeth, temporary solution |

#### 6. Original synthesis

Combine information from multiple authoritative sources into analysis that no single source provides. If one agency publishes cost data and another publishes quality ratings, connect them into a unified value assessment.

### The unique insight bar

At least one section in every article must contain analysis, frameworks, or data synthesis that a reader cannot find on the primary government source page for the topic. Without this, the article is a re-summary; with it, the article is the citation.

## Structured data signals

Generative engines parse Schema.org structured data when deciding what to extract and cite. The structural-data layer is covered in `aeo.md` (FAQPage, HowTo, Article schemas). Treat it as a GEO requirement, not an optional bonus.

## Author and expertise signals

Generative engines weight `Author` schema and visible author metadata. Articles with named authors who have visible credentials in the topic area get cited more.

### Required Author markup

```json
"author": {
  "@type": "Person",
  "name": "Author Name",
  "url": "https://yourdomain.com/team/author-name",
  "jobTitle": "Senior Editor, [Topic Area]"
}
```

### Visible byline

- Author name and title near the top of the article
- Link to an author page with relevant credentials
- For YMYL topics, include "Reviewed by [Expert Name, Credentials]"

## What gets penalized

- Vague attributions ("Industry reports say...") without specific sources
- Stale dates (referencing 2023 data in 2026 without updating)
- Pure synthesis of public information with no original insight
- Stock images on a topic the brand should have photographed itself
- AI-generated content with zero editorial review (engines are getting better at detecting this signal)
- Heavy keyword stuffing detectable in heading-to-body density

## GEO audit checklist

- [ ] 4+ hyperlinked source citations (8+ for YMYL)
- [ ] Source anchor text names the source, not "click here"
- [ ] Links to specific pages, not homepages
- [ ] Author named with visible credentials
- [ ] Author schema present
- [ ] `dateModified` reflects actual last update
- [ ] At least one freshness signal (current year, "as of" date, last-change note)
- [ ] At least one unique-insight section (decision framework, statistical breakdown, edge cases, practitioner guidance, cost-benefit table, or original synthesis)
- [ ] No fabricated dates
- [ ] No vague attributions
