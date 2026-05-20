# SEO methodology

Classic on-page SEO. Keyword targeting, headings, internal linking, meta hygiene, structured data. This is the floor; AEO and GEO build on top.

## Keyword targeting

Every article ranks for one primary keyword and 5-15 secondary keywords. Decide these before you start writing.

### Primary keyword

The exact search query this article should rank for. Singular. If you have two, pick the one with higher commercial intent or higher search volume, and write the other as a separate article.

Required placements:

- **H1 (title)** — exact match preferred, near-match acceptable
- **First 100 words** — exact match
- **At least one H2** — exact or near-match
- **Meta title** — exact match, near the front
- **URL slug** — exact match, hyphenated
- **Image alt text** — at least one

### Secondary keywords

5-15 long-tail variations, related queries, and "People Also Ask"-style follow-ups. Each one that represents a distinct subtopic gets its own H2 or H3 section.

Don't just sprinkle. A high-value secondary keyword without a dedicated section is wasted opportunity. Search engines index sections independently when each is a self-contained topical unit.

| Pattern | Required treatment |
|---|---|
| Comparison ("X vs Y") | Dedicated H2 with table or side-by-side breakdown |
| Timeline ("X timeline by Y") | Dedicated H2/H3 with ordered list or step format |
| Cost ("how much does X cost") | Dedicated H2 with range, breakdown, and regional variation |
| Process ("how to X") | Dedicated H2 with numbered ordered list (extracts to HowTo schema) |
| Decision ("X or Y", "should I X") | Dedicated H2 with decision framework or scenario-based analysis |

## Headings

H1 (title) once per page. H2 for major sections. H3 for subsections within. H4 sparingly. Don't skip levels.

Every H2 includes the primary keyword or a related secondary keyword. Every H2/H3 begins with a **quotable factual answer** (1-2 sentences) that can be pulled into an AI summary or featured snippet without surrounding context.

Use descriptive, not vague, headings:

| Vague | Specific |
|---|---|
| The Process | Filing the I-130 Petition: Step-by-Step |
| What to Know | Marriage-Based Green Card Costs in 2026 |
| Common Issues | Why I-485 Applications Get RFEs |

## Meta hygiene

| Field | Rule |
|---|---|
| `meta_title` | 50-60 characters. Primary keyword near the front. Click-optimized (clarity or urgency), not just the article title rephrased. |
| `meta_description` | 150-160 characters. Previews value. Includes primary keyword. Encourages clicks. |
| `slug` | 3-6 words, lowercase, hyphenated. Primary keyword. No stopwords (a, the, of) unless they change meaning. |
| `canonical` | Self-canonical unless this is a duplicate of another page. |
| `og:title` / `og:description` | Match `meta_title` / `meta_description` unless the social context differs. |
| `og:image` | 1200×630 px, under 5MB, with text safe in the center 60%. |

## Featured snippets (intentional)

Featured snippets get pulled when content gives the engine a clean answer to extract. For the primary keyword:

1. Identify the snippet *type* the SERP currently shows (paragraph, list, table).
2. Provide a direct **40-60 word** answer near the top of the article in that format.
3. Place it under an H2 that closely matches the query.
4. Don't bury the answer; the engine extracts the first match.

### Paragraph snippet

A clean 40-60 word definition or answer. Used for definition queries.

### List snippet

A short numbered or bulleted list (3-8 items). Used for "how to" and "what are" queries.

### Table snippet

A simple HTML `<table>` with 2-4 columns. Used for comparison queries.

## SERP competition alignment

Before publishing, compare against the top 3-5 ranking pages for the primary keyword:

1. **Heading coverage**: list every H2/H3 used by competitors. Cover the same subtopics; don't leave obvious gaps.
2. **Depth differentiator**: identify what competitors do *not* cover well. Add at least one section that goes deeper than typical results — original analysis, edge cases, expert-level detail, recent updates.
3. **Format differentiator**: if competitors are wall-of-text, use tables and lists. If they're bullet-heavy, use prose with embedded evidence. Be the cleanest answer in the SERP.

## Internal linking

- **Cluster pages**: pillar links to every supporting page; supporting links to pillar + 2-3 related siblings. Use the linkmap from `reference/cluster.md`.
- **Standalone articles**: 3-8 internal links to related content. If no cluster exists, use logical placeholder slugs that match likely future articles.
- **Anchor text**: keyword-rich, matches the target page's primary keyword. Never "click here", "read more".
- **Placement**: distribute throughout the content, in context. Don't cluster all links in one section.
- **Avoid cannibalization**: when cluster context lists sibling keywords, do not try to rank for those keywords in this article.

## External linking

- 4-6 hyperlinked source citations per long-form article, minimum.
- Source hierarchy: (1) official government / agency, (2) regulations and standards, (3) official data releases, (4) peer-reviewed research, (5) established reference sites.
- Anchor text names the source, not generic ("ADA clinical guidelines" not "this page").
- Link to the most specific page available — a specific resource page, not a homepage.
- If no authoritative source exists, qualify the claim. Never present unsourced claims as definitive.

## Schema markup (handed off to `aeo.md`)

SEO and AEO share structured-data requirements. Specifically:

- **FAQPage schema** — required on every long-form article. See `aeo.md`.
- **HowTo schema** — required when content_type is "how_to".
- **Article schema** — base metadata: author, datePublished, dateModified, image.
- **Breadcrumb schema** — when the article is part of a cluster.

The JSON-LD is emitted by `publish`; the source of truth is the article's HTML structure (H3 > p pairs for FAQ, `<ol>` for HowTo). Get the structure right and the schema follows.

## Meta-level rules

- **Don't keyword-stuff.** Search engines penalize unnatural density. Aim for 1-2% primary keyword density in body, with the structural placements above.
- **Don't write for engines first.** Write for the reader. SEO is what makes a good article findable; it doesn't make a bad article good.
- **Update, don't republish.** When the underlying facts change, update the existing article and refresh the `dateModified`. Don't create a duplicate.

## SEO audit checklist

When auditing an existing article, check in order:

- [ ] Primary keyword present in H1, first 100 words, meta_title, slug, at least one H2
- [ ] meta_title 50-60 chars; meta_description 150-160
- [ ] H2 hierarchy clean; H2/H3 headings descriptive, not vague
- [ ] Every H2 opens with a quotable factual answer (1-2 sentences)
- [ ] Featured snippet target present in the right format
- [ ] 5-15 secondary keywords each addressed in named sections
- [ ] 4+ inline hyperlinked sources to authoritative pages
- [ ] 3-8 internal links with keyword-rich anchor text
- [ ] FAQ section present (H3 > p pairs)
- [ ] HowTo `<ol>` if content type is procedural
- [ ] Image alt text descriptive, includes primary keyword on at least one image
- [ ] `dateModified` reflects last substantive update
