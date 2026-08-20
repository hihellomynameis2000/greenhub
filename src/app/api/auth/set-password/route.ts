import { createClient, type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { portalOriginForRole } from "@/lib/portal/hosts";
import { portalErrorResponse, PortalApiError, requiredString, supabaseRest } from "@/lib/portal/server";
import { verifySignedPortalPasswordState } from "@/lib/portal/signedAuthLink";
import type { AgentProfile } from "@/lib/portal/types";

type AuthUserUpdateResponse = {
  email?: string;
  id: string;
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new PortalApiError("Portal authentication is not configured.", 500);
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
    return body.message || body.msg || body.error_description || body.error || "Auth request failed.";
  } catch {
    return text || `Auth request failed with status ${status}.`;
  }
}

async function updateAuthPassword(userId: string, password: string) {
  const { serviceRoleKey, url } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    cache: "no-store",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_confirm: true,
      password,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new PortalApiError(parseResponseError(response.status, text), response.status);
  }

  return JSON.parse(text) as AuthUserUpdateResponse;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const state = requiredString(body?.state, "Password link");
    const password = requiredString(body?.password, "Password");

    if (password.length < 8) {
      throw new PortalApiError("Choose a password with at least 8 characters.", 400);
    }

    const payload = verifySignedPortalPasswordState(state);
    const { anonKey, url } = supabaseConfig();
    const supabase = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: payload.tokenHash,
      type: payload.verificationType as EmailOtpType,
    });

    if (error || !data.user?.id || !data.user.email) {
      throw new PortalApiError("This secure link is invalid or has expired.", 400);
    }

    const email = data.user.email.toLowerCase();
    const profiles = await supabaseRest<Pick<AgentProfile, "auth_user_id" | "email" | "id" | "role" | "status">[]>(
      "agent_profiles",
      {
        query: new URLSearchParams({
          select: "id,email,role,status,auth_user_id",
          email: `ilike.${email}`,
          limit: "5",
        }),
      }
    );
    const profile = profiles.find((candidate) => candidate.email.toLowerCase() === email);

    if (!profile || profile.status !== "active" || profile.role !== payload.role) {
      throw new PortalApiError("This secure link is invalid or has expired.", 400);
    }

    if (profile.auth_user_id && profile.auth_user_id !== data.user.id) {
      throw new PortalApiError("This secure link is invalid or has expired.", 400);
    }

    if (!profile.auth_user_id) {
      await supabaseRest("agent_profiles", {
        method: "PATCH",
        query: new URLSearchParams({ id: `eq.${profile.id}` }),
        body: { auth_user_id: data.user.id },
      });
    }

    const updatedUser = await updateAuthPassword(data.user.id, password);

    return NextResponse.json({
      email: updatedUser.email ?? data.user.email,
      redirectTo: `${portalOriginForRole(payload.role)}/login?password=updated`,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
