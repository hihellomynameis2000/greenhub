import { NextRequest, NextResponse } from "next/server";
import {
  PortalApiError,
  portalErrorResponse,
  requirePortalContext,
  supabaseRest,
} from "@/lib/portal/server";
import { assertPartnerLibraryAvailable, fetchPartnerLibrary, visibleDealQuery } from "@/lib/portal/partner";
import { visibleResidualsForRole } from "@/lib/portal/residualVisibility";
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
      accountQuery.set("assigned_agent_id", `eq.${context.profile.id}`);
      residualQuery.set("agent_id", `eq.${context.profile.id}`);
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
        supabaseRest<MerchantAccount[]>("residual_merchant_accounts", { query: accountQuery }),
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
      residuals: visibleResidualsForRole(residuals, context.profile.role),
    };

    return NextResponse.json(response);
  } catch (error) {
    return portalErrorResponse(error);
  }
}
