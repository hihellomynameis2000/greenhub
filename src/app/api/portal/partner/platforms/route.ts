import { NextRequest, NextResponse } from "next/server";
import {
  optionalString,
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
import type { Platform } from "@/lib/portal/types";

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

    const existing = await supabaseRest<Platform[]>("platforms", {
      query: new URLSearchParams({ select: "*", slug: `eq.${slug}`, limit: "1" }),
    });

    const platforms = existing[0]
      ? await supabaseRest<Platform[]>("platforms", {
          method: "PATCH",
          prefer: "return=representation",
          query: new URLSearchParams({ id: `eq.${existing[0].id}` }),
          body: {
            category,
            description,
            is_active: true,
            last_updated_at: new Date().toISOString(),
            name,
            portal_status: portalStatus,
            slug,
          },
        })
      : await supabaseRest<Platform[]>("platforms", {
          method: "POST",
          prefer: "return=representation",
          body: {
            category,
            description,
            is_active: true,
            name,
            portal_status: portalStatus,
            slug,
          },
        });

    const platform = platforms[0];
    await seedPlatformFolders(platform.id);
    await writeAuditLog(context, "partner_platform.created", "platforms", platform.id, {
      category,
      name,
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
    if (body.isActive !== undefined) updates.is_active = Boolean(body.isActive);

    const platforms = await supabaseRest<Platform[]>("platforms", {
      method: "PATCH",
      prefer: "return=representation",
      query: new URLSearchParams({ id: `eq.${id}` }),
      body: updates,
    });
    const platform = platforms[0];
    if (!platform) return NextResponse.json({ error: "Platform not found." }, { status: 404 });

    await seedPlatformFolders(platform.id);
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
        is_active: false,
        last_updated_at: new Date().toISOString(),
        portal_status: "restricted",
      },
    });
    const platform = platforms[0];
    if (!platform) return NextResponse.json({ error: "Platform not found." }, { status: 404 });

    await writeAuditLog(context, "partner_platform.archived", "platforms", id, {
      name: platform.name,
    });
    return NextResponse.json({ platform });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
