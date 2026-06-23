import { NextRequest, NextResponse } from "next/server";
import {
  decimalValue,
  optionalString,
  portalErrorResponse,
  requirePortalContext,
  requiredInteger,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import type { MonthlyResidual } from "@/lib/portal/types";

function validStatus(value: unknown): value is "draft" | "finalized" {
  return value === "draft" || value === "finalized";
}

function validMonth(value: number) {
  return value >= 1 && value <= 12;
}

function residualPayload(body: Record<string, unknown>) {
  const residualMonth = requiredInteger(body.residualMonth, "Residual month");
  const residualYear = requiredInteger(body.residualYear, "Residual year");
  if (!validMonth(residualMonth)) throw new Error("Residual month must be between 1 and 12.");
  if (residualYear < 2000 || residualYear > 2100) throw new Error("Residual year is invalid.");

  return {
    agent_id: requiredString(body.agentId, "Assigned agent"),
    agent_profit: decimalValue(body.agentProfit),
    equipment_cost: decimalValue(body.equipmentCost),
    greenhub_net_profit: decimalValue(body.greenhubNetProfit),
    merchant_account_id: requiredString(body.merchantAccountId, "Merchant account"),
    monthly_sales_volume: decimalValue(body.monthlySalesVolume),
    one_time_fees: decimalValue(body.oneTimeFees),
    platform_id: optionalString(body.platformId),
    profit_per_transaction: decimalValue(body.profitPerTransaction),
    rebate: decimalValue(body.rebate),
    residual_month: residualMonth,
    residual_status: validStatus(body.residualStatus) ? body.residualStatus : "draft",
    residual_year: residualYear,
    surcharge: decimalValue(body.surcharge),
    transactions_per_month: requiredInteger(body.transactionsPerMonth ?? 0, "Transactions per month"),
  };
}

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
    return NextResponse.json({ residuals });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = (await request.json()) as Record<string, unknown>;
    const payload = residualPayload(body);

    const residuals = await supabaseRest<MonthlyResidual[]>("monthly_residuals", {
      method: "POST",
      prefer: "return=representation",
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

    const residuals = await supabaseRest<MonthlyResidual[]>("monthly_residuals", {
      method: "PATCH",
      prefer: "return=representation",
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
