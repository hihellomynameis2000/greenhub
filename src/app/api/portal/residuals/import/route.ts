import { NextRequest, NextResponse } from "next/server";
import { portalErrorResponse, requirePortalContext, supabaseRest, writeAuditLog } from "@/lib/portal/server";
import { residualPayload, writeResidual } from "@/lib/portal/residualWrite";
import type { MonthlyResidual } from "@/lib/portal/types";

type ImportBody = {
  entries?: Record<string, unknown>[];
  source?: string;
};

function residualMatchQuery(payload: ReturnType<typeof residualPayload>) {
  const query = new URLSearchParams({
    limit: "1",
    merchant_account_id: `eq.${payload.merchant_account_id}`,
    order: "created_at.desc",
    residual_month: `eq.${payload.residual_month}`,
    residual_year: `eq.${payload.residual_year}`,
    select: "id",
  });

  query.set("platform_id", payload.platform_id ? `eq.${payload.platform_id}` : "is.null");
  return query;
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = (await request.json()) as ImportBody;
    const entries = Array.isArray(body.entries) ? body.entries : [];

    if (!entries.length) {
      return NextResponse.json({ created: 0, imported: 0, residuals: [], updated: 0 });
    }

    if (entries.length > 500) {
      return NextResponse.json(
        { error: "Import is limited to 500 residual rows at a time." },
        { status: 400 }
      );
    }

    const residuals: MonthlyResidual[] = [];
    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const payload = residualPayload(entry);
      const existing = await supabaseRest<{ id: string }[]>("monthly_residuals", {
        query: residualMatchQuery(payload),
      });
      const match = existing[0];

      const result = await writeResidual({
        method: match ? "PATCH" : "POST",
        query: match ? new URLSearchParams({ id: `eq.${match.id}` }) : undefined,
        body: {
          ...payload,
          ...(match ? {} : { created_by: context.profile.id }),
          updated_by: context.profile.id,
        },
      });

      const residual = result[0];
      if (residual) residuals.push(residual);
      if (match) updated += 1;
      else created += 1;
    }

    await writeAuditLog(context, "residual.imported", "monthly_residuals", context.profile.id, {
      created,
      imported: entries.length,
      source: body.source ?? "monthly residual import",
      updated,
    });

    return NextResponse.json({
      created,
      imported: entries.length,
      residuals,
      updated,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
