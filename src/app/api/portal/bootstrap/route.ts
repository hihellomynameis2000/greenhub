import { NextRequest, NextResponse } from "next/server";
import {
  portalErrorResponse,
  requirePortalContext,
  supabaseRest,
} from "@/lib/portal/server";
import type {
  AgentLifetimeSummary,
  AgentMonthlySummary,
  AgentProfile,
  MerchantAccount,
  MonthlyResidual,
  Platform,
  PortalBootstrap,
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

    const response: PortalBootstrap = {
      accounts,
      agents,
      lifetimeSummary: lifetimeSummaries[0] ?? null,
      monthlySummaries,
      notifications,
      platforms,
      profile: context.profile,
      residuals,
    };

    return NextResponse.json(response);
  } catch (error) {
    return portalErrorResponse(error);
  }
}
