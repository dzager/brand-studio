/**
 * AI Client Abstraction Layer
 * 
 * Provides a unified interface for text generation across multiple providers
 * (OpenAI, Anthropic, Google) via the Vercel AI SDK.
 * 
 * Image generation defaults to GPT Image 2, with Gemini as fallback.
 */

import { generateText, Output, experimental_generateImage as generateImage } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { jsonSchema } from "ai";
import type { LanguageModel } from "ai";

// ── Model Registry ──────────────────────────────────────────────────────

export type ModelCapability = "writing" | "imageGeneration" | "utility";

export type ModelOption = {
    id: string;
    label: string;
    provider: "openai" | "anthropic" | "google";
    envKey: string;           // required env var
    supportsStructured: boolean; // supports JSON schema output
    capabilities: ModelCapability[]; // which process categories this model supports
};

export const MODEL_REGISTRY: ModelOption[] = [
    // OpenAI
    { id: "gpt-4.1-nano",   label: "GPT-4.1 Nano",       provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gpt-4.1",        label: "GPT-4.1",             provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gpt-4.1-mini",   label: "GPT-4.1 Mini",        provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gpt-5.1",        label: "GPT-5.1",             provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gpt-5.2",        label: "GPT-5.2",             provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gpt-5.3-chat-latest", label: "GPT-5.3",        provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gpt-5.4",        label: "GPT-5.4",             provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gpt-image-2",    label: "GPT Image 2",          provider: "openai",    envKey: "OPENAI_API_KEY",              supportsStructured: false, capabilities: ["imageGeneration"] },

    // Anthropic
    { id: "claude-sonnet-4-20250514",    label: "Claude Sonnet 4",     provider: "anthropic", envKey: "ANTHROPIC_API_KEY",            supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "claude-3-5-haiku-20241022",   label: "Claude 3.5 Haiku",   provider: "anthropic", envKey: "ANTHROPIC_API_KEY",            supportsStructured: true, capabilities: ["writing", "utility"] },

    // Google
    { id: "gemini-3.1-pro-preview",            label: "Gemini 3.1 Pro",   provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gemini-2.5-flash-preview-04-17", label: "Gemini 2.5 Flash", provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gemini-2.5-pro-preview-05-06",   label: "Gemini 2.5 Pro",   provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gemini-3.1-flash-lite-preview",   label: "Gemini 3.1 Flash", provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true, capabilities: ["writing", "utility"] },
    { id: "gemini-2.5-flash-image",            label: "Gemini 2.5 Flash Image", provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true, capabilities: ["writing", "imageGeneration"] },
    { id: "gemini-3-pro-image-preview",         label: "Gemini 3 Pro Image",     provider: "google", envKey: "GOOGLE_GENERATIVE_AI_API_KEY", supportsStructured: true, capabilities: ["writing", "imageGeneration"] },
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
export function resolveModelId(requestedModel: string | undefined, fallback = "gpt-5.4"): string {
    const available = getAvailableModels();
    if (typeof requestedModel === "string" && available.some((m) => m.id === requestedModel)) {
        return requestedModel;
    }
    // Try fallback
    if (available.some((m) => m.id === fallback)) {
        return fallback;
    }
    // Use first available
    return available[0]?.id ?? "gpt-5.4";
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
 * Uses GPT Image 2 when OpenAI key is available, otherwise falls back to Gemini.
 */
export const DEFAULT_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_WRITING_MODEL = "gpt-5.4";
export const DEFAULT_UTILITY_MODEL = "gpt-4.1-mini";

/**
 * Resolves an image model ID from user settings.
 * Returns the model ID if available, or the default image model.
 */
export function resolveImageModelId(requestedModel: string | undefined): string {
    const available = getAvailableModels();
    if (typeof requestedModel === "string" && available.some((m) => m.id === requestedModel && m.capabilities.includes("imageGeneration"))) {
        return requestedModel;
    }
    if (available.some((m) => m.id === DEFAULT_IMAGE_MODEL)) {
        return DEFAULT_IMAGE_MODEL;
    }
    // Fallback to first image-capable model
    const firstImage = available.find((m) => m.capabilities.includes("imageGeneration"));
    return firstImage?.id ?? DEFAULT_IMAGE_MODEL;
}

/**
 * Generate an image and return its base64-encoded data.
 * Defaults to GPT Image 2; falls back to Gemini if OpenAI is unavailable.
 * Accepts an optional imageModel to override the default.
 */
export async function generateImageBase64(
    prompt: string,
    options?: { size?: string; aspectRatio?: string; imageModel?: string }
): Promise<string | null> {
    const aspectRatio = options?.aspectRatio ?? "16:9";
    const imageModel = options?.imageModel ?? DEFAULT_IMAGE_MODEL;

    // Determine provider for the selected image model
    const modelEntry = MODEL_REGISTRY.find((m) => m.id === imageModel);
    const isOpenAIModel = !modelEntry || modelEntry.provider === "openai";

    if (isOpenAIModel) {
        // ── OpenAI path (GPT Image 2 or gpt-image-1) ──
        if (process.env.OPENAI_API_KEY) {
            try {
                const imageResp = await getOpenAIClient().images.generate({
                    model: imageModel,
                    prompt,
                    size: (options?.size as any) ?? "1792x1024",
                    output_format: "png",
                    quality: "high",
                } as any);

                const b64 = imageResp.data?.[0]?.b64_json ?? null;
                if (b64) return b64;

                console.warn(`${imageModel} generation returned no image, falling back to Gemini`);
            } catch (err) {
                console.warn(`${imageModel} generation failed, falling back to Gemini:`, err);
            }
        }

        // Fallback to Gemini
        if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            try {
                const result = await generateImage({
                    model: google.image("gemini-3-pro-image-preview"),
                    prompt,
                    aspectRatio: aspectRatio as `${number}:${number}`,
                });
                if (result.image?.base64) return result.image.base64;
                if (result.image?.uint8Array) return Buffer.from(result.image.uint8Array).toString("base64");
            } catch (geminiErr) {
                console.warn("Gemini fallback also failed:", geminiErr);
            }
        }
    } else {
        // ── Google/Gemini path ──
        if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            try {
                const result = await generateImage({
                    model: google.image(imageModel),
                    prompt,
                    aspectRatio: aspectRatio as `${number}:${number}`,
                });

                if (result.image?.base64) return result.image.base64;
                if (result.image?.uint8Array) return Buffer.from(result.image.uint8Array).toString("base64");

                console.warn(`${imageModel} generation returned no image, falling back to OpenAI`);
            } catch (err) {
                console.warn(`${imageModel} generation failed, falling back to OpenAI:`, err);
            }
        }

        // Fallback to OpenAI GPT Image 2
        if (process.env.OPENAI_API_KEY) {
            try {
                const imageResp = await getOpenAIClient().images.generate({
                    model: "gpt-image-2",
                    prompt,
                    size: (options?.size as any) ?? "1792x1024",
                    output_format: "png",
                    quality: "high",
                } as any);
                const b64 = imageResp.data?.[0]?.b64_json ?? null;
                if (b64) return b64;
            } catch (oaiErr) {
                console.warn("OpenAI fallback also failed:", oaiErr);
            }
        }
    }

    throw new Error("No image generation API key configured (need OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY)");
}
