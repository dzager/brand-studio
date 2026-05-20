import { useState, useRef } from "react";
import type { VoiceProfile } from "@/brand/engine";
import type { CompanyData, CompanyPrompt, CompanyForm } from "./types";
import { Section, useCopyToClipboard, CopyButton } from "./shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    FileText, Cpu, AlertCircle, Loader2, Plus, X, Pencil, Trash2,
    Copy as CopyIcon, CheckCircle2, ChevronDown, ChevronRight, Save,
    Mic, Globe, Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Voice profile → prompt compiler ──────────────────────────────── */
function compileVoiceToPrompt(vp: VoiceProfile): string {
    const lines: string[] = [
        `# VOICE PROFILE — PRIORITY DIRECTIVE`,
        ``,
        `> The following voice attributes MUST take priority over all other style guidance.`,
        `> Match this voice exactly. Do not deviate.`,
        ``,
    ];
    if (vp.summary) lines.push(`## Voice Summary`, vp.summary, ``);
    if (vp.tone_descriptors.length > 0) lines.push(`## Tone`, `Be: ${vp.tone_descriptors.join(", ")}`, ``);
    if (vp.pov_and_person) lines.push(`## Point of View`, vp.pov_and_person, ``);
    if (vp.sentence_rhythm) lines.push(`## Sentence Rhythm`, vp.sentence_rhythm, ``);
    if (vp.paragraph_style) lines.push(`## Paragraph Style`, vp.paragraph_style, ``);
    if (vp.vocabulary_level) lines.push(`## Vocabulary`, vp.vocabulary_level, ``);
    if (vp.rhetorical_devices.length > 0) lines.push(`## Rhetorical Devices`, `Use: ${vp.rhetorical_devices.join(", ")}`, ``);
    if (vp.sample_phrases.length > 0) lines.push(`## Signature Phrases`, `Channel phrases like: ${vp.sample_phrases.map(p => `"${p}"`).join(", ")}`, ``);
    if (vp.structural_patterns.length > 0) lines.push(`## Structural Patterns`, vp.structural_patterns.join(", "), ``);
    if ((vp.structural_do ?? []).length > 0) lines.push(`## DO`, ...vp.structural_do!.map(s => `- ${s}`), ``);
    if ((vp.structural_dont ?? []).length > 0) lines.push(`## DON'T`, ...vp.structural_dont!.map(s => `- ${s}`), ``);
    if ((vp.specificity_rules ?? []).length > 0) lines.push(`## Specificity Rules`, ...vp.specificity_rules!.map(s => `- ${s}`), ``);
    if ((vp.length_rules ?? []).length > 0) lines.push(`## Length Rules`, ...vp.length_rules!.map(s => `- ${s}`), ``);
    if (vp.avoid.length > 0) lines.push(`## Patterns to Avoid`, `NEVER use: ${vp.avoid.join(", ")}`, ``);
    if ((vp.banned_phrases ?? []).length > 0) lines.push(`## Banned Phrases — NEVER use these`, ...vp.banned_phrases!.map(p => `- "${p}"`), ``);
    return lines.join("\n");
}

