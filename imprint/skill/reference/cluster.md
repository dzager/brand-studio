# cluster

Combined: the methodology for designing topical clusters AND the workflow for the `cluster` slash command.

## Command workflow

When invoked as `/imprint cluster <topic>`:

1. Interview the user for cluster scope (3-5 questions: target topic, audience, depth, optional keyword list)
2. Map the keyword space (use a search-API tool if available, otherwise propose keywords from training knowledge for the user to validate)
3. Cluster keywords into buckets (one bucket = one supporting page)
4. Detect overlap; warn if any buckets cannibalize
5. Propose the linkmap (pillar + supporting pages + anchor text)
6. User confirms
7. Generate pillar page first
8. Generate supporting pages in parallel (default concurrency: 2)
9. Optionally generate long-tail pages
10. Emit cluster manifest + every article + linkmap

Each article generation invokes the `article` pipeline (brand → write → humanize → factcheck → emit) with cluster context injected.

## Why clusters beat standalone articles

Google ranks domains for topics, not just pages for keywords. A single comprehensive article gets some authority. A cluster of 5-15 coordinated articles, each focused on a sub-aspect, establishes the brand as the topical authority and ranks every component on its dedicated keyword.

Cluster authority compounds. A new article inside a strong cluster ranks faster than a standalone because the internal link map signals topical relevance to the engine.

## Cluster shape

```
            ┌──────────────────────┐
            │   Pillar page         │
            │   (broad topic)       │
            └──────────────────────┘
                  │  │  │  │
        ┌─────────┘  │  │  └────────┐
        ▼            ▼  ▼            ▼
    ┌────────┐  ┌────────┐ ┌────────┐ ┌────────┐
    │Support │  │Support │ │Support │ │Support │
    │page 1  │  │page 2  │ │page 3  │ │page 4  │
    └────────┘  └────────┘ └────────┘ └────────┘
        │            │         │           │
        └──── long-tail pages, optional ────┘
```

### Pillar page

- One per cluster
- Broad keyword (high volume, high competition)
- 2,500-5,000+ words
- Overview + links to every supporting page
- Section per major sub-aspect, each linking to the relevant supporting page
- Goal: rank for the broad keyword AND act as the cluster hub

### Supporting page

- 4-8 per cluster
- Narrower keyword (medium volume, medium competition)
- 1,200-2,500 words
- Deep treatment of one specific sub-aspect
- Links back to pillar + 2-3 related supporting pages
- Goal: rank for the specific keyword and feed authority to the pillar

### Long-tail page (optional)

- 0-12 per cluster
- Very specific query (low volume, low competition)
- 600-1,200 words
- Quick, focused answer
- Links to relevant supporting page
- Goal: capture long-tail traffic and direct it into the cluster

### Definition / Glossary page (optional, assign as long-tail)

- Captures featured snippets and AI citations
- 400-800 words
- Concise, factual, structured for extraction
- Links to relevant supporting page and pillar

### Comparison article (assign as supporting)

- High-intent commercial traffic
- 1,500-3,000 words
- Side-by-side analysis with clear recommendations
- Links back to pillar + related supporting pages

### How-To Guide (assign as supporting)

- Procedural search intent
- 1,500-3,500 words
- Step-by-step with specific details, costs, and timing
- Links back to pillar + related supporting pages

## Design steps

### 1. Pick the topic

Specific enough to be coherent, broad enough to support 5+ articles. "Marriage-based green cards" is a cluster; "immigration" is too broad; "I-130 timeline in 2026" is too narrow.

### 2. Map the keyword space

For the chosen topic, gather:

