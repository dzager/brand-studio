# GTM: imprint

Go-to-market for an open-source skill, owned by a startup studio with portfolio reach. The goal isn't downloads — it's PSL becoming the credible authority on AI-content methodology, with `imprint` as the give-away and Organic as the upsell.

The skill ships at `github.com/psl-labs/imprint`. This doc covers distribution, sequencing, community, and conversion.

---

## 1. Positioning

**What imprint is, in one sentence:** the open-source methodology behind Organic, packaged as a Claude/Cursor/Codex skill that any team can install in 60 seconds.

**Who it's for:**

| Segment | Pain | imprint's promise |
|---|---|---|
| **Content ops at series A-C companies** | AI tools produce cream that hurts the brand | A methodology that gives output you'd actually publish |
| **Indie founders / solopreneurs** | Can't afford a content agency, can't sound like AI either | The toolkit a content team would use, in their terminal |
| **Marketing leads at agencies** | Need to produce on-brand content at scale across clients | Brand-by-brand context profiles, same engine |
| **AI engineers building content stacks** | Want a reference implementation of voice/AEO/GEO best practices | Drop-in slash commands; CLI; clean schemas |

**Who it's NOT for (yet):**

- Enterprise content teams with full editorial staffs (they have their own playbooks)
- Casual users who just want "an AI to write a blog post" (use ChatGPT)
- Highly regulated content (legal, medical, financial) without an editor in the loop

**The wedge.** Most "AI content tools" are wrappers. imprint is the methodology — readable markdown, editable, model-agnostic, no API key required. That's a fundamentally different value prop: we're handing you the recipe, not the meal.

---

## 2. The free → paid path

`imprint` is the give-away. Organic is the paid product. The conversion logic:

```
discover (open-source skill)
    ↓
install (any harness)
    ↓
generate (1-5 articles, sees the methodology work)
    ↓
recognize (this is the same methodology Organic uses)
    ↓
hit a scale wall (managing 5+ brands, 50+ articles/mo, collaboration)
    ↓
upgrade to Organic (managed, multi-tenant, CMS-published)
```

Critical: the skill is genuinely useful at every level above the wall. We're not crippling the skill to force the upgrade. The skill is the methodology; Organic is the *operations* layer (storage, CMS publish, team seats, observability, dashboards). A solo founder publishing 5 articles a month should be happy on the skill forever. A team publishing 50/month across 3 brands will hit operational friction the skill doesn't solve.

**Conversion triggers to monitor:**

- "How do I run this across 5 brands at once?" → Organic multi-tenant
- "How do I publish to WordPress / Webflow?" → Organic CMS integrations
- "How do I share BRAND.md across my team?" → Organic team seats
- "How do I see analytics on how the content is performing?" → Organic dashboard
- "How do I run scheduled fact-checks on existing content?" → Organic background jobs

---

## 3. Launch sequence

### Phase 1: Stealth + portfolio (weeks 1-3)

**Audience:** PSL portfolio companies. **Goal:** find and fix the first 5 sharp edges before the public sees it.

1. **Week 1 — internal soak.** Install in the Organic team's repos. Use it for our own content. File the first round of issues in a private board.
2. **Week 2 — portfolio pilot.** Identify 3-5 portfolio companies that publish content (any vertical). Offer a 30-minute install + walkthrough. Ask them to use it for one week.
3. **Week 3 — feedback consolidation.** Synthesize feedback. Ship v0.2 with the most-requested adjustments. Get 2 portfolio companies to commit to a public testimonial.

**Success criteria for Phase 1:**

- Two portfolio companies using it weekly
- One concrete bug or sharp edge fixed per company
- Two testimonials ready for launch

### Phase 2: Soft launch (weeks 4-5)

**Audience:** developer + marketing communities most likely to be early adopters. **Goal:** generate the first signal — stars, organic shares, real feedback from outside the bubble.

1. **Make the repo public.** `github.com/psl-labs/imprint`. README is the front door — see Section 5 for the polish.
2. **Quiet announcement.** PSL's accounts, founder accounts, and the portfolio CEO accounts post about it (separate from a launch — this is "we built this, it's open source").
3. **Direct outreach.** Email or DM 50-100 hand-selected targets:
   - Devs building agentic workflows
   - Content ops at companies we know
   - AI/marketing newsletter authors
   - Cursor / Claude Code power users in our network
4. **Sub-Reddit + Discord seeding.** Post in `/r/ClaudeCode`, `/r/cursor`, the Anthropic + OpenAI Discord communities. Lead with the methodology, not the install.

