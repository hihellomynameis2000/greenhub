import "server-only";

import { portalOriginForRole } from "./hosts";
import { PortalApiError } from "./server";
import type { NumericValue, PortalRole } from "./types";

type PortalAccessEmail = {
  accessUrl: string;
  name: string;
  role: PortalRole;
  type: "invite" | "recovery";
  to: string;
};

type PortalLoginCodeEmail = {
  code: string;
  name: string;
  role: "admin" | "agent";
  to: string;
};

type CrmLeadNotificationEmail = {
  agentName: string;
  contactEmail?: string | null;
  contactName?: string | null;
  createdByName: string;
  estimatedVolume?: NumericValue;
  lastActivity?: string | null;
  merchantName: string;
  nextFollowUp?: string | null;
  notes?: string | null;
  platformName?: string | null;
  priority: string;
  salesforceStatus?: string | null;
  stageLabel: string;
  to: string[];
};

type ResendSuccessResponse = {
  id?: string;
};

const defaultCrmLeadNotificationRecipients = [
  "nik@buildrbrand.com",
  "justin@greenhubinc.com",
];

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

function normalizeEmailList(value: string | undefined) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function displayValue(value: NumericValue | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function emailRow(label: string, value: NumericValue | string | null | undefined) {
  return `
    <tr>
      <td style="border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;font-weight:700;padding:10px 12px;width:180px">${escapeHtml(label)}</td>
      <td style="border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;padding:10px 12px">${escapeHtml(displayValue(value))}</td>
    </tr>
  `;
}

export function crmLeadNotificationRecipients() {
  const configured = normalizeEmailList(
    process.env.CRM_LEAD_NOTIFICATION_EMAILS ?? process.env.ADMIN_CRM_NOTIFICATION_EMAILS
  );

  return configured.length ? configured : defaultCrmLeadNotificationRecipients;
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

export function resendConfig(role?: PortalRole) {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    role === "admin"
      ? process.env.ADMIN_RESEND_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL
      : role === "agent"
        ? process.env.AGENT_RESEND_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL
        : process.env.RESEND_FROM_EMAIL;
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
  role,
  to,
  type,
}: PortalAccessEmail) {
  const { apiKey, from } = resendConfig(role);
  const accessHost = new URL(accessUrl).hostname;
  if (accessHost.endsWith(".supabase.co")) {
    throw new PortalApiError("Portal email link is not configured for branded delivery.", 500);
  }

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
          <p style="color:#475569;font-size:13px">If you did not expect this email, you can ignore it.</p>
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
  const { apiKey, from } = resendConfig(role);
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

export async function sendCrmLeadNotificationEmail({
  agentName,
  contactEmail,
  contactName,
  createdByName,
  estimatedVolume,
  lastActivity,
  merchantName,
  nextFollowUp,
  notes,
  platformName,
  priority,
  salesforceStatus,
  stageLabel,
  to,
}: CrmLeadNotificationEmail) {
  if (!to.length) return;

  const { apiKey, from } = resendConfig("admin");
  const subject = `New CRM lead: ${merchantName}`;
  const rows = [
    emailRow("Merchant", merchantName),
    emailRow("Assigned agent", agentName),
    emailRow("Platform", platformName),
    emailRow("Stage", stageLabel),
    emailRow("Priority", priority),
    emailRow("Estimated volume", estimatedVolume),
    emailRow("Contact name", contactName),
    emailRow("Contact email", contactEmail),
    emailRow("Next follow-up", nextFollowUp),
    emailRow("Salesforce status", salesforceStatus),
    emailRow("Last activity", lastActivity),
    emailRow("Created by", createdByName),
    emailRow("Notes", notes),
  ].join("");

  const text = [
    `New CRM lead: ${merchantName}`,
    "",
    `Merchant: ${displayValue(merchantName)}`,
    `Assigned agent: ${displayValue(agentName)}`,
    `Platform: ${displayValue(platformName)}`,
    `Stage: ${displayValue(stageLabel)}`,
    `Priority: ${displayValue(priority)}`,
    `Estimated volume: ${displayValue(estimatedVolume)}`,
    `Contact name: ${displayValue(contactName)}`,
    `Contact email: ${displayValue(contactEmail)}`,
    `Next follow-up: ${displayValue(nextFollowUp)}`,
    `Salesforce status: ${displayValue(salesforceStatus)}`,
    `Last activity: ${displayValue(lastActivity)}`,
    `Created by: ${displayValue(createdByName)}`,
    `Notes: ${displayValue(notes)}`,
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      html: `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5;max-width:680px;margin:0 auto;padding:24px">
          <p style="color:#047857;font-size:13px;font-weight:700;letter-spacing:.08em;margin:0 0 12px;text-transform:uppercase">GreenHub CRM</p>
          <h1 style="font-size:24px;margin:0 0 8px">New CRM lead added</h1>
          <p style="color:#475569;margin:0 0 20px">A new CRM lead was created in the GreenHub Partner Portal.</p>
          <table style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;width:100%">
            <tbody>${rows}</tbody>
          </table>
        </div>
      `,
      subject,
      text,
      to,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new PortalApiError(
      `Resend could not deliver the CRM lead notification${body ? `: ${body}` : "."}`,
      502
    );
  }

  const delivery = (await response.json().catch(() => ({}))) as ResendSuccessResponse;
  console.log("CRM lead notification email accepted by Resend", {
    resendId: delivery.id ?? null,
    to,
  });
}
