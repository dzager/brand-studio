// funFacts.ts — Shared fun fact data and company-matching logic
// Used by TaskPanel (inline ticker)

export type FunFact = {
    headline: string;
    body: string;
    category: string;
};

// ── Industry-mapped fun facts & trends ──────────────────────────────────

export const CONTENT_MARKETING_FACTS: FunFact[] = [
    { headline: "Content drives 3x more leads", body: "Content marketing generates 3x as many leads as outbound marketing — at 62% lower cost per lead.", category: "Content Marketing" },
    { headline: "93% of online journeys start with search", body: "Nearly all web experiences begin on a search engine. Ranking on page one captures 71% of all clicks.", category: "SEO" },
    { headline: "Long-form wins the ranking game", body: "Articles over 2,000 words earn 3x more traffic, 4x more shares, and 3.5x more backlinks than short posts.", category: "Content Strategy" },
    { headline: "Readers skim — structure matters", body: "79% of readers scan rather than read word-by-word. Subheadings, bullets, and bold text improve engagement by 47%.", category: "UX Writing" },
    { headline: "Blogs with images get 94% more views", body: "Visual content drives significantly more engagement. Posts with relevant images earn 94% more total views.", category: "Visual Content" },
    { headline: "Personalized content converts 6x better", body: "Content tailored to a specific audience segment converts at 6x the rate of generic content.", category: "Personalization" },
    { headline: "Internal links boost rankings", body: "Pages with 40+ internal links earn 5x more organic traffic. Smart interlinking signals topical authority.", category: "Technical SEO" },
    { headline: "60% of searches are mobile", body: "Mobile-first indexing means your content must perform flawlessly on small screens to rank well.", category: "Mobile SEO" },
    { headline: "Consistency beats volume", body: "Brands that publish 2-4x per week see 3.5x more traffic than those posting less than weekly.", category: "Publishing" },
    { headline: "Topic clusters outperform single pages", body: "Pillar + cluster content strategies earn 2-3x more organic traffic than isolated blog posts.", category: "Content Architecture" },
];

export const DENTAL_FACTS: FunFact[] = [
    { headline: "Tooth enamel is the hardest substance", body: "Tooth enamel is even harder than bone — it's the hardest biological substance in the human body.", category: "Dental Science" },
    { headline: "48% of adults are unhappy with their smile", body: "Nearly half of adults say their smile is the feature they'd most like to improve, driving demand for cosmetic dentistry.", category: "Cosmetic Dentistry" },
    { headline: "Dental industry growing at 6.2% CAGR", body: "The global dental market is projected to reach $65B by 2028, fueled by aesthetic treatments and digital dentistry.", category: "Industry Growth" },
    { headline: "The average person brushes for 45 seconds", body: "Dentists recommend 2 minutes — but most people spend less than a quarter of that time brushing.", category: "Patient Education" },
    { headline: "Before and after photos drive 3x more leads", body: "Dental practices using visual case studies on their website see 3x higher conversion rates from organic traffic.", category: "Dental Marketing" },
    { headline: "77% of patients choose dentists online", body: "More than three-quarters of patients find and select their dentist through online search and reviews.", category: "Patient Acquisition" },
    { headline: "Reviews are the number one trust signal", body: "92% of patients read online reviews before choosing a dental provider. Star rating directly impacts call volume.", category: "Reputation" },
    { headline: "AI is transforming diagnostics", body: "AI-powered imaging can detect cavities, bone loss, and oral cancers up to 20% more accurately than traditional methods.", category: "Dental Technology" },
];

export const LEGAL_FACTS: FunFact[] = [
    { headline: "96% of people seeking legal help start online", body: "Nearly all potential clients begin their attorney search with a Google query — making SEO critical for law firms.", category: "Legal Marketing" },
    { headline: "Legal content builds trust before the call", body: "67% of people research legal topics extensively online before ever contacting an attorney.", category: "Client Acquisition" },
    { headline: "Immigration backlogs hit record highs", body: "USCIS processing times have doubled in many categories, with 9M+ cases pending — creating enormous demand for clear guidance.", category: "Immigration" },
    { headline: "FAQ pages reduce intake calls by 35%", body: "Well-structured legal FAQ content answers common questions upfront, reducing phone volume while improving lead quality.", category: "Legal Content" },
    { headline: "E-E-A-T matters most for legal content", body: "Google's quality guidelines emphasize Experience, Expertise, Authoritativeness, and Trust — especially for YMYL legal content.", category: "Legal SEO" },
    { headline: "The legal services market is $1.1 trillion", body: "The global legal services industry continues to grow, with digital transformation reshaping how firms acquire and serve clients.", category: "Industry Trends" },
    { headline: "73% of legal searches happen on mobile", body: "People searching for legal help are often in urgent situations — mobile-optimized content is essential for conversion.", category: "Mobile Strategy" },
    { headline: "Case studies convert 4x better", body: "Law firm pages featuring anonymized case results and client stories see 4x higher engagement than generic practice area pages.", category: "Conversion" },
];

