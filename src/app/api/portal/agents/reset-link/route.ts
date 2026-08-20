import { NextRequest, NextResponse } from "next/server";
import { portalAppUrlForRole } from "@/lib/portal/resend";
import {
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
  properties?: {
    action_link?: string;
  };
};

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

    const recovery = await supabaseAuthAdmin<RecoveryLinkResponse>("admin/generate_link", {
      type: "recovery",
      email: agent.email,
      redirect_to: `${portalAppUrlForRole(agent.role)}/set-password`,
    });
    const accessUrl = recovery.action_link ?? recovery.properties?.action_link;

    if (!accessUrl) {
      throw new Error("Supabase did not return a password recovery link.");
    }

    const resetUrl = createSignedPortalAuthLink(accessUrl, agent.role);

    await writeAuditLog(context, "agent.reset_link.created", "agent_profiles", agent.id, {
      email: agent.email,
      role: agent.role,
    });

    return NextResponse.json({ resetUrl });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
