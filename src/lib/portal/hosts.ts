import type { PortalRole } from "./types";

const defaultPartnerHost = "console.greenhub.io";
const defaultAdminHost = "admin.greenhub.io";
const legacyAgentHost = "agents.greenhub.io";

export function partnerPortalHost() {
  return process.env.NEXT_PUBLIC_PORTAL_HOST ?? defaultPartnerHost;
}

export function adminPortalHost() {
  return process.env.ADMIN_PORTAL_HOST ?? defaultAdminHost;
}

export function requestHost(hostHeader: string | null) {
  return (hostHeader ?? "").split(":")[0].toLowerCase();
}

export function portalRoleForHost(host: string): PortalRole | null {
  if (host === adminPortalHost()) return "admin";
  if (host === partnerPortalHost() || host === legacyAgentHost) return "agent";
  return null;
}

export function portalOriginForRole(role: PortalRole) {
  const configuredUrl =
    role === "admin" ? process.env.ADMIN_PORTAL_APP_URL : process.env.PORTAL_APP_URL;

  if (configuredUrl) {
    return new URL(configuredUrl).origin;
  }

  return `https://${role === "admin" ? adminPortalHost() : partnerPortalHost()}`;
}

export function authEmailLinkOrigin(role: PortalRole) {
  const configuredUrl = process.env.PORTAL_AUTH_EMAIL_ORIGIN;
  if (configuredUrl) return new URL(configuredUrl).origin;
  return portalOriginForRole(role);
}

export function roleMismatchMessage(expectedRole: PortalRole) {
  return expectedRole === "admin"
    ? "Use the admin portal domain to sign in as an administrator."
    : "Use the partner portal domain to sign in as an agent.";
}