export const HEALTH_FACTS: FunFact[] = [
    { headline: "Dr. Google is everyone's first stop", body: "80% of internet users have searched for health information online. Trustworthy health content is more important than ever.", category: "Health Content" },
    { headline: "Wellness industry worth $5.6 trillion", body: "The global wellness economy continues to surge, driven by personalized health, mental wellness, and preventive care.", category: "Industry Growth" },
    { headline: "Personalized health content converts 5x better", body: "Health content tailored to specific conditions and demographics converts at 5x the rate of generic wellness articles.", category: "Content Strategy" },
    { headline: "Health misinformation costs $50B annually", body: "Inaccurate health information leads to poor decisions and wasted spending — making credible content a public service.", category: "Trust & Authority" },
    { headline: "Patients want education, not sales", body: "72% of patients prefer healthcare providers who offer educational content, building trust before the first appointment.", category: "Patient Engagement" },
    { headline: "Mental health searches up 300%", body: "Online searches for mental health resources have tripled since 2019, creating massive demand for quality content.", category: "Mental Health" },
    { headline: "Telehealth is here to stay", body: "38x growth in telehealth usage has permanently shifted how patients discover and interact with healthcare providers.", category: "Digital Health" },
    { headline: "Medical content needs E-E-A-T signals", body: "Google holds health content to the highest quality standards. Author credentials and citations are ranking necessities.", category: "Health SEO" },
];

export const TRAVEL_FACTS: FunFact[] = [
    { headline: "Travel planning starts 45 days before booking", body: "Travelers consume an average of 38 pieces of content before making a booking decision — your content needs to be in that journey.", category: "Travel Marketing" },
    { headline: "Group travel is booming", body: "Group travel demand has grown 45% since 2022, with travelers seeking curated, hosted experiences over DIY planning.", category: "Industry Trends" },
    { headline: "Visual content drives 150% more engagement", body: "Travel content with high-quality destination imagery earns 150% more engagement than text-only posts.", category: "Visual Marketing" },
    { headline: "87% of millennials use social for trip ideas", body: "Social media and blogs are now the primary inspiration source for millennial and Gen Z travelers.", category: "Social Travel" },
    { headline: "Experience over luxury", body: "72% of travelers now prioritize unique experiences over accommodation quality when choosing a trip.", category: "Travel Trends" },
    { headline: "SEO drives 40% of travel website traffic", body: "Organic search remains the single largest traffic channel for travel companies — outpacing paid ads and social combined.", category: "Travel SEO" },
    { headline: "Solo travel up 131% in searches", body: "Interest in solo travel experiences has more than doubled, opening up new content and product opportunities.", category: "Solo Travel" },
    { headline: "Sustainable travel is a deciding factor", body: "68% of travelers say sustainability impacts their destination choice — eco-conscious content resonates strongly.", category: "Sustainable Travel" },
];

export const TECH_FACTS: FunFact[] = [
    { headline: "AI adoption grew 270% in 4 years", body: "Enterprise AI adoption has nearly tripled since 2020, with content creation being one of the fastest-growing use cases.", category: "AI Trends" },
    { headline: "Developer content drives 70% of B2B SaaS leads", body: "Technical content — tutorials, docs, and guides — is the primary lead driver for most B2B software companies.", category: "Developer Marketing" },
    { headline: "Cybersecurity market hits $376B by 2029", body: "As threats multiply, organizations are spending more than ever on security — creating massive demand for educational content.", category: "Cybersecurity" },
    { headline: "95% of enterprises are multi-cloud", body: "Cloud complexity continues to grow, making clear, authoritative technical content essential for vendor differentiation.", category: "Cloud Computing" },
    { headline: "Data-driven companies are 23x more likely to acquire customers", body: "Companies that leverage data analytics in their marketing outperform competitors dramatically in customer acquisition.", category: "Data & Analytics" },
    { headline: "Product-led growth is the new playbook", body: "82% of top SaaS companies use content and freemium models to drive adoption before sales conversations begin.", category: "PLG Strategy" },
    { headline: "API-first companies grow 4x faster", body: "Companies with API-first architecture and developer ecosystems see 4x faster revenue growth.", category: "API Economy" },
    { headline: "Page speed equals revenue", body: "A 1-second improvement in load time can increase conversions by 7%. Performance content directly impacts the bottom line.", category: "Performance" },
];