**Success criteria for Phase 2:**

- 100+ GitHub stars
- 5+ unsolicited issues opened
- 2-3 detailed blog posts or threads from outside our network

### Phase 3: Public launch (week 6)

**Audience:** broader dev and marketing. **Goal:** the moment.

1. **Show HN.** Title: "Show HN: imprint — open-source methodology for on-brand AI content". Lead the post with the methodology, not the product. Don't astroturf.
2. **Product Hunt.** Coordinated post on a Tuesday-Thursday (best PH days). Lead with the *philosophy* — methodology > tooling — not feature list. Recruit hunter from PSL's network.
3. **Newsletter sponsorships / placements.** AI newsletter audience overlaps perfectly. Targets:
   - Latent Space (AI / dev tools)
   - The Pragmatic Engineer
   - The Pull Request
   - Marketing Brew (one paid placement)
   - Lenny's Newsletter (mention via Lenny network if accessible)
4. **Twitter / X / Bluesky thread.** Long-form thread from PSL's founder accounts. Demonstrate the methodology with a real before/after. Pin for two weeks.
5. **LinkedIn post.** Same content, repackaged for the marketing-ops audience. Less code, more methodology.

**Success criteria for Phase 3:**

- HN front page or close (top 30 for >2 hours)
- 1,000+ GitHub stars within 7 days
- 5-10 inbound conversations from companies wanting to use it

### Phase 4: Sustain (weeks 7+)

**Goal:** turn launch energy into sustained adoption + an Organic pipeline.

Ongoing motion:

- **Two content pieces per week**: see Section 6 for the calendar
- **One portfolio case study per month**: a deep-dive on how a portfolio company used imprint
- **Quarterly v-bump release**: minor releases keep the repo live and signal active maintenance
- **Conference / podcast circuit**: target two AI-content adjacent talks per quarter

---

## 4. Distribution channels (detail)

| Channel | First post | Sustain motion |
|---|---|---|
| **GitHub** | Public repo, README is canonical | Issue triage <48h; weekly minor commits; release notes |
| **npm** | `npm publish` at v0.1.0 | Version bumps follow semver; bumps surface in `npx imprint version` |
| **Show HN** | One post at launch | One follow-up post at v0.5 (a real milestone, not a vanity bump) |
| **Product Hunt** | Launch day | No re-posts; PH is one-shot |
| **Hacker News (organic)** | None; never astroturf | Topic-relevant posts (AI content, voice profiles, AEO) reference imprint where genuine |
| **X / Bluesky** | Founder thread at launch | 2-3 micro-posts per week (tactical tips that demo methodology) |
| **LinkedIn** | Marketing-ops repackage | 1-2 long-form posts per week from a PSL author |
| **YouTube** | A 10-minute "watch me use it on a real brand" at launch | Bi-weekly episodes; each is a real workflow on a real brand |
| **AI / marketing newsletters** | 3-5 paid placements at launch | One paid placement per quarter; targeted sponsorships of high-fit niches |
| **Podcasts** | None at launch | One/month from week 8 onward |
| **Conferences** | None at launch | One talk per quarter, targeting AI-engineer and content-ops audiences |
| **Direct portfolio reach-out** | 5-10 companies in Phase 1-2 | Quarterly check-in with all PSL portfolio CEOs |

---

## 5. README & first-touch polish

The README is the front door. Everything else is downstream. Specifically nail:

### First-screen content

- A one-sentence hook ("the open-source methodology behind on-brand AI content")
- 10-line install (`npx imprint install`)
- A 30-second demo (animated GIF or asciicast) showing one slash command end-to-end
- One sentence on the philosophy ("methodology, not a wrapper")

### Below the fold

- The five most-common commands with one-line descriptions
- Architecture diagram (what is the skill, what is the CLI, what is the file layout)
- "Why open source?" — the philosophy statement (≤200 words)
- Apache 2.0 + contributing link

### Don't

- Don't open with a marketing video. Open with what it is.
- Don't lead with PSL branding. The skill is the product; PSL credit goes in the footer.
- Don't bury install instructions below feature lists. Install is the first thing.

### Repository hygiene that signals "this is real"

- CODE_OF_CONDUCT.md (use Contributor Covenant)
- CONTRIBUTING.md (how to file issues, run tests, propose new commands)
- CHANGELOG.md (Keep a Changelog format)
- .github/ISSUE_TEMPLATE/ (bug, feature, question)
- A real, populated `tests/` directory
- CI badge in the README (GitHub Actions running `npx imprint detect` on the example fixtures)

---

## 6. Content calendar (first 90 days)

