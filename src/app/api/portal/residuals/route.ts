import { NextRequest, NextResponse } from "next/server";
import {
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import { visibleResidualsForRole } from "@/lib/portal/residualVisibility";
import { residualPayload, writeResidual } from "@/lib/portal/residualWrite";
import type { MonthlyResidual } from "@/lib/portal/types";

export async function GET(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    const query = new URLSearchParams({
      select: "*",
      order: "residual_year.desc,residual_month.desc,created_at.desc",
    });
    const requestedStatus = request.nextUrl.searchParams.get("status");

    if (context.profile.role === "agent") {
      query.set("agent_id", `eq.${context.profile.id}`);
      query.set("residual_status", "eq.finalized");
    } else if (requestedStatus === "draft" || requestedStatus === "finalized") {
      query.set("residual_status", `eq.${requestedStatus}`);
    }

    const residuals = await supabaseRest<MonthlyResidual[]>("monthly_residuals", { query });
    return NextResponse.json({
      residuals: visibleResidualsForRole(residuals, context.profile.role),
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = (await request.json()) as Record<string, unknown>;
    const payload = residualPayload(body);

    const residuals = await writeResidual({
      method: "POST",
      body: {
        ...payload,
        created_by: context.profile.id,
        updated_by: context.profile.id,
      },
    });
    const residual = residuals[0];
    await writeAuditLog(context, "residual.created", "monthly_residuals", residual.id, {
      merchantAccountId: payload.merchant_account_id,
      status: payload.residual_status,
    });

    return NextResponse.json({ residual }, { status: 201 });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = (await request.json()) as Record<string, unknown>;
    const id = requiredString(body.id, "Residual ID");
    const payload = residualPayload(body);
    const query = new URLSearchParams({ id: `eq.${id}` });

    const residuals = await writeResidual({
      method: "PATCH",
      query,
      body: { ...payload, updated_by: context.profile.id },
    });
    const residual = residuals[0];
    if (!residual) return NextResponse.json({ error: "Residual entry not found." }, { status: 404 });

    await writeAuditLog(context, "residual.updated", "monthly_residuals", id, {
      status: payload.residual_status,
    });
    return NextResponse.json({ residual });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const id = requiredString(request.nextUrl.searchParams.get("id"), "Residual ID");
    const query = new URLSearchParams({ id: `eq.${id}`, residual_status: "eq.draft" });
    const residuals = await supabaseRest<MonthlyResidual[]>("monthly_residuals", {
      method: "DELETE",
      prefer: "return=representation",
      query,
    });
    const residual = residuals[0];
    if (!residual) {
      return NextResponse.json(
        { error: "Only existing draft residuals can be deleted." },
        { status: 404 }
      );
    }

    await writeAuditLog(context, "residual.deleted", "monthly_residuals", id);
    return NextResponse.json({ deletedId: id });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
