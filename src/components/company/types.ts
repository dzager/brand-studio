import type { ImageStyleCategory, VoiceProfile } from "@/brand/engine";

export type BrandColor = { name: string; hex: string };

export type CompanyPrompt = {
    id: string;
    company_id: string;
    name: string;
    body: string;
    created_at: string;
};

export type CompanyData = {
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
    brand_colors: BrandColor[] | null;
    avoid_phrases: string | null;
    image_style_categories: ImageStyleCategory[] | null;
    voice_profile: VoiceProfile | null;
    editorial_guidelines: string | null;
    seo_content_guidelines: string | null;
    reference_articles: string[] | null;
    auto_humanize: boolean | null;
    include_toc: boolean | null;
    default_image_mode: "generate" | "library" | null;
    created_at: string;
    prompts: CompanyPrompt[];
};

export type CompanyForm = {
    name: string;
    tagline: string;
    mission: string;
    archetype: string;
    tone: string;
    target_audiences: string[];
    photography_style: string;
    color_primary: string;
    color_secondary: string;
    brand_colors: BrandColor[];
    avoid_phrases: string;
    editorial_guidelines: string;
    seo_content_guidelines: string;
    auto_humanize: boolean;
    include_toc: boolean;
    default_image_mode: "generate" | "library";
    reference_articles: string[];
    useCustomStyles: boolean;
    image_style_categories: ImageStyleCategory[];
    voice_profile: VoiceProfile | null;
};

export type TabProps = {
    company: CompanyData;
    form: CompanyForm;
    setForm: React.Dispatch<React.SetStateAction<CompanyForm>>;
    setField: <K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) => void;
    editing: boolean;
};

export function getInitialBrandColors(c: CompanyData): BrandColor[] {
    if (c.brand_colors && c.brand_colors.length > 0) return c.brand_colors.map(bc => ({ ...bc }));
    return [
        { name: "Primary", hex: c.color_primary ?? "#000000" },
        { name: "Secondary", hex: c.color_secondary ?? "#FFFFFF" },
    ];
}
