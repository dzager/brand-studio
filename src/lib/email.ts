/**
 * Email delivery via Resend.
 *
 * Requires RESEND_API_KEY in .env.local
 * Optional: NEXT_PUBLIC_APP_URL (defaults to http://localhost:3000)
 */
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Resolve the "from" address for outbound emails.
 *
 * Priority:
 *  1. RESEND_FROM_DOMAIN  → "Organic <noreply@your-domain.com>"
 *  2. Fallback            → "Organic <onboarding@resend.dev>"   (Resend testing sender)
 *
 * NOTE: The `onboarding@resend.dev` sender is Resend's free testing address.
 * It can only deliver to the email that owns the Resend account.
 * To send to any recipient, add & verify your own domain in the Resend dashboard,
 * then set RESEND_FROM_DOMAIN in .env.local.
 */
function getFromAddress(): string {
    if (process.env.RESEND_FROM_DOMAIN) {
        return `Organic <noreply@${process.env.RESEND_FROM_DOMAIN}>`;
    }
    // Resend's free testing sender — delivers only to account-owner email
    return "Organic <onboarding@resend.dev>";
}

/** Base URL for constructing invite links */
export function getAppUrl(): string {
    if (process.env.NEXT_PUBLIC_APP_URL) {
        return process.env.NEXT_PUBLIC_APP_URL;
    }
    if (process.env.VERCEL_URL) {
        return `https://${process.env.VERCEL_URL}`;
    }
    return "http://localhost:3000";
}

/** Build the full invite URL from a token */
export function buildInviteUrl(token: string): string {
    return `${getAppUrl()}/invite/${token}`;
}

// ── Cluster Invite Email ───────────────────────────────────────────

interface SendClusterInviteParams {
    to: string;
    inviterName: string;
    accountName: string;
    clusterName: string | null;
    inviteUrl: string;
}

export async function sendClusterInviteEmail({
    to,
    inviterName,
    accountName,
    clusterName,
    inviteUrl,
}: SendClusterInviteParams): Promise<{ success: boolean; error?: string }> {
    // If no API key, log and return gracefully
    if (!process.env.RESEND_API_KEY) {
        console.warn(
            "[email] RESEND_API_KEY not set — skipping email delivery. Invite URL:",
            inviteUrl
        );
        return { success: true };
    }

    const clusterLine = clusterName
        ? `You've been invited to collaborate on the <strong>"${clusterName}"</strong> content cluster.`
        : `You've been invited to join the team.`;

    const subject = clusterName
        ? `${inviterName} invited you to collaborate on "${clusterName}"`
        : `${inviterName} invited you to ${accountName}`;

    try {
        const from = getFromAddress();
        console.log(`[email] Sending invite to ${to} from ${from} — subject: "${subject}"`);

        const { data, error } = await resend.emails.send({
            from,
            to: [to],
            subject,
            html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
    <div style="max-width:480px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
        <!-- Header -->
        <div style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #f4f4f5;">
            <img src="${getAppUrl()}/organic-logo.png" alt="Organic" style="height:28px;width:auto;" />
        </div>

        <!-- Body -->
        <div style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#09090b;line-height:1.3;">
                You're invited to ${accountName}
            </h1>
            <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
                ${clusterLine}
            </p>
            <p style="margin:0 0 24px;font-size:14px;color:#71717a;line-height:1.6;">
                Click the button below to create your account and get started.
                You'll just need to set a username and password.
            </p>

            <!-- CTA Button -->
            <div style="text-align:center;margin:32px 0;">
                <a href="${inviteUrl}"
                   style="display:inline-block;padding:12px 32px;background:#18181b;color:#fafafa;font-size:14px;font-weight:500;text-decoration:none;border-radius:8px;">
                    Accept Invitation
                </a>
            </div>

            <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">
                If you weren't expecting this invitation, you can safely ignore this email.
            </p>
        </div>

        <!-- Footer -->
        <div style="padding:20px 32px;background:#fafafa;border-top:1px solid #f4f4f5;text-align:center;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;">
                Sent by Organic · <a href="${getAppUrl()}" style="color:#a1a1aa;">organic.so</a>
            </p>
        </div>
    </div>
</body>
</html>
            `.trim(),
        });

        if (error) {
            console.error("[email] Resend API error:", JSON.stringify(error, null, 2));
            return { success: false, error: error.message };
        }

        console.log("[email] ✓ Email sent successfully. Resend ID:", data?.id);
        return { success: true };
    } catch (err) {
        const message = err instanceof Error ? err.message : "Email delivery failed";
        console.error("[email] Send failed:", message);
        return { success: false, error: message };
    }
}
