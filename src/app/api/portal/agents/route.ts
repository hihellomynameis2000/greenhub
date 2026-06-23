import { NextRequest, NextResponse } from "next/server";
import {
  decimalValue,
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseAuthAdmin,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import type { AgentProfile } from "@/lib/portal/types";

type InviteResponse = {
  id?: string;
  user?: { id: string };
};

function validRole(value: unknown): value is "admin" | "agent" {
  return value === "admin" || value === "agent";
}

function validStatus(value: unknown): value is "active" | "inactive" {
  return value === "active" || value === "inactive";
}

function commissionRate(value: unknown) {
  if (typeof value === "string") return decimalValue(value.replace("%", ""));
  return decimalValue(value);
}

export async function GET(request: NextRequest) {
  try {
    await requirePortalContext(request, "admin");
    const query = new URLSearchParams({ select: "*", order: "name.asc" });
    const agents = await supabaseRest<AgentProfile[]>("agent_profiles", { query });
    return NextResponse.json({ agents });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const name = requiredString(body.name, "Full name");
    const email = requiredString(body.email, "Email address").toLowerCase();
    const role = validRole(body.role) ? body.role : "agent";
    const status = validStatus(body.status) ? body.status : "active";
    const rate = commissionRate(body.commissionRate);

    const existingQuery = new URLSearchParams({
      select: "id",
      email: `eq.${email}`,
      limit: "1",
    });
    const existing = await supabaseRest<{ id: string }[]>("agent_profiles", {
      query: existingQuery,
    });
    if (existing.length) {
      return NextResponse.json(
        { error: "A portal profile already exists for this email address." },
        { status: 409 }
      );
    }

    const invitation = await supabaseAuthAdmin<InviteResponse>("invite", {
      email,
      data: { name },
    });
    const authUserId = invitation.user?.id ?? invitation.id;
    if (!authUserId) {
      throw new Error("Supabase did not return an invited user ID.");
    }

    const profiles = await supabaseRest<AgentProfile[]>("agent_profiles", {
      method: "POST",
      prefer: "return=representation",
      body: {
        auth_user_id: authUserId,
        commission_rate: rate,
        email,
        name,
        role,
        status,
      },
    });
    const agent = profiles[0];
    await writeAuditLog(context, "agent.created", "agent_profiles", agent.id, {
      email,
      role,
    });

    return NextResponse.json({ agent, invitationSent: true }, { status: 201 });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const id = requiredString(body.id, "Agent ID");
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = requiredString(body.name, "Full name");
    if (body.status !== undefined) {
      if (!validStatus(body.status)) throw new Error("Invalid agent status.");
      updates.status = body.status;
    }
    if (body.role !== undefined) {
      if (!validRole(body.role)) throw new Error("Invalid agent role.");
      updates.role = body.role;
    }
    if (body.commissionRate !== undefined) {
      updates.commission_rate = commissionRate(body.commissionRate);
    }
    if (body.email !== undefined) updates.email = requiredString(body.email, "Email address").toLowerCase();
    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "No agent changes were provided." }, { status: 400 });
    }

    const query = new URLSearchParams({ id: `eq.${id}` });
    const agents = await supabaseRest<AgentProfile[]>("agent_profiles", {
      method: "PATCH",
      prefer: "return=representation",
      query,
      body: updates,
    });
    const agent = agents[0];
    if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });

    await writeAuditLog(context, "agent.updated", "agent_profiles", id, updates);
    return NextResponse.json({ agent });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const id = requiredString(body.id, "Agent ID");

    if (id === context.profile.id) {
      return NextResponse.json(
        { error: "You cannot delete your own administrator profile." },
        { status: 400 }
      );
    }

    const agentQuery = new URLSearchParams({
      select: "id,auth_user_id,name,email,role,status,commission_rate,created_at,updated_at",
      id: `eq.${id}`,
      limit: "1",
    });
    const existingAgents = await supabaseRest<AgentProfile[]>("agent_profiles", {
      query: agentQuery,
    });
    const agent = existingAgents[0];

    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    if (agent.role === "admin" && agent.status === "active") {
      const activeAdminQuery = new URLSearchParams({
        select: "id",
        role: "eq.admin",
        status: "eq.active",
      });
      const activeAdmins = await supabaseRest<{ id: string }[]>("agent_profiles", {
        query: activeAdminQuery,
      });

      if (activeAdmins.length <= 1) {
        return NextResponse.json(
          { error: "At least one active administrator must remain in the portal." },
          { status: 400 }
        );
      }
    }

    const relationshipQueries = [
      ["residual_merchant_accounts", "assigned_agent_id"],
      ["monthly_residuals", "agent_id"],
      ["residual_notifications", "agent_id"],
    ] as const;
    const relationships = await Promise.all(
      relationshipQueries.map(([table, column]) =>
        supabaseRest<{ id: string }[]>(table, {
          query: new URLSearchParams({
            select: "id",
            [column]: `eq.${id}`,
            limit: "1",
          }),
        })
      )
    );

    if (relationships.some((records) => records.length > 0)) {
      return NextResponse.json(
        {
          error:
            "This agent has assigned accounts, residuals, or notifications. Set the profile to inactive instead to preserve reporting history.",
        },
        { status: 409 }
      );
    }

    const deletedAgents = await supabaseRest<AgentProfile[]>("agent_profiles", {
      method: "DELETE",
      prefer: "return=representation",
      query: new URLSearchParams({ id: `eq.${id}` }),
    });
    const deletedAgent = deletedAgents[0];

    if (!deletedAgent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    await writeAuditLog(context, "agent.deleted", "agent_profiles", id, {
      email: deletedAgent.email,
      name: deletedAgent.name,
    });

    return NextResponse.json({ agent: deletedAgent });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
