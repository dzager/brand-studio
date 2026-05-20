#!/usr/bin/env node
// load-context.mjs — load BRAND.md / VOICE.md / VISUAL.md as one JSON payload.
// Output to stdout. The harness consumes the JSON; do not pipe through head/tail/jq.

import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { findContextDir, findCaseInsensitive } from "./imprint-paths.mjs";

const contextDir = findContextDir();

function load(name) {
    const path = findCaseInsensitive(contextDir, name);
    if (!path || !existsSync(path)) {
        return { path: null, present: false, content: null, sizeBytes: 0 };
    }
    const content = readFileSync(path, "utf-8");
    const sizeBytes = statSync(path).size;
    return { path, present: true, content, sizeBytes };
}

const brand = load("BRAND.md");
const voice = load("VOICE.md");
const visual = load("VISUAL.md");
const evals = load("EVALS.md");

// Heuristic: detect placeholder/empty
function isPlaceholder(state) {
    if (!state.present) return true;
    if (state.sizeBytes < 200) return true;
    if (state.content.includes("[TODO]")) return true;
    if (state.content.trim() === "") return true;
    return false;
}

const result = {
    contextDir,
    brand,
    voice,
    visual,
    evals,
    flags: {
        hasBrand: brand.present && !isPlaceholder(brand),
        hasVoice: voice.present && !isPlaceholder(voice),
        hasVisual: visual.present && !isPlaceholder(visual),
        hasEvals: evals.present && !isPlaceholder(evals),
        brandIsPlaceholder: brand.present && isPlaceholder(brand),
    },
};

process.stdout.write(JSON.stringify(result, null, 2));
process.stdout.write("\n");
