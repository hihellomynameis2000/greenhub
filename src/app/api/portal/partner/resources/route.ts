import { NextRequest, NextResponse } from "next/server";
import {
  optionalString,
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import type { PlatformResource } from "@/lib/portal/types";

function validResourceType(value: unknown): "document" | "link" | "note" {
  if (value === "link" || value === "note") return value;
  return "document";
}

function resourcePayload(body: Record<string, unknown>, actorId: string) {
  return {
    description: optionalString(body.description),
    external_url: optionalString(body.externalUrl),
    file_name: optionalString(body.fileName),
    file_size:
      typeof body.fileSize === "number" && Number.isFinite(body.fileSize)
        ? Math.trunc(body.fileSize)
        : null,
    folder_id: requiredString(body.folderId, "Folder"),
    is_active: body.isActive === undefined ? true : Boolean(body.isActive),
    platform_id: requiredString(body.platformId, "Platform"),
    resource_type: validResourceType(body.resourceType),
    sort_order:
      typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
        ? Math.trunc(body.sortOrder)
        : 0,
    storage_bucket: optionalString(body.storageBucket),
    storage_path: optionalString(body.storagePath),
    title: requiredString(body.title, "Resource title"),
    updated_by: actorId,
  };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    const folderId = request.nextUrl.searchParams.get("folderId");
    const platformId = request.nextUrl.searchParams.get("platformId");
    const query = new URLSearchParams({
      select: "*",
      is_active: "eq.true",
      order: "sort_order.asc,title.asc",
    });

    if (folderId) query.set("folder_id", `eq.${folderId}`);
    if (platformId) query.set("platform_id", `eq.${platformId}`);

    const resources = await supabaseRest<PlatformResource[]>("platform_resources", { query });

    if (context.profile.role === "admin" || !folderId) {
      return NextResponse.json({ resources });
    }

    const accessRows = await supabaseRest<{ can_view: boolean }[]>("agent_platform_access", {
      query: new URLSearchParams({
        select: "can_view",
        agent_id: `eq.${context.profile.id}`,
        folder_id: `eq.${folderId}`,
        limit: "1",
      }),
    });

    if (accessRows[0]?.can_view === false) {
      return NextResponse.json({ error: "You do not have access to this folder." }, { status: 403 });
    }

    return NextResponse.json({ resources });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = (await request.json()) as Record<string, unknown>;
    const payload = resourcePayload(body, context.profile.id);

    const resources = await supabaseRest<PlatformResource[]>("platform_resources", {
      method: "POST",
      prefer: "return=representation",
      body: {
        ...payload,
        created_by: context.profile.id,
      },
    });
    const resource = resources[0];

    await writeAuditLog(context, "platform_resource.created", "platform_resources", resource.id, {
      folderId: payload.folder_id,
      platformId: payload.platform_id,
      title: payload.title,
    });

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = (await request.json()) as Record<string, unknown>;
    const id = requiredString(body.id, "Resource ID");
    const payload = resourcePayload(body, context.profile.id);

    const resources = await supabaseRest<PlatformResource[]>("platform_resources", {
      method: "PATCH",
      prefer: "return=representation",
      query: new URLSearchParams({ id: `eq.${id}` }),
      body: payload,
    });
    const resource = resources[0];
    if (!resource) return NextResponse.json({ error: "Resource not found." }, { status: 404 });

    await writeAuditLog(context, "platform_resource.updated", "platform_resources", id, {
      title: payload.title,
    });
    return NextResponse.json({ resource });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const id = requiredString(request.nextUrl.searchParams.get("id"), "Resource ID");

    const resources = await supabaseRest<PlatformResource[]>("platform_resources", {
      method: "PATCH",
      prefer: "return=representation",
      query: new URLSearchParams({ id: `eq.${id}` }),
      body: { is_active: false, updated_by: context.profile.id },
    });
    const resource = resources[0];
    if (!resource) return NextResponse.json({ error: "Resource not found." }, { status: 404 });

    await writeAuditLog(context, "platform_resource.archived", "platform_resources", id, {
      title: resource.title,
    });
    return NextResponse.json({ resource });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
