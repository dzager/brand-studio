// imprint-paths.mjs — locate skill, context, and harness directories
// Mirrors the impeccable pattern so a third-party harness can drop in.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * The skill's own root (the folder containing SKILL.md).
 * scripts/ lives one level below.
 */
export const skillRoot = resolve(__dirname, "..");

/**
 * The skill's reference directory.
 */
export const referenceDir = join(skillRoot, "reference");

/**
 * The skill's schemas directory.
 */
export const schemasDir = join(skillRoot, "schemas");

/**
 * Walk up from cwd looking for a project root.
 * A project root is the first ancestor containing one or more of:
 *   - package.json
 *   - .git/
 *   - skills-lock.json
 */
export function findProjectRoot(start = process.cwd()) {
    let dir = resolve(start);
    while (dir !== "/" && dir !== "") {
        if (
            existsSync(join(dir, "package.json")) ||
            existsSync(join(dir, ".git")) ||
            existsSync(join(dir, "skills-lock.json"))
        ) {
            return dir;
        }
        dir = dirname(dir);
    }
    return resolve(start);
}

/**
 * Locate the brand context directory.
 * Priority:
 *   1. IMPRINT_CONTEXT_DIR env var (absolute or relative to cwd)
 *   2. <project>/  (project root)
 *   3. <project>/.agents/context/
 *   4. <project>/docs/
 */
export function findContextDir() {
    const env = process.env.IMPRINT_CONTEXT_DIR;
    if (env) {
        const dir = resolve(env);
        if (existsSync(dir)) return dir;
    }

    const root = findProjectRoot();
    const candidates = [root, join(root, ".agents", "context"), join(root, "docs")];

    for (const dir of candidates) {
        if (existsSync(dir) && statSync(dir).isDirectory()) {
            // Check for at least one of the context files
            const hasContext = ["BRAND.md", "brand.md", "VOICE.md", "voice.md", "VISUAL.md", "visual.md"]
                .some((name) => existsSync(join(dir, name)));
            if (hasContext) return dir;
        }
    }

    // Default to project root if nothing found (loader will report missing files)
    return root;
}

/**
 * Case-insensitive file lookup. Returns the actual path if found.
 */
export function findCaseInsensitive(dir, name) {
    if (!existsSync(dir)) return null;
    const target = name.toLowerCase();
    // Quick path: exact match
    if (existsSync(join(dir, name))) return join(dir, name);
    // Case-insensitive scan
    try {
        const { readdirSync } = require("node:fs");
        const files = readdirSync(dir);
        for (const f of files) {
            if (f.toLowerCase() === target) return join(dir, f);
        }
    } catch {
        // Fallback for environments where dynamic require fails
        const variants = [name, name.toUpperCase(), name.toLowerCase(),
            name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()];
        for (const v of variants) {
            if (existsSync(join(dir, v))) return join(dir, v);
        }
    }
    return null;
}

/**
 * Read a JSON file with graceful failure.
 */
export function readJsonSafe(path) {
    try {
        return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
        return null;
    }
}

/**
 * Detect every harness directory present in a project.
 * Returns an array of { harness: "claude" | "cursor" | ..., path: <abs> }.
 */
export function detectHarnesses(projectRoot = findProjectRoot()) {
    const harnessDirs = [
        { harness: "claude", path: ".claude" },
        { harness: "cursor", path: ".cursor" },
        { harness: "codex", path: ".codex" },
        { harness: "gemini", path: ".gemini" },
        { harness: "opencode", path: ".opencode" },
        { harness: "agents", path: ".agents" },
        { harness: "kiro", path: ".kiro" },
        { harness: "pi", path: ".pi" },
        { harness: "qoder", path: ".qoder" },
        { harness: "rovodev", path: ".rovodev" },
        { harness: "trae", path: ".trae" },
    ];

    return harnessDirs
        .map((h) => ({ harness: h.harness, path: join(projectRoot, h.path) }))
        .filter((h) => existsSync(h.path) && statSync(h.path).isDirectory());
}

/**
 * Resolve where this skill installs in a given harness directory.
 */
export function installPath(harnessDir, harnessName) {
    if (harnessName === "claude") return join(harnessDir, "skills", "imprint");
    if (harnessName === "cursor") return join(harnessDir, "rules", "imprint");
    if (harnessName === "codex") return join(harnessDir, "skills", "imprint");
    if (harnessName === "gemini") return join(harnessDir, "skills", "imprint");
    if (harnessName === "opencode") return join(harnessDir, "skills", "imprint");
    if (harnessName === "agents") return join(harnessDir, "skills", "imprint");
    // Default convention: <harness>/skills/imprint
    return join(harnessDir, "skills", "imprint");
}