- Primary keyword (the pillar's target)
- 5-15 high-priority secondary keywords (the supporting pages' targets)
- Optional 5-25 long-tail keywords

Use search tools (Ahrefs, Semrush, Google's "People also ask") to find actual search variants. Don't invent keywords — find the ones users type.

### 3. Cluster the keywords

Group secondary keywords into thematic buckets. Each bucket has:

- A single dominant keyword (the page target)
- 2-5 related keywords (the page's secondary targets within itself)
- A clear scope that does not overlap with other buckets

### 4. Define the linkmap

Before writing, document which pages link to which, with what anchor text:

```yaml
cluster_id: marriage-based-green-cards
pillar:
  slug: marriage-based-green-card-guide
  title: "Marriage-Based Green Cards: The Complete 2026 Guide"
  primary_keyword: "marriage-based green card"
  links_to:
    - {slug: i-130-petition-processing-times, anchor: "I-130 petition processing times"}
    - {slug: affidavit-of-support-requirements, anchor: "Affidavit of Support: Income Requirements"}
    - {slug: consular-processing-vs-adjustment, anchor: "Consular processing vs. adjustment of status"}
    - {slug: marriage-greencard-timeline-2026, anchor: "marriage green card timeline"}
    - {slug: uscis-marriage-interview-prep, anchor: "USCIS marriage interview prep"}
supporting:
  - slug: i-130-petition-processing-times
    title: "I-130 Petition Processing Times in 2026"
    primary_keyword: "I-130 processing time"
    links_back_to_pillar: true
    links_to_siblings:
      - {slug: marriage-greencard-timeline-2026, anchor: "marriage green card timeline"}
      - {slug: uscis-marriage-interview-prep, anchor: "USCIS interview prep"}
  - slug: affidavit-of-support-requirements
    title: "Affidavit of Support: Income Requirements"
    ...
```

### 5. Overlap detection

Before writing, check that no two buckets overlap:

- Take supporting page A's title
- Search supporting page B's planned content
- If page B would naturally cover the title of page A, the two pages cannibalize

Fix by merging, narrowing one's scope, or repositioning one as a long-tail.

### 6. Generation order

1. Pillar first (establishes the topic and link targets)
2. Supporting pages in parallel (each can reference the pillar)
3. Long-tail pages last (each references the relevant supporting page)

## Cluster context injection

Each article in a cluster receives a context block in its user prompt:

```
## Cluster Context

This article is part of the "Marriage-Based Green Cards" cluster.

You are writing: <supporting page title>
Your primary keyword: <kw>
Your role in the cluster: <pillar | supporting | long-tail>

You MUST link to:
- Pillar: <pillar title> at /<pillar slug> using anchor "<anchor text>"
- Sibling: <sibling title> at /<sibling slug> using anchor "<anchor text>"

You MUST NOT try to rank for these sibling keywords:
- <sibling keyword 1>
- <sibling keyword 2>

Mention these topics only as linking opportunities to siblings.
```

This is what makes the cluster cohere instead of cannibalizing.

## Anti-cannibalization rules

Cannibalization happens when two pages in the same cluster try to rank for the same keyword. Symptoms:

- Two pages oscillate in SERP rank
- Click-through gets split
- Neither page builds enough authority to displace competitors

Prevent it:

- One keyword, one page. Period.
- If sibling content mentions the sibling's keyword, mention it ONLY as a link target, not as content to rank for.
- Cluster context lists "do not rank for" keywords explicitly.

## Maintenance

Plan a refresh cadence:

- Pillar: review every 6 months
- Supporting: review every 12 months
- Long-tail: review every 18 months

The `audit` command flags articles past their cadence threshold.

## Cluster scoring

`cluster --score <cluster_id>` emits a health report:

| Signal | What it measures |
|---|---|
| Coverage | % of mapped keywords with a published article |
| Internal link density | Average internal links per article |
| Link reciprocity | Whether linked-to pages also link back |
| Freshness | Average days since `dateModified` |
| Overlap risk | Pairs of articles flagged as semantically overlapping |
| Rank distribution | Top 3 / top 10 / top 20 / unranked % |
| Authority signal | Inbound external links to the cluster's pages |

A healthy cluster shows >90% coverage, >5 internal links/article, <90 day average freshness, zero overlap risk.
