#!/usr/bin/env node
// imprint — the brand-content methodology, on your terminal.
//
// Usage:
//   npx imprint install            install skill into every detected harness
//   npx imprint detect <file>      scan for AI tells, banned phrases, weak openings
//   npx imprint score <file>       0-100 score per dimension (deterministic parts only)
//   npx imprint version
//   npx imprint help

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI lives at <repo>/cli/imprint.mjs. Skill lives at <repo>/skill/.
const repoRoot = resolve(__dirname, "..");
const skillSrc = join(repoRoot, "skill");
const pkg = readJsonOrNull(join(repoRoot, "package.json"));

const args = process.argv.slice(2);
const cmd = args[0];

if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    process.exit(0);
}

switch (cmd) {
    case "install": exit(install(args.slice(1))); break;
    case "detect":  exit(detect(args.slice(1))); break;
    case "score":   exit(score(args.slice(1))); break;
    case "version":
    case "--version":
    case "-v":
        console.log(pkg?.version ?? "0.0.0");
        process.exit(0);
    default:
        console.error(`Unknown command: ${cmd}`);
        printHelp();
        process.exit(2);
}

// ─────────────────────────────────────────────────────────────────────────

function printHelp() {
    const lines = [
        `imprint v${pkg?.version ?? "0.0.0"} — brand-content methodology, on your terminal`,
        ``,
        `Usage: imprint <command> [args]`,
        ``,
        `Commands:`,
        `  install            Install the skill into every detected harness directory`,
        `                     (.claude, .cursor, .codex, .gemini, .opencode, .agents, ...)`,
        `  detect <file>      Scan a markdown / HTML file for AI tells, banned phrases,`,
        `                     weak openings, and structural gaps. Exit 0 = clean, 2 = findings.`,
        `  score <file>       Emit a 0-100 score per dimension (voice, SEO, AEO, GEO,`,
        `                     humanization). Factuality requires the LLM-side council.`,
        `  version            Print the version`,
        `  help               Print this message`,
        ``,
        `Environment:`,
        `  IMPRINT_CONTEXT_DIR    Override the BRAND.md / VOICE.md / VISUAL.md search path`,
        `  IMPRINT_IMAGE_PROVIDER Set to openai|fal|replicate|stability for image generation`,
        `  IMPRINT_VIDEO_PROVIDER Set to sora|runway|veo|luma for motion generation`,
        ``,
        `Docs:`,
        `  https://github.com/psl-labs/imprint`,
    ];
    console.log(lines.join("\n"));
}

// ─── install ─────────────────────────────────────────────────────────────────

function install(opts) {
    const projectRoot = findProjectRoot();
    const harnesses = detectHarnesses(projectRoot);

    if (harnesses.length === 0) {
        console.error(`No harness directories found in ${projectRoot}.`);
        console.error(`Create one of: .claude/, .cursor/, .codex/, .gemini/, .opencode/, .agents/`);
        return 1;
    }

    const dryRun = opts.includes("--dry-run");
    const results = [];

    for (const h of harnesses) {
        const target = installPath(h.path, h.harness);

        if (dryRun) {
            results.push({ harness: h.harness, action: "would install", target });
            continue;
        }

        mkdirSync(target, { recursive: true });
        // Copy skill/ → target/
        cpSync(skillSrc, target, { recursive: true, force: true });
        results.push({ harness: h.harness, action: "installed", target });
    }

    for (const r of results) {
        console.log(`${r.harness.padEnd(10)} ${r.action.padEnd(15)} ${r.target}`);
    }

    return 0;
}

// ─── detect ──────────────────────────────────────────────────────────────────

function detect(opts) {
    const file = opts[0];
    if (!file || !existsSync(file)) {
        console.error(`Usage: imprint detect <file>`);
        return 2;
    }

    const result = runScript("score-content.mjs", [file]);
    if (!result) return 1;

    const data = JSON.parse(result);
    const highIssues = data.issues.filter((i) => i.severity === "high");
    const mediumIssues = data.issues.filter((i) => i.severity === "medium");
    const lowIssues = data.issues.filter((i) => i.severity === "low");

    console.log(`imprint detect — ${file}`);
    console.log(`composite: ${data.composite_score ?? "—"}/100 (factuality not scored deterministically)`);
    console.log(`metrics: ${data.metrics.words} words, ${data.metrics.h2_count} H2s, ${data.metrics.external_links} external links, ${data.metrics.banned_phrase_hits} banned-phrase hits`);
    console.log("");

    if (highIssues.length === 0 && mediumIssues.length === 0 && lowIssues.length === 0) {
        console.log("✓ clean — no deterministic findings");
        return 0;
    }

    if (highIssues.length) {
        console.log(`high (${highIssues.length}):`);
        for (const i of highIssues) console.log(`  [${i.dimension}] ${i.issue}`);
    }
    if (mediumIssues.length) {
        console.log(`\nmedium (${mediumIssues.length}):`);
        for (const i of mediumIssues) console.log(`  [${i.dimension}] ${i.issue}`);
    }
    if (lowIssues.length) {
        console.log(`\nlow (${lowIssues.length}):`);
        for (const i of lowIssues) console.log(`  [${i.dimension}] ${i.issue}`);
    }

    return highIssues.length > 0 ? 2 : 0;
}

// ─── score ───────────────────────────────────────────────────────────────────

function score(opts) {
    const file = opts[0];
    if (!file || !existsSync(file)) {
        console.error(`Usage: imprint score <file> [--json]`);
        return 2;
    }
    const json = opts.includes("--json");

    const result = runScript("score-content.mjs", [file]);
    if (!result) return 1;

    if (json) {
        process.stdout.write(result);
        return 0;
    }

    const data = JSON.parse(result);
    console.log(`imprint score — ${file}`);
    console.log(`composite: ${data.composite_score ?? "—"}/100`);
    console.log("");
    for (const [k, v] of Object.entries(data.scores)) {
        const label = k.padEnd(14);
        const value = v === null ? "— (needs LLM)" : `${v}/100`;
        console.log(`  ${label} ${value}`);
    }

    return 0;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function runScript(name, args) {
    const scriptPath = join(skillSrc, "scripts", name);
    if (!existsSync(scriptPath)) {
        console.error(`Missing script: ${scriptPath}`);
        return null;
    }
    const res = spawnSync(process.execPath, [scriptPath, ...args], {
        stdio: ["ignore", "pipe", "inherit"],
        encoding: "utf-8",
    });
    if (res.status !== 0) {
        console.error(`Script exited with code ${res.status}`);
        return null;
    }
    return res.stdout;
}

function readJsonOrNull(path) {
    try {
        return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
        return null;
    }
}

function findProjectRoot(start = process.cwd()) {
    let dir = resolve(start);
    while (dir !== "/" && dir !== "") {
        if (existsSync(join(dir, "package.json")) ||
            existsSync(join(dir, ".git")) ||
            existsSync(join(dir, "skills-lock.json"))) {
            return dir;
        }
        dir = dirname(dir);
    }
    return resolve(start);
}

function detectHarnesses(projectRoot) {
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

function installPath(harnessDir, harnessName) {
    if (harnessName === "cursor") return join(harnessDir, "rules", "imprint");
    return join(harnessDir, "skills", "imprint");
}

function exit(code) { process.exit(code ?? 0); }
