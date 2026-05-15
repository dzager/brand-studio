import { useState, useRef, useEffect } from "react";
import {
  Building2, Network, FileText, Check, ChevronRight, ChevronLeft,
  Sparkles, RefreshCw, Settings, ChevronDown, Search, Layers,
  Eye, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ImageStyleCategory } from "@/brand/engine";
import ModelBakeoff from "@/components/ui/ModelBakeoff";

// ── Types ──────────────────────────────────────────────────────────────

interface WizardProps {
  // Company
  companies: { id: string; name: string }[];
  companiesLoaded: boolean;
  companyId: string;
  setCompanyId: (id: string) => void;
  isScopedMember: boolean;
  // Mode
  mode: "single" | "cluster";
  setMode: (m: "single" | "cluster") => void;
  // Single article
  prompt: string;
  setPrompt: (p: string) => void;
  suggestedPrompt: string;
  companyPrompts: { id: string; name: string; body: string }[];
  activeTemplateId: string | null;
  setActiveTemplateId: (id: string | null) => void;
  // Cluster
  clusterTopic: string;
  setClusterTopic: (t: string) => void;
  getClusterPlaceholder: (name?: string) => string;
  // Advanced
  imageStyle: string;
  setImageStyle: (s: string) => void;
  activeStyles: ImageStyleCategory[];
  model: string;
  setModel: (m: string) => void;
  availableModels: { id: string; label: string; provider: string }[];
  wordCount: string;
  setWordCount: (w: string) => void;
  // Composite
  isCompositeStyle: boolean;
  selectedStyleObj?: ImageStyleCategory;
  csProductQuery: string;
  setCsProductQuery: (q: string) => void;
  csProductResults: any[];
  csProductSearching: boolean;
  csProductSearch: () => void;
  csProductUrl: string | null;
  setCsProductUrl: (u: string | null) => void;
  csProductThumb: string | null;
  setCsProductThumb: (t: string | null) => void;
  csBgPrompt: string;
  setCsBgPrompt: (p: string) => void;
  csBgImageUrl: string;
  setCsBgImageUrl: (u: string) => void;
  // Recommendation
  recommending: boolean;
  recommendation: { id: string; label: string; reason: string } | null;
  onRecommendStyle: () => void;
  // Actions
  loading: boolean;
  clusterGenerating: boolean;
  onCreate: () => void;
  onCreateCluster: () => void;
  onPreviewPrompt: () => void;
  previewing: boolean;
  // Bake-off
  onBakeoffModelSelected: (mid: string) => void;
}

const ALL_STEPS = [
  { id: 1, label: "Brand", icon: Building2 },
  { id: 2, label: "Format", icon: Network },
  { id: 3, label: "Content", icon: FileText },
  { id: 4, label: "Create", icon: Sparkles },
];

// ── Component ──────────────────────────────────────────────────────────

