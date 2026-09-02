import { NextRequest, NextResponse } from "next/server";
import { portalAppUrlForRole, resendConfig, sendPortalAccessEmail } from "@/lib/portal/resend";
import { PortalApiError, portalErrorResponse, supabaseAuthAdmin, supabaseRest } from "@/lib/portal/server";
import { createSignedPortalAuthLink } from "@/lib/portal/signedAuthLink";
import type { AgentProfile } from "@/lib/portal/types";

type RecoveryLinkResponse = {
  action_link?: string;
  id?: string;
  properties?: {
    action_link?: string;
  };
  user?: { id: string };
};

type PortalAccessLink = {
  accessUrl: string;
  authUserId?: string;
  type: "invite" | "recovery";
};

const successResponse = { success: true };

function isMissingAuthUser(error: unknown) {
  return (
    error instanceof PortalApiError &&
    /not found|does not exist|no user|user.*missing|unable to validate email address/i.test(
      error.message
    )
  );
}

function authUserIdFromResponse(response: RecoveryLinkResponse) {
  return response.user?.id ?? response.id;
}

async function generateRecoveryLink(profile: Pick<AgentProfile, "email" | "name" | "role">) {
  const recovery = await supabaseAuthAdmin<RecoveryLinkResponse>("admin/generate_link", {
    type: "recovery",
    email: profile.email,
    redirect_to: `${portalAppUrlForRole(profile.role)}/set-password`,
  });
  const accessUrl = recovery.action_link ?? recovery.properties?.action_link;

  if (!accessUrl) {
    throw new Error("Supabase did not return a password recovery link.");
  }

  return {
    accessUrl,
    authUserId: authUserIdFromResponse(recovery),
    type: "recovery" as const,
  };
}

async function generateInviteLink(profile: Pick<AgentProfile, "email" | "name" | "role">) {
  const invitation = await supabaseAuthAdmin<RecoveryLinkResponse>("admin/generate_link", {
    type: "invite",
    email: profile.email,
    data: { name: profile.name },
    redirect_to: `${portalAppUrlForRole(profile.role)}/set-password`,
  });
  const accessUrl = invitation.action_link ?? invitation.properties?.action_link;

  if (!accessUrl) {
    throw new Error("Supabase did not return a portal setup link.");
  }

  return {
    accessUrl,
    authUserId: authUserIdFromResponse(invitation),
    type: "invite" as const,
  };
}

async function generatePortalAccessLink(
  profile: Pick<AgentProfile, "email" | "name" | "role">
): Promise<PortalAccessLink> {
  try {
    return await generateRecoveryLink(profile);
  } catch (error) {
    if (!isMissingAuthUser(error)) throw error;
    return generateInviteLink(profile);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) return NextResponse.json(successResponse);

  try {
    resendConfig();
    const profiles = await supabaseRest<Pick<AgentProfile, "email" | "id" | "name" | "role">[]>(
      "agent_profiles",
      {
        query: new URLSearchParams({
          select: "id,email,name,role",
          email: `ilike.${email}`,
          limit: "5",
        }),
      }
    );
    const profile = profiles.find((candidate) => candidate.email.toLowerCase() === email);

    if (!profile) return NextResponse.json(successResponse);

    const access = await generatePortalAccessLink(profile);
    if (access.authUserId) {
      await supabaseRest("agent_profiles", {
        method: "PATCH",
        prefer: "return=minimal",
        query: new URLSearchParams({ id: `eq.${profile.id}` }),
        body: { auth_user_id: access.authUserId },
      });
    }

    await sendPortalAccessEmail({
      accessUrl: createSignedPortalAuthLink(access.accessUrl, profile.role),
      name: profile.name,
      role: profile.role,
      to: profile.email,
      type: access.type,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }

  return NextResponse.json(successResponse);
}
