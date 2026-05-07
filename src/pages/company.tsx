import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import type { ImageStyleCategory, VoiceProfile } from "@/brand/engine";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    AlertCircle, Save, X, CheckCircle2,
    Eye, Mic, Palette, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import type { CompanyData, CompanyForm } from "@/components/company/types";
import { getInitialBrandColors } from "@/components/company/types";
import { BrandIdentityTab } from "@/components/company/BrandIdentityTab";
import { VoiceToneTab } from "@/components/company/VoiceToneTab";
import { VisualStyleTab } from "@/components/company/VisualStyleTab";
import { PromptsEngineTab } from "@/components/company/PromptsEngineTab";

export const getServerSideProps: GetServerSideProps = async () => {
    return { props: {} };
};

/* ── Company Card (used for both single and multi mode) ──────────── */
function CompanyBrand({ company, onSaved }: { company: CompanyData; onSaved?: (c: CompanyData) => void }) {
    const [editing, setEditing] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveErr, setSaveErr] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const hasCustomStyles = Array.isArray(company.image_style_categories) && company.image_style_categories.length > 0;

    const [form, setForm] = useState<CompanyForm>(() => ({
        name: company.name, tagline: company.tagline ?? "", mission: company.mission ?? "",
        archetype: company.archetype ?? "guide", tone: company.tone ?? "",
        target_audiences: company.target_audiences ?? [],
        photography_style: company.photography_style ?? "",
        color_primary: company.color_primary ?? "#000000", color_secondary: company.color_secondary ?? "#FFFFFF",
        brand_colors: getInitialBrandColors(company),
        avoid_phrases: company.avoid_phrases ?? "",
        editorial_guidelines: company.editorial_guidelines ?? "",
        seo_content_guidelines: company.seo_content_guidelines ?? "",
        auto_humanize: company.auto_humanize !== false, include_toc: company.include_toc === true,
        reference_articles: company.reference_articles ?? [] as string[],
        useCustomStyles: hasCustomStyles,
        image_style_categories: hasCustomStyles ? company.image_style_categories! : [] as ImageStyleCategory[],
        voice_profile: company.voice_profile ? { ...company.voice_profile } : null as VoiceProfile | null,
    }));

    function cancelEdit() {
        const hcs = Array.isArray(company.image_style_categories) && company.image_style_categories.length > 0;
        setForm({
            name: company.name, tagline: company.tagline ?? "", mission: company.mission ?? "",
            archetype: company.archetype ?? "guide", tone: company.tone ?? "",
            target_audiences: company.target_audiences ?? [],
            photography_style: company.photography_style ?? "",
            color_primary: company.color_primary ?? "#000000", color_secondary: company.color_secondary ?? "#FFFFFF",
            brand_colors: getInitialBrandColors(company),
            avoid_phrases: company.avoid_phrases ?? "",
            editorial_guidelines: company.editorial_guidelines ?? "",
            seo_content_guidelines: company.seo_content_guidelines ?? "",
            auto_humanize: company.auto_humanize !== false, include_toc: company.include_toc === true,
            reference_articles: company.reference_articles ?? [],
            useCustomStyles: hcs,
            image_style_categories: hcs ? company.image_style_categories! : [],
            voice_profile: company.voice_profile ? { ...company.voice_profile } : null,
        });
        setSaveErr(null); setSaved(false);
    }

    async function handleSave() {
        setSaving(true); setSaveErr(null);
        try {
            const { useCustomStyles, brand_colors, ...rest } = form;
            const primary = brand_colors.find(c => c.name.toLowerCase() === "primary");
            const secondary = brand_colors.find(c => c.name.toLowerCase() === "secondary");
            const payload = {
                ...rest,
                color_primary: primary?.hex ?? rest.color_primary,
                color_secondary: secondary?.hex ?? rest.color_secondary,
                brand_colors: brand_colors,
                target_audiences: form.target_audiences,
                image_style_categories: useCustomStyles && form.image_style_categories.length > 0 ? form.image_style_categories : null,
            };
            const r = await fetch(`/api/companies/${company.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Save failed");
            setSaved(true); setTimeout(() => setSaved(false), 3000);
            if (onSaved) onSaved({ ...data, prompts: company.prompts });
        } catch (e: any) { setSaveErr(e.message); }
        finally { setSaving(false); }
    }

    function setField<K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) {
        setForm(prev => ({ ...prev, [key]: value }));
    }

    const tabProps = { company, form, setForm, setField, editing };

    return (
        <div className="space-y-4">
            {/* Save bar */}
            <div className="flex items-center gap-2">
                <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
                    <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save Changes"}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5" onClick={cancelEdit} disabled={saving}>
                    <X className="h-3.5 w-3.5" /> Reset
                </Button>
                {saved && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>}
                {saveErr && <span className="text-xs text-destructive">{saveErr}</span>}
            </div>

            {/* Tabbed interface */}
            <Tabs defaultValue="brand" className="w-full">
                <TabsList className="w-full justify-start">
                    <TabsTrigger value="brand" className="gap-1.5">
                        <Eye className="h-3.5 w-3.5" /> Brand
                    </TabsTrigger>
                    <TabsTrigger value="voice" className="gap-1.5">
                        <Mic className="h-3.5 w-3.5" />
                        Voice
                        {form.voice_profile
                            ? <Badge variant="outline" className="text-[10px] ml-0.5 h-4 border-primary/50 text-primary">Active</Badge>
                            : null}
                    </TabsTrigger>
                    <TabsTrigger value="visual" className="gap-1.5">
                        <Palette className="h-3.5 w-3.5" />
                        Visual
                        <Badge variant="secondary" className="text-[10px] ml-0.5 h-4">{form.brand_colors.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="prompts" className="gap-1.5">
                        <FileText className="h-3.5 w-3.5" /> Prompts
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="brand" className="mt-4">
                    <BrandIdentityTab {...tabProps} />
                </TabsContent>
                <TabsContent value="voice" className="mt-4">
                    <VoiceToneTab {...tabProps} />
                </TabsContent>
                <TabsContent value="visual" className="mt-4">
                    <VisualStyleTab {...tabProps} />
                </TabsContent>
                <TabsContent value="prompts" className="mt-4">
                    <PromptsEngineTab company={company} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

/* ── Main Page ───────────────────────────────────────────────────── */
export default function CompanyPage() {
    const router = useRouter();
    const { activeAccount } = useAuth();
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [mode, setMode] = useState<"single" | "multi" | null>(null);
    const [company, setCompany] = useState<CompanyData | null>(null);
    const [companies, setCompanies] = useState<CompanyData[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Direct company ID from query param (e.g. /company?id=xxx)
    const directId = router.query.id as string | undefined;

    useEffect(() => {
        // If a direct company ID is provided, load it directly
        if (directId) {
            setLoading(true); setErr(null);
            Promise.all([
                fetch(`/api/companies/${directId}`).then(r => r.json()),
                fetch(`/api/prompts?company_id=${directId}`).then(r => r.json()).catch(() => []),
            ])
                .then(([companyData, promptsData]) => {
                    if (companyData.error) throw new Error(companyData.error);
                    setMode("single");
                    setCompany({ ...companyData, prompts: Array.isArray(promptsData) ? promptsData : [] });
                })
                .catch((e) => setErr(e.message))
                .finally(() => setLoading(false));
            return;
        }

        if (!activeAccount) return;
        setLoading(true); setErr(null);
        const url = `/api/account/company?account_id=${activeAccount.account_id}`;
        fetch(url)
            .then((r) => r.json())
            .then((data) => {
                if (data.error) throw new Error(data.error);
                if (data.mode === "single") {
                    setMode("single");
                    setCompany(data.company);
                } else if (data.mode === "multi") {
                    setMode("multi");
                    setCompanies(data.companies || []);
                    if (data.companies?.length === 1) {
                        setSelectedId(data.companies[0].id);
                    }
                }
            })
            .catch((e) => setErr(e.message))
            .finally(() => setLoading(false));
    }, [activeAccount, directId]);

    const activeCompany = mode === "single" ? company : companies.find((c) => c.id === selectedId) ?? null;

    return (
        <AppLayout>
            <div className="space-y-6">
                {/* Header */}
                {activeCompany && (
                    <div className="flex items-center gap-4">
                        <div
                            className="w-12 h-12 rounded-lg shrink-0 border border-border shadow-sm"
                            style={{ backgroundColor: activeCompany.color_primary ?? "#000" }}
                        />
                        <div>
                            <h2 className="text-xl font-semibold tracking-tight">{activeCompany.name}</h2>
                            {activeCompany.tagline && <p className="text-sm text-muted-foreground italic">{activeCompany.tagline}</p>}
                        </div>
                    </div>
                )}

                {/* Multi-company selector */}
                {mode === "multi" && companies.length > 1 && (
                    <div className="flex gap-2 flex-wrap">
                        {companies.map((c) => (
                            <Button
                                key={c.id}
                                variant={selectedId === c.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => setSelectedId(c.id)}
                                className="gap-2"
                            >
                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: c.color_primary ?? "#000" }} />
                                {c.name}
                            </Button>
                        ))}
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                )}

                {/* Error */}
                {err && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{err}</AlertDescription>
                    </Alert>
                )}

                {/* Empty states */}
                {!loading && !err && mode === "multi" && companies.length === 0 && (
                    <p className="text-muted-foreground">No companies found for this account.</p>
                )}
                {!loading && !err && mode === "single" && !company && (
                    <p className="text-muted-foreground">No company linked to your account.</p>
                )}

                {/* Company brand view */}
                {!loading && activeCompany && <CompanyBrand company={activeCompany} onSaved={(updated) => {
                    if (mode === "single") setCompany(updated);
                    else setCompanies(prev => prev.map(c => c.id === updated.id ? updated : c));
                }} />}
            </div>
        </AppLayout>
    );
}
