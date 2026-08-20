import "server-only";

import { portalOriginForRole } from "./hosts";
import { PortalApiError } from "./server";
import type { PortalRole } from "./types";

type PortalAccessEmail = {
  accessUrl: string;
  name: string;
  type: "invite" | "recovery";
  to: string;
};

type PortalLoginCodeEmail = {
  code: string;
  name: string;
  role: "admin" | "agent";
  to: string;
};

type ResendSuccessResponse = {
  id?: string;
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
  try {
    return portalOriginForRole("agent");
  } catch {
    throw new PortalApiError("PORTAL_APP_URL must be a valid absolute URL.", 500);
  }
}

export function portalAppUrlForRole(role: PortalRole) {
  try {
    return portalOriginForRole(role);
  } catch {
    throw new PortalApiError(
      role === "admin"
        ? "ADMIN_PORTAL_APP_URL must be a valid absolute URL."
        : "PORTAL_APP_URL must be a valid absolute URL.",
      500
    );
  }
}

export function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new PortalApiError(
      "Portal email delivery is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.",
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
    ? "You have been invited to access the GreenHub Partner Portal. Use the secure link below to set your password and activate your account."
    : "Use the secure link below to set a new password for your GreenHub Partner Portal account.";
  const actionLabel = isInvite ? "Set up your account" : "Set a new password";
  const subject = isInvite
    ? "You are invited to the GreenHub Partner Portal"
    : "Reset your GreenHub Partner Portal password";
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

  const delivery = (await response.json().catch(() => ({}))) as ResendSuccessResponse;
  console.log("Portal access email accepted by Resend", {
    resendId: delivery.id ?? null,
    to,
    type,
  });
}

export async function sendPortalLoginCodeEmail({
  code,
  name,
  role,
  to,
}: PortalLoginCodeEmail) {
  const { apiKey, from } = resendConfig();
  const safeCode = escapeHtml(code);
  const safeName = escapeHtml(name);
  const roleLabel = role === "admin" ? "administrator" : "agent";
  const subject = `Your GreenHub verification code is ${code}`;
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
          <p style="color:#047857;font-size:13px;font-weight:700;letter-spacing:.08em;margin:0 0 12px;text-transform:uppercase">GreenHub Partner Portal</p>
          <h1 style="font-size:24px;margin:0 0 16px">Verify your sign in</h1>
          <p>Hi ${safeName},</p>
          <p>Use this one-time code to finish signing in to your GreenHub ${roleLabel} workspace.</p>
          <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:12px;font-size:32px;font-weight:800;letter-spacing:8px;margin:24px 0;padding:18px;text-align:center">${safeCode}</div>
          <p style="color:#475569;font-size:13px">This code expires in 10 minutes. If you did not try to sign in, reset your password and contact GreenHub support.</p>
        </div>
      `,
      subject,
      text: `Hi ${name},\n\nUse this one-time code to finish signing in to your GreenHub ${roleLabel} workspace: ${code}\n\nThis code expires in 10 minutes.`,
      to: [to],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new PortalApiError(
      `Resend could not deliver the verification code${body ? `: ${body}` : "."}`,
      502
    );
  }

  const delivery = (await response.json().catch(() => ({}))) as ResendSuccessResponse;
  console.log("Portal verification email accepted by Resend", {
    resendId: delivery.id ?? null,
    role,
    to,
  });
}
