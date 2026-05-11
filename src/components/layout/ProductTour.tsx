import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import {
  Joyride,
  type Step,
  type EventData,
  type TooltipRenderProps,
  type Controls,
  STATUS,
  EVENTS,
  ACTIONS,
} from "react-joyride";
import { useProductTour } from "@/hooks/useProductTour";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Rocket,
  X,
} from "lucide-react";

// ── Tour Steps ──────────────────────────────────────────────────────────

function buildSteps(pathname: string): Step[] {
  if (pathname === "/studio") {
    return [
      {
        target: "body",
        placement: "center",
        content: "",
        data: {
          custom: true,
          heading: "Welcome to Organic",
          body: "Organic generates brand-consistent, SEO-optimized content from a single prompt. Let\u2019s walk through the key features.",
          hint: "~90 second tour \u00b7 skip anytime",
        },
      },
      {
        target: "[data-tour='sidebar-nav']",
        placement: "right",
        content: "",
        data: {
          heading: "Navigation",
          body: "The sidebar gives you quick access to the Studio (create content), Companies (brand settings), and Articles (content library & clusters).",
        },
      },
      {
        target: "#company-select",
        placement: "bottom",
        content: "",
        data: {
          heading: "Select Your Company",
          body: "Every piece of content is powered by a company\u2019s brand engine \u2014 voice profile, editorial guidelines, image styles, and SEO rules. Select one to start creating.",
        },
      },
      {
        target: "#mode-cluster",
        placement: "bottom",
        content: "",
        data: {
          heading: "Content Cluster",
          body: "Generate a complete topical cluster strategy with pillar, supporting, and long-tail pages \u2014 all keyword-coordinated and internally linked.",
        },
      },
      {
        target: "#mode-single",
        placement: "bottom",
        content: "",
        data: {
          heading: "Single Article",
          body: "Create one blog post at a time. Each includes a prompt area, image style picker, model selector, and advanced options for word count and composition.",
        },
      },
      {
        target: "[data-tour='nav-companies']",
        placement: "right",
        content: "",
        data: {
          heading: "Set Up Your Brand",
          body: "Head to Companies to configure your voice profile, editorial guidelines, custom image styles, and reference articles. These power every generation.",
        },
      },
      {
        target: "[data-tour='nav-articles']",
        placement: "right",
        content: "",
        data: {
          heading: "Content Architecture",
          body: "View all articles and clusters in a visual graph or outline tree. Generate entire clusters in batch, share with collaborators, and manage your content library.",
        },
      },
      {
        target: "body",
        placement: "center",
        content: "",
        data: {
          custom: true,
          heading: "You\u2019re Ready!",
          body: "Select a company, write a prompt, and hit Create. After generation you can humanize the output, fact-check claims, regenerate images, and publish directly to WordPress.",
          hint: "Replay anytime from the \u24d8 button in the sidebar",
        },
      },
    ];
  }

  if (pathname === "/companies") {
    return [
      {
        target: "body",
        placement: "center",
        content: "",
        data: {
          custom: true,
          heading: "Your Brand Engine",
          body: "Each company has its own voice profile, image styles, editorial guidelines, and SEO rules \u2014 all injected into every AI prompt automatically. Click a company to configure it.",
          hint: "Use the \ud83c\udfa4 Voice Profile button to analyze your writing style from a sample article",
        },
      },
    ];
  }

  if (pathname === "/articles") {
    return [
      {
        target: "body",
        placement: "center",
        content: "",
        data: {
          custom: true,
          heading: "Content Architecture",
          body: "Your articles and clusters live here. Switch between Graph View (visual network) and Outline View (sidebar tree). Generate entire clusters, interlink pages, and export bundles.",
          hint: "Articles within clusters receive sibling context so they naturally link to each other",
        },
      },
    ];
  }

  return [];
}

// ── Custom Tooltip ──────────────────────────────────────────────────────

