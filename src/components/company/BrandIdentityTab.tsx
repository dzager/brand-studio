import { useState } from "react";
import type { TabProps } from "./types";
import { Section, Field, FieldList, useCopyToClipboard, CopyButton } from "./shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Eye, BookOpen, Search as SearchIcon, Settings2,
    Plus, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandIdentityTab({ company, form, setForm, setField, editing }: TabProps) {
    const { copiedId, copyToClipboard } = useCopyToClipboard();
    const [newRefUrl, setNewRefUrl] = useState("");

    return (
        <div className="space-y-3">
            {/* Identity */}
            <Section title="Identity" icon={Eye} defaultOpen>
                <div className="space-y-4 pt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Company Name" value={editing ? form.name : company.name} editing={editing} onChange={v => setField("name", v)} />
                        <Field label="Tagline" value={editing ? form.tagline : company.tagline} editing={editing} onChange={v => setField("tagline", v)} />
                    </div>
                    <Field label="Mission" value={editing ? form.mission : company.mission} editing={editing} onChange={v => setField("mission", v)} rows={3} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Archetype" value={editing ? form.archetype : (company.archetype ?? "guide")} editing={editing} onChange={v => setField("archetype", v)} />
                        <Field label="Tone" value={editing ? form.tone : company.tone} editing={editing} onChange={v => setField("tone", v)} />
                    </div>
                    <FieldList label="Target Audiences" items={editing ? form.target_audiences : company.target_audiences} editing={editing} onChange={v => setField("target_audiences", v)} />
                </div>
            </Section>

            {/* Editorial + SEO Guidelines — two-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Editorial Guidelines */}
                <Section
                    title="Editorial Guidelines"
                    icon={BookOpen}
                    badge={(editing ? form.editorial_guidelines : company.editorial_guidelines) ? <Badge variant="secondary" className="text-[10px] ml-1">{(editing ? form.editorial_guidelines : company.editorial_guidelines)!.length} chars</Badge> : <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Default</Badge>}
                >
                    <div className="pt-3">
                        {editing ? (
                            <Textarea value={form.editorial_guidelines} onChange={e => setField("editorial_guidelines", e.target.value)} rows={12} className="text-xs font-mono" />
                        ) : company.editorial_guidelines ? (
                            <div className="relative">
                                <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-muted rounded-md p-4 max-h-96 overflow-y-auto">{company.editorial_guidelines}</pre>
                                <CopyButton text={company.editorial_guidelines} id="editorial" copiedId={copiedId} onCopy={copyToClipboard} />
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No editorial guidelines configured.</p>
                        )}
                    </div>
                </Section>

                {/* SEO Content Guidelines */}
                <Section
                    title="SEO Content Guidelines"
                    icon={SearchIcon}
                    badge={(editing ? form.seo_content_guidelines : company.seo_content_guidelines) ? <Badge variant="secondary" className="text-[10px] ml-1">{(editing ? form.seo_content_guidelines : company.seo_content_guidelines)!.length} chars</Badge> : <Badge variant="outline" className="text-[10px] ml-1 text-muted-foreground">Default</Badge>}
                >
                    <div className="pt-3">
                        {editing ? (
                            <Textarea value={form.seo_content_guidelines} onChange={e => setField("seo_content_guidelines", e.target.value)} rows={12} className="text-xs font-mono" />
                        ) : company.seo_content_guidelines ? (
                            <div className="relative">
                                <pre className="whitespace-pre-wrap text-xs leading-relaxed bg-muted rounded-md p-4 max-h-96 overflow-y-auto">{company.seo_content_guidelines}</pre>
                                <CopyButton text={company.seo_content_guidelines} id="seo" copiedId={copiedId} onCopy={copyToClipboard} />
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No SEO content guidelines configured.</p>
                        )}
                    </div>
                </Section>
            </div>

            {/* Content Settings */}
            <Section title="Content Settings" icon={Settings2}>
                <div className="space-y-3 pt-3">
                    <button type="button" onClick={() => editing && setField("auto_humanize", !form.auto_humanize)} className={cn("flex items-center gap-3 w-full text-left", editing && "cursor-pointer hover:bg-muted/50 rounded-md p-1 -m-1")}>
                        <div className={cn("w-3 h-3 rounded-full", (editing ? form.auto_humanize : company.auto_humanize !== false) ? "bg-green-500" : "bg-muted-foreground/30")} />
                        <div>
                            <div className="text-sm font-medium">🧹 Auto-Humanize</div>
                            <div className="text-xs text-muted-foreground">{(editing ? form.auto_humanize : company.auto_humanize !== false) ? "Enabled" : "Disabled"}{editing ? " — click to toggle" : ""}</div>
                        </div>
                    </button>
                    <button type="button" onClick={() => editing && setField("include_toc", !form.include_toc)} className={cn("flex items-center gap-3 w-full text-left", editing && "cursor-pointer hover:bg-muted/50 rounded-md p-1 -m-1")}>
                        <div className={cn("w-3 h-3 rounded-full", (editing ? form.include_toc : company.include_toc === true) ? "bg-green-500" : "bg-muted-foreground/30")} />
                        <div>
                            <div className="text-sm font-medium">📑 Table of Contents</div>
                            <div className="text-xs text-muted-foreground">{(editing ? form.include_toc : company.include_toc === true) ? "Enabled" : "Disabled"}{editing ? " — click to toggle" : ""}</div>
                        </div>
                    </button>
                    <Field label="Avoid Phrases" value={editing ? form.avoid_phrases : company.avoid_phrases} editing={editing} onChange={v => setField("avoid_phrases", v)} rows={2} />
                    {editing ? (
                        <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">Reference Articles</Label>
                            <p className="text-xs text-muted-foreground">Add URLs of gold-standard articles used as style references.</p>
                            {form.reference_articles.map((url, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm text-primary break-all">{url}</a>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={() => setForm(prev => ({ ...prev, reference_articles: prev.reference_articles.filter((_, i) => i !== idx) }))}><X className="h-3 w-3" /></Button>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <Input type="url" value={newRefUrl} onChange={(e) => setNewRefUrl(e.target.value)} placeholder="https://example.com/blog/article" onKeyDown={(e) => { if (e.key === "Enter" && newRefUrl.trim()) { e.preventDefault(); setForm(prev => ({ ...prev, reference_articles: [...prev.reference_articles, newRefUrl.trim()] })); setNewRefUrl(""); } }} />
                                <Button variant="outline" size="sm" disabled={!newRefUrl.trim()} onClick={() => { if (newRefUrl.trim()) { setForm(prev => ({ ...prev, reference_articles: [...prev.reference_articles, newRefUrl.trim()] })); setNewRefUrl(""); } }}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                                </Button>
                            </div>
                        </div>
                    ) : company.reference_articles && company.reference_articles.length > 0 ? (
                        <div className="space-y-1">
                            <div className="text-xs font-medium text-muted-foreground">Reference Articles</div>
                            <div className="space-y-1">
                                {company.reference_articles.map((url, i) => (
                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary truncate hover:underline">{url}</a>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            </Section>
        </div>
    );
}
