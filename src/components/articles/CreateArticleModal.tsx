import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/hooks/useAuth";
import { useTaskRunner } from "@/hooks/useTaskRunner";
import { useModelDefaults } from "@/hooks/useModelDefaults";
import { IMAGE_STYLE_CATEGORIES, type ImageStyleCategory } from "@/brand/engine";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import ContentWizard from "@/components/layout/ContentWizard";


interface CreateArticleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful creation so the parent can refresh data */
  onCreated?: () => void;
}

/** Return a company-contextual placeholder for the cluster topic input */
function getClusterPlaceholder(companyName?: string): string {
  if (!companyName) return "e.g., product benefits, comparisons, and buying guides for your audience in 2026...";
  const lower = companyName.toLowerCase();
  if (lower.includes("dental") || lower.includes("abramson") || lower.includes("amato"))
    return `e.g., dental implant options, costs, and recovery for patients in 2026...`;
  if (lower.includes("trovatrip") || lower.includes("travel") || lower.includes("trip"))
    return `e.g., group travel planning tips, retreat destinations, and trip leader strategies for 2026...`;
  if (lower.includes("certivo") || lower.includes("compliance") || lower.includes("cert"))
    return `e.g., compliance certification workflows, audit readiness, and regulatory frameworks for 2026...`;
  if (lower.includes("civenne"))
    return `e.g., luxury fashion trends, sustainable style, and seasonal collection guides for 2026...`;
  if (lower.includes("gumshoe") || lower.includes("legal") || lower.includes("law") || lower.includes("greencard"))
    return `e.g., immigration visa options, green card timelines, and legal process guides for 2026...`;
  if (lower.includes("health") || lower.includes("wellness"))
    return `e.g., holistic wellness routines, nutrition strategies, and preventive health guides for 2026...`;
  if (lower.includes("patchbay") || lower.includes("tech") || lower.includes("software"))
    return `e.g., API integration patterns, developer workflow tools, and platform architecture guides for 2026...`;
  if (lower.includes("pioneer") || lower.includes("labs") || lower.includes("startup") || lower.includes("venture"))
    return `e.g., startup fundraising strategies, product-market fit frameworks, and venture studio insights for 2026...`;
  if (lower.includes("potato"))
    return `e.g., creative branding strategies, product storytelling, and audience engagement guides for 2026...`;
  if (lower.includes("boundless"))
    return `e.g., global hiring compliance, remote workforce management, and international expansion strategies for 2026...`;
  return `e.g., key topics, strategies, and guides relevant to ${companyName} for 2026...`;
}

