import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Head from "next/head";
import { useAuth } from "@/hooks/useAuth";
import { PLAN_LIMITS, type PlanId } from "@/lib/plans";
import {
    Check,
    ChevronRight,
    ChevronLeft,
    Globe,
    Loader2,
    Building2,
    User,
    CreditCard,
    Users,
    ImagePlus,
    X,
    Camera,
    PenLine,
    Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Steps ──────────────────────────────────────────────────────────
// NOTE: Plan and Team steps are hidden while payments are paused.
// To re-enable, restore steps 4 (Plan) and 5 (Team) and update
// the navigation logic + handleSubmit to redirect to Stripe checkout.
const STEPS = [
    { id: 1, label: "Account", icon: User },
    { id: 2, label: "Company", icon: Building2 },
    { id: 3, label: "Brand Images", icon: Camera },
];

const MAX_IMAGES = 6;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const PLAN_IDS: PlanId[] = ["starter", "standard", "scale"];

export default function RegisterPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Step 1: Account
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    // Step 2: Company
    const [companyName, setCompanyName] = useState("");
    const [tagline, setTagline] = useState("");
    const [mission, setMission] = useState("");
    const [tone, setTone] = useState("confident, clear, modern");
    const [importUrl, setImportUrl] = useState("");
    const [importing, setImporting] = useState(false);
    const [companyMode, setCompanyMode] = useState<"choose" | "import" | "manual">("choose");

    // Step 3: Brand Images
    const [brandImages, setBrandImages] = useState<{ src: string; name: string }[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    // Step 4: Plan (hidden while payments paused)
    const [selectedPlan, setSelectedPlan] = useState<PlanId>("starter");

    // Step 5: Team invites (hidden while payments paused)
    const [inviteEmails, setInviteEmails] = useState<string[]>([""]);

    // Redirect if already authenticated
    useEffect(() => {
        if (user) {
            router.replace("/articles");
        }
    }, [user, router]);

    // ── URL Import ─────────────────────────────────────────────────
    async function handleImportUrl() {
        if (!importUrl.trim()) return;
        setImporting(true);
        setError(null);

        try {
            const r = await fetch("/api/crawl-brand", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: importUrl.trim() }),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Import failed");

            // Auto-fill company fields from the nested brand object
            const b = data.brand;
            if (b.name) setCompanyName(b.name);
            if (b.tagline) setTagline(b.tagline);
            if (b.mission) setMission(b.mission);
            if (b.tone) setTone(b.tone);

            if (data.fallback) {
                setError("Website couldn't be crawled — fields were pre-filled using AI knowledge of this brand. Please review carefully.");
            }

            // Switch to manual mode so user can review pre-filled fields
            setCompanyMode("manual");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setImporting(false);
        }
    }

    // ── Image upload helpers ────────────────────────────────────────
    const processFiles = useCallback((files: FileList | File[]) => {
        const fileArr = Array.from(files);
        const valid = fileArr.filter(
            (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_IMAGE_SIZE
        );
        if (valid.length === 0) return;

        valid.slice(0, MAX_IMAGES - brandImages.length).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const src = ev.target?.result as string;
                setBrandImages((prev) => {
                    if (prev.length >= MAX_IMAGES) return prev;
                    return [...prev, { src, name: file.name }];
                });
            };
            reader.readAsDataURL(file);
        });
    }, [brandImages.length]);

    function handleImageDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
        }
    }

    function removeImage(index: number) {
        setBrandImages((prev) => prev.filter((_, i) => i !== index));
    }

    // ── Submit registration ────────────────────────────────────────
    async function handleSubmit() {
        setLoading(true);
        setError(null);

        try {
            const validInvites = inviteEmails.filter(
                (e) => e.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
            );

            const r = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: email.trim(),
                    password,
                    full_name: fullName.trim(),
                    company: {
                        name: companyName.trim(),
                        tagline: tagline.trim() || null,
                        mission: mission.trim() || null,
                        tone: tone.trim() || "confident, clear, modern",
                    },
                    brand_images: brandImages.map((img) => img.src),
                    plan: selectedPlan,
                    invite_emails: validInvites,
                }),
            });

            const data = await r.json();
            if (!r.ok) throw new Error(data?.error || "Registration failed");

            // Sign in with the new account
            const { createBrowserSupabase } = await import("@/lib/supabase");
            const supabase = createBrowserSupabase();
            await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            // Payments paused — skip Stripe checkout and go straight to articles.
            // To re-enable, restore the Stripe Checkout redirect block here.
            router.push("/articles");
        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    }

    // ── Step navigation ────────────────────────────────────────────
    function canProceed(): boolean {
        switch (step) {
            case 1:
                return (
                    !!fullName.trim() &&
                    !!email.trim() &&
                    password.length >= 6
                );
            case 2:
                return companyMode === "manual" && !!companyName.trim();
            case 3:
                return true; // images are optional
            case 4:
                return true;
            case 5:
                return true;
            default:
                return false;
        }
    }

    const selectedLimits = PLAN_LIMITS[selectedPlan];
    // Payments paused — team step is hidden
    const showTeamStep = false;

    return (
        <>
            <Head>
                <title>Get Started — Organic</title>
                <meta
                    name="description"
                    content="Create your Organic Brand Studio account and set up your first company."
                />
            </Head>

            <div className="min-h-screen bg-background">
                {/* Header */}
                <div className="flex items-center justify-between px-6 h-14 border-b border-border">
                    <a href="/index.html">
                        <img
                            src="/organic-logo.png"
                            alt="Organic"
                            className="dark:invert"
                            style={{ height: "28px", width: "auto" }}
                        />
                    </a>
                    <p className="text-sm text-muted-foreground">
                        Already have an account?{" "}
                        <Link
                            href="/login"
                            className="text-foreground font-medium hover:underline"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>

                {/* Step indicator */}
                <div className="max-w-2xl mx-auto px-6 pt-8 pb-4">
                    <div className="flex items-center justify-center gap-2">
                        {STEPS.filter(
                            (_s) => true
                        ).map((s, i, arr) => {
                            const Icon = s.icon;
                            const isActive = step === s.id;
                            const isComplete = step > s.id;
                            return (
                                <div
                                    key={s.id}
                                    className="flex items-center gap-2"
                                >
                                    <div
                                        className={cn(
                                            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                                            isActive &&
                                                "bg-primary text-primary-foreground",
                                            isComplete &&
                                                "bg-primary/10 text-primary",
                                            !isActive &&
                                                !isComplete &&
                                                "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {isComplete ? (
                                            <Check className="h-3 w-3" />
                                        ) : (
                                            <Icon className="h-3 w-3" />
                                        )}
                                        {s.label}
                                    </div>
                                    {i < arr.length - 1 && (
                                        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Step content */}
                <div className="max-w-lg mx-auto px-6 pb-16">
                    {/* ─── Step 1: Account ─────────────────────────── */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    Create your account
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1">
                                    This will be your login for Organic.
                                </p>
                            </div>

                            <div>
                                <label
                                    htmlFor="reg-name"
                                    className="block text-sm font-medium mb-1.5"
                                >
                                    Full name
                                </label>
                                <input
                                    id="reg-name"
                                    type="text"
                                    value={fullName}
                                    onChange={(e) =>
                                        setFullName(e.target.value)
                                    }
                                    placeholder="Jane Smith"
                                    autoFocus
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="reg-email"
                                    className="block text-sm font-medium mb-1.5"
                                >
                                    Work email
                                </label>
                                <input
                                    id="reg-email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="jane@company.com"
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="reg-password"
                                    className="block text-sm font-medium mb-1.5"
                                >
                                    Password
                                </label>
                                <input
                                    id="reg-password"
                                    type="password"
                                    value={password}
                                    onChange={(e) =>
                                        setPassword(e.target.value)
                                    }
                                    placeholder="At least 6 characters"
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                />
                                {password.length > 0 &&
                                    password.length < 6 && (
                                        <p className="text-xs text-destructive mt-1">
                                            Password must be at least 6
                                            characters.
                                        </p>
                                    )}
                            </div>
                        </div>
                    )}

                    {/* ─── Step 2: Company ──────────────────────────── */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    Set up your company
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {companyMode === "choose"
                                        ? "How would you like to get started?"
                                        : companyMode === "import"
                                        ? "We'll crawl your site and pre-fill your brand details."
                                        : "Tell us about your brand."}
                                </p>
                            </div>

                            {/* ── Mode chooser ────────────────────────── */}
                            {companyMode === "choose" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setCompanyMode("import")}
                                        className="group rounded-xl border-2 border-border hover:border-primary p-6 text-left transition-all hover:shadow-md hover:bg-primary/[0.03]"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                            <Sparkles className="h-5 w-5 text-primary" />
                                        </div>
                                        <p className="font-semibold text-sm mb-1">
                                            Import from website
                                        </p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Enter your URL and we&apos;ll auto-fill your brand name, tagline, mission, and tone.
                                        </p>
                                    </button>
                                    <button
                                        onClick={() => setCompanyMode("manual")}
                                        className="group rounded-xl border-2 border-border hover:border-primary p-6 text-left transition-all hover:shadow-md hover:bg-primary/[0.03]"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                            <PenLine className="h-5 w-5 text-primary" />
                                        </div>
                                        <p className="font-semibold text-sm mb-1">
                                            Enter manually
                                        </p>
                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                            Fill in your company details yourself. You can always update them later.
                                        </p>
                                    </button>
                                </div>
                            )}

                            {/* ── Import mode ─────────────────────────── */}
                            {companyMode === "import" && (
                                <>
                                    <div className="rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-5">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                                                <Sparkles className="h-3.5 w-3.5 text-primary" />
                                            </div>
                                            <span className="text-sm font-semibold">
                                                Import from website
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="url"
                                                value={importUrl}
                                                onChange={(e) =>
                                                    setImportUrl(e.target.value)
                                                }
                                                placeholder="https://yourcompany.com"
                                                autoFocus
                                                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                            />
                                            <button
                                                onClick={handleImportUrl}
                                                disabled={
                                                    importing || !importUrl.trim()
                                                }
                                                className="rounded-lg bg-primary text-primary-foreground px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-opacity"
                                            >
                                                {importing ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Globe className="h-3 w-3" />
                                                )}
                                                {importing ? "Importing…" : "Import"}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="relative flex items-center gap-3">
                                        <div className="flex-1 border-t border-border" />
                                        <span className="text-xs text-muted-foreground">or</span>
                                        <div className="flex-1 border-t border-border" />
                                    </div>

                                    <button
                                        onClick={() => setCompanyMode("manual")}
                                        className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5 py-2"
                                    >
                                        <PenLine className="h-3.5 w-3.5" />
                                        Fill in details manually instead
                                    </button>
                                </>
                            )}

                            {/* ── Manual mode ─────────────────────────── */}
                            {companyMode === "manual" && (
                                <>
                                    <button
                                        onClick={() => setCompanyMode("choose")}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                    >
                                        <ChevronLeft className="h-3 w-3" />
                                        Back to options
                                    </button>

                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Company name *
                                        </label>
                                        <input
                                            type="text"
                                            value={companyName}
                                            onChange={(e) =>
                                                setCompanyName(e.target.value)
                                            }
                                            placeholder="Acme Corporation"
                                            autoFocus
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Tagline
                                        </label>
                                        <input
                                            type="text"
                                            value={tagline}
                                            onChange={(e) => setTagline(e.target.value)}
                                            placeholder="Your brand's one-liner"
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Mission
                                        </label>
                                        <textarea
                                            value={mission}
                                            onChange={(e) => setMission(e.target.value)}
                                            placeholder="What does your company do and for whom?"
                                            rows={3}
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow resize-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1.5">
                                            Brand tone
                                        </label>
                                        <input
                                            type="text"
                                            value={tone}
                                            onChange={(e) => setTone(e.target.value)}
                                            placeholder="e.g. confident, clear, modern"
                                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        />
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        You can add more details like voice profile,
                                        editorial guidelines, and image styles after
                                        setup in the Companies page.
                                    </p>
                                </>
                            )}
                        </div>
                    )}

                    {/* ─── Step 3: Brand Images ────────────────────── */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    Add brand images
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Upload photos, screenshots, or graphics that
                                    represent your brand&apos;s visual style.
                                    We&apos;ll analyze them to inform your image
                                    generation settings.
                                </p>
                            </div>

                            {/* Drop zone */}
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setDragOver(true);
                                }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={handleImageDrop}
                                onClick={() =>
                                    brandImages.length < MAX_IMAGES &&
                                    imageInputRef.current?.click()
                                }
                                className={cn(
                                    "rounded-xl border-2 border-dashed transition-all cursor-pointer p-8 flex flex-col items-center gap-3 group",
                                    dragOver
                                        ? "border-primary bg-primary/5 scale-[1.01]"
                                        : "border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40",
                                    brandImages.length >= MAX_IMAGES &&
                                        "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <div
                                    className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                                        dragOver
                                            ? "bg-primary/20"
                                            : "bg-primary/10 group-hover:bg-primary/20"
                                    )}
                                >
                                    <ImagePlus
                                        className={cn(
                                            "h-6 w-6",
                                            dragOver
                                                ? "text-primary"
                                                : "text-primary"
                                        )}
                                    />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium">
                                        {brandImages.length >= MAX_IMAGES
                                            ? `Maximum of ${MAX_IMAGES} images reached`
                                            : "Drop images here or click to browse"}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        JPEG, PNG, or WebP — up to 10MB each
                                    </p>
                                </div>
                            </div>

                            <input
                                ref={imageInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files) {
                                        processFiles(e.target.files);
                                    }
                                    e.target.value = "";
                                }}
                            />

                            {/* Image previews */}
                            {brandImages.length > 0 && (
                                <div className="grid grid-cols-3 gap-3">
                                    {brandImages.map((img, i) => (
                                        <div
                                            key={i}
                                            className="relative group rounded-lg overflow-hidden border border-border bg-black/5 aspect-square"
                                        >
                                            <img
                                                src={img.src}
                                                alt={img.name}
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeImage(i);
                                                }}
                                                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <p className="text-[10px] text-white truncate">
                                                    {img.name}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p className="text-xs text-muted-foreground">
                                {brandImages.length} of {MAX_IMAGES} images
                                added. These will be used to extract your
                                brand&apos;s visual style automatically.
                            </p>
                        </div>
                    )}

                    {/* ─── Step 4: Plan (hidden) ───────────────────── */}
                    {step === 4 && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    Choose your plan
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Start with a 14‑day free trial. Cancel anytime.
                                </p>
                            </div>

                            <div className="grid gap-4">
                                {PLAN_IDS.map((planId) => {
                                    const plan = PLAN_LIMITS[planId];
                                    const isSelected =
                                        selectedPlan === planId;
                                    return (
                                        <button
                                            key={planId}
                                            onClick={() =>
                                                setSelectedPlan(planId)
                                            }
                                            className={cn(
                                                "w-full rounded-xl border-2 p-5 text-left transition-all",
                                                isSelected
                                                    ? "border-primary bg-primary/5"
                                                    : "border-border hover:border-primary/30"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <span className="font-semibold text-base">
                                                        {plan.label}
                                                    </span>
                                                    {planId === "standard" && (
                                                        <span className="ml-2 text-[10px] font-medium uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                                                            Popular
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-2xl font-bold">
                                                        $
                                                        {plan.price_monthly}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground">
                                                        /mo
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                                <span>
                                                    {plan.articles_per_month}{" "}
                                                    articles/mo
                                                </span>
                                                <span>
                                                    ${plan.overage_price.toFixed(2)}{" "}
                                                    per extra
                                                </span>
                                                <span>
                                                    {plan.max_seats === 1
                                                        ? "Solo use"
                                                        : `${plan.max_seats} team seats`}
                                                </span>
                                                <span>
                                                    {plan.max_domains ===
                                                    Infinity
                                                        ? "Unlimited domains"
                                                        : `${plan.max_domains} domains`}
                                                </span>
                                            </div>
                                            {isSelected && (
                                                <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-medium">
                                                    <Check className="h-3 w-3" />
                                                    Selected
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ─── Step 5: Team Invites (hidden) ─────────── */}
                    {step === 5 && showTeamStep && (
                        <div className="space-y-6">
                            <div className="text-center mb-8">
                                <h1 className="text-2xl font-semibold tracking-tight">
                                    Invite your team
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Your {selectedLimits.label} plan includes{" "}
                                    {selectedLimits.max_seats} seats. You can
                                    add more later.
                                </p>
                            </div>

                            <div className="space-y-3">
                                {inviteEmails.map((email, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2"
                                    >
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => {
                                                const next = [
                                                    ...inviteEmails,
                                                ];
                                                next[i] = e.target.value;
                                                setInviteEmails(next);
                                            }}
                                            placeholder="colleague@company.com"
                                            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-shadow"
                                        />
                                        {inviteEmails.length > 1 && (
                                            <button
                                                onClick={() =>
                                                    setInviteEmails(
                                                        inviteEmails.filter(
                                                            (_, j) => j !== i
                                                        )
                                                    )
                                                }
                                                className="text-muted-foreground hover:text-destructive text-sm"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {inviteEmails.length <
                                    selectedLimits.max_seats - 1 && (
                                    <button
                                        onClick={() =>
                                            setInviteEmails([
                                                ...inviteEmails,
                                                "",
                                            ])
                                        }
                                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        + Add another
                                    </button>
                                )}
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Invitations will be sent after your account is
                                created. You can skip this step.
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-4 rounded-lg bg-destructive/10 text-destructive px-4 py-3 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                        <button
                            onClick={() => setStep(step - 1)}
                            disabled={step === 1}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-0 disabled:pointer-events-none"
                        >
                            <ChevronLeft className="h-3 w-3" />
                            Back
                        </button>

                        <div className="flex items-center gap-3">
                            {/* Skip button — only on step 3 (images) */}
                            {step === 3 && (
                                <button
                                    onClick={() => {
                                        setError(null);
                                        setStep(step + 1);
                                    }}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                                >
                                    Skip
                                </button>
                            )}

                            {step < 3 ? (
                                <button
                                    onClick={() => {
                                        setError(null);
                                        setStep(step + 1);
                                    }}
                                    disabled={!canProceed()}
                                    className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                                >
                                    Continue
                                    <ChevronRight className="h-3 w-3" />
                                </button>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading || !canProceed()}
                                    className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                                >
                                    {loading ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : null}
                                    {loading
                                        ? "Creating account…"
                                        : "Create account →"}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