export default function ContentWizard(props: WizardProps) {
  const {
    companies, companiesLoaded, companyId, setCompanyId, isScopedMember,
    mode, setMode,
    prompt, setPrompt, suggestedPrompt, companyPrompts, activeTemplateId, setActiveTemplateId,
    clusterTopic, setClusterTopic, getClusterPlaceholder,
    imageStyle, setImageStyle, activeStyles, model, setModel,
    availableModels, wordCount, setWordCount,
    isCompositeStyle, selectedStyleObj,
    csProductQuery, setCsProductQuery, csProductResults, csProductSearching,
    csProductSearch, csProductUrl, setCsProductUrl, csProductThumb, setCsProductThumb,
    csBgPrompt, setCsBgPrompt, csBgImageUrl, setCsBgImageUrl,
    recommending, recommendation, onRecommendStyle,
    loading, clusterGenerating, onCreate, onCreateCluster,
    onPreviewPrompt, previewing, onBakeoffModelSelected,
  } = props;

  // When only 1 company, skip the Brand step entirely
  const singleCompany = companies.length === 1;
  const visibleSteps = singleCompany ? ALL_STEPS.filter(s => s.id !== 1) : ALL_STEPS;
  const firstStep = singleCompany ? 2 : 1;

  const [step, setStep] = useState(firstStep);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-select when only one company
  useEffect(() => {
    if (singleCompany && !companyId) {
      setCompanyId(companies[0].id);
    }
    // Skip past the Brand step if only one company
    if (singleCompany && step === 1) {
      setStep(2);
    }
  }, [companies]);

  function canProceed(): boolean {
    switch (step) {
      case 1: return companiesLoaded && !!companyId;
      case 2: return true; // mode always has a default
      case 3:
        return mode === "single"
          ? prompt.trim().length >= 5
          : clusterTopic.trim().length >= 5;
      default: return true;
    }
  }

  function goTo(target: number) {
    if (target === step || animating) return;
    setDirection(target > step ? "forward" : "back");
    setAnimating(true);
    setTimeout(() => {
      setStep(target);
      setAnimating(false);
    }, 200);
  }

  function next() { if (canProceed() && step < 4) goTo(step + 1); }
  function back() { if (step > firstStep) goTo(step - 1); }

  const companyName = companies.find((c) => c.id === companyId)?.name;
  const isWorking = loading || clusterGenerating;

  const LENGTH_LABELS: Record<string, string> = {
    "300-500": "Short (300–500 words)",
    "800-1200": "Medium (800–1,200 words)",
    "1500-2500": "Long (1,500–2,500 words)",
    "2500-4000": "Deep Dive (2,500–4,000 words)",
    "": "No limit",
  };

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-[calc(100vh-7rem)] gap-6">
      {/* Progress bar */}
      <div className="wizard-progress">
        {visibleSteps.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isComplete = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Only allow going back to completed steps
                  if (isComplete) goTo(s.id);
                }}
                disabled={!isComplete}
                className={cn(
                  "wizard-step-pill",
                  isActive && "active",
                  isComplete && "complete",
                )}
              >
                {isComplete ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                <span>{s.label}</span>
              </button>
              {i < visibleSteps.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div
        ref={contentRef}
        className={cn(
          "wizard-step-content",
          animating && direction === "forward" && "wizard-exit-left",
          animating && direction === "back" && "wizard-exit-right",
        )}
      >
        {/* ─── Step 1: Brand ─────────────────────────────────── */}
        {step === 1 && !singleCompany && (
          <div className="wizard-card">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold tracking-tight">Choose your brand</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Every piece of content is powered by a company's brand engine.
              </p>
            </div>

            {!companiesLoaded ? (
              <div className="grid gap-2.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="wizard-company-card animate-pulse">
                    <div className="wizard-company-avatar" style={{ opacity: 0.4 }}>?</div>
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-28 rounded bg-muted" />
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground text-center mt-2">Loading brands…</p>
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-3">No companies configured yet.</p>
                <Button variant="outline" asChild>
                  <a href="/companies">Create a company first →</a>
                </Button>
              </div>
            ) : (
              <div className="grid gap-2.5">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCompanyId(c.id); goTo(2); }}
                    disabled={isScopedMember && companies.length === 1}
                    className={cn(
                      "wizard-company-card",
                      companyId === c.id && "selected",
                    )}
                  >
                    <div className="wizard-company-avatar">
                      {c.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium text-sm">{c.name}</span>
                    {companyId === c.id && (
                      <Check className="h-4 w-4 text-primary ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2: Format ────────────────────────────────── */}
        {step === 2 && (
          <div className="wizard-card">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold tracking-tight">Pick a format</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose how you'd like to create content for <strong>{companyName}</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setMode("single")}
                className={cn(
                  "wizard-format-card",
                  mode === "single" && "selected",
                )}
              >
                <div className={cn(
                  "wizard-format-icon",
                  mode === "single" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">Single article</div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    One blog post with hero image, SEO metadata, FAQ schema, and fact-check ready.
                  </p>
                </div>
                {mode === "single" && (
                  <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>

              <button
                onClick={() => setMode("cluster")}
                className={cn(
                  "wizard-format-card",
                  mode === "cluster" && "selected",
                )}
              >
                <div className={cn(
                  "wizard-format-icon",
                  mode === "cluster" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  <Network className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-sm">Content cluster</div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Generate a pillar page + supporting articles with coordinated keywords and internal linking.
                  </p>
                </div>
                {mode === "cluster" && (
                  <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Content ───────────────────────────────── */}
        {step === 3 && (
          <div className="wizard-card">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold tracking-tight">
                {mode === "single" ? "Describe your article" : "Describe your cluster"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "single"
                  ? "Tell us the topic, angle, and audience. Be as specific as you like."
                  : "Describe the broad topic. AI will design the pillar + supporting pages."}
              </p>
            </div>

            {/* Single: templates + prompt */}
            {mode === "single" && (<>
              {companyPrompts.length > 0 && (
                <div className="mb-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">Templates</Label>
                  <div className="flex gap-2 flex-wrap">
                    {companyPrompts.map((t) => (
                      <Button
                        key={t.id}
                        variant={activeTemplateId === t.id ? "default" : "outline"}
                        size="sm"
                        className="rounded-full gap-1 text-xs"
                        onClick={() => { setPrompt(t.body); setActiveTemplateId(t.id); }}
                      >
                        📝 {t.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="wizard-prompt" className="text-sm font-medium">Prompt</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">{prompt.length} / 2000</span>
                </div>
                <Textarea
                  id="wizard-prompt"
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value.slice(0, 2000)); setActiveTemplateId(null); }}
                  rows={4}
                  placeholder="Describe the article you want — topic, angle, audience, anything specific to cover…"
                  className="text-sm min-h-[120px]"
                  autoFocus
                />
              </div>

              {/* Smart suggestion */}
              {suggestedPrompt && !prompt.trim() && (
                <button
                  type="button"
                  onClick={() => setPrompt(suggestedPrompt)}
                  className="mt-3 w-full text-left rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] px-3.5 py-2.5 transition-colors hover:bg-primary/[0.06] hover:border-primary/50 group"
                >
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-primary/70">Suggested topic</span>
                      <p className="text-sm text-foreground/70 mt-0.5 leading-relaxed line-clamp-2 group-hover:text-foreground/90">{suggestedPrompt}</p>
                    </div>
                    <span className="text-[10px] text-primary/60 font-medium whitespace-nowrap mt-0.5 shrink-0">Click to use</span>
                  </div>
                </button>
              )}
            </>)}

            {/* Cluster: topic */}
            {mode === "cluster" && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Cluster Topic</Label>
                <Textarea
                  value={clusterTopic}
                  onChange={(e) => setClusterTopic(e.target.value)}
                  rows={4}
                  placeholder={getClusterPlaceholder(companyName)}
                  className="text-base min-h-[120px]"
                  autoFocus
                />
              </div>
            )}

            {/* Advanced options (collapsed) */}
            <details className="group mt-5">
              <summary className="flex items-center gap-2 cursor-pointer text-sm font-medium select-none list-none [&::-webkit-details-marker]:hidden">
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Advanced options</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
                  {activeStyles.find(s => s.id === imageStyle)?.label ?? "Default"} · {availableModels.find(m => m.id === model)?.label ?? model} · {LENGTH_LABELS[wordCount] ?? wordCount}
                </span>
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {mode === "single" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Hero style</Label>
                    <div className="flex gap-2 items-center">
                      <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {activeStyles.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.type === "composite" ? `🧩 ${cat.label}` : cat.label}
                          </option>
                        ))}
                      </select>
                      {activeStyles.length > 1 && (
                        <Button variant="secondary" size="sm" disabled={recommending || !prompt.trim()} onClick={onRecommendStyle} className="gap-1 whitespace-nowrap">
                          <Sparkles className="h-3.5 w-3.5" />
                          {recommending ? "…" : "Recommend"}
                        </Button>
                      )}
                    </div>
                    {recommendation && (
                      <p className="text-xs text-primary mt-1">
                        <strong>{recommendation.label}</strong> — {recommendation.reason}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Model</Label>
                  <div className="flex gap-2 items-center">
                    <select value={model} onChange={(e) => setModel(e.target.value)}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm">
                      {availableModels.length > 0
                        ? availableModels.map((m) => (
                          <option key={m.id} value={m.id}>{m.label}{m.provider !== "openai" ? ` (${m.provider})` : ""}</option>
                        ))
                        : <><option value="gpt-5.5">GPT-5.5</option><option value="gpt-5.4">GPT-5.4</option></>
                      }
                    </select>
                    <ModelBakeoff companyId={companyId} companyName={companyName} onModelSelected={onBakeoffModelSelected} />
                  </div>
                </div>
                {mode === "single" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Length</Label>
                    <select value={wordCount} onChange={(e) => setWordCount(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="300-500">Short (300–500)</option>
                      <option value="800-1200">Medium (800–1,200)</option>
                      <option value="1500-2500">Long (1,500–2,500)</option>
                      <option value="2500-4000">Deep Dive (2,500–4,000)</option>
                      <option value="">No limit</option>
                    </select>
                  </div>
                )}
              </div>
            </details>

            {/* Composite blend (inline, single mode only) */}
            {mode === "single" && isCompositeStyle && (
              <Card className="border-primary/20 bg-primary/5 mt-4">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">🧩 Composite Blend</span>
                    {csProductUrl && <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-600">✓ Product selected</Badge>}
                  </div>
                  <div className="flex gap-2">
                    <Input placeholder={selectedStyleObj?.composite_product_query || "Search product image..."} value={csProductQuery} onChange={(e) => setCsProductQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") csProductSearch(); }} className="text-sm" />
                    <Button variant="outline" size="sm" onClick={csProductSearch} disabled={csProductSearching || !csProductQuery.trim()} className="gap-1 whitespace-nowrap">
                      <Search className="h-3.5 w-3.5" />
                      {csProductSearching ? "…" : "Find Product"}
                    </Button>
                  </div>
                  {csProductResults.length > 0 && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {csProductResults.map((img: any, i: number) => (
                        <button key={i} onClick={() => { setCsProductUrl(img.imageUrl); setCsProductThumb(img.thumbnailUrl || img.imageUrl); }}
                          className={cn("rounded-lg overflow-hidden border-2 transition-all",
                            csProductUrl === img.imageUrl ? "border-primary ring-2 ring-primary/30 scale-[1.02]" : "border-border hover:border-primary/50")}>
                          <img src={img.thumbnailUrl || img.imageUrl} alt={img.title} loading="lazy" className="w-full aspect-square object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </button>
                      ))}
                    </div>
                  )}
                  {csProductUrl && csProductThumb && (
                    <div className="flex items-center gap-3 p-2 rounded-md bg-card border border-border">
                      <img src={csProductThumb} alt="Selected product" className="w-12 h-12 object-contain rounded" />
                      <span className="text-sm text-muted-foreground truncate flex-1">Product selected for compositing</span>
                      <Button variant="ghost" size="sm" onClick={() => { setCsProductUrl(null); setCsProductThumb(null); }} className="text-destructive text-xs">Remove</Button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Background prompt</Label>
                      <Input placeholder={selectedStyleObj?.composite_bg_prompt || "e.g. Modern kitchen countertop"} value={csBgPrompt} onChange={(e) => setCsBgPrompt(e.target.value)} className="text-sm" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Background image URL</Label>
                      <Input placeholder={selectedStyleObj?.composite_bg_image_url || "https://... (optional)"} value={csBgImageUrl} onChange={(e) => setCsBgImageUrl(e.target.value)} className="text-sm" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ─── Step 4: Review & Create ───────────────────────── */}
        {step === 4 && (
          <div className="wizard-card">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold tracking-tight">Review & create</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Everything look good? Hit create to start generating.
              </p>
            </div>

            {/* Summary */}
            <div className="space-y-3 mb-6">
              <div className="wizard-summary-row">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Brand</span>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {companyName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span className="text-sm font-medium">{companyName}</span>
                </div>
              </div>

              <div className="wizard-summary-row">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Format</span>
                <div className="flex items-center gap-2">
                  {mode === "cluster"
                    ? <><Network className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">Content cluster</span></>
                    : <><FileText className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">Single article</span></>
                  }
                </div>
              </div>

              <div className="wizard-summary-row">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {mode === "single" ? "Prompt" : "Topic"}
                </span>
                <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">
                  {mode === "single" ? prompt : clusterTopic}
                </p>
              </div>

              <div className="wizard-summary-row">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</span>
                <span className="text-sm">{availableModels.find(m => m.id === model)?.label ?? model}</span>
              </div>

              {mode === "single" && (
                <>
                  <div className="wizard-summary-row">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hero style</span>
                    <span className="text-sm">{activeStyles.find(s => s.id === imageStyle)?.label ?? "Default"}</span>
                  </div>
                  <div className="wizard-summary-row">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Length</span>
                    <span className="text-sm">{LENGTH_LABELS[wordCount] ?? wordCount}</span>
                  </div>
                </>
              )}
            </div>

            {/* Action */}
            <div className="flex flex-col gap-3 items-center">
              <Button
                onClick={() => mode === "single" ? onCreate() : onCreateCluster()}
                disabled={isWorking}
                size="lg"
                className="w-full max-w-xs gap-2"
              >
                {isWorking ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> {mode === "single" ? "Creating article…" : "Generating strategy…"}</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> {mode === "single" ? "Create Article" : "Generate Cluster Strategy"}</>
                )}
              </Button>
              {mode === "single" && (
                <Button variant="ghost" size="sm" onClick={onPreviewPrompt} disabled={previewing || isWorking} className="gap-1.5 text-xs">
                  <Eye className="h-3.5 w-3.5" /> {previewing ? "Loading…" : "Preview prompt"}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">~2 min · uses 1 credit</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation — pinned to bottom */}
      <div className="mt-auto pt-4 pb-2 border-t border-border/50 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={back}
          disabled={step === firstStep || isWorking}
          className={cn("gap-1.5", step === firstStep && "invisible")}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Button>

        {step < 4 ? (
          <Button
            onClick={next}
            disabled={!canProceed()}
            className="gap-1.5"
          >
            Continue <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <div /> /* spacer — create button is inside the card */
        )}
      </div>
    </div>
  );
}
