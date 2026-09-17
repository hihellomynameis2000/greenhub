import type { MerchantAccount, NumericValue } from "./types";

export type AccountSplitType = "fixed" | "percent";

export type AccountSplitAgent = {
  agentId: string;
  split: string;
};

export type AccountSplitMeta = {
  agents: AccountSplitAgent[];
  splitType: AccountSplitType;
};

const ACCOUNT_SPLIT_META_PATTERN =
  /\n?\[portal_account_split_meta:({[\s\S]*?})\]\s*$/;

function numericText(value: NumericValue | undefined, fallback = "") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(/[$,%\s]/g, "");
}

function uniqueAgentRows(rows: AccountSplitAgent[]) {
  const seen = new Set<string>();

  return rows
    .map((row) => ({ agentId: row.agentId.trim(), split: row.split.trim() }))
    .filter((row) => {
      if (!row.agentId || seen.has(row.agentId)) return false;
      seen.add(row.agentId);
      return true;
    });
}

function fallbackMeta(account: MerchantAccount | null | undefined): AccountSplitMeta {
  const agents: AccountSplitAgent[] = [];

  if (account?.assigned_agent_id) {
    agents.push({
      agentId: account.assigned_agent_id,
      split: numericText(account.primary_agent_split, "100"),
    });
  }

  if (account?.secondary_agent_id) {
    agents.push({
      agentId: account.secondary_agent_id,
      split: numericText(account.secondary_agent_split, "0"),
    });
  }

  return {
    agents: uniqueAgentRows(agents),
    splitType: "percent",
  };
}

export function readAccountSplitMeta(
  notes: string | null | undefined,
  account?: MerchantAccount | null
): AccountSplitMeta & { cleanNotes: string } {
  const source = notes ?? "";
  const fallback = fallbackMeta(account);
  const match = source.match(ACCOUNT_SPLIT_META_PATTERN);

  if (!match) return { ...fallback, cleanNotes: source };

  try {
    const parsed = JSON.parse(match[1]) as Partial<AccountSplitMeta>;
    const splitType = parsed.splitType === "fixed" ? "fixed" : "percent";
    const agents = uniqueAgentRows(
      Array.isArray(parsed.agents)
        ? parsed.agents.map((row) => ({
            agentId: String(row.agentId ?? ""),
            split: String(row.split ?? ""),
          }))
        : []
    );

    return {
      agents: agents.length ? agents : fallback.agents,
      cleanNotes: source.replace(ACCOUNT_SPLIT_META_PATTERN, "").trimEnd(),
      splitType,
    };
  } catch {
    return {
      ...fallback,
      cleanNotes: source.replace(ACCOUNT_SPLIT_META_PATTERN, "").trimEnd(),
    };
  }
}

export function writeAccountSplitMeta(
  notes: string | null | undefined,
  meta: AccountSplitMeta
) {
  const cleanNotes = (notes ?? "").replace(ACCOUNT_SPLIT_META_PATTERN, "").trimEnd();
  const agents = uniqueAgentRows(meta.agents);
  const payload = JSON.stringify({
    agents,
    splitType: meta.splitType,
  });

  return `${cleanNotes}${cleanNotes ? "\n\n" : ""}[portal_account_split_meta:${payload}]`;
}

export function accountSplitAssignments(account: MerchantAccount | null | undefined) {
  return readAccountSplitMeta(account?.internal_notes, account).agents;
}

export function accountSplitType(account: MerchantAccount | null | undefined): AccountSplitType {
  return readAccountSplitMeta(account?.internal_notes, account).splitType;
}

export function hasStoredAccountSplitMeta(account: MerchantAccount | null | undefined) {
  return Boolean(account?.internal_notes?.match(ACCOUNT_SPLIT_META_PATTERN));
}

export function visibleAccountAgentIds(account: MerchantAccount | null | undefined) {
  return accountSplitAssignments(account).map((row) => row.agentId);
}

export function accountAgentSplitValue(
  account: MerchantAccount | null | undefined,
  agentId: string
) {
  return accountSplitAssignments(account).find((row) => row.agentId === agentId)?.split ?? "";
}