function TourTooltip(props: TooltipRenderProps) {
  const {
    step,
    index,
    size,
    isLastStep,
    backProps,
    primaryProps,
    skipProps,
    tooltipProps,
  } = props;

  const data = (step as any).data || {};
  const isCenter = step.placement === "center";

  return (
    <div
      {...tooltipProps}
      className="product-tour-tooltip"
      style={{
        maxWidth: isCenter ? 440 : 360,
        width: "100%",
      }}
    >
      {/* Close button */}
      <button
        {...skipProps}
        className="product-tour-close"
        aria-label="Close tour"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Content */}
      <div className="product-tour-content">
        {isCenter && (
          <div className="product-tour-icon-ring">
            <Sparkles className="h-5 w-5" />
          </div>
        )}

        <h3 className="product-tour-heading">{data.heading}</h3>
        <p className="product-tour-body">{data.body}</p>

        {data.hint && (
          <p className="product-tour-hint">{data.hint}</p>
        )}
      </div>

      {/* Footer */}
      <div className="product-tour-footer">
        <div className="product-tour-progress">
          {Array.from({ length: size }, (_, i) => (
            <span
              key={i}
              className={`product-tour-dot ${i === index ? "active" : i < index ? "completed" : ""}`}
            />
          ))}
        </div>

        <div className="product-tour-actions">
          {index > 0 && (
            <button {...backProps} className="product-tour-btn-back">
              <ChevronLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          <button {...primaryProps} className="product-tour-btn-next">
            {isLastStep ? (
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
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export default function ProductTour() {
  const router = useRouter();
  const { tourActive, completeTour, dismissTour } = useProductTour();
  const [stepIndex, setStepIndex] = useState(0);
  const [run, setRun] = useState(false);

  const allSteps = useMemo(
    () => buildSteps(router.pathname),
    [router.pathname]
  );

  // Sync run state with tourActive
  useEffect(() => {
    if (tourActive && allSteps.length > 0) {
      setStepIndex(0);
      const t = setTimeout(() => setRun(true), 300);
      return () => clearTimeout(t);
    } else {
      setRun(false);
    }
  }, [tourActive, allSteps.length]);

  // Clean up orphaned Joyride portal elements on unmount
  useEffect(() => {
    return () => {
      // Joyride creates portal elements that may not be cleaned up
      document.querySelectorAll(
        '.__floater, .react-joyride__overlay, .react-joyride__spotlight, [data-react-joyride]'
      ).forEach((el) => el.remove());
      // Also remove any lingering overlay backdrop
      document.querySelectorAll('[class*="joyride"]').forEach((el) => {
        if (el.parentElement === document.body) el.remove();
      });
    };
  }, []);

  const handleEvent = useCallback(
    (data: EventData, controls: Controls) => {
      const { status, action, index, type } = data;

      if (status === STATUS.FINISHED) {
        setRun(false);
        setStepIndex(0);
        completeTour();
        return;
      }

      if (status === STATUS.SKIPPED || action === ACTIONS.SKIP) {
        setRun(false);
        setStepIndex(0);
        dismissTour();
        return;
      }

      if (action === ACTIONS.CLOSE) {
        setRun(false);
        setStepIndex(0);
        dismissTour();
        return;
      }

      if (type === EVENTS.STEP_AFTER) {
        if (action === ACTIONS.NEXT) {
          setStepIndex(index + 1);
        } else if (action === ACTIONS.PREV) {
          setStepIndex(index - 1);
        }
      }
    },
    [completeTour, dismissTour]
  );

  if (allSteps.length === 0 || !tourActive) return null;

  return (
    <Joyride
      steps={allSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      onEvent={handleEvent}
      tooltipComponent={TourTooltip}
      options={{
        overlayColor: "rgba(0, 0, 0, 0.55)",
        spotlightRadius: 12,
        zIndex: 10000,
        arrowColor: "#ffffff",
        skipBeacon: true,
      }}
    />
  );
}
