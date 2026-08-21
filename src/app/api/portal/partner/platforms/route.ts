import { NextRequest, NextResponse } from "next/server";
import {
  optionalString,
  PortalApiError,
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import {
  assertPartnerLibraryAvailable,
  fetchPartnerLibrary,
  normalizePortalStatus,
  seedPlatformFolders,
  slugify,
} from "@/lib/portal/partner";
import { normalizeResidualPlatformType } from "@/lib/portal/residualType";
import type { Platform } from "@/lib/portal/types";

type PlatformWriteOptions = {
  body: Record<string, unknown>;
  method: "PATCH" | "POST";
  query?: URLSearchParams;
};

function residualTypeColumnMissing(error: unknown) {
  return (
    error instanceof PortalApiError &&
    /residual_type|schema cache|column/i.test(error.message)
  );
}

async function writePlatform({ body, method, query }: PlatformWriteOptions) {
  try {
    return await supabaseRest<Platform[]>("platforms", {
      method,
      prefer: "return=representation",
      query,
      body,
    });
  } catch (error) {
    if (!residualTypeColumnMissing(error)) throw error;
    const { residual_type: _residualType, ...fallbackBody } = body;

    return supabaseRest<Platform[]>("platforms", {
      method,
      prefer: "return=representation",
      query,
      body: fallbackBody,
    });
  }
}

async function restrictPlatformAccess(platformId: string, actorId: string) {
  await supabaseRest("agent_platform_access", {
    method: "PATCH",
    prefer: "return=minimal",
    query: new URLSearchParams({ platform_id: `eq.${platformId}` }),
    body: {
      can_view: false,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    },
  });
}

async function restoreDefaultPlatformAccess(platformId: string, actorId: string) {
  const body = {
    actor_id: actorId,
    platform_id: platformId,
  };

  try {
    await supabaseRest("rpc/restore_default_platform_access", {
      method: "POST",
      body,
    });
    return;
  } catch {
    // Fall through to the direct table updates for databases without the helper RPC.
  }

  const [agents, folders] = await Promise.all([
    supabaseRest<{ id: string }[]>("agent_profiles", {
      query: new URLSearchParams({
        select: "id",
        role: "eq.agent",
        status: "eq.active",
      }),
    }),
    supabaseRest<{ folder_key: string; id: string }[]>("platform_resource_folders", {
      query: new URLSearchParams({
        select: "id,folder_key",
        platform_id: `eq.${platformId}`,
        is_active: "eq.true",
      }),
    }),
  ]);

  if (!agents.length || !folders.length) return;

  await supabaseRest("agent_platform_access", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    query: new URLSearchParams({ on_conflict: "agent_id,folder_id" }),
    body: agents.flatMap((agent) =>
      folders.map((folder) => ({
        agent_id: agent.id,
        can_view: folder.folder_key !== "schedule-a",
        folder_id: folder.id,
        platform_id: platformId,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      }))
    ),
  });
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    try {
      const library = await fetchPartnerLibrary(context);
      return NextResponse.json(library);
    } catch (error) {
      assertPartnerLibraryAvailable(error);
    }
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const name = requiredString(body.name, "Platform name");
    const slug = slugify(optionalString(body.slug) ?? name);
    const category = optionalString(body.category) ?? "Other";
    const description = optionalString(body.description);
    const portalStatus = normalizePortalStatus(body.status ?? body.portalStatus);
    const residualType = normalizeResidualPlatformType(body.residualType ?? body.residual_type);

    const existing = await supabaseRest<Platform[]>("platforms", {
      query: new URLSearchParams({ select: "*", slug: `eq.${slug}`, limit: "1" }),
    });

    const platforms = existing[0]
      ? await writePlatform({
          method: "PATCH",
          query: new URLSearchParams({ id: `eq.${existing[0].id}` }),
          body: {
            category,
            description,
            is_active: true,
            last_updated_at: new Date().toISOString(),
            name,
            portal_status: portalStatus,
            residual_type: residualType,
            slug,
          },
        })
      : await writePlatform({
          method: "POST",
          body: {
            category,
            description,
            is_active: true,
            name,
            portal_status: portalStatus,
            residual_type: residualType,
            slug,
          },
        });

    const platform = platforms[0];
    await seedPlatformFolders(platform.id);
    await writeAuditLog(context, "partner_platform.created", "platforms", platform.id, {
      category,
      name,
      residualType,
      slug,
    });

    return NextResponse.json({ platform }, { status: existing[0] ? 200 : 201 });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const id = requiredString(body.id, "Platform ID");
    const updates: Record<string, unknown> = {
      last_updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      const name = requiredString(body.name, "Platform name");
      updates.name = name;
      updates.slug = slugify(optionalString(body.slug) ?? name);
    }
    if (body.category !== undefined) updates.category = optionalString(body.category) ?? "Other";
    if (body.description !== undefined) updates.description = optionalString(body.description);
    if (body.status !== undefined || body.portalStatus !== undefined) {
      updates.portal_status = normalizePortalStatus(body.status ?? body.portalStatus);
    }
    if (body.residualType !== undefined || body.residual_type !== undefined) {
      updates.residual_type = normalizeResidualPlatformType(body.residualType ?? body.residual_type);
    }
    if (body.isActive !== undefined) updates.is_active = Boolean(body.isActive);

    const platforms = await writePlatform({
      method: "PATCH",
      query: new URLSearchParams({ id: `eq.${id}` }),
      body: updates,
    });
    const platform = platforms[0];
    if (!platform) return NextResponse.json({ error: "Platform not found." }, { status: 404 });

    await seedPlatformFolders(platform.id);
    if (body.restoreAccess === true && platform.is_active && platform.portal_status === "active") {
      await restoreDefaultPlatformAccess(platform.id, context.profile.id);
    }
    await writeAuditLog(context, "partner_platform.updated", "platforms", id, updates);
    return NextResponse.json({ platform });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const id = requiredString(request.nextUrl.searchParams.get("id"), "Platform ID");
    const hardDelete = request.nextUrl.searchParams.get("mode") === "delete";

    if (hardDelete) {
      const platforms = await supabaseRest<Platform[]>("platforms", {
        method: "DELETE",
        prefer: "return=representation",
        query: new URLSearchParams({ id: `eq.${id}` }),
      });
      const platform = platforms[0];
      if (!platform) return NextResponse.json({ error: "Platform not found." }, { status: 404 });

      await writeAuditLog(context, "partner_platform.deleted", "platforms", id, {
        name: platform.name,
      });
      return NextResponse.json({ platform });
    }

    const platforms = await supabaseRest<Platform[]>("platforms", {
      method: "PATCH",
      prefer: "return=representation",
      query: new URLSearchParams({ id: `eq.${id}` }),
      body: {
        is_active: true,
        last_updated_at: new Date().toISOString(),
        portal_status: "restricted",
      },
    });
    const platform = platforms[0];
    if (!platform) return NextResponse.json({ error: "Platform not found." }, { status: 404 });

    await restrictPlatformAccess(id, context.profile.id);
    await writeAuditLog(context, "partner_platform.archived", "platforms", id, {
      name: platform.name,
    });
    return NextResponse.json({ platform });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
