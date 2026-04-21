import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabase } from "@/lib/supabase";

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { email } = req.body;

    if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email is required" });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
        return res.status(400).json({ error: "Invalid email address" });
    }

    try {
        const supabase = getSupabase();

        const { error } = await supabase
            .from("waitlist")
            .upsert(
                { email: email.trim().toLowerCase() },
                { onConflict: "email" }
            );

        if (error) {
            console.error("Waitlist insert error:", error);
            return res.status(500).json({ error: "Failed to save email" });
        }

        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error("Waitlist API error:", err);
        return res.status(500).json({ error: err.message || "Internal server error" });
    }
}
