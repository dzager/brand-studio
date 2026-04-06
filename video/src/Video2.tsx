import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AppChrome } from "./components/AppChrome";
import { Typewriter } from "./components/Typewriter";

/*
╔══════════════════════════════════════════════════════════════════════════════╗
║  VOICEOVER SCRIPT (45 seconds)                                             ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  [0–3s]   INTRO                                                            ║
║  "Meet AutoMouse."                                                         ║
║                                                                            ║
║  [3–10s]  PROMPT & CONTROLS                                                ║
║  "Describe what you need — pick your company, style, and model —           ║
║   and hit create."                                                         ║
║                                                                            ║
║  [10–15s] GENERATE                                                         ║
║  "AutoMouse builds a custom brand engine and writes a complete article     ║
║   with a featured image in seconds."                                       ║
║                                                                            ║
║  [15–21s] RESULT                                                           ║
║  "You get a publish-ready article — SEO-optimized, with key takeaways,    ║
║   FAQ, and JSON-LD baked in."                                              ║
║                                                                            ║
║  [21–27s] HUMANIZE + FACT-CHECK                                            ║
║  "One click to humanize. One click to fact-check. Your content sounds      ║
║   real and reads accurate."                                                ║
║                                                                            ║
║  [27–33s] MULTI-COMPANY                                                    ║
║  "Run multiple brands from a single dashboard — each with its own voice,  ║
║   image style, and editorial guidelines."                                  ║
║                                                                            ║
║  [33–38s] VOICE & PUBLISH                                                  ║
║  "Analyze any writing sample to build a voice profile, then publish        ║
║   straight to WordPress."                                                  ║
║                                                                            ║
║  [38–45s] OUTRO                                                            ║
║  "AutoMouse. AI-powered content that sounds human."                        ║
║                                                                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  BACKGROUND MUSIC                                                          ║
║  Place an MP3 at: public/music/demo2-bg.mp3                                ║
║  Suggested: upbeat electronic / lo-fi tech — 45s, fade out last 3s        ║
╚══════════════════════════════════════════════════════════════════════════════╝
*/

// ─── PSL Palette ──────────────────────────────────────────────────────────────
const CHARCOAL = "#252423";
const IVORY = "#ffffffff";
const LIGHT_GRAY = "#F0F0F0";
const NEON = "#8a91e9ff";
const COOL_GRAY = "#C5CBD1";

const FONT = "'Geist', 'Inter', system-ui, sans-serif";

// ─── Timing (45s = 1350 frames @ 30fps) ──────────────────────────────────────
export const FPS2 = 30;
export const TOTAL_FRAMES_2 = 1350;

const SC = {
  intro: 75,             // 0–2.5s
  promptControls: 180,   // 2.5–8.5s
  generate: 120,         // 8.5–12.5s
  result: 135,           // 12.5–17s
  humanize: 105,         // 17–20.5s
  factCheck: 105,        // 20.5–24s
  imageGallery: 105,     // 24–27.5s
  multiCompany: 120,     // 27.5–31.5s
  voiceProfile: 105,     // 31.5–35s
  publish: 90,           // 35–38s
  articleLibrary: 75,    // 38–40.5s
  outro: 135,            // 40.5–45s
} as const;

function offsets() {
  const keys = Object.keys(SC) as (keyof typeof SC)[];
  const m: Record<string, number> = {};
  let o = 0;
  for (const k of keys) {
    m[k] = o;
    o += SC[k];
  }
  return m;
}
const O = offsets();

// ─── Shared Components ────────────────────────────────────────────────────────

/** Centered bottom callout */
const Callout: React.FC<{ text: string; delay?: number }> = ({
  text,
  delay = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const scale = spring({
    frame: local,
    fps,
    config: { damping: 12, stiffness: 180, mass: 0.5 },
    from: 0.5,
    to: 1,
  });
  const opacity = interpolate(local, [0, 5], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: NEON,
          color: CHARCOAL,
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 24,
          padding: "16px 40px",
          borderRadius: 12,
          letterSpacing: "-0.02em",
          boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
          transform: `scale(${scale})`,
          opacity,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/** Energetic pop-in */
const Pop: React.FC<{
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const local = Math.max(0, frame - delay);
  const opacity = interpolate(local, [0, 5], [0, 1], {
    extrapolateRight: "clamp",
  });
  const y = spring({
    frame: local,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.4 },
    from: 24,
    to: 0,
  });
  return (
    <div style={{ opacity, transform: `translateY(${y}px)`, ...style }}>
      {children}
    </div>
  );
};

const Pill2: React.FC<{ label: string; active?: boolean }> = ({
  label,
  active,
}) => (
  <div
    style={{
      padding: "6px 16px",
      borderRadius: 6,
      background: active ? NEON : IVORY,
      border: `1px solid ${active ? "transparent" : COOL_GRAY}`,
      fontSize: 13,
      fontWeight: active ? 700 : 400,
      color: CHARCOAL,
    }}
  >
    {label}
  </div>
);

/** Fast-fading scene wrapper */
const Wrap: React.FC<{
  children: React.ReactNode;
  dur: number;
  bg?: string;
}> = ({ children, dur, bg = "#FFFFFF" }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 5, dur - 5, dur], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ background: bg, fontFamily: FONT, opacity }}>
      {children}
    </AbsoluteFill>
  );
};

