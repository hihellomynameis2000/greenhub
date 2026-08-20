import { NextRequest, NextResponse } from "next/server";
import {
  PortalApiError,
  portalErrorResponse,
  requirePortalContext,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import type { AgentPlatformAccess, AgentProfile, PlatformResourceFolder } from "@/lib/portal/types";

type AccessRuleInput = {
  agentId?: unknown;
  canView?: unknown;
  folderId?: unknown;
  platformId?: unknown;
};

function accessRule(rule: AccessRuleInput, actorId: string) {
  if (typeof rule.agentId !== "string" || !rule.agentId.trim()) return null;
  if (typeof rule.folderId !== "string" || !rule.folderId.trim()) return null;
  if (typeof rule.platformId !== "string" || !rule.platformId.trim()) return null;

  return {
    agent_id: rule.agentId.trim(),
    can_view: Boolean(rule.canView),
    folder_id: rule.folderId.trim(),
    platform_id: rule.platformId.trim(),
    updated_at: new Date().toISOString(),
    updated_by: actorId,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requirePortalContext(request, "admin");
    const query = new URLSearchParams({
      select: "*",
      order: "created_at.desc",
    });
    const platformId = request.nextUrl.searchParams.get("platformId");
    const agentId = request.nextUrl.searchParams.get("agentId");
    if (platformId) query.set("platform_id", `eq.${platformId}`);
    if (agentId) query.set("agent_id", `eq.${agentId}`);

    const access = await supabaseRest<AgentPlatformAccess[]>("agent_platform_access", { query });
    return NextResponse.json({ access });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = (await request.json()) as { rules?: AccessRuleInput[] };
    const rules = (Array.isArray(body.rules) ? body.rules : [])
      .map((rule) => accessRule(rule, context.profile.id))
      .filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));

    if (!rules.length) {
      return NextResponse.json({ error: "At least one access rule is required." }, { status: 400 });
    }

    const agentIds = Array.from(new Set(rules.map((rule) => rule.agent_id)));
    const folderIds = Array.from(new Set(rules.map((rule) => rule.folder_id)));

    const [agents, folders] = await Promise.all([
      supabaseRest<Pick<AgentProfile, "id" | "role" | "status">[]>("agent_profiles", {
        query: new URLSearchParams({
          select: "id,role,status",
          id: `in.(${agentIds.join(",")})`,
        }),
      }),
      supabaseRest<Pick<PlatformResourceFolder, "id" | "platform_id">[]>("platform_resource_folders", {
        query: new URLSearchParams({
          select: "id,platform_id",
          id: `in.(${folderIds.join(",")})`,
        }),
      }),
    ]);

    const validAgentIds = new Set(
      agents
        .filter((agent) => agent.role === "agent" && agent.status === "active")
        .map((agent) => agent.id)
    );
    const folderPlatform = new Map(folders.map((folder) => [folder.id, folder.platform_id]));

    if (validAgentIds.size !== agentIds.length) {
      throw new PortalApiError("Access rules can only be saved for active agent profiles.", 400);
    }
    if (
      folders.length !== folderIds.length ||
      rules.some((rule) => folderPlatform.get(rule.folder_id) !== rule.platform_id)
    ) {
      throw new PortalApiError("Folder access rules do not match the selected platform.", 400);
    }

    const access = await supabaseRest<AgentPlatformAccess[]>("agent_platform_access", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      query: new URLSearchParams({ on_conflict: "agent_id,folder_id" }),
      body: rules.map((rule) => ({
        ...rule,
        created_by: context.profile.id,
      })),
    });

    await writeAuditLog(context, "platform_access.updated", "agent_platform_access", context.profile.id, {
      ruleCount: access.length,
    });
    return NextResponse.json({ access });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
