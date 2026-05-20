#!/usr/bin/env node
// pin.mjs — alias /imprint <command> as a top-level /<command>.
//
// Usage:
//   node pin.mjs pin <command>    -- write a thin redirect skill into every detected harness
//   node pin.mjs unpin <command>  -- remove a pinned alias
//
// The pinned skill carries a marker so unpin can find what it created without
// touching skills the user authored manually.

import { writeFileSync, mkdirSync, existsSync, readFileSync, unlinkSync, rmdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { detectHarnesses, findProjectRoot, installPath } from "./imprint-paths.mjs";

const VALID_COMMANDS = new Set([
    "teach", "voice", "style", "article", "short", "cluster", "image", "video",
    "humanize", "factcheck", "shorten", "polish", "audit", "critique", "bakeoff",
    "seo", "aeo", "geo", "publish", "evals",
]);

const MARKER = "<!-- imprint-pinned-skill -->";

function usage() {
    process.stderr.write(`Usage: pin.mjs <pin|unpin> <command>\n`);
    process.stderr.write(`  command must be one of: ${[...VALID_COMMANDS].join(", ")}\n`);
    process.exit(2);
}

function pinSkillContent(command) {
    return `---
name: ${command}
description: "Pinned shortcut: run /imprint ${command}. See ../imprint/SKILL.md for the full skill."
argument-hint: "[target]"
user-invocable: true
---
${MARKER}

# ${command} (pinned)

This is a thin alias. Routes to \`/imprint ${command}\` so you can type \`/${command}\` directly.

The actual methodology lives in the imprint skill — open \`../imprint/SKILL.md\` and \`../imprint/reference/${command}.md\` for everything.

When invoked, behave exactly as if the user had typed \`/imprint ${command} <args>\`.
`;
}

function action() {
    const [verb, command] = process.argv.slice(2);
    if (verb !== "pin" && verb !== "unpin") usage();
    if (!command || !VALID_COMMANDS.has(command)) usage();

    const projectRoot = findProjectRoot();
    const harnesses = detectHarnesses(projectRoot);

    if (harnesses.length === 0) {
        process.stderr.write(`No harness directories found in ${projectRoot}.\n`);
        process.stderr.write(`Expected one of: .claude/, .cursor/, .codex/, .gemini/, .opencode/, .agents/\n`);
        process.exit(1);
    }

    const results = [];

    for (const h of harnesses) {
        // The pinned alias goes one level above the imprint skill, as a sibling skill named <command>.
        const imprintInstall = installPath(h.path, h.harness);
        const skillsDir = dirname(imprintInstall);
        const target = join(skillsDir, command);

        if (verb === "pin") {
            mkdirSync(target, { recursive: true });
            const filePath = join(target, "SKILL.md");
            writeFileSync(filePath, pinSkillContent(command), "utf-8");
            results.push({ harness: h.harness, action: "pinned", path: filePath });
        } else {
            // unpin: only remove if MARKER is present
            const filePath = join(target, "SKILL.md");
            if (!existsSync(filePath)) {
                results.push({ harness: h.harness, action: "skipped (not pinned)", path: filePath });
                continue;
            }
            const content = readFileSync(filePath, "utf-8");
            if (!content.includes(MARKER)) {
                results.push({ harness: h.harness, action: "skipped (no marker; not authored by imprint)", path: filePath });
                continue;
            }
            unlinkSync(filePath);
            try {
                const remaining = readdirSync(target);
                if (remaining.length === 0) rmdirSync(target);
            } catch { /* directory not empty or doesn't exist; leave it */ }
            results.push({ harness: h.harness, action: "unpinned", path: filePath });
        }
    }

    process.stdout.write(JSON.stringify({ verb, command, results }, null, 2));
    process.stdout.write("\n");
}

action();
