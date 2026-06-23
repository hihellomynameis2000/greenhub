import "server-only";

import { NextRequest, NextResponse } from "next/server";
import type { AgentProfile, PortalRole } from "./types";

type RestOptions = {
  body?: unknown;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  prefer?: string;
  query?: URLSearchParams;
};

type SupabaseAuthUser = {
  email?: string;
  id: string;
};

export type PortalContext = {
  profile: AgentProfile;
  user: SupabaseAuthUser;
};

export class PortalApiError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message);
  }
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !serviceRoleKey || !anonKey) {
    throw new PortalApiError("Portal database is not configured.", 500);
  }

  return { anonKey, serviceRoleKey, url };
}

function parseResponseError(status: number, text: string) {
  try {
    const body = JSON.parse(text) as {
      error?: string;
      error_description?: string;
      message?: string;
      msg?: string;
    };
    return (
      body.message ||
      body.msg ||
      body.error_description ||
      body.error ||
      "Supabase request failed."
    );
  } catch {
    return text || "Supabase request failed.";
  }
}

export async function supabaseRest<T>(
  table: string,
  { body, method = "GET", prefer, query }: RestOptions = {}
): Promise<T> {
  const { serviceRoleKey, url } = supabaseConfig();
  const queryString = query?.toString();
  const response = await fetch(
    `${url}/rest/v1/${table}${queryString ? `?${queryString}` : ""}`,
    {
      method,
      cache: "no-store",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(prefer ? { Prefer: prefer } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }
  );

  const text = await response.text();
  if (!response.ok) {
    throw new PortalApiError(parseResponseError(response.status, text), response.status);
  }

  return (text ? JSON.parse(text) : null) as T;
}

export async function supabaseAuthAdmin<T>(
  path: string,
  body: unknown
): Promise<T> {
  const { serviceRoleKey, url } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new PortalApiError(parseResponseError(response.status, text), response.status);
  }

  return JSON.parse(text) as T;
}

async function supabaseAuthUser(accessToken: string): Promise<SupabaseAuthUser> {
  const { anonKey, url } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    cache: "no-store",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new PortalApiError("Your portal session has expired. Please sign in again.", 401);
  }

  return JSON.parse(text) as SupabaseAuthUser;
}

export async function requirePortalContext(
  request: NextRequest,
  requiredRole?: PortalRole
): Promise<PortalContext> {
  const authorization = request.headers.get("authorization");
  const accessToken = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

  if (!accessToken) {
    throw new PortalApiError("Sign in is required to access the portal.", 401);
  }

  const user = await supabaseAuthUser(accessToken);
  if (!user.email) {
    throw new PortalApiError("The signed-in user does not have an email address.", 403);
  }

  const query = new URLSearchParams({
    select: "id,auth_user_id,name,email,role,status,commission_rate,created_at,updated_at",
    email: `eq.${user.email}`,
    limit: "1",
  });
  const profiles = await supabaseRest<AgentProfile[]>("agent_profiles", { query });
  const profile = profiles[0];

  if (!profile || profile.status !== "active") {
    throw new PortalApiError("You do not have an active portal profile.", 403);
  }

  if (profile.auth_user_id && profile.auth_user_id !== user.id) {
    throw new PortalApiError("Your authentication account does not match this portal profile.", 403);
  }

  if (!profile.auth_user_id) {
    const updateQuery = new URLSearchParams({ id: `eq.${profile.id}` });
    await supabaseRest("agent_profiles", {
      method: "PATCH",
      query: updateQuery,
      body: { auth_user_id: user.id },
    });
    profile.auth_user_id = user.id;
  }

  if (requiredRole && profile.role !== requiredRole) {
    throw new PortalApiError("You do not have permission to perform this action.", 403);
  }

  return { profile, user };
}

export async function writeAuditLog(
  context: PortalContext,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await supabaseRest("audit_logs", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        actor_id: context.profile.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}

export function portalErrorResponse(error: unknown) {
  if (error instanceof PortalApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Portal API error", error);
  return NextResponse.json({ error: "Unexpected portal server error." }, { status: 500 });
}

export function requiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new PortalApiError(`${fieldName} is required.`, 400);
  }

  return value.trim();
}

export function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function requiredInteger(value: unknown, fieldName: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    throw new PortalApiError(`${fieldName} must be a whole number.`, 400);
  }

  return parsed;
}

export function decimalValue(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(parsed)) {
    throw new PortalApiError("Residual amounts must be valid numbers.", 400);
  }

  return parsed;
}