Two pieces per week, alternating between *demonstrate* and *teach*:

| Week | Piece | Channel | Demonstrates |
|---|---|---|---|
| 1 | "Why AI content sounds like AI: 17 patterns and how to detect them" | Blog + LinkedIn | humanization.md |
| 1 | "Inside imprint: the file you write once, your AI uses forever" | Twitter thread | brand.md, voice.md |
| 2 | "Before/after: 5 AI articles, audited against AEO best practices" | Blog | aeo.md, audit |
| 2 | "How to write a voice profile in 15 minutes" | Loom walkthrough | voice.md |
| 3 | "GEO is the new SEO: getting cited by ChatGPT" | Blog | geo.md |
| 3 | "The 200-phrase banned list, with rationale" | LinkedIn carousel | banned-phrases.md |
| 4 | "Three-model fact-check council: how we cross-verify claims" | Blog | factcheck.md |
| 4 | "Topical clusters: pillar pages that actually rank" | Blog | cluster.md |
| 5 | "We open-sourced the methodology behind Organic" | Show HN + Product Hunt | launch |
| 5 | "Imprint: a methodology, not a wrapper" | LinkedIn long-form | philosophy |
| 6 | "Live: building a 12-article cluster in one afternoon" | YouTube | end-to-end |
| 6 | "How a [portfolio company] uses imprint for [content type]" | Blog (case study) | testimonial |
| 7 | "Brand-styled image prompts: the 5-layer approach" | Blog | image-prompts.md |
| 7 | "Common voice profile mistakes" | Twitter thread | voice.md |
| 8 | "The audit rubric: how we score 0-100 across 6 dimensions" | Blog | evals.md |
| 8 | "[Portfolio CEO] on shipping content with imprint" | Podcast guest | testimonial |
| 9 | "Video generation in imprint: script + storyboard + motion spec" | Blog | video-spec.md |
| 9 | "How to extend imprint with brand-specific rules" | YouTube tutorial | brand.md |
| 10 | "imprint v0.5: what shipped, what's next" | Blog + Twitter | maintenance signal |
| 10 | "End-to-end: from BRAND.md to published article" | Loom walkthrough | full pipeline |
| 11 | "Open source vs hosted: when to graduate to Organic" | Blog | conversion path |
| 11 | "The biggest mistake teams make with AI content" | LinkedIn long-form | broad-reach |
| 12 | "imprint roadmap: what users asked for and what we're building" | Blog | community signal |
| 12 | "Behind the scenes: PSL's content stack" | Blog (PSL voice) | brand authority |

After 90 days, the cadence drops to one piece per week, with monthly deep-dive case studies.

---

## 7. Portfolio rollout

PSL portfolio companies are the warmest possible audience. They:

- Already trust PSL
- Often need content help
- Can produce testimonials
- Open doors to their networks

Sequence:

1. **Audit the portfolio.** Categorize every portfolio company:
   - Tier A: actively publishing content (5+ pieces/month)
   - Tier B: occasional content (1-4 pieces/month)
   - Tier C: no content motion currently
2. **Tier A: pilot adoption.** Reach out individually. Offer a 30-min walkthrough + 1 week of pilot use + a co-marketing case study afterward. Target 5 Tier A pilots in Phase 1-2.
3. **Tier B: light intro.** Internal newsletter, "we built this, here's the repo, let us know if you want a walkthrough." Goal: passive awareness, opt-in pilots.
4. **Tier C: future audience.** When they start publishing, imprint is a natural recommendation.

**Co-marketing playbook (per Tier A pilot):**

- Co-authored case study post (on PSL blog + portfolio company blog)
- Joint LinkedIn announcement
- Quote in PSL newsletter
- Optional: 10-15 min "lessons learned" podcast episode

**Goal:** 5 portfolio companies as named users in the first 60 days. 10 in 120 days.

---

## 8. Community

imprint becomes a real project the moment outside contributors land. Plan for it.

### Discord or Discussions?

GitHub Discussions for v0. Discord is overkill until there are 500+ active users. Re-evaluate at week 12.

### Issue / PR triage

- Triage commitment: every issue gets a first response within 48 hours
- Bug fixes: target a fix in the next minor release within 2 weeks
- Feature requests: respond with one of: (a) shipping in next release, (b) v1.1, (c) won't ship and here's why
- PRs: review within 1 week; accept or close with substantive feedback

### Maintainer model

Single maintainer (PSL employee) for the first 6 months. Recruit 1-2 outside maintainers from the most active contributors at month 6.

### Contributor recognition

