import { useState } from "react";
import type { VoiceProfile } from "@/brand/engine";
import type { TabProps } from "./types";
import { Section, Field, FieldList } from "./shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Mic, AlertCircle, Plus, Trash2,
    Loader2, Globe, Link2, CheckCircle2,
} from "lucide-react";

const defaultVP: VoiceProfile = {
    summary: "", tone_descriptors: [], sentence_rhythm: "", paragraph_style: "",
    vocabulary_level: "", rhetorical_devices: [], structural_patterns: [],
    pov_and_person: "", sample_phrases: [], avoid: [], banned_phrases: [],
    structural_do: [], structural_dont: [], specificity_rules: [], length_rules: [],
};

export function VoiceToneTab({ company, form, setForm, setField, editing }: TabProps) {
    const [voiceImportUrl, setVoiceImportUrl] = useState("");
    const [voiceImportFetching, setVoiceImportFetching] = useState(false);
    const [voiceImportAnalyzing, setVoiceImportAnalyzing] = useState(false);
    const [voiceImportErr, setVoiceImportErr] = useState<string | null>(null);
    const [voiceImportSuccess, setVoiceImportSuccess] = useState(false);

    async function handleVoiceImportFromUrl() {
        if (!voiceImportUrl.trim()) return;
        setVoiceImportErr(null); setVoiceImportSuccess(false);

        // Step 1: Fetch article text
        setVoiceImportFetching(true);
        let articleText: string;
        try {
            const r = await fetch("/api/fetch-article-text", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: voiceImportUrl.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to fetch article");
            articleText = data.text;
            if (!articleText || articleText.trim().length < 50) throw new Error("Article content too short for analysis (need at least 50 characters).");
        } catch (e: any) { setVoiceImportErr(e.message); setVoiceImportFetching(false); return; }
        setVoiceImportFetching(false);

        // Step 2: Analyze voice
        setVoiceImportAnalyzing(true);
        try {
            const r = await fetch("/api/analyze-voice", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html: articleText, company_id: company.id }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Voice analysis failed");
            setForm(prev => ({ ...prev, voice_profile: data.voice_profile }));
            setVoiceImportSuccess(true);
            setVoiceImportUrl("");
            setTimeout(() => setVoiceImportSuccess(false), 5000);
        } catch (e: any) { setVoiceImportErr(e.message); }
        finally { setVoiceImportAnalyzing(false); }
    }

    return (
        <div className="space-y-3">
            <Section
                title="Voice Profile"
                icon={Mic}
                defaultOpen
                badge={form.voice_profile ? <Badge variant="outline" className="text-[10px] ml-1 text-primary border-primary/50">Active</Badge> : <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Default</Badge>}
            >
                <div className="space-y-4 pt-3">
                    {/* URL Import */}
                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3.5 space-y-2.5">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <Link2 className="h-4 w-4 text-primary" />
                            {form.voice_profile ? "Analyze a blog post to update voice" : "Import voice from a blog post"}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Paste a link to any article or blog post. We&apos;ll extract the text, analyze the writing style, and {form.voice_profile ? "update" : "populate"} all voice profile fields automatically.
                        </p>
                        <div className="flex gap-2">
                            <Input
                                type="url"
                                value={voiceImportUrl}
                                onChange={(e) => { setVoiceImportUrl(e.target.value); setVoiceImportErr(null); }}
                                placeholder="https://example.com/blog/your-best-article"
                                disabled={voiceImportFetching || voiceImportAnalyzing}
                                onKeyDown={(e) => { if (e.key === "Enter" && voiceImportUrl.trim()) { e.preventDefault(); handleVoiceImportFromUrl(); } }}
                                className="text-sm"
                            />
                            <Button
                                variant="outline"
                                onClick={handleVoiceImportFromUrl}
                                disabled={voiceImportFetching || voiceImportAnalyzing || !voiceImportUrl.trim()}
                                className="gap-1.5 whitespace-nowrap shrink-0"
                            >
                                {voiceImportFetching ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching…</>
                                ) : voiceImportAnalyzing ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…</>
                                ) : (
                                    <><Globe className="h-3.5 w-3.5" /> Analyze URL</>
                                )}
                            </Button>
                        </div>
                        {(voiceImportFetching || voiceImportAnalyzing) && (
                            <p className="text-xs text-muted-foreground animate-pulse">
                                {voiceImportFetching ? "Fetching article content…" : "Analyzing writing style — this takes 15–30 seconds…"}
                            </p>
                        )}
                        {voiceImportErr && (
                            <p className="text-xs text-destructive flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3 shrink-0" /> {voiceImportErr}
                            </p>
                        )}
                        {voiceImportSuccess && (
                            <p className="text-xs text-green-600 flex items-center gap-1.5">
                                <CheckCircle2 className="h-3 w-3 shrink-0" /> Voice profile {form.voice_profile ? "updated" : "created"} from article! Review the fields below and save.
                            </p>
                        )}
                    </div>

                    {!form.voice_profile ? (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground italic">No voice profile configured yet. Import from a URL above, or create one manually.</p>
                            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setForm(prev => ({ ...prev, voice_profile: defaultVP }))}>
                                <Plus className="h-3.5 w-3.5" /> Create Manually
                            </Button>
                        </div>
                    ) : (
                        <>
                            <Field label="Summary" value={form.voice_profile.summary} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, summary: v } : prev.voice_profile }))} rows={3} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FieldList label="Tone Descriptors" items={form.voice_profile.tone_descriptors} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, tone_descriptors: v } : prev.voice_profile }))} />
                                <Field label="POV & Person" value={form.voice_profile.pov_and_person} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, pov_and_person: v } : prev.voice_profile }))} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Sentence Rhythm" value={form.voice_profile.sentence_rhythm} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, sentence_rhythm: v } : prev.voice_profile }))} rows={2} />
                                <Field label="Paragraph Style" value={form.voice_profile.paragraph_style} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, paragraph_style: v } : prev.voice_profile }))} rows={2} />
                            </div>
                            <Field label="Vocabulary Level" value={form.voice_profile.vocabulary_level} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, vocabulary_level: v } : prev.voice_profile }))} rows={2} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FieldList label="Rhetorical Devices" items={form.voice_profile.rhetorical_devices} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, rhetorical_devices: v } : prev.voice_profile }))} />
                                <FieldList label="Sample Phrases" items={form.voice_profile.sample_phrases} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, sample_phrases: v } : prev.voice_profile }))} />
                            </div>
                            <FieldList label="Structural Patterns" items={form.voice_profile.structural_patterns} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, structural_patterns: v } : prev.voice_profile }))} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FieldList label="✓ Do Use" items={form.voice_profile.structural_do} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, structural_do: v } : prev.voice_profile }))} />
                                <FieldList label="✗ Don't Use" items={form.voice_profile.structural_dont} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, structural_dont: v } : prev.voice_profile }))} />
                            </div>
                            <FieldList label="Specificity Rules" items={form.voice_profile.specificity_rules} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, specificity_rules: v } : prev.voice_profile }))} />
                            <FieldList label="Length Rules" items={form.voice_profile.length_rules} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, length_rules: v } : prev.voice_profile }))} />
                            <FieldList label="Patterns to Avoid" items={form.voice_profile.avoid} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, avoid: v } : prev.voice_profile }))} />
                            <FieldList label="Banned Phrases" items={form.voice_profile.banned_phrases} editing onChange={v => setForm(prev => ({ ...prev, voice_profile: prev.voice_profile ? { ...prev.voice_profile, banned_phrases: v } : prev.voice_profile }))} placeholder="comma-separated banned phrases" />
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5" onClick={() => setForm(prev => ({ ...prev, voice_profile: null }))}>
                                <Trash2 className="h-3.5 w-3.5" /> Remove Voice Profile
                            </Button>
                        </>
                    )}
                </div>
            </Section>
        </div>
    );
}
