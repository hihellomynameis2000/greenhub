import { NextRequest, NextResponse } from "next/server";
import { portalAppUrlForRole } from "@/lib/portal/resend";
import {
  PortalApiError,
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseAuthAdmin,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
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

async function generateRecoveryLink(agent: AgentProfile): Promise<PortalAccessLink> {
  const recovery = await supabaseAuthAdmin<RecoveryLinkResponse>("admin/generate_link", {
    type: "recovery",
    email: agent.email,
    redirect_to: `${portalAppUrlForRole(agent.role)}/set-password`,
  });
  const accessUrl = recovery.action_link ?? recovery.properties?.action_link;

  if (!accessUrl) {
    throw new Error("Supabase did not return a password recovery link.");
  }

  return {
    accessUrl,
    authUserId: authUserIdFromResponse(recovery),
    type: "recovery",
  };
}

async function generateInviteLink(agent: AgentProfile): Promise<PortalAccessLink> {
  const invitation = await supabaseAuthAdmin<RecoveryLinkResponse>("admin/generate_link", {
    type: "invite",
    email: agent.email,
    data: { name: agent.name },
    redirect_to: `${portalAppUrlForRole(agent.role)}/set-password`,
  });
  const accessUrl = invitation.action_link ?? invitation.properties?.action_link;

  if (!accessUrl) {
    throw new Error("Supabase did not return a portal setup link.");
  }

  return {
    accessUrl,
    authUserId: authUserIdFromResponse(invitation),
    type: "invite",
  };
}

async function generatePortalAccessLink(agent: AgentProfile) {
  try {
    return await generateRecoveryLink(agent);
  } catch (error) {
    if (!isMissingAuthUser(error)) throw error;
    return generateInviteLink(agent);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const id = requiredString(body.id, "Agent ID");

    const agents = await supabaseRest<AgentProfile[]>("agent_profiles", {
      query: new URLSearchParams({
        select: "*",
        id: `eq.${id}`,
        limit: "1",
      }),
    });
    const agent = agents[0];

    if (!agent || agent.status !== "active") {
      return NextResponse.json({ error: "Active agent profile not found." }, { status: 404 });
    }

    const access = await generatePortalAccessLink(agent);
    if (access.authUserId && access.authUserId !== agent.auth_user_id) {
      await supabaseRest("agent_profiles", {
        method: "PATCH",
        prefer: "return=minimal",
        query: new URLSearchParams({ id: `eq.${agent.id}` }),
        body: { auth_user_id: access.authUserId },
      });
    }

    const resetUrl = createSignedPortalAuthLink(access.accessUrl, agent.role);

    await writeAuditLog(context, "agent.reset_link.created", "agent_profiles", agent.id, {
      email: agent.email,
      role: agent.role,
      type: access.type,
    });

    return NextResponse.json({ resetUrl });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
