import type { MerchantAccount, NumericValue } from "./types";
import type { ResidualPlatformType } from "./residualType";

function numeric(value: NumericValue | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function splitPercentFromText(value: string | null | undefined, fallback = 100) {
  const match = String(value ?? "").match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) return fallback;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 100) : fallback;
}

export function normalizedSplitPercent(value: NumericValue | undefined, fallback = 0) {
  const parsed = numeric(value);
  if (!parsed && fallback) return fallback;
  if (parsed > 0 && parsed <= 1) return parsed * 100;
  return Math.min(Math.max(parsed, 0), 100);
}

export function hasSecondaryAgent(account: MerchantAccount | null | undefined) {
  return Boolean(account?.secondary_agent_id && normalizedSplitPercent(account.secondary_agent_split) > 0);
}

export function accountAgentSplitPercent({
  account,
  agentId,
  fallbackCommission,
  residualType,
}: {
  account: MerchantAccount | null | undefined;
  agentId: string;
  fallbackCommission?: string | null;
  residualType: ResidualPlatformType;
}) {
  if (account?.secondary_agent_id && account.secondary_agent_id === agentId) {
    return normalizedSplitPercent(account.secondary_agent_split);
  }

  if (account?.assigned_agent_id && account.assigned_agent_id === agentId) {
    if (hasSecondaryAgent(account)) return normalizedSplitPercent(account.primary_agent_split, 100);
    return residualType === "cc" ? splitPercentFromText(fallbackCommission, 100) : 100;
  }

  return residualType === "cc" ? splitPercentFromText(fallbackCommission, 100) : 100;
}

export function adminAccountSplitPercent({
  account,
  fallbackCommission,
  reportAgent,
  residualType,
}: {
  account: MerchantAccount | null | undefined;
  fallbackCommission?: string | null;
  reportAgent: string;
  residualType: ResidualPlatformType;
}) {
  if (reportAgent !== "all") {
    return accountAgentSplitPercent({
      account,
      agentId: reportAgent,
      fallbackCommission,
      residualType,
    });
  }

  if (hasSecondaryAgent(account)) {
    return Math.min(
      normalizedSplitPercent(account?.primary_agent_split, 100) +
        normalizedSplitPercent(account?.secondary_agent_split),
      100
    );
  }

  return residualType === "cc" ? splitPercentFromText(fallbackCommission, 100) : 100;
}

export function splitLabel(percent: number) {
  return `${Number(percent.toFixed(2)).toString()}%`;
}

export function splitAmount(value: number, percent: number) {
  return value * (percent / 100);
}
