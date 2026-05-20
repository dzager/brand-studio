import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Rocket,
  X,
  FileText,
  Building2,
  Layers,
  PenLine,
  Palette,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = "organic_onboarding_complete";
const TOUR_STORAGE_KEY = "organic_product_tour";

interface OnboardingStep {
  icon: React.ReactNode;
  heading: string;
  body: string;
  features?: { icon: React.ReactNode; label: string; desc: string }[];
  hint?: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: <Sparkles className="h-6 w-6" />,
    heading: "Welcome to Organic",
    body: "Your AI content platform that generates brand-consistent, SEO-optimized articles. Here's a quick overview of how to get started.",
    hint: "3 steps · takes 30 seconds",
  },
  {
    icon: <FileText className="h-6 w-6" />,
    heading: "Create Content",
    body: "Use the Create button on the Articles page to generate content. You have two powerful options:",
    features: [
      {
        icon: <Layers className="h-4 w-4" />,
        label: "Topic Clusters",
        desc: "Generate a full cluster — a pillar page plus supporting articles — with one prompt. Great for building topical authority.",
      },
      {
        icon: <PenLine className="h-4 w-4" />,
        label: "Individual Articles",
        desc: "Create single articles with full control over topic, keyword targeting, word count, and content type.",
      },
    ],
  },
  {
    icon: <Building2 className="h-6 w-6" />,
    heading: "Customize Your Brand",
    body: "Head to the Companies section to fine-tune how Organic writes and creates visuals for your brand:",
    features: [
      {
        icon: <Mic className="h-4 w-4" />,
        label: "Voice Profile",
        desc: "Analyze your existing writing to capture your unique tone, rhythm, and vocabulary.",
      },
      {
        icon: <Palette className="h-4 w-4" />,
        label: "Image Styles",
        desc: "Define your visual aesthetic — lighting, composition, and mood for AI-generated hero images.",
      },
      {
        icon: <FileText className="h-4 w-4" />,
        label: "Editorial Guidelines",
        desc: "Set rules for structure, depth, sourcing, and content requirements.",
      },
    ],
    hint: "The more context you add, the better your content will match your brand.",
  },
];

export default function OnboardingModal() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  // Only show on articles page for first-time users
  useEffect(() => {
    if (router.pathname !== "/articles") return;
    try {
      const done = localStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        const timer = setTimeout(() => setVisible(true), 600);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, [router.pathname]);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      setExiting(false);
      try {
        localStorage.setItem(ONBOARDING_KEY, new Date().toISOString());
        // Also mark the product tour as completed so it doesn't auto-start
        localStorage.setItem(
          TOUR_STORAGE_KEY,
          JSON.stringify({
            completed: true,
            dismissed: false,
            lastStep: 0,
            completedAt: new Date().toISOString(),
          })
        );
      } catch {}
    }, 200);
  }, []);

  const goNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setDirection("next");
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  const goBack = useCallback(() => {
    if (step > 0) {
      setDirection("prev");
      setStep((s) => s - 1);
    }
  }, [step]);

  if (!visible) return null;

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[10001] flex items-center justify-center",
        exiting ? "onboarding-overlay-exit" : "onboarding-overlay-enter"
      )}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/60 backdrop-blur-[2px]"
        onClick={dismiss}
      />

      {/* Modal */}
      <div
        className={cn(
          "onboarding-modal relative w-full max-w-[480px] mx-4",
          exiting ? "onboarding-modal-exit" : "onboarding-modal-enter"
        )}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          className="absolute top-3.5 right-3.5 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all z-10"
          aria-label="Close onboarding"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Step content */}
        <div
          key={step}
          className={cn(
            "onboarding-step-content px-7 pt-7 pb-4",
            direction === "next"
              ? "onboarding-enter-right"
              : "onboarding-enter-left"
          )}
        >
          {/* Icon */}
          <div className="onboarding-icon-ring mb-5">
            {currentStep.icon}
          </div>

          {/* Heading */}
          <h2 className="text-lg font-semibold tracking-tight mb-2 pr-6">
            {currentStep.heading}
          </h2>

          {/* Body */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-1">
            {currentStep.body}
          </p>

          {/* Feature list */}
          {currentStep.features && (
            <div className="mt-4 space-y-3">
              {currentStep.features.map((f, i) => (
                <div
                  key={i}
                  className="onboarding-feature-card flex gap-3 p-3 rounded-xl"
                >
                  <div className="onboarding-feature-icon shrink-0 mt-0.5">
                    {f.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold leading-snug">
                      {f.label}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hint */}
          {currentStep.hint && (
            <p className="text-xs text-muted-foreground/70 mt-4 italic">
              {currentStep.hint}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="onboarding-footer px-7 pt-3 pb-5">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "onboarding-dot transition-all duration-200",
                  i === step && "active",
                  i < step && "completed"
                )}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button onClick={goBack} className="onboarding-btn-back">
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
            )}
            <button onClick={goNext} className="onboarding-btn-next">
              {isLast ? (
                <>
                  Get started
                  <Rocket className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
