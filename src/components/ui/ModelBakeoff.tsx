import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { RefreshCw, Trophy, Clock, Sparkles, CheckCircle2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type BakeoffSample = {
    model_id: string;
    label: string;
    provider: string;
    content: string;
    latency_ms: number;
    error?: boolean;
};

type ModelBakeoffProps = {
    companyId: string;
    companyName?: string;
    onModelSelected: (modelId: string) => void;
};

const PROVIDER_COLORS: Record<string, string> = {
    openai: "#10a37f",
    google: "#4285f4",
    anthropic: "#cc785c",
};

const PROVIDER_GRADIENTS: Record<string, string> = {
    openai: "from-emerald-500/10 to-emerald-500/5",
    google: "from-blue-500/10 to-blue-500/5",
    anthropic: "from-orange-500/10 to-orange-500/5",
};

export default function ModelBakeoff({ companyId, companyName, onModelSelected }: ModelBakeoffProps) {
    const [open, setOpen] = useState(false);
    const [topic, setTopic] = useState("");
    const [running, setRunning] = useState(false);
    const [samples, setSamples] = useState<BakeoffSample[]>([]);
    const [err, setErr] = useState<string | null>(null);
    const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    async function runBakeoff() {
        if (!topic.trim() || !companyId) return;
        setRunning(true);
        setErr(null);
        setSamples([]);
        setSelectedWinner(null);
        setSaved(false);
        try {
            const r = await fetch("/api/model-bakeoff", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ topic: topic.trim(), company_id: companyId }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || `Bake-off failed (${r.status})`);
            setSamples(data.samples ?? []);
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setRunning(false);
        }
    }

    async function saveWinner() {
        if (!selectedWinner || !companyId) return;
        setSaving(true);
        try {
            const r = await fetch(`/api/companies/${companyId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ preferred_model: selectedWinner }),
            });
            if (!r.ok) {
                const data = await r.json();
                throw new Error(data?.error || "Save failed");
            }
            setSaved(true);
            onModelSelected(selectedWinner);
            // Auto-close after a brief pause
            setTimeout(() => {
                setOpen(false);
                // Reset for next use
                setTimeout(() => {
                    setSamples([]);
                    setSelectedWinner(null);
                    setSaved(false);
                    setTopic("");
                }, 300);
            }, 1200);
        } catch (e: any) {
            setErr(e.message);
        } finally {
            setSaving(false);
        }
    }

    function handleClose() {
        if (running) return; // prevent closing during generation
        setOpen(false);
        // Delayed reset
        setTimeout(() => {
            setSamples([]);
            setSelectedWinner(null);
            setSaved(false);
            setErr(null);
        }, 300);
    }

    return (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                disabled={!companyId}
                className="gap-1.5 whitespace-nowrap border-dashed border-primary/40 hover:border-primary hover:bg-primary/5 transition-all"
                title="Compare 3 AI models side-by-side and pick your favorite"
            >
                <Zap className="h-3.5 w-3.5 text-primary" />
                Bake-off
            </Button>

            <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
                <DialogContent className="w-[80vw] max-w-[80vw] h-[80vh] max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
                                <Trophy className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <span>Model Bake-off</span>
                                {companyName && (
                                    <span className="text-muted-foreground font-normal text-sm ml-2">· {companyName}</span>
                                )}
                            </div>
                        </DialogTitle>
                        <p className="text-sm text-muted-foreground">
                            Compare GPT-5.5, GPT-4.1, and Gemini 3.1 Pro side by side.
                            Pick the output you like best and save it as the default writing model for this company.
                        </p>
                    </DialogHeader>

                    {/* Topic input */}
                    {samples.length === 0 && !running && (
                        <div className="space-y-3 py-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="bakeoff-topic" className="text-sm font-medium">Topic</Label>
                                <Input
                                    id="bakeoff-topic"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter" && topic.trim().length >= 3) runBakeoff(); }}
                                    placeholder="e.g., Benefits of dental implants for seniors, How to choose a travel insurance policy…"
                                    className="text-sm"
                                    autoFocus
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter any topic relevant to {companyName || "your brand"}.
                                    Each model will produce a short content sample (~200 words).
                                </p>
                            </div>
                            <Button
                                onClick={runBakeoff}
                                disabled={topic.trim().length < 3}
                                className="gap-1.5"
                            >
                                <Sparkles className="h-4 w-4" />
                                Run Bake-off
                            </Button>
                        </div>
                    )}

                    {/* Loading state */}
                    {running && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
                            <div className="relative">
                                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                    <RefreshCw className="h-7 w-7 text-primary animate-spin" />
                                </div>
                            </div>
                            <div className="text-center space-y-1">
                                <p className="font-medium">Running 3 models in parallel…</p>
                                <p className="text-sm text-muted-foreground">GPT-5.5 · GPT-4.1 · Gemini 3.1 Pro</p>
                                <p className="text-xs text-muted-foreground">This typically takes 10–20 seconds</p>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {err && !running && (
                        <p className="text-sm text-destructive py-2">{err}</p>
                    )}

                    {/* Results */}
                    {samples.length > 0 && !running && (
                        <div className="flex-1 overflow-auto space-y-4 py-2">
                            <div className="flex items-center gap-2 text-sm">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <span className="font-medium">Results for: &ldquo;{topic}&rdquo;</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="ml-auto text-xs gap-1"
                                    onClick={() => { setSamples([]); setSelectedWinner(null); setSaved(false); setErr(null); }}
                                >
                                    <RefreshCw className="h-3 w-3" /> Try another topic
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {samples.map((s) => {
                                    const isWinner = selectedWinner === s.model_id;
                                    const provColor = PROVIDER_COLORS[s.provider] ?? "#888";
                                    const gradClass = PROVIDER_GRADIENTS[s.provider] ?? "from-muted/20 to-muted/5";
                                    return (
                                        <button
                                            key={s.model_id}
                                            onClick={() => { if (!saved) setSelectedWinner(s.model_id); }}
                                            disabled={saved}
                                            className={cn(
                                                "relative flex flex-col rounded-xl border-2 p-4 text-left transition-all duration-200 cursor-pointer",
                                                "hover:shadow-md hover:scale-[1.01]",
                                                isWinner
                                                    ? "border-primary ring-2 ring-primary/20 shadow-lg scale-[1.01]"
                                                    : "border-border/60 hover:border-primary/40",
                                                saved && !isWinner && "opacity-50 cursor-not-allowed",
                                                `bg-gradient-to-b ${gradClass}`
                                            )}
                                        >
                                            {/* Header */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-2.5 w-2.5 rounded-full"
                                                        style={{ backgroundColor: provColor }}
                                                    />
                                                    <span className="font-semibold text-sm">{s.label}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                                    <span className="text-[11px] text-muted-foreground tabular-nums">
                                                        {(s.latency_ms / 1000).toFixed(1)}s
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className={cn(
                                                "text-sm leading-relaxed flex-1",
                                                s.error ? "text-destructive italic" : "text-foreground/90"
                                            )}>
                                                {s.content}
                                            </div>

                                            {/* Word count footer */}
                                            <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                                    {s.content.split(/\s+/).length} words
                                                </span>
                                                {isWinner && (
                                                    <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-[10px]">
                                                        <Trophy className="h-3 w-3" /> Selected
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Winner crown overlay */}
                                            {isWinner && saved && (
                                                <div className="absolute -top-2.5 -right-2.5">
                                                    <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shadow-lg">
                                                        <CheckCircle2 className="h-4 w-4 text-primary-foreground" />
                                                    </div>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {!selectedWinner && !saved && (
                                <p className="text-xs text-muted-foreground text-center">
                                    Click on the output you prefer to select it as the default model for {companyName || "this company"}.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    {samples.length > 0 && !running && (
                        <DialogFooter className="gap-2">
                            {saved ? (
                                <div className="flex items-center gap-2 text-sm text-success font-medium">
                                    <CheckCircle2 className="h-4 w-4" />
                                    {samples.find(s => s.model_id === selectedWinner)?.label} is now the default writing model
                                    {companyName ? ` for ${companyName}` : ""}!
                                </div>
                            ) : (
                                <>
                                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                                    <Button
                                        onClick={saveWinner}
                                        disabled={!selectedWinner || saving}
                                        className="gap-1.5"
                                    >
                                        {saving ? (
                                            <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</>
                                        ) : (
                                            <><Trophy className="h-4 w-4" /> Set as Default Model</>
                                        )}
                                    </Button>
                                </>
                            )}
                        </DialogFooter>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
