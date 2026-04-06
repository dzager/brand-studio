import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
    api: {
        bodyParser: {
            sizeLimit: "10mb",
        },
    },
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const webhookUrl = process.env.WEBHOOK_URL;
    const webhookApiKey = process.env.WEBHOOK_API_KEY;

    if (!webhookUrl) {
        return res.status(500).json({ error: "WEBHOOK_URL not configured" });
    }
    if (!webhookApiKey) {
        return res.status(500).json({ error: "WEBHOOK_API_KEY not configured" });
    }

    const { title, slug, excerpt, content_html, featured_image_url, tags, published, seo_data } = req.body;

    if (!title || !slug || !content_html) {
        return res.status(400).json({ error: "title, slug, and content_html are required" });
    }

    try {
        const response = await fetch(`${webhookUrl}/api/webhook/posts`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${webhookApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                title,
                slug,
                excerpt: excerpt || title.substring(0, 160),
                content_html,
                featured_image_url: featured_image_url || undefined,
                tags: tags || [],
                published: published ?? true,
                ...(seo_data && { seo_data }),
            }),
        });

        const responseText = await response.text();
        let data: any;
        try {
            data = JSON.parse(responseText);
        } catch {
            // Non-JSON response (HTML error page, etc.)
            console.error("Webhook returned non-JSON:", responseText.substring(0, 500));
            return res.status(response.status || 502).json({
                error: `Webhook returned ${response.status} with non-JSON response. Check that WEBHOOK_URL (${webhookUrl}) is correct.`,
            });
        }

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error || `Webhook returned ${response.status}`,
            });
        }

        return res.status(201).json(data);
    } catch (err) {
        console.error("Publish webhook error:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        return res.status(500).json({ error: message });
    }
}
