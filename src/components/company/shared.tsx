import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Trash2, Copy as CopyIcon, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageStyleCategory } from "@/brand/engine";

/* ── Color utility ───────────────────────────────────────────────── */
export function isLightColor(hex: string): boolean {
    const h = hex.replace("#", "");
    if (h.length < 6) return true;
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    // W3C relative luminance
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

/* ── Collapsible Section ─────────────────────────────────────────── */
export function Section({ title, icon: Icon, badge, defaultOpen, children }: {
    title: string; icon: React.ElementType; badge?: React.ReactNode;
    defaultOpen?: boolean; children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen ?? false);
    return (
        <Card className="ring-0">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center justify-between w-full px-5 py-3.5 text-left hover:bg-muted/50 transition-colors"
            >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {title}
                    {badge}
                </span>
                {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </button>
            {open && (
                <CardContent className="pt-0 pb-5 px-5 border-t border-border">
                    {children}
                </CardContent>
            )}
        </Card>
    );
}

/* ── Field components (read-only / editable) ─────────────────────── */
export function Field({ label, value, mono, editing, onChange, rows }: {
    label: string; value?: string | null; mono?: boolean;
    editing?: boolean; onChange?: (v: string) => void; rows?: number;
}) {
    if (!editing && !value) return null;
    return (
        <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            {editing ? (
                rows ? <Textarea value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} rows={rows} className="text-sm" />
                    : <Input value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} className="text-sm" />
            ) : (
                <div className={cn("text-sm leading-relaxed", mono && "font-mono text-xs bg-muted rounded-md p-2.5 whitespace-pre-wrap")}>{value}</div>
            )}
        </div>
    );
}

export function FieldList({ label, items, editing, onChange, placeholder }: {
    label: string; items?: string[] | null;
    editing?: boolean; onChange?: (v: string[]) => void; placeholder?: string;
}) {
    if (!editing && (!items || items.length === 0)) return null;
    return (
        <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
            {editing ? (
                <Input value={(items ?? []).join(", ")} onChange={(e) => onChange?.(e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder={placeholder ?? "comma-separated"} className="text-sm" />
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {items!.map((item, i) => <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>)}
                </div>
            )}
        </div>
    );
}

/* ── Image Style Card (read-only, used in visual tab) ────────────── */
export function ImageStyleCard({ style: cat, onDelete }: { style: ImageStyleCategory; onDelete?: () => void }) {
    const [expanded, setExpanded] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    return (
        <Card className="bg-muted/20">
            <div className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1.5 text-sm font-medium text-left flex-1 min-w-0"
                >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    {cat.label || "Untitled Style"}
                    <span className="text-xs text-muted-foreground">({cat.id})</span>
                    {cat.type === "composite" && <Badge variant="outline" className="text-[10px] h-4 gap-0.5">🧩 Composite</Badge>}
                </button>
                {onDelete && (
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                        {confirmDelete ? (
                            <>
                                <Button variant="destructive" size="sm" className="h-6 text-[11px] px-2" onClick={onDelete}>Delete</Button>
                                <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                            </>
                        ) : (
                            <Button variant="ghost" size="sm" className="h-6 px-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                                <Trash2 className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
            {expanded && (
                <CardContent className="pt-0 pb-3 px-4 space-y-2.5 border-t border-border">
                    <Field label="Narrative" value={cat.narrative} />
                    <FieldList label="Storytelling Cues" items={cat.storytelling_cues} />
                    <Field label="Image Prompt Style" value={cat.image_prompt_style} mono />
                    {cat.type === "composite" && (
                        <fieldset className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
                            <legend className="text-xs font-semibold px-1.5">🧩 Composite Defaults</legend>
                            <Field label="Background Prompt" value={cat.composite_bg_prompt} />
                            <Field label="Product Search Query" value={cat.composite_product_query} />
                            {cat.composite_bg_image_url && (
                                <div className="space-y-1">
                                    <div className="text-xs font-medium text-muted-foreground">Background Image</div>
                                    <img src={cat.composite_bg_image_url} alt="Background" className="w-32 h-20 object-cover rounded-md border border-border" />
                                </div>
                            )}
                        </fieldset>
                    )}
                </CardContent>
            )}
        </Card>
    );
}

/* ── Copy-to-clipboard hook ──────────────────────────────────────── */
export function useCopyToClipboard() {
    const [copiedId, setCopiedId] = useState<string | null>(null);
    function copyToClipboard(text: string, id: string) {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        });
    }
    return { copiedId, copyToClipboard };
}

/* ── Copy button helper ──────────────────────────────────────────── */
export function CopyButton({ text, id, copiedId, onCopy }: { text: string; id: string; copiedId: string | null; onCopy: (text: string, id: string) => void }) {
    return (
        <Button variant="ghost" size="sm" className="absolute top-2 right-2 h-7 text-xs gap-1" onClick={() => onCopy(text, id)}>
            {copiedId === id ? <><CheckCircle2 className="h-3 w-3" /> Copied</> : <><CopyIcon className="h-3 w-3" /> Copy</>}
        </Button>
    );
}
