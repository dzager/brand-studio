import { useState, useRef, useEffect } from "react";
import type { CompanyFeedback, CompanyPrompt } from "./types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MessageSquare, Send, Loader2, Trash2, Cpu, UserCircle,
    ChevronDown, CheckCircle2, AlertCircle, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Relative time helper ────────────────────────────────────────── */
function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

/* ── FeedbackDialog ──────────────────────────────────────────────── */
export function FeedbackDialog({
    open,
    onOpenChange,
    companyId,
    companyName,
    personas,
    onFeedbackChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    companyId: string;
    companyName: string;
    personas: CompanyPrompt[];
    onFeedbackChange?: () => void;
}) {
    const [items, setItems] = useState<CompanyFeedback[]>([]);
    const [loading, setLoading] = useState(false);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [togglingModel, setTogglingModel] = useState<string | null>(null);
    const [applyingPersona, setApplyingPersona] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch feedback when dialog opens
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setError(null);
        fetch(`/api/feedback?company_id=${companyId}`)
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setItems(data);
                else if (data.error) setError(data.error);
            })
            .catch(() => setError("Failed to load feedback"))
            .finally(() => setLoading(false));
    }, [open, companyId]);

    // Scroll to bottom on new items
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [items.length]);

    async function handleSend() {
        if (!input.trim()) return;
        setSending(true);
        setError(null);
        try {
            const r = await fetch("/api/feedback", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_id: companyId, body: input.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed to submit feedback");
            setItems((prev) => [...prev, data]);
            setInput("");
            onFeedbackChange?.();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSending(false);
        }
    }

    async function handleToggleModel(item: CompanyFeedback) {
        setTogglingModel(item.id);
        try {
            const r = await fetch("/api/feedback/apply-to-model", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: item.id, active: !item.applied_to_model }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed");
            setItems((prev) => prev.map((f) => (f.id === item.id ? { ...f, applied_to_model: !item.applied_to_model } : f)));
            onFeedbackChange?.();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setTogglingModel(null);
        }
    }

    async function handleApplyToPersona(feedbackId: string, personaId: string) {
        setApplyingPersona(feedbackId);
        try {
            const r = await fetch("/api/feedback/apply-to-persona", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: feedbackId, persona_id: personaId }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || "Failed");
            setItems((prev) => prev.map((f) => (f.id === feedbackId ? { ...f, applied_to_persona_id: personaId } : f)));
            onFeedbackChange?.();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setApplyingPersona(null);
        }
    }

    async function handleDelete(id: string) {
        setDeletingId(id);
        try {
            await fetch(`/api/feedback/${id}`, { method: "DELETE" });
            setItems((prev) => prev.filter((f) => f.id !== id));
            onFeedbackChange?.();
        } catch {
            setError("Failed to delete feedback");
        } finally {
            setDeletingId(null);
        }
    }

    const appliedCount = items.filter((f) => f.applied_to_model).length;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
                {/* Header */}
                <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
                    <SheetTitle className="flex items-center gap-2 text-base">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Feedback — {companyName}
                    </SheetTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Leave quality-improvement notes. Apply them to the global model or a specific persona.
                    </p>
                    {appliedCount > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                            <Badge variant="secondary" className="text-[10px] gap-1">
                                <Cpu className="h-2.5 w-2.5" />
                                {appliedCount} active in model
                            </Badge>
                        </div>
                    )}
                </SheetHeader>

                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {!loading && items.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-3" />
                            <p className="text-sm text-muted-foreground">No feedback yet</p>
                            <p className="text-xs text-muted-foreground/70 mt-1">
                                Share notes to improve content quality across all articles.
                            </p>
                        </div>
                    )}

                    {items.map((item) => {
                        const personaName = personas.find((p) => p.id === item.applied_to_persona_id)?.name;
                        return (
                            <FeedbackMessage
                                key={item.id}
                                item={item}
                                personaName={personaName}
                                personas={personas}
                                togglingModel={togglingModel === item.id}
                                applyingPersona={applyingPersona === item.id}
                                deleting={deletingId === item.id}
                                onToggleModel={() => handleToggleModel(item)}
                                onApplyToPersona={(pid) => handleApplyToPersona(item.id, pid)}
                                onDelete={() => handleDelete(item.id)}
                            />
                        );
                    })}
                </div>

                {/* Error */}
                {error && (
                    <div className="px-5 pb-2">
                        <p className="text-xs text-destructive flex items-center gap-1.5">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {error}
                        </p>
                    </div>
                )}

                {/* Input */}
                <div className="border-t border-border px-5 py-3 shrink-0">
                    <div className="flex gap-2">
                        <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Share feedback to improve article quality…"
                            rows={2}
                            className="text-sm resize-none flex-1"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey && input.trim()) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            disabled={sending}
                        />
                        <Button
                            size="icon"
                            className="h-auto aspect-square shrink-0"
                            onClick={handleSend}
                            disabled={sending || !input.trim()}
                        >
                            {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                        Press Enter to send · Shift+Enter for new line
                    </p>
                </div>
            </SheetContent>
        </Sheet>
    );
}

