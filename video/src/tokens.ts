// ─── Brand ────────────────────────────────────────────────────────────────────
export const YELLOW = "#FDB72A";
export const DARK = "#191F1D";
export const WHITE = "#FFFFFF";
export const GRAY_100 = "#F5F5F4";
export const GRAY_200 = "#E5E5E5";
export const GRAY_400 = "#A3A3A3";
export const GRAY_600 = "#555555";
export const GREEN = "#22C55E";
export const RED = "#EF4444";
export const AMBER = "#F59E0B";
export const INDIGO = "#6366F1";

// ─── Typography ───────────────────────────────────────────────────────────────
export const FONT_FAMILY = "'Geist', 'Inter', system-ui, sans-serif";

// ─── Video ────────────────────────────────────────────────────────────────────
export const FPS = 30;
export const DURATION_FRAMES = 2700; // 90 s

// ─── Scene durations (frames) ─────────────────────────────────────────────────
export const SCENE = {
  intro: 120,           // 0–4 s
  generatorSetup: 300,  // 4–14 s
  generatorControls: 240, // 14–22 s
  generateLoading: 240, // 22–30 s
  resultReveal: 360,    // 30–42 s
  humanize: 240,        // 42–50 s
  factCheck: 270,       // 50–59 s
  imageGallery: 240,    // 59–67 s
  multiCompany: 240,    // 67–75 s
  voiceProfile: 180,    // 75–81 s
  publish: 150,         // 81–86 s
  articleLibrary: 90,   // 86–89 s
  outro: 90,            // 89–90 s (padded to 3 s for graceful end)
} as const;

// Article content used in demo
export const DEMO_ARTICLE_TITLE =
  "DOL Proposes Major H-1B Wage Overhaul: What the New Prevailing Wage Rule Means for Employers";

export const DEMO_ARTICLE_EXCERPT =
  "The Department of Labor's proposed rule would reset H-1B prevailing wages to the 45th percentile for Level I positions, up from 17th — a shift that could increase annual visa costs by $20,000–$40,000 per worker for mid-size tech employers.";

export const DEMO_PROMPT =
  "Write an article about the DOL's proposed H-1B prevailing wage overhaul and what it means for employers";