// ─── Scenes ───────────────────────────────────────────────────────────────────

const PROMPT =
  "Write a K-1 Visa Requirements: Eligibility Rules & Checklist (2026)";

/** Scene 1: Brand slam */
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 200, mass: 0.5 },
    from: 0.4,
    to: 1,
  });
  const glow = interpolate(frame, [0, 60, 90], [0, 1, 0.7], {
    extrapolateRight: "clamp",
  });
  return (
    <Wrap dur={SC.intro} bg={CHARCOAL}>
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
            fontSize: 88,
            fontWeight: 900,
            color: NEON,
            letterSpacing: "-0.05em",
            transform: `scale(${scale})`,
            textShadow: `0 0 ${glow * 60}px ${NEON}88`,
          }}
        >
          AutoMouse
        </div>
        <Pop delay={20}>
          <div style={{ fontSize: 22, color: COOL_GRAY, fontWeight: 500 }}>
            Content. Automated. Perfected.
          </div>
        </Pop>
      </AbsoluteFill>
    </Wrap>
  );
};

/** Scene 2: Prompt + controls */
const PromptControls: React.FC = () => (
  <Wrap dur={SC.promptControls}>
    <AppChrome activePage="studio" />
    <div style={{ padding: "40px 80px" }}>
      <Pop>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: CHARCOAL,
            marginBottom: 20,
          }}
        >
          ✦ Content Generator
        </div>
      </Pop>
      <Pop delay={8}>
        <div
          style={{
            background: IVORY,
            border: `2px solid ${NEON}`,
            borderRadius: 10,
            padding: "18px 24px",
            fontSize: 17,
            color: CHARCOAL,
            lineHeight: 1.6,
            minHeight: 60,
          }}
        >
          <Typewriter text={PROMPT} startFrame={12} speed={1} />
        </div>
      </Pop>
      <div style={{ display: "flex", gap: 20, marginTop: 28, flexWrap: "wrap" }}>
        {[
          { label: "Company", value: "PSL" },
          { label: "Image Style", value: "Neon Editorial" },
          { label: "Model", value: "GPT-5.1" },
          { label: "Length", value: "1,500–2,500" },
        ].map((c, i) => (
          <Pop key={c.label} delay={60 + i * 10}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  color: COOL_GRAY,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 5,
                }}
              >
                {c.label}
              </div>
              <Pill2 label={c.value} active />
            </div>
          </Pop>
        ))}
      </div>
      <Pop delay={110}>
        <div
          style={{
            marginTop: 32,
            display: "inline-flex",
            padding: "14px 40px",
            borderRadius: 8,
            background: NEON,
            color: CHARCOAL,
            fontSize: 16,
            fontWeight: 800,
          }}
        >
          ✦ Create Article
        </div>
      </Pop>
    </div>
    <Callout text="Describe it. Configure it. Create it." delay={130} />
  </Wrap>
);