- All-contributors bot in the README
- Quarterly "contributor spotlight" blog post
- imprint sticker pack for any contributor with a merged PR

### What we'll accept vs decline

| Accept | Decline |
|---|---|
| Bug fixes | Re-architectures we didn't ask for |
| New harness install targets (Aider, gemini-cli, etc.) | New non-content commands (we're a content skill) |
| Documentation improvements | "AI features" that aren't in the roadmap |
| Test coverage improvements | Whitespace-only PRs |
| Language packs for non-English content | (Until v1) Image-provider integrations beyond the v1 four |
| New banned phrases with rationale | Removing banned phrases without rationale |

---

## 9. Metrics

The metrics that matter, in order:

### Adoption (primary)

- GitHub stars (vanity, but the right signal)
- npm installs / week
- Active harness installs (telemetry deliberately off; track via GitHub release downloads + npm stats only)

### Engagement (secondary)

- Issues opened per week (signal of active use)
- PRs from outside PSL per month
- Discord/Discussion posts per week

### Conversion (primary for Organic)

- Inbound conversations referencing imprint
- Trial signups attributed to imprint
- Paid conversions attributed to imprint (via "How did you hear about us" survey)
- Time-from-imprint-discovery to Organic trial (target: <60 days)

### Brand authority (qualitative)

- Mentions in AI-engineering newsletters
- Mentions in marketing-ops newsletters
- Inbound speaker invitations
- Companies citing imprint in their own AI content stack write-ups

### What we explicitly don't measure

- Daily / weekly active users (telemetry-off by design)
- Article generation count (this happens entirely client-side)
- Conversion rate from skill use to Organic (we can't see it; we only see signups)

The lack of telemetry is a feature. It's a credibility signal in the developer community and reinforces the methodology-not-tool positioning.

---

## 10. 30 / 60 / 90 day plan

### 30 days

- [ ] Phase 1 complete (portfolio soak)
- [ ] Phase 2 launched (soft launch)
- [ ] 100+ GitHub stars
- [ ] 5+ unsolicited issues
- [ ] 2 portfolio testimonials ready
- [ ] 6 content pieces published
- [ ] README polished + repo hygiene complete

### 60 days

- [ ] Phase 3 complete (public launch)
- [ ] 1,000+ GitHub stars
- [ ] 5 portfolio companies as named users
- [ ] 12 content pieces published
- [ ] First outside contributor merged
- [ ] First inbound Organic conversation attributed to imprint
- [ ] v0.3 shipped (incorporating launch feedback)

### 90 days

- [ ] 2,500+ GitHub stars
- [ ] 10 portfolio companies as named users
- [ ] 24 content pieces published
- [ ] 3-5 outside contributors
- [ ] First Organic paying customer attributed to imprint
- [ ] v0.5 shipped (real product milestone)
- [ ] First case study from a non-portfolio company

---

## 11. Failure modes and what to do

| Failure | Signal | Response |
|---|---|---|
| Slow stars after launch | <100 stars in week 1 of Phase 3 | The README is wrong. Audit first-touch experience. Get 3 new-to-imprint developers to install and narrate. Revise. |
| HN ignores it | Show HN sinks to page 3 quickly | Don't re-post. Do better content marketing. Try Show HN again at v0.5 with a real milestone. |
| No outside contributors | 0 PRs in 60 days | The codebase is too closed or the contribution path is unclear. Add "good first issue" labels, lower the bar on docs PRs. |
| Portfolio companies don't pilot | <2 pilots committed in Phase 1 | The skill is too rough or the pitch is wrong. Direct conversations with 5 portfolio CEOs to find out which. |
| Organic conversion is zero | 60 days, 0 paid conversions from imprint | The free-to-paid wall is too low (no real reason to upgrade) or too high (the skill solves their problem too completely). Tune the wall. |
| Negative HN reception | Comments are "this is just prompts" | They're right and we need a better narrative. The methodology is the IP, not the code. Lead with that. |

---

## 12. The long game

imprint is a 5-year asset, not a launch artifact. The 90-day plan is the on-ramp. The sustain motion is:

- The methodology gets better as the field gets more sophisticated (GEO matters more in 2027 than 2025)
- The skill gets better as more harnesses ship and more brands stress-test it
- PSL's authority compounds as imprint becomes the canonical reference in the space
- Organic's conversion pipeline compounds as imprint adoption scales

Five years out, the goal is "every AI-content team has imprint installed; the serious teams upgrade to Organic." The skill is the trust-building artifact that gets us there.

The cheapest, most durable kind of distribution is being the people who wrote the methodology everyone uses.