export function PromptsEngineTab({
    company,
    form,
    setForm,
    onPromptsChange,
}: {
    company: CompanyData;
    form?: CompanyForm;
    setForm?: React.Dispatch<React.SetStateAction<CompanyForm>>;
    onPromptsChange?: (prompts: CompanyPrompt[]) => void;
}) {
    const { copiedId, copyToClipboard } = useCopyToClipboard();
    const [prompts, setPrompts] = useState<CompanyPrompt[]>(company.prompts ?? []);

    // Create / Edit state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState("");
    const [formBody, setFormBody] = useState("");
    const [formSaving, setFormSaving] = useState(false);
    const [formErr, setFormErr] = useState<string | null>(null);

    // Delete state
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Voice import state
    const [voiceUrl, setVoiceUrl] = useState("");
    const [voiceFetching, setVoiceFetching] = useState(false);
    const [voiceAnalyzing, setVoiceAnalyzing] = useState(false);
    const [voiceErr, setVoiceErr] = useState<string | null>(null);
    const [voiceSuccess, setVoiceSuccess] = useState(false);

    function openCreate() {
        setEditingId(null);
        setFormName("");
        setFormBody("");
        setFormErr(null);
        setVoiceUrl("");
        setVoiceErr(null);
        setVoiceSuccess(false);
        setShowForm(true);
    }

    function openEdit(p: CompanyPrompt) {
        setEditingId(p.id);
        setFormName(p.name);
        setFormBody(p.body);
        setFormErr(null);
        setVoiceUrl("");
        setVoiceErr(null);
        setVoiceSuccess(false);
        setShowForm(true);
    }

    function closeForm() {
        setShowForm(false);
        setEditingId(null);
        setFormName("");
        setFormBody("");
        setFormErr(null);
        setVoiceUrl("");
        setVoiceErr(null);
        setVoiceSuccess(false);
    }

    async function handleVoiceImport() {
        if (!voiceUrl.trim()) return;
        setVoiceErr(null);
        setVoiceSuccess(false);

        // Step 1: Fetch article text
        setVoiceFetching(true);
        let articleText: string;
        try {
            const r = await fetch("/api/fetch-article-text", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: voiceUrl.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to fetch article");
            articleText = data.text;
            if (!articleText || articleText.trim().length < 50) throw new Error("Article content too short for analysis (need at least 50 characters).");
        } catch (e: any) {
            setVoiceErr(e.message);
            setVoiceFetching(false);
            return;
        }
        setVoiceFetching(false);

        // Step 2: Analyze voice
        setVoiceAnalyzing(true);
        try {
            const r = await fetch("/api/analyze-voice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html: articleText, company_id: company.id }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Voice analysis failed");

            const voiceProfile: VoiceProfile = data.voice_profile;

            // Compile voice profile into a prompt directive
            const compiledBody = compileVoiceToPrompt(voiceProfile);

            // Auto-fill the prompt template form
            if (!formName.trim()) {
                setFormName(`${company.name} — Voice Priority`);
            }
            setFormBody(compiledBody);

            // Also update the company's voice_profile if setForm is available
            if (setForm) {
                setForm(prev => ({ ...prev, voice_profile: voiceProfile }));
            }

            setVoiceSuccess(true);
            setVoiceUrl("");
            setTimeout(() => setVoiceSuccess(false), 5000);
        } catch (e: any) {
            setVoiceErr(e.message);
        } finally {
            setVoiceAnalyzing(false);
        }
    }

    async function handleSavePrompt() {
        if (!formName.trim() || !formBody.trim()) {
            setFormErr("Name and body are required.");
            return;
        }
        setFormSaving(true);
        setFormErr(null);
        try {
            if (editingId) {
                // Update existing
                const r = await fetch(`/api/prompts/${editingId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: formName.trim(), body: formBody.trim() }),
                });
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || "Failed to update prompt");
                const updated = prompts.map(p => p.id === editingId ? data : p);
                setPrompts(updated);
                onPromptsChange?.(updated);
            } else {
                // Create new
                const r = await fetch("/api/prompts", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ company_id: company.id, name: formName.trim(), body: formBody.trim() }),
                });
                const data = await r.json();
                if (!r.ok) throw new Error(data.error || "Failed to create prompt");
                const updated = [data, ...prompts];
                setPrompts(updated);
                onPromptsChange?.(updated);
            }
            closeForm();
        } catch (e: any) {
            setFormErr(e.message);
        } finally {
            setFormSaving(false);
        }
    }

    async function handleDelete(id: string) {
        setDeletingId(id);
        try {
            const r = await fetch(`/api/prompts/${id}`, { method: "DELETE" });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to delete prompt");
            const updated = prompts.filter(p => p.id !== id);
            setPrompts(updated);
            onPromptsChange?.(updated);
        } catch (e: any) {
            console.error("Delete prompt error:", e.message);
        } finally {
            setDeletingId(null);
        }
    }

    const isVoiceBusy = voiceFetching || voiceAnalyzing;

    return (
        <div className="space-y-3">
            {/* Prompt Templates */}
            <Section
                title="Prompt Templates"
                icon={FileText}
                defaultOpen
                badge={prompts.length > 0 ? <Badge variant="secondary" className="text-[10px] ml-1">{prompts.length}</Badge> : <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Default</Badge>}
            >
                <div className="space-y-3 pt-3">
                    {/* Create / Edit form */}
                    {showForm ? (
                        <Card className="border-primary/30 bg-primary/[0.02]">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold flex items-center gap-1.5">
                                        {editingId ? <><Pencil className="h-3.5 w-3.5" /> Edit Prompt</> : <><Plus className="h-3.5 w-3.5" /> New Prompt Template</>}
                                    </span>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={closeForm}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                </div>

                                {/* Voice Import — only for new prompts */}
                                {!editingId && (
                                    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3.5 space-y-2.5">
                                        <div className="flex items-center gap-2 text-sm font-medium">
                                            <Mic className="h-4 w-4 text-primary" />
                                            Import voice from a blog post
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Paste a link to any article. We&apos;ll analyze the writing style and auto-generate a voice profile prompt template.
                                        </p>
                                        <div className="flex gap-2">
                                            <Input
                                                type="url"
                                                value={voiceUrl}
                                                onChange={(e) => { setVoiceUrl(e.target.value); setVoiceErr(null); }}
                                                placeholder="https://example.com/blog/your-best-article"
                                                disabled={isVoiceBusy}
                                                onKeyDown={(e) => { if (e.key === "Enter" && voiceUrl.trim()) { e.preventDefault(); handleVoiceImport(); } }}
                                                className="text-sm"
                                            />
                                            <Button
                                                variant="outline"
                                                onClick={handleVoiceImport}
                                                disabled={isVoiceBusy || !voiceUrl.trim()}
                                                className="gap-1.5 whitespace-nowrap shrink-0"
                                            >
                                                {voiceFetching ? (
                                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching…</>
                                                ) : voiceAnalyzing ? (
                                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analyzing…</>
                                                ) : (
                                                    <><Globe className="h-3.5 w-3.5" /> Analyze URL</>
                                                )}
                                            </Button>
                                        </div>
                                        {isVoiceBusy && (
                                            <p className="text-xs text-muted-foreground animate-pulse">
                                                {voiceFetching ? "Fetching article content…" : "Analyzing writing style — this takes 15–30 seconds…"}
                                            </p>
                                        )}
                                        {voiceErr && (
                                            <p className="text-xs text-destructive flex items-center gap-1.5">
                                                <AlertCircle className="h-3 w-3 shrink-0" /> {voiceErr}
                                            </p>
                                        )}
                                        {voiceSuccess && (
                                            <p className="text-xs text-green-600 flex items-center gap-1.5">
                                                <CheckCircle2 className="h-3 w-3 shrink-0" /> Voice profile analyzed and populated below! Review and save.
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <Label className="text-xs font-medium text-muted-foreground">Template Name</Label>
                                    <Input
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. Product Launch Blog, FAQ Generator"
                                        className="text-sm"
                                        autoFocus={!editingId}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-medium text-muted-foreground">Prompt Body</Label>
                                    <Textarea
                                        value={formBody}
                                        onChange={(e) => setFormBody(e.target.value)}
                                        placeholder={"Write a detailed blog post about {{topic}}.\n\nRequirements:\n- Include 3-5 subheadings\n- Target keyword: {{keyword}}\n- Tone: professional yet approachable"}
                                        rows={8}
                                        className="text-xs font-mono"
                                    />
                                    <p className="text-[11px] text-muted-foreground">Use {"{{variable}}"} syntax for dynamic placeholders.</p>
                                </div>
                                {formErr && (
                                    <p className="text-xs text-destructive flex items-center gap-1.5">
                                        <AlertCircle className="h-3 w-3 shrink-0" /> {formErr}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 pt-1">
                                    <Button size="sm" className="gap-1.5" onClick={handleSavePrompt} disabled={formSaving}>
                                        {formSaving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : <><Save className="h-3.5 w-3.5" /> {editingId ? "Update" : "Create"}</>}
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={closeForm} disabled={formSaving}>Cancel</Button>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        <Button variant="outline" size="sm" className="gap-1.5 border-dashed" onClick={openCreate}>
                            <Plus className="h-3.5 w-3.5" /> New Prompt Template
                        </Button>
                    )}

                    {/* Existing prompts */}
                    {prompts.length === 0 && !showForm && (
                        <p className="text-sm text-muted-foreground italic">No prompt templates configured. Create one to get started.</p>
                    )}
                    {prompts.map((p) => (
                        <PromptCard
                            key={p.id}
                            prompt={p}
                            copiedId={copiedId}
                            onCopy={copyToClipboard}
                            onEdit={() => openEdit(p)}
                            onDelete={() => handleDelete(p.id)}
                            deleting={deletingId === p.id}
                        />
                    ))}
                </div>
            </Section>

            {/* Prompt Engine */}
            <PromptEngineSection companyId={company.id} />
        </div>
    );
}

/* ── Prompt Card (with edit/delete actions) ──────────────────────── */
function PromptCard({ prompt: p, copiedId, onCopy, onEdit, onDelete, deleting }: {
    prompt: CompanyPrompt;
    copiedId: string | null;
    onCopy: (text: string, id: string) => void;
    onEdit: () => void;
    onDelete: () => void;
    deleting: boolean;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <Card className="bg-muted/30">
            <CardContent className="p-3.5">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => onCopy(p.body, p.id)}>
                            {copiedId === p.id ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><CopyIcon className="h-3 w-3" /> Copy</>}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-1.5" onClick={onEdit}>
                            <Pencil className="h-3 w-3" />
                        </Button>
                        {confirmDelete ? (
                            <div className="flex items-center gap-1">
                                <Button variant="destructive" size="sm" className="h-6 text-[11px] px-2" onClick={() => { onDelete(); setConfirmDelete(false); }} disabled={deleting}>
                                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                            </div>
                        ) : (
                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </div>
                <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono bg-background rounded-md p-2.5 max-h-48 overflow-y-auto">{p.body}</pre>
            </CardContent>
        </Card>
    );
}

/* ── Prompt Engine Section (lazy-loaded compiled prompts) ────────── */
function PromptEngineSection({ companyId }: { companyId: string }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [systemPrompt, setSystemPrompt] = useState<string | null>(null);
    const [userPrompt, setUserPrompt] = useState<string | null>(null);
    const { copiedId, copyToClipboard } = useCopyToClipboard();
    const [activeTab, setActiveTab] = useState<"system" | "user">("system");
    const loaded = useRef(false);

    function handleToggle() {
        const willOpen = !open;
        setOpen(willOpen);
        if (willOpen && !loaded.current) {
            setLoading(true);
            setError(null);
            fetch(`/api/companies/${companyId}/prompt-engine`)
                .then((r) => r.json())
                .then((data) => {
                    if (data.error) throw new Error(data.error);
                    setSystemPrompt(data.system_prompt);
                    setUserPrompt(data.user_prompt_template);
                    loaded.current = true;
                })
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
        }
    }

    const estimateTokens = (text: string) => Math.ceil(text.length / 4);
    const systemTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;
    const userTokens = userPrompt ? estimateTokens(userPrompt) : 0;

    return (
        <Card>
            <button
                onClick={handleToggle}
                className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
            >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <Cpu className="h-4 w-4 text-muted-foreground" />
                    Prompt Engine
                    <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Base</Badge>
                </span>
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {open && (
                <CardContent className="pt-0 pb-5 px-5 border-t border-border">
                    <div className="space-y-4 pt-3">
                        <div className="flex items-start gap-2.5 rounded-md bg-muted/40 border border-border p-3">
                            <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="text-xs text-muted-foreground leading-relaxed">
                                <p>This is the <strong>compiled prompt</strong> sent to the LLM for this company. It combines the <strong>base prompt</strong> (editable in <strong>Settings → Prompts</strong>) with this company&apos;s editorial guidelines, SEO guidelines, and voice profile layered on top.</p>
                                <p className="mt-1.5">Company-level settings always take priority over the base prompt.</p>
                            </div>
                        </div>

                        {loading && (
                            <div className="flex items-center gap-2 justify-center py-8">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Compiling prompts…</span>
                            </div>
                        )}

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {systemPrompt && userPrompt && (
                            <>
                                <div className="flex gap-4 text-xs text-muted-foreground">
                                    <span>System: ~{systemTokens.toLocaleString()} tokens</span>
                                    <span>User: ~{userTokens.toLocaleString()} tokens</span>
                                    <span className="font-medium text-foreground">Total: ~{(systemTokens + userTokens).toLocaleString()} tokens</span>
                                </div>

                                <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                                    <button onClick={() => setActiveTab("system")} className={cn("flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all", activeTab === "system" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>System Prompt</button>
                                    <button onClick={() => setActiveTab("user")} className={cn("flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all", activeTab === "user" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>User Prompt Template</button>
                                </div>

                                <div className="relative">
                                    <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-muted rounded-md p-4 max-h-[500px] overflow-y-auto font-mono">{activeTab === "system" ? systemPrompt : userPrompt}</pre>
                                    <CopyButton text={activeTab === "system" ? systemPrompt : userPrompt} id={activeTab} copiedId={copiedId} onCopy={copyToClipboard} />
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
