/**
 * AI Client Abstraction Layer
 * 
 * Provides a unified interface for text generation across multiple providers
 * (OpenAI, Anthropic, Google) via the Vercel AI SDK.
 * 
 * Image generation defaults to Gemini 3 Pro Image, with OpenAI as fallback.
 */

import { generateText, Output, experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { jsonSchema } from "ai";
import type { LanguageModel } from "ai";

// ── Model Registry ──────────────────────────────────────────────────────

export type ModelOption = {
    id: string;
    label: string;
    provider: "openai" | "anthropic" | "google";
    envKey: string;           // required env var
    supportsStructured: boolean; // supports JSON schema output
};

export const MODEL_REGISTRY: ModelOption[] = [
    // OpenAI
    { id: "gpt-4.1-nano",   label: "GPT-4.1 Nano",       provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true },
    { id: "gpt-4.1",        label: "GPT-4.1",             provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true },
    { id: "gpt-4.1-mini",   label: "GPT-4.1 Mini",        provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true },
    { id: "gpt-5.1",        label: "GPT-5.1",             provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true },

    // Anthropic
    { id: "claude-sonnet-4-20250514",    label: "Claude Sonnet 4",     provider: "anthropic", envKey: "ANTHROPIC_API_KEY",            supportsStructured: true },
    { id: "claude-3-5-haiku-20241022",   label: "Claude 3.5 Haiku",   provider: "anthropic", envKey: "ANTHROPIC_API_KEY",            supportsStructured: true },

    // Google
    { id: "gemini-2.5-flash-preview-04-17", label: "Gemini 2.5 Flash", provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true },
    { id: "gemini-2.5-pro-preview-05-06",   label: "Gemini 2.5 Pro",   provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true },
    { id: "gemini-3.1-flash-lite-preview",   label: "Gemini 3.1 Flash", provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true },
    { id: "gemini-2.5-flash-image",            label: "Gemini 2.5 Flash Image", provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true },
    { id: "gemini-3-pro-image-preview",         label: "Gemini 3 Pro Image",     provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true },
];

/**
 * Returns which models are available based on configured env vars.
 */
export function getAvailableModels(): ModelOption[] {
    return MODEL_REGISTRY.filter((m) => !!process.env[m.envKey]);
}

/**
 * Resolves a model ID to the correct Vercel AI SDK model instance.
 */
export function getModel(modelId: string): LanguageModel {
    const entry = MODEL_REGISTRY.find((m) => m.id === modelId);
    if (!entry) {
        // Fallback: try OpenAI
        console.warn(`Unknown model "${modelId}", falling back to OpenAI provider`);
        return openai(modelId);
    }

    switch (entry.provider) {
        case "openai":
            return openai(modelId);
        case "anthropic":
            return anthropic(modelId);
        case "google":
            return google(modelId);
        default:
            return openai(modelId);
    }
}

/**
 * Validates and resolves a model ID from user input.
 * Returns the model ID if available, or fallback.
 */
export function resolveModelId(requestedModel: string | undefined, fallback = "gpt-5.1"): string {
    const available = getAvailableModels();
    if (typeof requestedModel === "string" && available.some((m) => m.id === requestedModel)) {
        return requestedModel;
    }
    // Try fallback
    if (available.some((m) => m.id === fallback)) {
        return fallback;
    }
    // Use first available
    return available[0]?.id ?? "gpt-5.1";
}

// ── Text Generation Helpers ─────────────────────────────────────────────

/**
 * Generate plain text with any supported model.
 */
export async function getTextResponse(
    modelId: string,
    system: string,
    prompt: string,
    options?: { temperature?: number }
): Promise<string> {
    const result = await generateText({
        model: getModel(modelId),
        system,
        prompt,
        temperature: options?.temperature,
    });
    return result.text;
}

/**
 * Generate structured JSON output with any supported model.
 * Uses the AI SDK's Output.object() with a JSON Schema.
 */
export async function getStructuredResponse<T>(
    modelId: string,
    system: string,
    prompt: string,
    schema: Record<string, unknown>,
    options?: { temperature?: number; schemaName?: string }
): Promise<T> {
    const result = await generateText({
        model: getModel(modelId),
        system,
        prompt,
        output: Output.object({
            schema: jsonSchema<T>(schema as any),
        }),
        temperature: options?.temperature,
    });

    if (!result.output) {
        throw new Error("Model returned no structured output.");
    }

    return result.output as T;
}

// ── Image Generation ────────────────────────────────────────────────────

import OpenAI from "openai";

let _openaiClient: OpenAI | null = null;
export function getOpenAIClient(): OpenAI {
    if (!_openaiClient) {
        _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _openaiClient;
}

/**
 * Default image generation model.
 * Uses Gemini 3 Pro Image when Google key is available, otherwise falls back to OpenAI.
 */
const DEFAULT_IMAGE_MODEL = "gemini-3-pro-image-preview";

/**
 * Generate an image and return its base64-encoded data.
 * Defaults to Gemini 3 Pro Image; falls back to OpenAI gpt-image-1.
 */
export async function generateImageBase64(
    prompt: string,
    options?: { size?: string; aspectRatio?: string }
): Promise<string | null> {
    const aspectRatio = options?.aspectRatio ?? "16:9";

    // Try Gemini first if the key is available
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        try {
            const result = await generateImage({
                model: google.image(DEFAULT_IMAGE_MODEL),
                prompt,
                aspectRatio: aspectRatio as `${number}:${number}`,
            });

            // experimental_generateImage returns image in result.image
            if (result.image?.base64) {
                return result.image.base64;
            }

            // Check uint8Array fallback
            if (result.image?.uint8Array) {
                return Buffer.from(result.image.uint8Array).toString("base64");
            }

            console.warn("Gemini 3 Pro Image generation returned no image, falling back to OpenAI");
        } catch (err) {
            console.warn("Gemini 3 Pro Image generation failed, falling back to OpenAI:", err);
        }
    }

    // Fallback to OpenAI (1792x1024 is closest supported 16:9 size)
    if (!process.env.OPENAI_API_KEY) {
        throw new Error("No image generation API key configured (need GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_API_KEY)");
    }

    const imageResp = await getOpenAIClient().images.generate({
        model: "gpt-image-1",
        prompt,
        size: (options?.size as any) ?? "1792x1024",
    });

    return imageResp.data?.[0]?.b64_json ?? null;
}
