import { NextRequest, NextResponse } from "next/server";
import {
  PortalApiError,
  type PortalContext,
  portalErrorResponse,
  requirePortalContext,
  supabaseRest,
} from "@/lib/portal/server";
import { assertPartnerLibraryAvailable, fetchPartnerLibrary, visibleDealQuery } from "@/lib/portal/partner";
import { accountAgentSplitPercent, hasSecondaryAgent, splitAmount } from "@/lib/portal/agentSplits";
import { visibleResidualsForRole } from "@/lib/portal/residualVisibility";
import { inferredResidualPlatformType } from "@/lib/portal/residualType";
import type {
  AgentLifetimeSummary,
  AgentMonthlySummary,
  AgentProfile,
  AgentPlatformAccess,
  MerchantAccount,
  MonthlyResidual,
  PartnerPlatformRecord,
  Platform,
  PlatformCategory,
  PlatformUpdate,
  PortalBootstrap,
  PortalDeal,
  ResidualNotification,
} from "@/lib/portal/types";

function query(select = "*") {
  return new URLSearchParams({ select });
}

function amount(value: number | string | null | undefined) {
  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value ?? 0).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function sharedAgentColumnsMissing(error: unknown) {
  return (
    error instanceof PortalApiError &&
    /secondary_agent_id|primary_agent_split|secondary_agent_split|schema cache|column/i.test(error.message)
  );
}

async function fetchAccountsForContext(context: PortalContext, accountQuery: URLSearchParams) {
  if (context.profile.role !== "agent") {
    return supabaseRest<MerchantAccount[]>("residual_merchant_accounts", { query: accountQuery });
  }

  const sharedQuery = new URLSearchParams(accountQuery);
  sharedQuery.set(
    "or",
    `(assigned_agent_id.eq.${context.profile.id},secondary_agent_id.eq.${context.profile.id})`
  );

  try {
    return await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", {
      query: sharedQuery,
    });
  } catch (error) {
    if (!sharedAgentColumnsMissing(error)) throw error;

    const fallbackQuery = new URLSearchParams(accountQuery);
    fallbackQuery.set("assigned_agent_id", `eq.${context.profile.id}`);
    return supabaseRest<MerchantAccount[]>("residual_merchant_accounts", {
      query: fallbackQuery,
    });
  }
}

function residualsForAgent({
  accounts,
  platforms,
  profileId,
  residuals,
}: {
  accounts: MerchantAccount[];
  platforms: Platform[];
  profileId: string;
  residuals: MonthlyResidual[];
}) {
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const platformById = new Map(platforms.map((platform) => [platform.id, platform]));

  return residuals.map((residual) => {
    const account = accountById.get(residual.merchant_account_id) ?? null;
    const platform = platformById.get(residual.platform_id ?? "");
    const residualType = inferredResidualPlatformType(platform ?? "");
    const splitPercent = accountAgentSplitPercent({
      account,
      agentId: profileId,
      fallbackCommission: residual.agent_commission_structure || account?.commission_structure,
      residualType,
    });
    const rawAgentProfit = amount(residual.agent_profit);
    const agentProfit =
      residualType === "cc"
        ? splitAmount(amount(residual.greenhub_net_profit), splitPercent)
        : hasSecondaryAgent(account)
          ? splitAmount(rawAgentProfit, splitPercent)
          : rawAgentProfit;

    return {
      ...residual,
      agent_id: profileId,
      agent_profit: agentProfit,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    const platformQuery = query();
    platformQuery.set("is_active", "eq.true");
    platformQuery.set("order", "name.asc");

    const accountQuery = query();
    accountQuery.set("order", "created_at.desc");

    const residualQuery = query();
    residualQuery.set("order", "residual_year.desc,residual_month.desc,created_at.desc");

    const notificationQuery = query();
    notificationQuery.set("order", "created_at.desc");

    if (context.profile.role === "agent") {
      residualQuery.set("residual_status", "eq.finalized");
      notificationQuery.set("agent_id", `eq.${context.profile.id}`);
    }

    const agentQuery = query();
    agentQuery.set("order", "name.asc");

    const monthlySummaryQuery = query();
    monthlySummaryQuery.set("agent_id", `eq.${context.profile.id}`);
    monthlySummaryQuery.set("order", "residual_year.desc,residual_month.desc");

    const lifetimeSummaryQuery = query();
    lifetimeSummaryQuery.set("agent_id", `eq.${context.profile.id}`);
    lifetimeSummaryQuery.set("limit", "1");

    const [platforms, accounts, residuals, notifications, agents, monthlySummaries, lifetimeSummaries] =
      await Promise.all([
        supabaseRest<Platform[]>("platforms", { query: platformQuery }),
        fetchAccountsForContext(context, accountQuery),
        supabaseRest<MonthlyResidual[]>("monthly_residuals", { query: residualQuery }),
        supabaseRest<ResidualNotification[]>("residual_notifications", { query: notificationQuery }),
        context.profile.role === "admin"
          ? supabaseRest<AgentProfile[]>("agent_profiles", { query: agentQuery })
          : Promise.resolve([context.profile]),
        context.profile.role === "agent"
          ? supabaseRest<AgentMonthlySummary[]>("agent_monthly_summary", {
              query: monthlySummaryQuery,
            })
          : Promise.resolve([]),
        context.profile.role === "agent"
          ? supabaseRest<AgentLifetimeSummary[]>("agent_lifetime_summary", {
              query: lifetimeSummaryQuery,
            })
          : Promise.resolve([]),
      ]);

    const visibleAccountIds = new Set(accounts.map((account) => account.id));
    const scopedResiduals =
      context.profile.role === "agent"
        ? residualsForAgent({
            accounts,
            platforms,
            profileId: context.profile.id,
            residuals: residuals.filter(
              (residual) =>
                residual.agent_id === context.profile.id ||
                visibleAccountIds.has(residual.merchant_account_id)
            ),
          })
        : residuals;

    let partnerPlatforms: PartnerPlatformRecord[] = [];
    let platformAccess: AgentPlatformAccess[] = [];
    let platformCategories: PlatformCategory[] = [];
    let platformUpdates: PlatformUpdate[] = [];
    let portalDeals: PortalDeal[] = [];

    try {
      const library = await fetchPartnerLibrary(context);
      partnerPlatforms = library.partnerPlatforms;
      platformAccess = library.platformAccess;
      platformCategories = library.platformCategories;

      const updateQuery = new URLSearchParams({
        select: "*",
        order: "created_at.desc",
        limit: "12",
        or: `(audience.eq.all,audience.eq.${context.profile.role})`,
      });
      const [updates, deals] = await Promise.all([
        supabaseRest<PlatformUpdate[]>("platform_updates", { query: updateQuery }),
        supabaseRest<PortalDeal[]>("portal_deals", { query: visibleDealQuery(context) }),
      ]);
      platformUpdates = updates;
      portalDeals = deals;
    } catch (error) {
      try {
        assertPartnerLibraryAvailable(error);
      } catch (partnerError) {
        if (!(partnerError instanceof PortalApiError) || partnerError.status !== 503) {
          throw partnerError;
        }
      }
    }

    const response: PortalBootstrap = {
      accounts,
      agents,
      lifetimeSummary: lifetimeSummaries[0] ?? null,
      monthlySummaries,
      notifications,
      partnerPlatforms,
      platformAccess,
      platformCategories,
      platformUpdates,
      platforms,
      profile: context.profile,
      portalDeals,
      residuals: visibleResidualsForRole(scopedResiduals, context.profile.role),
    };

    return NextResponse.json(response);
  } catch (error) {
    return portalErrorResponse(error);
  }
}