/** Scene 3: Generation */
const Generate: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / (SC.generate - 15));
  const pulse = Math.sin(frame * 0.3) * 0.5 + 0.5;
  return (
    <Wrap dur={SC.generate}>
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
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            color: CHARCOAL,
            opacity: 0.6 + pulse * 0.4,
          }}
        >
          ⚡ Generating…
        </div>
        <div
          style={{
            width: 480,
            height: 8,
            borderRadius: 4,
            background: LIGHT_GRAY,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress * 100}%`,
              height: "100%",
              background: NEON,
              borderRadius: 4,
              boxShadow: `0 0 16px ${NEON}88`,
            }}
          />
        </div>
        <div style={{ fontSize: 14, color: COOL_GRAY, fontWeight: 500 }}>
          {progress < 0.35
            ? "Brand engine loading…"
            : progress < 0.65
              ? "Writing article…"
              : progress < 0.9
                ? "Generating image…"
                : "Done."}
        </div>
      </AbsoluteFill>
    </Wrap>
  );
};

/** Scene 4: Result reveal */
const Result: React.FC = () => (
  <Wrap dur={SC.result}>
    <AppChrome activePage="studio" />
    <div style={{ display: "flex", padding: "36px 80px", gap: 32 }}>
      <Pop style={{ flex: 1 }}>
        <div
          style={{
            background: IVORY,
            border: `1px solid ${COOL_GRAY}44`,
            borderRadius: 10,
            padding: 28,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 800, color: CHARCOAL, lineHeight: 1.3, marginBottom: 10 }}>
            K-1 Visa Requirements: Eligibility Rules & Checklist (2026)
          </div>
          <div style={{ fontSize: 14, color: COOL_GRAY, lineHeight: 1.7, marginBottom: 16 }}>
            Understanding the specific eligibility rules and documentation requirements for the K-1 visa is crucial. Most denials occur due to failure to meet eligibility criteria. This comprehensive guide outlines who can petition, relationship prerequisites, required evidence, and common pitfalls to avoid.
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 9,
                borderRadius: 4,
                background: LIGHT_GRAY,
                marginBottom: 9,
                width: `${65 + Math.sin(i * 2.1) * 30}%`,
              }}
            />
          ))}
        </div>
      </Pop>
      <Pop delay={12} style={{ width: 380, flexShrink: 0 }}>
        <img
          src={staticFile("images/featured.png")}
          style={{
            width: "100%",
            height: 260,
            borderRadius: 10,
            objectFit: "cover",
            border: `2px solid ${NEON}44`,
            display: "block",
          }}
        />
      </Pop>
    </div>
    <Callout text="Full article + image in seconds" delay={30} />
  </Wrap>
);

/** Scene 5: Humanize */
const Humanize: React.FC = () => {
  const frame = useCurrentFrame();
  const done = frame > 55;
  return (
    <Wrap dur={SC.humanize}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 4 }}>✨</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: CHARCOAL }}>
          {done ? "Article Humanized" : "Humanizing…"}
        </div>
        <div style={{ fontSize: 15, color: COOL_GRAY, maxWidth: 480, textAlign: "center", lineHeight: 1.6 }}>
          {done
            ? "AI patterns removed. Natural voice injected."
            : "Rewriting to remove AI patterns and match brand voice…"}
        </div>
        {done && (
          <Pop delay={0}>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <Pill2 label="✓ Title" active />
              <Pill2 label="✓ Excerpt" active />
              <Pill2 label="✓ Body" active />
            </div>
          </Pop>
        )}
      </AbsoluteFill>
      <Callout text="One-click humanization" delay={65} />
    </Wrap>
  );
};

/** Scene 6: Fact Check */
const FactCheck: React.FC = () => {
  const frame = useCurrentFrame();
  const done = frame > 55;
  return (
    <Wrap dur={SC.factCheck}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 4 }}>🔍</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: CHARCOAL }}>
          {done ? "Fact-Check Complete" : "Verifying claims…"}
        </div>
        {done && (
          <Pop>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 8,
                padding: "14px 28px",
                borderRadius: 10,
                background: "#22C55E18",
                border: "1px solid #22C55E40",
              }}
            >
              <div style={{ fontSize: 38, fontWeight: 800, color: "#22C55E" }}>96</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: CHARCOAL }}>Accuracy Score</div>
                <div style={{ fontSize: 12, color: COOL_GRAY }}>14 claims verified</div>
              </div>
            </div>
          </Pop>
        )}
      </AbsoluteFill>
      <Callout text="AI fact-checking powered by o3" delay={65} />
    </Wrap>
  );
};

/** Scene 7: Image Gallery */
const ImageGallery: React.FC = () => (
  <Wrap dur={SC.imageGallery}>
    <AppChrome activePage="studio" />
    <div style={{ padding: "36px 80px" }}>
      <Pop>
        <div style={{ fontSize: 22, fontWeight: 800, color: CHARCOAL, marginBottom: 20 }}>
          🖼 Image Gallery
        </div>
      </Pop>
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        {["Generate", "Search", "Upload"].map((tab, i) => (
          <Pop key={tab} delay={i * 8}>
            <Pill2 label={tab} active={i === 0} />
          </Pop>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Pop key={i} delay={30 + i * 8}>
            <div
              style={{
                height: 130,
                borderRadius: 10,
                background: `linear-gradient(${120 + i * 30}deg, ${NEON}33, ${CHARCOAL}15)`,
                border: i === 0 ? `3px solid ${NEON}` : `1px solid ${COOL_GRAY}33`,
              }}
            />
          </Pop>
        ))}
      </div>
    </div>
    <Callout text="Generate, search, or upload images" delay={50} />
  </Wrap>
);

/** Scene 6: Multi-company grid */
const COMPANIES = [
  { name: "Boundless", color: "#1E40AF", tagline: "Immigration for everyone" },
  { name: "TrovaTrip", color: "#E85D2A", tagline: "Group travel, simplified" },
  { name: "PSL", color: NEON, tagline: "Venture studio for builders" },
  { name: "Certivo", color: "#7C3AED", tagline: "Compliance, automated" },
];

const MultiCompany: React.FC = () => (
  <Wrap dur={SC.multiCompany}>
    <AppChrome activePage="companies" />
    <div style={{ padding: "36px 80px" }}>
      <Pop>
        <div style={{ fontSize: 22, fontWeight: 800, color: CHARCOAL, marginBottom: 24 }}>
          🏢 Your Companies
        </div>
      </Pop>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {COMPANIES.map((co, i) => (
          <Pop key={co.name} delay={12 + i * 10}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "18px 22px",
                borderRadius: 10,
                background: IVORY,
                border: `1px solid ${COOL_GRAY}33`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: co.color,
                  flexShrink: 0,
                  border: co.color === NEON ? `1px solid ${CHARCOAL}22` : "none",
                }}
              />
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: CHARCOAL }}>{co.name}</div>
                <div style={{ fontSize: 12, color: COOL_GRAY }}>{co.tagline}</div>
              </div>
            </div>
          </Pop>
        ))}
      </div>
    </div>
    <Callout text="One dashboard. Every brand." delay={60} />
  </Wrap>
);

/** Scene 9: Voice Profile */
const VoiceProfile: React.FC = () => (
  <Wrap dur={SC.voiceProfile}>
    <AppChrome activePage="companies" />
    <div style={{ display: "flex", height: "100%", paddingTop: 54 }}>
      <div style={{ width: 280, borderRight: `1px solid ${COOL_GRAY}33`, padding: "20px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: CHARCOAL, marginBottom: 14 }}>
          🎙️ Voice Profile
        </div>
        {["Tone Descriptors", "Sentence Rhythm", "Banned Phrases", "Specificity Rules"].map(
          (field, i) => (
            <Pop key={field} delay={i * 8}>
              <div
                style={{
                  padding: "7px 12px",
                  borderRadius: 6,
                  background: i === 0 ? `${NEON}22` : "transparent",
                  fontSize: 13,
                  color: CHARCOAL,
                  marginBottom: 4,
                }}
              >
                {field}
              </div>
            </Pop>
          )
        )}
      </div>
      <div style={{ flex: 1, padding: "20px 36px" }}>
        <Pop delay={15}>
          <div style={{ fontSize: 17, fontWeight: 800, color: CHARCOAL, marginBottom: 12 }}>
            Boundless — Voice
          </div>
        </Pop>
        <Pop delay={30}>
          <div
            style={{
              padding: "14px 18px",
              borderRadius: 8,
              background: LIGHT_GRAY,
              fontSize: 13,
              color: COOL_GRAY,
              lineHeight: 1.7,
            }}
          >
            Direct, authoritative. Active voice. Data-driven. No filler.
            Avoids motivational framing. Credibility over warmth.
          </div>
        </Pop>
      </div>
    </div>
    <Callout text="Structured voice analysis from any sample" delay={50} />
  </Wrap>
);

/** Scene 10: Publish */
const Publish: React.FC = () => {
  const frame = useCurrentFrame();
  const done = frame > 45;
  return (
    <Wrap dur={SC.publish}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 44 }}>{done ? "✅" : "🚀"}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: CHARCOAL }}>
          {done ? "Published to WordPress" : "Publishing…"}
        </div>
        {done && (
          <Pop>
            <div style={{ fontSize: 14, color: COOL_GRAY }}>
              SEO metadata, FAQ, and JSON-LD included
            </div>
          </Pop>
        )}
      </AbsoluteFill>
      <Callout text="One-click WordPress publishing" delay={55} />
    </Wrap>
  );
};

/** Scene 11: Article Library */
const ArticleLibrary: React.FC = () => (
  <Wrap dur={SC.articleLibrary}>
    <AppChrome activePage="articles" />
    <div style={{ padding: "36px 80px" }}>
      <Pop>
        <div style={{ fontSize: 22, fontWeight: 800, color: CHARCOAL, marginBottom: 20 }}>
          📄 Saved Articles
        </div>
      </Pop>
      {Array.from({ length: 3 }).map((_, i) => (
        <Pop key={i} delay={i * 8}>
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              padding: "12px 18px",
              borderRadius: 10,
              background: IVORY,
              border: `1px solid ${COOL_GRAY}33`,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 70,
                height: 48,
                borderRadius: 6,
                background: `linear-gradient(${90 + i * 45}deg, ${NEON}44, ${CHARCOAL}15)`,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ height: 9, borderRadius: 4, background: LIGHT_GRAY, width: `${60 + i * 12}%`, marginBottom: 6 }} />
              <div style={{ height: 7, borderRadius: 4, background: `${COOL_GRAY}33`, width: `${80 - i * 10}%` }} />
            </div>
          </div>
        </Pop>
      ))}
    </div>
  </Wrap>
);

/** Scene 12: Outro */
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.4 },
    from: 0.3,
    to: 1,
  });
  const tagLocal = Math.max(0, frame - 30);
  const tagOpacity = interpolate(tagLocal, [0, 8], [0, 1], {
    extrapolateRight: "clamp",
  });
  const glow = interpolate(frame, [0, 120, 210], [0, 1, 0.6], {
    extrapolateRight: "clamp",
  });
  return (
    <Wrap dur={SC.outro} bg={CHARCOAL}>
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
            fontWeight: 900,
            color: NEON,
            letterSpacing: "-0.05em",
            transform: `scale(${scale})`,
            textShadow: `0 0 ${glow * 80}px ${NEON}66`,
          }}
        >
          AutoMouse
        </div>
        <div style={{ fontSize: 22, color: COOL_GRAY, fontWeight: 500, opacity: tagOpacity }}>
          AI-powered content that sounds human.
        </div>
        <Pop delay={60}>
          <div
            style={{
              marginTop: 20,
              padding: "12px 32px",
              borderRadius: 8,
              border: `2px solid ${NEON}`,
              color: NEON,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            automouse.io
          </div>
        </Pop>
      </AbsoluteFill>
    </Wrap>
  );
};

// ─── Main Composition ─────────────────────────────────────────────────────────

export const AutoMouseDemo2: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#FFFFFF", fontFamily: FONT }}>
      {/*
        Background music — drop an MP3 at: video/public/music/demo2-bg.mp3
        Uncomment the line below once the file is in place:
      */}
      {/* <Audio src={staticFile("music/demo2-bg.mp3")} volume={0.3} /> */}

      <Sequence from={O.intro} durationInFrames={SC.intro} name="Intro">
        <Intro />
      </Sequence>
      <Sequence from={O.promptControls} durationInFrames={SC.promptControls} name="Prompt & Controls">
        <PromptControls />
      </Sequence>
      <Sequence from={O.generate} durationInFrames={SC.generate} name="Generate">
        <Generate />
      </Sequence>
      <Sequence from={O.result} durationInFrames={SC.result} name="Result">
        <Result />
      </Sequence>
      <Sequence from={O.humanize} durationInFrames={SC.humanize} name="Humanize">
        <Humanize />
      </Sequence>
      <Sequence from={O.factCheck} durationInFrames={SC.factCheck} name="Fact Check">
        <FactCheck />
      </Sequence>
      <Sequence from={O.imageGallery} durationInFrames={SC.imageGallery} name="Image Gallery">
        <ImageGallery />
      </Sequence>
      <Sequence from={O.multiCompany} durationInFrames={SC.multiCompany} name="Multi-Company">
        <MultiCompany />
      </Sequence>
      <Sequence from={O.voiceProfile} durationInFrames={SC.voiceProfile} name="Voice Profile">
        <VoiceProfile />
      </Sequence>
      <Sequence from={O.publish} durationInFrames={SC.publish} name="Publish">
        <Publish />
      </Sequence>
      <Sequence from={O.articleLibrary} durationInFrames={SC.articleLibrary} name="Article Library">
        <ArticleLibrary />
      </Sequence>
      <Sequence from={O.outro} durationInFrames={SC.outro} name="Outro">
        <Outro />
      </Sequence>
    </AbsoluteFill>
  );
};