/* ── Individual Feedback Message ─────────────────────────────────── */
function FeedbackMessage({
    item,
    personaName,
    personas,
    togglingModel,
    applyingPersona,
    deleting,
    onToggleModel,
    onApplyToPersona,
    onDelete,
}: {
    item: CompanyFeedback;
    personaName?: string;
    personas: CompanyPrompt[];
    togglingModel: boolean;
    applyingPersona: boolean;
    deleting: boolean;
    onToggleModel: () => void;
    onApplyToPersona: (personaId: string) => void;
    onDelete: () => void;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);

    return (
        <div className="group rounded-lg border border-border bg-card p-3 space-y-2 transition-colors hover:border-border/80">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <UserCircle className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="font-medium text-foreground/80">
                        {item.user_email?.split("@")[0] || "User"}
                    </span>
                    <span>·</span>
                    <span>{timeAgo(item.created_at)}</span>
                </div>
                {/* Delete */}
                {confirmDelete ? (
                    <div className="flex items-center gap-1">
                        <Button
                            variant="destructive"
                            size="sm"
                            className="h-5 text-[10px] px-1.5"
                            onClick={() => { onDelete(); setConfirmDelete(false); }}
                            disabled={deleting}
                        >
                            {deleting ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Delete"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 text-[10px] px-1.5"
                            onClick={() => setConfirmDelete(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                ) : (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmDelete(true)}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                )}
            </div>

            {/* Body */}
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.body}</p>

            {/* Status badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
                {item.applied_to_model && (
                    <Badge variant="default" className="text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700">
                        <Cpu className="h-2.5 w-2.5" /> Active in Model
                    </Badge>
                )}
                {personaName && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                        <Zap className="h-2.5 w-2.5" /> Applied to {personaName}
                    </Badge>
                )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5 pt-0.5">
                <Button
                    variant={item.applied_to_model ? "default" : "outline"}
                    size="sm"
                    className={cn(
                        "h-6 text-[11px] gap-1 px-2",
                        item.applied_to_model && "bg-emerald-600 hover:bg-emerald-700"
                    )}
                    onClick={onToggleModel}
                    disabled={togglingModel}
                >
                    {togglingModel ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : item.applied_to_model ? (
                        <><CheckCircle2 className="h-2.5 w-2.5" /> In Model</>
                    ) : (
                        <><Cpu className="h-2.5 w-2.5" /> Add to Model</>
                    )}
                </Button>

                {personas.length > 0 && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[11px] gap-1 px-2"
                                disabled={applyingPersona}
                            >
                                {applyingPersona ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                ) : (
                                    <><Zap className="h-2.5 w-2.5" /> Add to Persona</>
                                )}
                                <ChevronDown className="h-2.5 w-2.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            {personas.map((p) => (
                                <DropdownMenuItem
                                    key={p.id}
                                    onClick={() => onApplyToPersona(p.id)}
                                    className="text-xs"
                                >
                                    {p.name}
                                    {item.applied_to_persona_id === p.id && (
                                        <CheckCircle2 className="h-3 w-3 ml-auto text-primary" />
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );
}
