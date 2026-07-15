import { NextRequest, NextResponse } from "next/server";
import {
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import type { Platform } from "@/lib/portal/types";

function normalized(value: string) {
  return value.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    await requirePortalContext(request);
    const query = new URLSearchParams({
      select: "*",
      is_active: "eq.true",
      order: "name.asc",
    });
    const platforms = await supabaseRest<Platform[]>("platforms", { query });
    return NextResponse.json({ platforms });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const name = requiredString(body.name, "Platform name");

    const existing = await supabaseRest<Platform[]>("platforms", {
      query: new URLSearchParams({ select: "*", order: "name.asc" }),
    });
    const match = existing.find((platform) => normalized(platform.name) === normalized(name));

    if (match?.is_active) {
      return NextResponse.json(
        { error: "This processing platform already exists." },
        { status: 409 }
      );
    }

    const platforms = match
      ? await supabaseRest<Platform[]>("platforms", {
          method: "PATCH",
          prefer: "return=representation",
          query: new URLSearchParams({ id: `eq.${match.id}` }),
          body: { is_active: true, name },
        })
      : await supabaseRest<Platform[]>("platforms", {
          method: "POST",
          prefer: "return=representation",
          body: { is_active: true, name },
        });
    const platform = platforms[0];

    await writeAuditLog(context, "platform.created", "platforms", platform.id, { name });
    return NextResponse.json({ platform }, { status: 201 });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const id = requiredString(body.id, "Platform ID");
    const name = requiredString(body.name, "Platform name");

    const platforms = await supabaseRest<Platform[]>("platforms", {
      method: "PATCH",
      prefer: "return=representation",
      query: new URLSearchParams({ id: `eq.${id}` }),
      body: { name },
    });
    const platform = platforms[0];
    if (!platform) return NextResponse.json({ error: "Platform not found." }, { status: 404 });

    await writeAuditLog(context, "platform.updated", "platforms", id, { name });
    return NextResponse.json({ platform });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const id = requiredString(request.nextUrl.searchParams.get("id"), "Platform ID");

    const platforms = await supabaseRest<Platform[]>("platforms", {
      method: "PATCH",
      prefer: "return=representation",
      query: new URLSearchParams({ id: `eq.${id}` }),
      body: { is_active: false },
    });
    const platform = platforms[0];
    if (!platform) return NextResponse.json({ error: "Platform not found." }, { status: 404 });

    await writeAuditLog(context, "platform.archived", "platforms", id, {
      name: platform.name,
    });
    return NextResponse.json({ platform });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
