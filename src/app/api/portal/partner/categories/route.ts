import { NextRequest, NextResponse } from "next/server";
import {
  optionalString,
  portalErrorResponse,
  requirePortalContext,
  requiredInteger,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import type { Platform, PlatformCategory } from "@/lib/portal/types";

function cleanCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function GET(request: NextRequest) {
  try {
    await requirePortalContext(request);
    const categories = await supabaseRest<PlatformCategory[]>("platform_categories", {
      query: new URLSearchParams({
        select: "*",
        order: "sort_order.asc,name.asc",
      }),
    });

    return NextResponse.json({ categories });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const name = cleanCategoryName(requiredString(body.name, "Category name"));
    const sortOrder =
      body.sortOrder === undefined ? 100 : requiredInteger(body.sortOrder, "Sort order");

    const existing = await supabaseRest<PlatformCategory[]>("platform_categories", {
      query: new URLSearchParams({
        select: "*",
        name: `ilike.${name}`,
        limit: "5",
      }),
    });
    const existingCategory = existing.find(
      (category) => category.name.toLowerCase() === name.toLowerCase()
    );

    if (existingCategory) {
      return NextResponse.json({ category: existingCategory });
    }

    const categories = await supabaseRest<PlatformCategory[]>("platform_categories", {
      method: "POST",
      prefer: "return=representation",
      body: {
        name,
        sort_order: sortOrder,
      },
    });
    const category = categories[0];

    await writeAuditLog(context, "platform_category.created", "platform_categories", category.id, {
      name,
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const id = optionalString(request.nextUrl.searchParams.get("id"));
    const name = optionalString(request.nextUrl.searchParams.get("name"));

    if (!id && !name) {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }

    const categoryQuery = new URLSearchParams({
      select: "*",
      limit: "1",
    });
    if (id) categoryQuery.set("id", `eq.${id}`);
    if (name) categoryQuery.set("name", `eq.${name}`);

    const categories = await supabaseRest<PlatformCategory[]>("platform_categories", {
      query: categoryQuery,
    });
    const category = categories[0];
    if (!category) return NextResponse.json({ error: "Category not found." }, { status: 404 });

    const platforms = await supabaseRest<Pick<Platform, "id">[]>("platforms", {
      query: new URLSearchParams({
        select: "id",
        category: `eq.${category.name}`,
        is_active: "eq.true",
        limit: "1",
      }),
    });

    if (platforms.length) {
      return NextResponse.json(
        { error: "Move or delete platforms in this category before deleting it." },
        { status: 409 }
      );
    }

    await supabaseRest<PlatformCategory[]>("platform_categories", {
      method: "DELETE",
      prefer: "return=representation",
      query: new URLSearchParams({ id: `eq.${category.id}` }),
    });

    await writeAuditLog(context, "platform_category.deleted", "platform_categories", category.id, {
      name: category.name,
    });
    return NextResponse.json({ category });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