export const STARTUP_VC_FACTS: FunFact[] = [
    { headline: "Only 1 in 10 startups succeed", body: "90% of startups fail — but those with strong content brands are 2.5x more likely to reach product-market fit.", category: "Startup Stats" },
    { headline: "Content-led brands raise 40% faster", body: "Startups with established content presence and thought leadership close funding rounds significantly faster.", category: "Fundraising" },
    { headline: "Deep tech investment hit $62B in 2024", body: "Venture investment in AI, quantum, and biotech continues to accelerate, creating new content verticals.", category: "Deep Tech" },
    { headline: "Thought leadership drives 60% of B2B pipeline", body: "Senior decision-makers say thought leadership content directly influenced their purchasing decisions.", category: "Thought Leadership" },
    { headline: "Studio model is reshaping venture", body: "Venture studios now account for 30% of successful pre-seed companies, combining capital with operational building.", category: "Venture Studios" },
    { headline: "Climate tech drew $32B in 2024", body: "Sustainability-focused startups attracted record investment, with content playing a key role in category education.", category: "Climate Tech" },
    { headline: "Focus beats breadth", body: "Startups with a clearly defined ICP (ideal customer profile) grow 3x faster than those targeting broad markets.", category: "Go-to-Market" },
    { headline: "Community-led growth is accelerating", body: "Startups with active community programs see 5x better retention and 2x higher expansion revenue.", category: "Community" },
];

export const GENERIC_FACTS: FunFact[] = [
    { headline: "Content marketing ROI outpaces paid ads", body: "Organic content generates 3x more leads than paid advertising at 62% lower cost over its lifetime.", category: "Marketing ROI" },
    { headline: "80% of decision-makers prefer articles over ads", body: "Business leaders would rather learn about a company through content than through traditional advertising.", category: "B2B Marketing" },
    { headline: "Featured snippets capture 35% of clicks", body: "Structured, well-formatted content has a 35% chance of claiming position zero — above all organic results.", category: "SEO" },
    { headline: "AI-generated first drafts save 70% of writing time", body: "Teams using AI writing tools report cutting initial draft time by 70% — spending more time on strategy and editing.", category: "AI Content" },
    { headline: "Consistent brands earn 23% more revenue", body: "Companies with consistent brand presentation across all platforms increase revenue by an average of 23%.", category: "Brand Consistency" },
    { headline: "Voice search will be 50% of all queries", body: "By 2026, voice search is expected to account for half of all searches — conversational content is the future.", category: "Voice Search" },
    { headline: "Storytelling makes content 22x more memorable", body: "Facts told through narrative are 22x more memorable than data alone. Brand storytelling drives lasting impressions.", category: "Storytelling" },
    { headline: "Short-form video is the top content ROI driver", body: "Short-form video content delivers the highest ROI of any content format, with 2x the engagement of static posts.", category: "Video Content" },
    { headline: "Topical authority beats keyword stuffing", body: "Search engines now reward comprehensive topic coverage over keyword density. Clusters of related content win.", category: "Topical Authority" },
    { headline: "Original research content earns 6x more links", body: "Original data, surveys, and case studies earn 6x more backlinks than opinion-based content.", category: "Link Building" },
];

// ── Company → fact set matching ─────────────────────────────────────────

export function matchFactsForCompany(companyName: string): FunFact[] {
    const name = companyName.toLowerCase();

    if (name.includes("dental") || name.includes("dentist") || name.includes("orthodont") || name.includes("abramson") || name.includes("amato")) {
        return DENTAL_FACTS;
    }
    if (name.includes("law") || name.includes("legal") || name.includes("greencard") || name.includes("immigration") || name.includes("boundless") || name.includes("certivo")) {
        return LEGAL_FACTS;
    }
    if (name.includes("health") || name.includes("wellness") || name.includes("medical") || name.includes("doctor") || name.includes("dr ")) {
        return HEALTH_FACTS;
    }
    if (name.includes("travel") || name.includes("trip") || name.includes("trova") || name.includes("tour")) {
        return TRAVEL_FACTS;
    }
    if (name.includes("tech") || name.includes("software") || name.includes("patch") || name.includes("gumshoe") || name.includes("patchbay")) {
        return TECH_FACTS;
    }
    if (name.includes("lab") || name.includes("venture") || name.includes("pioneer") || name.includes("startup") || name.includes("studio")) {
        return STARTUP_VC_FACTS;
    }

    return [...CONTENT_MARKETING_FACTS, ...GENERIC_FACTS];
}

// Shuffle helper
export function shuffleArray<T>(arr: T[]): T[] {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
