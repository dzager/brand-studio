import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AppChrome } from "./components/AppChrome";
import { SceneWrapper } from "./components/SceneWrapper";
import { FeatureBadge } from "./components/FeatureBadge";
import { Typewriter } from "./components/Typewriter";
import {
  SCENE,
  DARK,
  WHITE,
  YELLOW,
  GRAY_100,
  GRAY_200,
  GRAY_400,
  GRAY_600,
  GREEN,
  RED,
  AMBER,
  INDIGO,
  FONT_FAMILY,
  DEMO_ARTICLE_TITLE,
  DEMO_ARTICLE_EXCERPT,
  DEMO_PROMPT,
} from "./tokens";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Running offset calculator for scene starts */
function sceneOffsets() {
  const keys = Object.keys(SCENE) as (keyof typeof SCENE)[];
  const starts: Record<string, number> = {};
  let offset = 0;
  for (const k of keys) {
    starts[k] = offset;
    offset += SCENE[k];
  }
  return starts;
}

const S = sceneOffsets();

const Pill: React.FC<{
  label: string;
  active?: boolean;
  color?: string;
}> = ({ label, active, color }) => (
  <div
    style={{
      padding: "6px 16px",
      borderRadius: 6,
      background: active ? (color ?? YELLOW) : WHITE,
      border: `1px solid ${active ? "transparent" : GRAY_200}`,
      fontSize: 13,
      fontWeight: active ? 600 : 400,
      color: active ? DARK : GRAY_600,
    }}
  >
    {label}
  </div>
);

const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const opacity = interpolate(local, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const y = spring({
    frame: local,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.6 },
    from: 14,
    to: 0,
  });
  return (
    <div style={{ opacity, transform: `translateY(${y}px)`, ...style }}>
      {children}
    </div>
  );
};

// ─── Scene Components ─────────────────────────────────────────────────────────

/** Scene 1: Brand intro */
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 100, mass: 0.8 },
    from: 0.7,
    to: 1,
  });
  return (
    <SceneWrapper durationInFrames={SCENE.intro} background={DARK}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: YELLOW,
            letterSpacing: "-0.04em",
            transform: `scale(${scale})`,
          }}
        >
          AutoMouse
        </div>
        <FadeIn delay={30}>
          <div style={{ fontSize: 24, color: GRAY_400, fontWeight: 400 }}>
            AI-Powered Content Creation
          </div>
        </FadeIn>
      </AbsoluteFill>
    </SceneWrapper>
  );
};

/** Scene 2: Generator setup — prompt typing */
const GeneratorSetup: React.FC = () => (
  <SceneWrapper durationInFrames={SCENE.generatorSetup}>
    <AppChrome activePage="studio" />
    <div style={{ padding: "48px 80px" }}>
      <FadeIn>
        <div style={{ fontSize: 28, fontWeight: 700, color: DARK, marginBottom: 24 }}>
          ✦ Content Generator
        </div>
      </FadeIn>
      <FadeIn delay={15}>
        <div
          style={{
            background: WHITE,
            border: `1px solid ${GRAY_200}`,
            borderRadius: 10,
            padding: "20px 24px",
            fontSize: 18,
            color: DARK,
            lineHeight: 1.6,
            minHeight: 80,
          }}
        >
          <Typewriter text={DEMO_PROMPT} startFrame={20} speed={1} />
        </div>
      </FadeIn>
    </div>
  </SceneWrapper>
);

/** Scene 3: Controls — company, style, model, length */
const GeneratorControls: React.FC = () => (
  <SceneWrapper durationInFrames={SCENE.generatorControls}>
    <AppChrome activePage="studio" />
    <div style={{ padding: "48px 80px" }}>
      <div
        style={{
          background: WHITE,
          border: `1px solid ${GRAY_200}`,
          borderRadius: 10,
          padding: "20px 24px",
          fontSize: 16,
          color: DARK,
          marginBottom: 32,
        }}
      >
        {DEMO_PROMPT}
      </div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {[
          { label: "Company", value: "Boundless Immigration" },
          { label: "Image Style", value: "Editorial Realism" },
          { label: "Model", value: "GPT-5.1" },
          { label: "Length", value: "1,500–2,500 words" },
        ].map((ctrl, i) => (
          <FadeIn key={ctrl.label} delay={i * 15}>
            <div>
              <div style={{ fontSize: 12, color: GRAY_400, fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {ctrl.label}
              </div>
              <Pill label={ctrl.value} active />
            </div>
          </FadeIn>
        ))}
      </div>
      <FadeIn delay={80}>
        <div
          style={{
            marginTop: 40,
            display: "inline-flex",
            padding: "14px 36px",
            borderRadius: 8,
            background: YELLOW,
            color: DARK,
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          ✦ Create Article
        </div>
      </FadeIn>
    </div>
    <FeatureBadge text="Multi-company brand engine" appearFrame={60} />
  </SceneWrapper>
);

/** Scene 4: Generation loading state */
const GenerateLoading: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / (SCENE.generateLoading - 20));
  return (
    <SceneWrapper durationInFrames={SCENE.generateLoading}>
      <AppChrome activePage="studio" />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: 600, color: DARK }}>
          Generating article…
        </div>
        <div
          style={{
            width: 400,
            height: 6,
            borderRadius: 3,
            background: GRAY_200,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: YELLOW,
              borderRadius: 3,
            }}
          />
        </div>
        <div style={{ fontSize: 14, color: GRAY_400 }}>
          {progress < 0.3
            ? "Building brand engine…"
            : progress < 0.6
              ? "Writing article…"
              : progress < 0.85
                ? "Generating featured image…"
                : "Finalizing…"}
        </div>
      </AbsoluteFill>
    </SceneWrapper>
  );
};

