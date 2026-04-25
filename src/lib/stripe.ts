/**
 * Stripe utility – server-side only.
 */
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("Missing STRIPE_SECRET_KEY — Stripe functionality disabled.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2025-03-31.basil" as any,
});

// Price IDs from Stripe Dashboard (set in .env.local)
export const STRIPE_PRICES = {
    starter: process.env.STRIPE_PRICE_STARTER || "",
    standard: process.env.STRIPE_PRICE_STANDARD || "",
    scale: process.env.STRIPE_PRICE_SCALE || "",
} as const;

export const STRIPE_OVERAGE_PRICES = {
    starter: process.env.STRIPE_OVERAGE_STARTER || "",
    standard: process.env.STRIPE_OVERAGE_STANDARD || "",
    scale: process.env.STRIPE_OVERAGE_SCALE || "",
} as const;
