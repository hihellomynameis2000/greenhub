import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { authEmailLinkOrigin } from "./hosts";
import { PortalApiError } from "./server";
import type { PortalRole } from "./types";

const AUTH_LINK_TTL_SECONDS = 60 * 60;

type LegacySignedAuthPayload = {
  exp: number;
  url: string;
};

export type SignedPasswordPayload = {
  exp: number;
  role: PortalRole;
  tokenHash: string;
  verificationType: "invite" | "recovery";
};

function authSecret() {
  const secret = process.env.PORTAL_AUTH_SECRET;
  if (!secret) {
    throw new PortalApiError("Portal auth links are not configured.", 500);
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", authSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function supabaseAuthHost() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new PortalApiError("Portal auth links are not configured.", 500);
  return new URL(supabaseUrl).hostname;
}

export function createSignedPortalAuthLink(actionUrl: string, role: PortalRole) {
  const target = new URL(actionUrl);

  if (target.hostname !== supabaseAuthHost() || !target.pathname.startsWith("/auth/v1/verify")) {
    throw new PortalApiError("Portal auth link target is invalid.", 500);
  }

  const tokenHash = target.searchParams.get("token");
  const verificationType = target.searchParams.get("type");
  if (!tokenHash || (verificationType !== "invite" && verificationType !== "recovery")) {
    throw new PortalApiError("Portal auth link target is invalid.", 500);
  }

  const payload: SignedPasswordPayload = {
    exp: Date.now() + AUTH_LINK_TTL_SECONDS * 1000,
    role,
    tokenHash,
    verificationType,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const state = `${encodedPayload}.${sign(encodedPayload)}`;
  const url = new URL("/set-password", authEmailLinkOrigin(role));
  url.searchParams.set("state", state);
  return url.toString();
}

export function verifySignedPortalPasswordState(state: string | null) {
  if (!state) throw new PortalApiError("This secure link is invalid or has expired.", 400);

  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature || !safeEqual(sign(encodedPayload), signature)) {
    throw new PortalApiError("This secure link is invalid or has expired.", 400);
  }

  let payload: Partial<SignedPasswordPayload>;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<SignedPasswordPayload>;
  } catch {
    throw new PortalApiError("This secure link is invalid or has expired.", 400);
  }

  if (
    !payload.exp ||
    payload.exp <= Date.now() ||
    !payload.tokenHash ||
    (payload.verificationType !== "invite" && payload.verificationType !== "recovery") ||
    (payload.role !== "admin" && payload.role !== "agent")
  ) {
    throw new PortalApiError("This secure link is invalid or has expired.", 400);
  }

  return payload as SignedPasswordPayload;
}

export function verifySignedPortalAuthLink(state: string | null) {
  if (!state) throw new PortalApiError("This secure link is invalid or has expired.", 400);

  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature || !safeEqual(sign(encodedPayload), signature)) {
    throw new PortalApiError("This secure link is invalid or has expired.", 400);
  }

  let payload: LegacySignedAuthPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as LegacySignedAuthPayload;
  } catch {
    throw new PortalApiError("This secure link is invalid or has expired.", 400);
  }

  if (payload.exp <= Date.now()) {
    throw new PortalApiError("This secure link is invalid or has expired.", 400);
  }

  const target = new URL(payload.url);
  if (target.hostname !== supabaseAuthHost() || !target.pathname.startsWith("/auth/v1/verify")) {
    throw new PortalApiError("This secure link is invalid or has expired.", 400);
  }

  return target.toString();
}
