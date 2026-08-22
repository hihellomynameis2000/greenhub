import "server-only";

import {
  decimalValue,
  PortalApiError,
  optionalString,
  requiredInteger,
  requiredString,
  supabaseRest,
} from "./server";
import type { MonthlyResidual } from "./types";

export function validResidualStatus(value: unknown): value is "draft" | "finalized" {
  return value === "draft" || value === "finalized";
}

function validMonth(value: number) {
  return value >= 1 && value <= 12;
}

export function residualPayload(body: Record<string, unknown>) {
  const residualMonth = requiredInteger(body.residualMonth, "Residual month");
  const residualYear = requiredInteger(body.residualYear, "Residual year");
  if (!validMonth(residualMonth)) throw new PortalApiError("Residual month must be between 1 and 12.", 400);
  if (residualYear < 2000 || residualYear > 2100) throw new PortalApiError("Residual year is invalid.", 400);

  return {
    agent_id: requiredString(body.agentId, "Assigned agent"),
    agent_commission_structure: optionalString(body.agentCommissionStructure),
    agent_profit: decimalValue(body.agentProfit),
    equipment_cost: decimalValue(body.equipmentCost),
    greenhub_net_profit: decimalValue(body.greenhubNetProfit),
    greenhub_pob_buy_rate: decimalValue(body.greenhubPobBuyRate),
    greenhub_pob_net_profit: decimalValue(body.greenhubPobNetProfit),
    greenhub_pob_profit_per_transaction: decimalValue(body.greenhubPobProfitPerTransaction),
    merchant_notes: optionalString(body.merchantNotes),
    merchant_account_id: requiredString(body.merchantAccountId, "Merchant account"),
    monthly_sales_volume: decimalValue(body.monthlySalesVolume),
    one_time_fees: decimalValue(body.oneTimeFees),
    platform_id: optionalString(body.platformId),
    pos_integration_fee: decimalValue(body.posIntegrationFee),
    profit_per_transaction: decimalValue(body.profitPerTransaction),
    rebate: decimalValue(body.rebate),
    residual_month: residualMonth,
    residual_status: validResidualStatus(body.residualStatus) ? body.residualStatus : "draft",
    residual_year: residualYear,
    surcharge: decimalValue(body.surcharge),
    transactions_per_month: requiredInteger(body.transactionsPerMonth ?? 0, "Transactions per month"),
  };
}

const extendedResidualColumns = new Set([
  "agent_commission_structure",
  "greenhub_pob_buy_rate",
  "greenhub_pob_net_profit",
  "greenhub_pob_profit_per_transaction",
  "merchant_notes",
  "pos_integration_fee",
]);

function stripExtendedResidualColumns(body: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => !extendedResidualColumns.has(key))
  );
}

function stripResidualColumns(body: Record<string, unknown>, columns: string[]) {
  const blocked = new Set(columns);
  return Object.fromEntries(Object.entries(body).filter(([key]) => !blocked.has(key)));
}

function missingPosIntegrationFeeColumn(error: unknown) {
  return error instanceof PortalApiError && /pos_integration_fee/i.test(error.message);
}

function missingResidualColumn(error: unknown) {
  return (
    error instanceof PortalApiError &&
    /agent_commission_structure|greenhub_pob|merchant_notes|pos_integration_fee|schema cache|column/i.test(
      error.message
    )
  );
}

export async function writeResidual(options: {
  body: Record<string, unknown>;
  method: "PATCH" | "POST";
  query?: URLSearchParams;
}) {
  try {
    return await supabaseRest<MonthlyResidual[]>("monthly_residuals", {
      method: options.method,
      prefer: "return=representation",
      query: options.query,
      body: options.body,
    });
  } catch (error) {
    if (missingPosIntegrationFeeColumn(error)) {
      return supabaseRest<MonthlyResidual[]>("monthly_residuals", {
        method: options.method,
        prefer: "return=representation",
        query: options.query,
        body: stripResidualColumns(options.body, ["pos_integration_fee"]),
      });
    }

    if (!missingResidualColumn(error)) throw error;
    return supabaseRest<MonthlyResidual[]>("monthly_residuals", {
      method: options.method,
      prefer: "return=representation",
      query: options.query,
      body: stripExtendedResidualColumns(options.body),
    });
  }
}
