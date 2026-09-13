import { NextRequest, NextResponse } from "next/server";
import { portalErrorResponse, requirePortalContext, supabaseRest, writeAuditLog } from "@/lib/portal/server";
import { residualPayload, writeResidual } from "@/lib/portal/residualWrite";
import type { MonthlyResidual } from "@/lib/portal/types";

type ImportBody = {
  entries?: Record<string, unknown>[];
  source?: string;
};

type ResidualMatch = Pick<MonthlyResidual, "id" | "platform_id">;

type ImportError = {
  message: string;
  merchantAccountId: string | null;
  merchantName: string | null;
  row: number | null;
};

function residualMatchQuery(payload: ReturnType<typeof residualPayload>) {
  return new URLSearchParams({
    limit: "20",
    merchant_account_id: `eq.${payload.merchant_account_id}`,
    order: "created_at.desc",
    residual_month: `eq.${payload.residual_month}`,
    residual_year: `eq.${payload.residual_year}`,
    select: "id,platform_id",
  });
}

function importError(entry: Record<string, unknown>, error: unknown): ImportError {
  console.error("Residual import row failed", error);

  return {
    merchantAccountId: typeof entry.merchantAccountId === "string" ? entry.merchantAccountId : null,
    merchantName: typeof entry.sourceMerchantName === "string" ? entry.sourceMerchantName : null,
    row: typeof entry.sourceIndex === "number" ? entry.sourceIndex : null,
    message: "This row could not be saved. Check that the merchant account, agent, and platform are still active.",
  };
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
    const errors: ImportError[] = [];
    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      try {
        const payload = residualPayload(entry);
        const existing = await supabaseRest<ResidualMatch[]>("monthly_residuals", {
          query: residualMatchQuery(payload),
        });
        const match =
          existing.find((row) => row.platform_id === payload.platform_id) ??
          existing.find((row) => !row.platform_id) ??
          existing[0];

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
      } catch (error) {
        errors.push(importError(entry, error));
      }
    }

    if (!residuals.length && errors.length) {
      return NextResponse.json(
        {
          created,
          errors,
          imported: 0,
          requested: entries.length,
          residuals,
          updated,
          error: `No residual rows were imported. ${errors.length} matched rows could not be saved.`,
        },
        { status: 400 }
      );
    }

    await writeAuditLog(context, "residual.imported", "monthly_residuals", context.profile.id, {
      created,
      errors: errors.length,
      imported: residuals.length,
      requested: entries.length,
      source: body.source ?? "monthly residual import",
      updated,
    });

    return NextResponse.json({
      created,
      errors,
      imported: residuals.length,
      requested: entries.length,
      residuals,
      updated,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
