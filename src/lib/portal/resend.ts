import "server-only";

import { PortalApiError } from "./server";

type PortalAccessEmail = {
  accessUrl: string;
  name: string;
  type: "invite" | "recovery";
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

export async function sendPortalAccessEmail({
  accessUrl,
  name,
  to,
  type,
}: PortalAccessEmail) {
  const { apiKey, from } = resendConfig();

  const safeName = escapeHtml(name);
  const safeAccessUrl = escapeHtml(accessUrl);
  const isInvite = type === "invite";
  const headline = isInvite ? "Welcome to GreenHub" : "Reset your GreenHub password";
  const description = isInvite
    ? "You have been invited to access the GreenHub Residual Portal. Use the secure link below to set your password and activate your account."
    : "Use the secure link below to set a new password for your GreenHub Residual Portal account.";
  const actionLabel = isInvite ? "Set up your account" : "Set a new password";
  const subject = isInvite
    ? "You are invited to the GreenHub Residual Portal"
    : "Reset your GreenHub Residual Portal password";
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
          <h1 style="font-size:24px;margin:0 0 16px">${headline}</h1>
          <p>Hi ${safeName},</p>
          <p>${description}</p>
          <p style="margin:28px 0">
            <a href="${safeAccessUrl}" style="background:#065f46;border-radius:8px;color:#ffffff;display:inline-block;font-weight:700;padding:12px 18px;text-decoration:none">${actionLabel}</a>
          </p>
          <p style="color:#475569;font-size:13px">If you did not expect this invitation, you can ignore this email.</p>
        </div>
      `,
      subject,
      text: `Hi ${name},\n\n${description}\n${accessUrl}\n\nIf you did not expect this email, you can ignore it.`,
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
