import { NextRequest, NextResponse } from "next/server";
import {
  PortalApiError,
  portalErrorResponse,
  requirePortalContext,
  requiredInteger,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import type { ResidualNotification } from "@/lib/portal/types";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export async function GET(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "agent");
    const query = new URLSearchParams({
      select: "*",
      agent_id: `eq.${context.profile.id}`,
      order: "created_at.desc",
      limit: "20",
    });
    const notifications = await supabaseRest<ResidualNotification[]>("residual_notifications", { query });
    return NextResponse.json({ notifications });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const agentId = requiredString(body.agentId, "Agent");
    const residualMonth = requiredInteger(body.residualMonth, "Residual month");
    const residualYear = requiredInteger(body.residualYear, "Residual year");
    if (residualMonth < 1 || residualMonth > 12) {
      return NextResponse.json({ error: "Residual month must be between 1 and 12." }, { status: 400 });
    }

    try {
      await supabaseRest<Pick<ResidualNotification, "read_at">[]>("residual_notifications", {
        query: new URLSearchParams({ select: "read_at", limit: "1" }),
      });
    } catch (error) {
      if (error instanceof PortalApiError && (error.status === 400 || error.status === 404)) {
        throw new PortalApiError(
          "The residual notification inbox migration has not been applied yet.",
          503
        );
      }
      throw error;
    }

    const residualQuery = new URLSearchParams({
      agent_id: `eq.${agentId}`,
      residual_month: `eq.${residualMonth}`,
      residual_year: `eq.${residualYear}`,
    });
    const finalizedResiduals = await supabaseRest<{ id: string }[]>("monthly_residuals", {
      method: "PATCH",
      prefer: "return=representation",
      query: residualQuery,
      body: { residual_status: "finalized", updated_by: context.profile.id },
    });

    const notificationQuery = new URLSearchParams({
      select: "*",
      agent_id: `eq.${agentId}`,
      residual_month: `eq.${residualMonth}`,
      residual_year: `eq.${residualYear}`,
      limit: "1",
    });
    const existing = await supabaseRest<ResidualNotification[]>("residual_notifications", {
      query: notificationQuery,
    });
    const now = new Date().toISOString();
    let notification: ResidualNotification;

    if (existing[0]) {
      const updateQuery = new URLSearchParams({ id: `eq.${existing[0].id}` });
      const notifications = await supabaseRest<ResidualNotification[]>("residual_notifications", {
        method: "PATCH",
        prefer: "return=representation",
        query: updateQuery,
        body: {
          notification_sent: true,
          notification_sent_at: now,
          notification_type: "residual_finalized",
          read_at: null,
          residual_id: finalizedResiduals[0]?.id ?? null,
          message: `Your finalized residuals for ${months[residualMonth - 1]} ${residualYear} are ready to review.`,
          title: "Residuals updated",
          triggered_by: context.profile.id,
        },
      });
      notification = notifications[0];
    } else {
      const notifications = await supabaseRest<ResidualNotification[]>("residual_notifications", {
        method: "POST",
        prefer: "return=representation",
        body: {
          agent_id: agentId,
          notification_sent: true,
          notification_sent_at: now,
          notification_type: "residual_finalized",
          read_at: null,
          residual_id: finalizedResiduals[0]?.id ?? null,
          residual_month: residualMonth,
          residual_year: residualYear,
          message: `Your finalized residuals for ${months[residualMonth - 1]} ${residualYear} are ready to review.`,
          title: "Residuals updated",
          triggered_by: context.profile.id,
        },
      });
      notification = notifications[0];
    }

    await writeAuditLog(context, "residual.notification_sent", "residual_notifications", notification.id, {
      agentId,
      finalizedResidualCount: finalizedResiduals.length,
      residualMonth,
      residualYear,
    });
    return NextResponse.json({
      finalizedResidualCount: finalizedResiduals.length,
      notification,
    });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "agent");
    const query = new URLSearchParams({
      agent_id: `eq.${context.profile.id}`,
      read_at: "is.null",
    });
    const notifications = await supabaseRest<ResidualNotification[]>("residual_notifications", {
      method: "PATCH",
      prefer: "return=representation",
      query,
      body: { read_at: new Date().toISOString() },
    });
    return NextResponse.json({ notifications });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