/** Scene 5: Result reveal — article + image */
const ResultReveal: React.FC = () => (
  <SceneWrapper durationInFrames={SCENE.resultReveal}>
    <AppChrome activePage="studio" />
    <div style={{ display: "flex", padding: "40px 80px", gap: 40 }}>
      {/* Article body */}
      <FadeIn style={{ flex: 1 }}>
        <div
          style={{
            background: WHITE,
            border: `1px solid ${GRAY_200}`,
            borderRadius: 10,
            padding: 32,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, color: DARK, lineHeight: 1.3, marginBottom: 12 }}>
            {DEMO_ARTICLE_TITLE}
          </div>
          <div style={{ fontSize: 15, color: GRAY_600, lineHeight: 1.7, marginBottom: 20 }}>
            {DEMO_ARTICLE_EXCERPT}
          </div>
          {/* Simulated article lines */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 10,
                borderRadius: 4,
                background: GRAY_200,
                marginBottom: 10,
                width: `${70 + Math.sin(i * 1.7) * 25}%`,
              }}
            />
          ))}
        </div>
      </FadeIn>
      {/* Featured image placeholder */}
      <FadeIn delay={20} style={{ width: 420, flexShrink: 0 }}>
        <div
          style={{
            width: "100%",
            height: 280,
            borderRadius: 10,
            background: `linear-gradient(135deg, ${INDIGO}44, ${YELLOW}44)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 48,
          }}
        >
          🖼
        </div>
        <div style={{ fontSize: 12, color: GRAY_400, marginTop: 8, textAlign: "center" }}>
          AI-generated featured image
        </div>
      </FadeIn>
    </div>
    <FeatureBadge text="Full article + image in one click" appearFrame={40} />
  </SceneWrapper>
);

/** Scene 6: Humanize pass */
const Humanize: React.FC = () => {
  const frame = useCurrentFrame();
  const done = frame > 120;
  return (
    <SceneWrapper durationInFrames={SCENE.humanize}>
      <AppChrome activePage="studio" />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>✨</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: DARK }}>
          {done ? "Article Humanized" : "Humanizing…"}
        </div>
        <div style={{ fontSize: 15, color: GRAY_600, maxWidth: 520, textAlign: "center", lineHeight: 1.6 }}>
          {done
            ? "AI writing patterns removed. Natural voice injected."
            : "Rewriting through GPT-4.1 to remove AI patterns and match brand voice…"}
        </div>
        {done && (
          <FadeIn delay={0}>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <Pill label="✓ Title rewritten" active color={GREEN} />
              <Pill label="✓ Excerpt rewritten" active color={GREEN} />
              <Pill label="✓ Body humanized" active color={GREEN} />
            </div>
          </FadeIn>
        )}
      </AbsoluteFill>
      <FeatureBadge text="One-click humanization pass" appearFrame={140} />
    </SceneWrapper>
  );
};

/** Scene 7: Fact-check */
const FactCheck: React.FC = () => {
  const frame = useCurrentFrame();
  const done = frame > 140;
  return (
    <SceneWrapper durationInFrames={SCENE.factCheck}>
      <AppChrome activePage="studio" />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: DARK }}>
          {done ? "Fact-Check Complete" : "Verifying claims…"}
        </div>
        {done && (
          <FadeIn>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginTop: 12,
                padding: "16px 32px",
                borderRadius: 10,
                background: `${GREEN}18`,
                border: `1px solid ${GREEN}40`,
              }}
            >
              <div style={{ fontSize: 42, fontWeight: 800, color: GREEN }}>94</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>
                  Accuracy Score
                </div>
                <div style={{ fontSize: 13, color: GRAY_600 }}>
                  12 claims verified · 1 needs review
                </div>
              </div>
            </div>
          </FadeIn>
        )}
      </AbsoluteFill>
      <FeatureBadge text="AI fact-checking powered by o3" appearFrame={160} />
    </SceneWrapper>
  );
};

/** Scene 8: Image gallery */
const ImageGallery: React.FC = () => (
  <SceneWrapper durationInFrames={SCENE.imageGallery}>
    <AppChrome activePage="studio" />
    <div style={{ padding: "48px 80px" }}>
      <FadeIn>
        <div style={{ fontSize: 22, fontWeight: 700, color: DARK, marginBottom: 24 }}>
          🖼 Image Gallery
        </div>
      </FadeIn>
      <div style={{ display: "flex", gap: 16 }}>
        {["Generate", "Search", "Upload"].map((tab, i) => (
          <FadeIn key={tab} delay={i * 12}>
            <Pill label={tab} active={i === 0} />
          </FadeIn>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 24 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <FadeIn key={i} delay={40 + i * 10}>
            <div
              style={{
                height: 160,
                borderRadius: 10,
                background: `linear-gradient(${120 + i * 30}deg, ${YELLOW}33, ${INDIGO}33)`,
                border: i === 0 ? `3px solid ${YELLOW}` : `1px solid ${GRAY_200}`,
              }}
            />
          </FadeIn>
        ))}
      </div>
    </div>
    <FeatureBadge text="Generate, search, or upload images" appearFrame={60} />
  </SceneWrapper>
);

/** Scene 9: Multi-company */
const MultiCompany: React.FC = () => (
  <SceneWrapper durationInFrames={SCENE.multiCompany}>
    <AppChrome activePage="companies" />
    <div style={{ padding: "48px 80px" }}>
      <FadeIn>
        <div style={{ fontSize: 22, fontWeight: 700, color: DARK, marginBottom: 32 }}>
          🏢 Companies
        </div>
      </FadeIn>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[
          { name: "Boundless Immigration", color: "#1E40AF", tagline: "The immigration company for everyone" },
          { name: "TechVisa Partners", color: "#7C3AED", tagline: "Simplifying work visas for startups" },
          { name: "Global Talent Co", color: "#059669", tagline: "Connecting talent across borders" },
        ].map((co, i) => (
          <FadeIn key={co.name} delay={i * 20}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "20px 24px",
                borderRadius: 10,
                background: WHITE,
                border: `1px solid ${GRAY_200}`,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: co.color,
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: DARK }}>{co.name}</div>
                <div style={{ fontSize: 13, color: GRAY_600 }}>{co.tagline}</div>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>
    </div>
    <FeatureBadge text="Each company has its own voice & style" appearFrame={50} />
  </SceneWrapper>
);

/** Scene 10: Voice profile */
const VoiceProfile: React.FC = () => (
  <SceneWrapper durationInFrames={SCENE.voiceProfile}>
    <AppChrome activePage="companies" />
    <div style={{ display: "flex", height: "100%", paddingTop: 54 }}>
      {/* Left: company list */}
      <div style={{ width: 300, borderRight: `1px solid ${GRAY_200}`, padding: "24px 20px" }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: DARK, marginBottom: 16 }}>
          🎙️ Voice Profile
        </div>
        {["Tone Descriptors", "Sentence Rhythm", "Banned Phrases", "Specificity Rules"].map(
          (field, i) => (
            <FadeIn key={field} delay={i * 12}>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: i === 0 ? `${YELLOW}22` : "transparent",
                  fontSize: 13,
                  color: DARK,
                  marginBottom: 4,
                }}
              >
                {field}
              </div>
            </FadeIn>
          )
        )}
      </div>
      {/* Right: profile editor */}
      <div style={{ flex: 1, padding: "24px 40px" }}>
        <FadeIn delay={20}>
          <div style={{ fontSize: 18, fontWeight: 700, color: DARK, marginBottom: 16 }}>
            Boundless Immigration — Voice
          </div>
        </FadeIn>
        <FadeIn delay={40}>
          <div
            style={{
              padding: "16px 20px",
              borderRadius: 8,
              background: GRAY_100,
              fontSize: 14,
              color: GRAY_600,
              lineHeight: 1.7,
            }}
          >
            Authoritative yet empathetic. Uses active voice and direct address.
            Avoids motivational framing and AI-sounding phrases. Credibility
            over warmth. Specific data preferred over vague claims.
          </div>
        </FadeIn>
      </div>
    </div>
    <FeatureBadge text="Structured voice analysis from sample content" appearFrame={60} />
  </SceneWrapper>
);

/** Scene 11: Publish */
const Publish: React.FC = () => {
  const frame = useCurrentFrame();
  const done = frame > 80;
  return (
    <SceneWrapper durationInFrames={SCENE.publish}>
      <AppChrome activePage="studio" />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <div style={{ fontSize: 40 }}>{done ? "✅" : "🚀"}</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: DARK }}>
          {done ? "Published to WordPress" : "Publishing…"}
        </div>
        {done && (
          <FadeIn>
            <div style={{ fontSize: 14, color: GRAY_600 }}>
              Article is live with SEO metadata, FAQ, and JSON-LD
            </div>
          </FadeIn>
        )}
      </AbsoluteFill>
      <FeatureBadge text="One-click WordPress publishing" appearFrame={90} />
    </SceneWrapper>
  );
};

/** Scene 12: Article library */
const ArticleLibrary: React.FC = () => (
  <SceneWrapper durationInFrames={SCENE.articleLibrary}>
    <AppChrome activePage="articles" />
    <div style={{ padding: "48px 80px" }}>
      <FadeIn>
        <div style={{ fontSize: 22, fontWeight: 700, color: DARK, marginBottom: 24 }}>
          📄 Saved Articles
        </div>
      </FadeIn>
      {Array.from({ length: 3 }).map((_, i) => (
        <FadeIn key={i} delay={i * 12}>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              padding: "14px 20px",
              borderRadius: 10,
              background: WHITE,
              border: `1px solid ${GRAY_200}`,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 80,
                height: 54,
                borderRadius: 6,
                background: `linear-gradient(${90 + i * 45}deg, ${YELLOW}44, ${INDIGO}44)`,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 10,
                  borderRadius: 4,
                  background: GRAY_200,
                  width: `${60 + i * 12}%`,
                  marginBottom: 8,
                }}
              />
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: GRAY_100,
                  width: `${80 - i * 10}%`,
                }}
              />
            </div>
          </div>
        </FadeIn>
      ))}
    </div>
  </SceneWrapper>
);

/** Scene 13: Outro */
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 100, mass: 0.8 },
    from: 0.8,
    to: 1,
  });
  return (
    <SceneWrapper durationInFrames={SCENE.outro} background={DARK}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: YELLOW,
            letterSpacing: "-0.04em",
            transform: `scale(${scale})`,
          }}
        >
          Brand Studio
        </div>
        <div style={{ fontSize: 18, color: GRAY_400 }}>
          AI-powered content that sounds human.
        </div>
      </AbsoluteFill>
    </SceneWrapper>
  );
};

// ─── Main Composition ─────────────────────────────────────────────────────────

export const AutoMouseDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: GRAY_100, fontFamily: FONT_FAMILY }}>
      <Sequence from={S.intro} durationInFrames={SCENE.intro} name="Intro">
        <Intro />
      </Sequence>
      <Sequence from={S.generatorSetup} durationInFrames={SCENE.generatorSetup} name="Generator Setup">
        <GeneratorSetup />
      </Sequence>
      <Sequence from={S.generatorControls} durationInFrames={SCENE.generatorControls} name="Generator Controls">
        <GeneratorControls />
      </Sequence>
      <Sequence from={S.generateLoading} durationInFrames={SCENE.generateLoading} name="Generate Loading">
        <GenerateLoading />
      </Sequence>
      <Sequence from={S.resultReveal} durationInFrames={SCENE.resultReveal} name="Result Reveal">
        <ResultReveal />
      </Sequence>
      <Sequence from={S.humanize} durationInFrames={SCENE.humanize} name="Humanize">
        <Humanize />
      </Sequence>
      <Sequence from={S.factCheck} durationInFrames={SCENE.factCheck} name="Fact Check">
        <FactCheck />
      </Sequence>
      <Sequence from={S.imageGallery} durationInFrames={SCENE.imageGallery} name="Image Gallery">
        <ImageGallery />
      </Sequence>
      <Sequence from={S.multiCompany} durationInFrames={SCENE.multiCompany} name="Multi-Company">
        <MultiCompany />
      </Sequence>
      <Sequence from={S.voiceProfile} durationInFrames={SCENE.voiceProfile} name="Voice Profile">
        <VoiceProfile />
      </Sequence>
      <Sequence from={S.publish} durationInFrames={SCENE.publish} name="Publish">
        <Publish />
      </Sequence>
      <Sequence from={S.articleLibrary} durationInFrames={SCENE.articleLibrary} name="Article Library">
        <ArticleLibrary />
      </Sequence>
      <Sequence from={S.outro} durationInFrames={SCENE.outro} name="Outro">
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
