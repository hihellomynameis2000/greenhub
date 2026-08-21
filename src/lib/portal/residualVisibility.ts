import type { MonthlyResidual, PortalRole } from "./types";

export function visibleResidualsForRole(
  residuals: MonthlyResidual[],
  role: PortalRole
): MonthlyResidual[] {
  if (role === "admin") return residuals;

  return residuals.map((residual) => ({
    ...residual,
    greenhub_net_profit: 0,
    greenhub_pob_buy_rate: 0,
    greenhub_pob_net_profit: 0,
    greenhub_pob_profit_per_transaction: 0,
    merchant_notes: null,
  }));
}
