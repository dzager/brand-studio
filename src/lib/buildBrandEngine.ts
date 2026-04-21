import {
    BRAND_ENGINE,
    type BrandEngine,
    type ImageStyleCategory,
    type VoiceProfile,
} from "@/brand/engine";

/**
 * A company record from Supabase.
 */
export type CompanyRecord = {
    id: string;
    name: string;
    tagline: string | null;
    mission: string | null;
    archetype: string | null;
    tone: string | null;
    target_audiences: string[] | null;
    photography_style: string | null;
    color_primary: string | null;
    color_secondary: string | null;
    avoid_phrases: string | null;
    image_style_categories: ImageStyleCategory[] | null;
    voice_profile: VoiceProfile | null;
    editorial_guidelines: string | null;
    seo_content_guidelines: string | null;
    reference_articles: string[] | null;
    evals: BrandEngine["evals"] | null;
    auto_humanize: boolean | null;
    include_toc: boolean | null;
    created_at: string;
};

/**
 * Build a BrandEngine from a company record.
 * Overlays company-specific fields onto generic defaults.
 */
export function buildBrandEngine(company: CompanyRecord): BrandEngine {
    const base = structuredClone(BRAND_ENGINE);

    // Engine meta
    base.engine_meta.brand_name = company.name;
    base.engine_meta.tagline = company.tagline ?? base.engine_meta.tagline;

    // Brand profile
    if (company.archetype) {
        base.latent_brand_profile.archetype = company.archetype;
    }
    if (company.tone) {
        base.latent_brand_profile.tone_axes = company.tone
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
    }

    // Knowledge pack
    if (company.mission) {
        base.brand_knowledge_pack.mission = company.mission;
        base.brand_knowledge_pack.value_proposition = company.mission;
    }

    // Audiences
    if (company.target_audiences && company.target_audiences.length > 0) {
        base.photography_style.subjects = company.target_audiences;
    }

    // Photography style
    if (company.photography_style) {
        base.photography_style.realism_base = company.photography_style;
    }

    // Colors
    if (company.color_primary) {
        base.design_tokens.colors.primary.obsidian = company.color_primary;
    }
    if (company.color_secondary) {
        base.design_tokens.colors.primary.marigold = company.color_secondary;
    }

    // Avoid phrases
    if (company.avoid_phrases) {
        const phrases = company.avoid_phrases
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
        base.rewrite_policy.banned_phrasing = [
            ...base.rewrite_policy.banned_phrasing,
            ...phrases,
        ];
    }

    // Image style categories — use company-specific styles if provided
    if (company.image_style_categories && company.image_style_categories.length > 0) {
        base.image_style_categories = company.image_style_categories;
    }

    // Voice profile — use company-specific voice if provided
    if (company.voice_profile) {
        base.voice_profile = company.voice_profile;
    }

    // Editorial guidelines — company-specific editorial framework
    if (company.editorial_guidelines) {
        base.editorial_guidelines = company.editorial_guidelines;
    }

    // SEO content guidelines — company-specific SEO rules
    if (company.seo_content_guidelines) {
        base.seo_content_guidelines = company.seo_content_guidelines;
    }

    // Reference articles — gold-standard URLs to scrape and model against
    if (company.reference_articles && company.reference_articles.length > 0) {
        base.reference_articles = company.reference_articles;
    }

    // Evals — company-specific quality rubric and test cases
    if (company.evals) {
        base.evals = company.evals;
    }

    // Auto-humanize toggle
    (base as any).auto_humanize = company.auto_humanize !== false; // default true

    // Table of Contents toggle
    (base as any).include_toc = company.include_toc === true; // default false

    // Update system prompt core to reflect the new brand
    base.prompt_layers.system.core = `You represent the ${company.name} brand.${company.tagline ? ` Tagline: "${company.tagline}".` : ""
        }${company.mission ? ` Mission: ${company.mission}.` : ""
        } Use plain language. Be helpful and clear. Provide actionable next steps.`;

    return base;
}