export default function CreateArticleModal({ open, onOpenChange, onCreated }: CreateArticleModalProps) {
  const router = useRouter();
  const { defaults } = useModelDefaults();
  const { activeAccount, isAdmin } = useAuth();
  const { runTask } = useTaskRunner();

  const isScopedMember = !isAdmin && !!activeAccount?.company_id;

  // ── Creation Mode ──────────────────────────────────────────────────
  const [mode, setMode] = useState<"single" | "cluster">("single");

  // ── Cluster Mode State ─────────────────────────────────────────────
  const [clusterTopic, setClusterTopic] = useState("");
  const [clusterGenerating, setClusterGenerating] = useState(false);

  // ── Single article state ───────────────────────────────────────────
  const [prompt, setPrompt] = useState("");
  const [suggestedPrompt, setSuggestedPrompt] = useState("");
  const [imageStyle, setImageStyle] = useState("default");
  const [model, setModel] = useState("");
  const [availableModels, setAvailableModels] = useState<{ id: string; label: string; provider: string }[]>([]);
  const [wordCount, setWordCount] = useState("1800-2400");
  const [companyId, setCompanyId] = useState<string>("");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companiesLoaded, setCompaniesLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Cluster assignment (single article mode)
  const [companyClusters, setCompanyClusters] = useState<{ id: string; name: string; status: string }[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string>("");

  // Snippet collections
  const [snippetCollections, setSnippetCollections] = useState<{ id: string; name: string; snippet_count: number }[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");

  const aiIsWorking = loading || clusterGenerating;

  const [activeStyles, setActiveStyles] = useState<ImageStyleCategory[]>(IMAGE_STYLE_CATEGORIES);
  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState<{ id: string; label: string; reason: string } | null>(null);
  const [recommendErr, setRecommendErr] = useState<string | null>(null);

  const [companyPrompts, setCompanyPrompts] = useState<{ id: string; name: string; body: string }[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(null);

  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  // Composite state
  const [csProductQuery, setCsProductQuery] = useState("");
  const [csProductResults, setCsProductResults] = useState<any[]>([]);
  const [csProductSearching, setCsProductSearching] = useState(false);
  const [csProductUrl, setCsProductUrl] = useState<string | null>(null);
  const [csProductThumb, setCsProductThumb] = useState<string | null>(null);
  const [csBgPrompt, setCsBgPrompt] = useState("");
  const [csBgImageUrl, setCsBgImageUrl] = useState("");

  const selectedStyleObj = activeStyles.find((s) => s.id === imageStyle);
  const isCompositeStyle = selectedStyleObj?.type === "composite";

  async function csProductSearch() {
    if (!csProductQuery.trim()) return;
    setCsProductSearching(true);
    try {
      const r = await fetch("/api/image-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: csProductQuery.trim(), num: 8 }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Search failed");
      setCsProductResults(data.images ?? []);
    } catch { setCsProductResults([]); }
    finally { setCsProductSearching(false); }
  }

  // Fetch companies + models when modal opens
  useEffect(() => {
    if (!open) return;
    fetch("/api/companies").then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) {
        setCompanies(data);
        if (data.length === 1 && !companyId) {
          setCompanyId(data[0].id);
        }
      }
    }).catch(() => {}).finally(() => setCompaniesLoaded(true));
    fetch("/api/models").then((r) => r.json()).then((data) => {
      if (data?.models && Array.isArray(data.models)) {
        setAvailableModels(data.models);
      }
    }).catch(() => {});
  }, [open]);

  // Initialize model from user's saved default once models are loaded
  useEffect(() => {
    if (availableModels.length === 0) return;
    const target = defaults.writing;
    if (availableModels.some((m) => m.id === target)) {
      setModel(target);
    } else {
      setModel(availableModels[0].id);
    }
  }, [availableModels, defaults.writing]);

  // Load company-specific styles when company changes
  useEffect(() => {
    if (!companyId) { setActiveStyles(IMAGE_STYLE_CATEGORIES); setImageStyle("default"); return; }
    fetch(`/api/companies/${companyId}`).then((r) => r.json()).then((data) => {
      if (data?.image_style_categories && Array.isArray(data.image_style_categories) && data.image_style_categories.length > 0) {
        setActiveStyles(data.image_style_categories);
      } else { setActiveStyles(IMAGE_STYLE_CATEGORIES); }
      setImageStyle("default");
      if (data?.preferred_model && typeof data.preferred_model === "string" && availableModels.some(m => m.id === data.preferred_model)) {
        setModel(data.preferred_model);
      }
      const name = data?.name || "";
      const tagline = data?.tagline || "";
      const mission = data?.mission || "";
      const audiences = Array.isArray(data?.target_audiences) ? data.target_audiences.filter(Boolean) : [];
      const audience = audiences[0] || "";
      if (tagline || mission) {
        const context = tagline || mission;
        const forAudience = audience ? ` for ${audience}` : "";
        setSuggestedPrompt(
          `Write an in-depth article about ${context.toLowerCase().replace(/\.$/, '')}${forAudience}. Include practical tips, current trends, and actionable takeaways.`
        );
      } else if (name) {
        setSuggestedPrompt(
          `Write a comprehensive guide about what ${name} does and why it matters${audience ? ` for ${audience}` : ''}. Cover key benefits, common challenges, and expert recommendations.`
        );
      }
    }).catch(() => { setActiveStyles(IMAGE_STYLE_CATEGORIES); setImageStyle("default"); });
    // Fetch snippet collections for this company
    fetch(`/api/snippet-collections?company_id=${companyId}`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setSnippetCollections(data);
    }).catch(() => { setSnippetCollections([]); });
    // Fetch clusters for this company (for single-article assignment)
    fetch(`/api/clusters?company_id=${companyId}`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) setCompanyClusters(data.map((c: any) => ({ id: c.id, name: c.name, status: c.status })));
    }).catch(() => { setCompanyClusters([]); });
  }, [companyId]);

  // Load company prompts
  useEffect(() => {
    setCompanyPrompts([]); setActiveTemplateId(null);
    if (!companyId) return;
    fetch(`/api/prompts?company_id=${companyId}`).then((r) => r.json()).then((data) => { if (Array.isArray(data)) setCompanyPrompts(data); }).catch(() => {});
  }, [companyId]);

  // ── Handlers ───────────────────────────────────────────────────────

  async function onCreate() {
    if (!companyId) {
      setErr("Please select a company before creating.");
      return;
    }
    setLoading(true); setErr(null);
    // Build the creation prompt — prepend voice prompt if one is active
    let finalPrompt = prompt;
    if (activeVoiceId) {
      const voiceBody = companyPrompts.find((p) => p.id === activeVoiceId)?.body;
      if (voiceBody) {
        finalPrompt = `${voiceBody}\n\n---\n\n${prompt}`;
      }
    }
    const payload: Record<string, unknown> = {
      creation_prompt: finalPrompt,
      image_style: imageStyle,
      model,
      word_count: wordCount,
      company_id: companyId || undefined,
      image_model: defaults.imageGeneration,
      utility_model: defaults.utility,
      snippet_collection_id: selectedCollectionId || undefined,
      cluster_id: selectedClusterId || undefined,
    };
    if (isCompositeStyle && csProductUrl) {
      payload.composite_product_image_url = csProductUrl;
      if (csBgImageUrl.trim()) payload.composite_bg_image_url = csBgImageUrl.trim();
      if (csBgPrompt.trim()) payload.composite_bg_prompt = csBgPrompt.trim();
    }
    // Close the modal immediately — the activity panel will track progress
    onOpenChange(false);
    resetState();
    setLoading(false);

    runTask({
      type: "article",
      label: prompt.trim().slice(0, 60) || "New article",
      endpoint: "/api/create",
      body: payload,
      meta: { companyId },
      onSuccess: () => {
        window.dispatchEvent(new Event("article-created"));
        onCreated?.();
      },
      onError: () => { /* handled by task panel */ },
    });
  }

  async function onCreateCluster() {
    if (!companyId || !clusterTopic.trim()) return;

    // Close the modal immediately — the activity panel will track progress
    const topic = clusterTopic.trim();
    onOpenChange(false);
    resetState();
    setClusterGenerating(false);

    runTask({
      type: "cluster-strategy",
      label: `Strategy: ${topic.slice(0, 50)}`,
      endpoint: "/api/clusters",
      body: { company_id: companyId, topic, model },
      meta: { companyId },
      onSuccess: (data: any) => {
        onCreated?.();
        if (data?.id) {
          router.push(`/articles?cluster=${data.id}`);
        }
      },
      onError: () => { /* handled by task panel */ },
    });
  }

  async function onPreviewPrompt() {
    setPreviewing(true); setPreviewData(null);
    try {
      const r = await fetch("/api/preview-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_prompt: prompt, image_style: imageStyle, model, word_count: wordCount, company_id: companyId || undefined, image_model: defaults.imageGeneration, utility_model: defaults.utility }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `Preview failed (${r.status})`);
      setPreviewData(data);
    } catch (e: any) { setErr(e.message); }
    finally { setPreviewing(false); }
  }

  function resetState() {
    setMode("single");
    setPrompt("");
    setSuggestedPrompt("");
    setClusterTopic("");
    setImageStyle("default");
    setWordCount("1800-2400");
    setErr(null);
    setActiveTemplateId(null);
    setActiveVoiceId(null);
    setCsProductQuery("");
    setCsProductResults([]);
    setCsProductUrl(null);
    setCsProductThumb(null);
    setCsBgPrompt("");
    setCsBgImageUrl("");
    setRecommendation(null);
    setPreviewData(null);
    setSnippetCollections([]);
    setSelectedCollectionId("");
    setCompanyClusters([]);
    setSelectedClusterId("");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) { onOpenChange(false); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <div className="p-6 create-modal-wizard">
            <ContentWizard
              companies={companies}
              companiesLoaded={companiesLoaded}
              companyId={companyId}
              setCompanyId={(id) => { setCompanyId(id); }}
              isScopedMember={isScopedMember}
              mode={mode}
              setMode={(m) => { setMode(m); }}
              prompt={prompt}
              setPrompt={(p) => { setPrompt(p); setActiveTemplateId(null); }}
              suggestedPrompt={suggestedPrompt}
              companyPrompts={companyPrompts}
              activeTemplateId={activeTemplateId}
              setActiveTemplateId={setActiveTemplateId}
              activeVoiceId={activeVoiceId}
              setActiveVoiceId={setActiveVoiceId}
              clusterTopic={clusterTopic}
              setClusterTopic={setClusterTopic}
              getClusterPlaceholder={getClusterPlaceholder}
              imageStyle={imageStyle}
              setImageStyle={setImageStyle}
              activeStyles={activeStyles}
              model={model}
              setModel={setModel}
              availableModels={availableModels}
              wordCount={wordCount}
              setWordCount={setWordCount}
              isCompositeStyle={isCompositeStyle}
              selectedStyleObj={selectedStyleObj}
              csProductQuery={csProductQuery}
              setCsProductQuery={setCsProductQuery}
              csProductResults={csProductResults}
              csProductSearching={csProductSearching}
              csProductSearch={csProductSearch}
              csProductUrl={csProductUrl}
              setCsProductUrl={setCsProductUrl}
              csProductThumb={csProductThumb}
              setCsProductThumb={setCsProductThumb}
              csBgPrompt={csBgPrompt}
              setCsBgPrompt={setCsBgPrompt}
              csBgImageUrl={csBgImageUrl}
              setCsBgImageUrl={setCsBgImageUrl}
              recommending={recommending}
              recommendation={recommendation}
              onRecommendStyle={async () => {
                setRecommending(true); setRecommendation(null); setRecommendErr(null);
                try {
                  const r = await fetch("/api/recommend-style", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt.trim(), styles: activeStyles }) });
                  const data = await r.json(); if (!r.ok) throw new Error(data.error || "Recommendation failed");
                  setRecommendation(data); setImageStyle(data.id);
                } catch (e: any) { setRecommendErr(e.message); } finally { setRecommending(false); }
              }}
              err={err}
              loading={loading}
              clusterGenerating={clusterGenerating}
              onCreate={onCreate}
              onCreateCluster={onCreateCluster}
              onPreviewPrompt={onPreviewPrompt}
              previewing={previewing}
              onBakeoffModelSelected={(mid) => { if (availableModels.some(m => m.id === mid)) setModel(mid); }}
              snippetCollections={snippetCollections}
              selectedCollectionId={selectedCollectionId}
              setSelectedCollectionId={setSelectedCollectionId}
              companyClusters={companyClusters}
              selectedClusterId={selectedClusterId}
              setSelectedClusterId={setSelectedClusterId}
            />
          </div>
        </DialogContent>
      </Dialog>

    </>
  );
}
