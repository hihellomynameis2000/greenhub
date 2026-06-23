import "server-only";

import { PortalApiError } from "./server";

type AgentInviteEmail = {
  inviteUrl: string;
  name: string;
  to: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "'": "&#39;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

export function portalAppUrl() {
  const configuredUrl = process.env.PORTAL_APP_URL;

  if (configuredUrl) {
    try {
      return new URL(configuredUrl).origin;
    } catch {
      throw new PortalApiError("PORTAL_APP_URL must be a valid absolute URL.", 500);
    }
  }

  const host = process.env.NEXT_PUBLIC_PORTAL_HOST ?? "console.greenhub.io";
  return `https://${host}`;
}

export function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new PortalApiError(
      "Agent invitations are not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
      500
    );
  }

  return { apiKey, from };
}

export async function sendAgentInviteEmail({ inviteUrl, name, to }: AgentInviteEmail) {
  const { apiKey, from } = resendConfig();

  const safeName = escapeHtml(name);
  const safeInviteUrl = escapeHtml(inviteUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:560px;margin:0 auto;padding:24px">
          <h1 style="font-size:24px;margin:0 0 16px">Welcome to GreenHub</h1>
          <p>Hi ${safeName},</p>
          <p>You have been invited to access the GreenHub Residual Portal. Use the secure link below to set your password and activate your account.</p>
          <p style="margin:28px 0">
            <a href="${safeInviteUrl}" style="background:#065f46;border-radius:8px;color:#ffffff;display:inline-block;font-weight:700;padding:12px 18px;text-decoration:none">Set up your account</a>
          </p>
          <p style="color:#475569;font-size:13px">If you did not expect this invitation, you can ignore this email.</p>
        </div>
      `,
      subject: "You are invited to the GreenHub Residual Portal",
      text: `Hi ${name},\n\nYou have been invited to access the GreenHub Residual Portal. Set your password and activate your account here:\n${inviteUrl}\n\nIf you did not expect this invitation, you can ignore this email.`,
      to: [to],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new PortalApiError(
      `Resend could not deliver the invitation${body ? `: ${body}` : "."}`,
      502
    );
  }
}
