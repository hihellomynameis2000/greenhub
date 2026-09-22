import { NextRequest, NextResponse } from "next/server";
import {
  decimalValue,
  optionalString,
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import { canEditDeal, visibleDealQuery } from "@/lib/portal/partner";
import { crmLeadNotificationRecipients, sendCrmLeadNotificationEmail } from "@/lib/portal/resend";
import type { AgentProfile, Platform, PortalDeal, PortalDealStage } from "@/lib/portal/types";

function validStage(value: unknown): PortalDealStage {
  if (
    value === "contacted" ||
    value === "application_sent" ||
    value === "submitted" ||
    value === "approved" ||
    value === "declined"
  ) {
    return value;
  }

  return "new_lead";
}

function validPriority(value: unknown): "standard" | "high" | "escalated" {
  if (value === "high" || value === "escalated") return value;
  return "standard";
}

function stageLabel(stage: PortalDealStage) {
  const labels: Record<PortalDealStage, string> = {
    application_sent: "Application Sent",
    approved: "Approved",
    contacted: "Contacted",
    declined: "Declined",
    new_lead: "New Lead",
    submitted: "Submitted",
  };

  return labels[stage];
}

function priorityLabel(priority: PortalDeal["priority"]) {
  if (priority === "escalated") return "Escalated";
  if (priority === "high") return "High";
  return "Standard";
}

function dealPayload(body: Record<string, unknown>, agentId: string, actorId: string) {
  return {
    agent_id: agentId,
    contact_email: optionalString(body.contactEmail),
    contact_name: optionalString(body.contactName),
    estimated_volume: decimalValue(body.estimatedVolume),
    last_activity: optionalString(body.lastActivity) ?? "CRM draft saved",
    merchant_name: requiredString(body.merchantName, "Merchant name"),
    next_follow_up: optionalString(body.nextFollowUp),
    notes: optionalString(body.notes),
    platform_id: optionalString(body.platformId),
    priority: validPriority(body.priority),
    salesforce_status: optionalString(body.salesforceStatus),
    stage: validStage(body.stage),
    updated_by: actorId,
  };
}

async function sendCrmLeadCreatedNotification({
  createdByName,
  deal,
}: {
  createdByName: string;
  deal: PortalDeal;
}) {
  const [assignedAgents, platforms] = await Promise.all([
    supabaseRest<Pick<AgentProfile, "id" | "name" | "email">[]>("agent_profiles", {
      query: new URLSearchParams({
        id: `eq.${deal.agent_id}`,
        select: "id,name,email",
        limit: "1",
      }),
    }),
    deal.platform_id
      ? supabaseRest<Pick<Platform, "id" | "name">[]>("platforms", {
          query: new URLSearchParams({
            id: `eq.${deal.platform_id}`,
            select: "id,name",
            limit: "1",
          }),
        })
      : Promise.resolve([]),
  ]);
  const assignedAgent = assignedAgents[0];
  const platform = platforms[0];

  await sendCrmLeadNotificationEmail({
    agentName: assignedAgent?.name ?? assignedAgent?.email ?? "Unassigned",
    contactEmail: deal.contact_email,
    contactName: deal.contact_name,
    createdByName,
    estimatedVolume: deal.estimated_volume,
    lastActivity: deal.last_activity,
    merchantName: deal.merchant_name,
    nextFollowUp: deal.next_follow_up,
    notes: deal.notes,
    platformName: platform?.name ?? null,
    priority: priorityLabel(deal.priority),
    salesforceStatus: deal.salesforce_status,
    stageLabel: stageLabel(deal.stage),
    to: crmLeadNotificationRecipients(),
  });
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    const deals = await supabaseRest<PortalDeal[]>("portal_deals", {
      query: visibleDealQuery(context),
    });
    return NextResponse.json({ deals });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    const body = (await request.json()) as Record<string, unknown>;
    const agentId =
      context.profile.role === "admin"
        ? requiredString(body.agentId, "Agent")
        : context.profile.id;
    const payload = dealPayload(body, agentId, context.profile.id);

    const deals = await supabaseRest<PortalDeal[]>("portal_deals", {
      method: "POST",
      prefer: "return=representation",
      body: {
        ...payload,
        created_by: context.profile.id,
      },
    });
    const deal = deals[0];

    await writeAuditLog(context, "portal_deal.created", "portal_deals", deal.id, {
      agentId,
      merchantName: payload.merchant_name,
      stage: payload.stage,
    });
    try {
      await sendCrmLeadCreatedNotification({
        createdByName: context.profile.name || context.profile.email,
        deal,
      });
    } catch (notificationError) {
      console.error("CRM lead notification email failed", notificationError);
    }
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    const body = (await request.json()) as Record<string, unknown>;
    const id = requiredString(body.id, "Deal ID");
    const existingDeals = await supabaseRest<PortalDeal[]>("portal_deals", {
      query: new URLSearchParams({ select: "*", id: `eq.${id}`, limit: "1" }),
    });
    const existingDeal = existingDeals[0];

    if (!existingDeal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    if (!canEditDeal(context, existingDeal)) {
      return NextResponse.json({ error: "You do not have permission to update this deal." }, { status: 403 });
    }

    const agentId =
      context.profile.role === "admin" && typeof body.agentId === "string"
        ? requiredString(body.agentId, "Agent")
        : existingDeal.agent_id;
    const payload = dealPayload(
      {
        ...existingDeal,
        ...body,
        contactEmail: body.contactEmail ?? existingDeal.contact_email,
        contactName: body.contactName ?? existingDeal.contact_name,
        estimatedVolume: body.estimatedVolume ?? existingDeal.estimated_volume,
        lastActivity: body.lastActivity ?? existingDeal.last_activity,
        merchantName: body.merchantName ?? existingDeal.merchant_name,
        nextFollowUp: body.nextFollowUp ?? existingDeal.next_follow_up,
        platformId: body.platformId ?? existingDeal.platform_id,
        salesforceStatus: body.salesforceStatus ?? existingDeal.salesforce_status,
      },
      agentId,
      context.profile.id
    );

    const deals = await supabaseRest<PortalDeal[]>("portal_deals", {
      method: "PATCH",
      prefer: "return=representation",
      query: new URLSearchParams({ id: `eq.${id}` }),
      body: payload,
    });
    const deal = deals[0];

    await writeAuditLog(context, "portal_deal.updated", "portal_deals", id, {
      stage: payload.stage,
    });
    return NextResponse.json({ deal });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    const id = requiredString(request.nextUrl.searchParams.get("id"), "Deal ID");
    const existingDeals = await supabaseRest<PortalDeal[]>("portal_deals", {
      query: new URLSearchParams({ select: "*", id: `eq.${id}`, limit: "1" }),
    });
    const existingDeal = existingDeals[0];

    if (!existingDeal) return NextResponse.json({ error: "Deal not found." }, { status: 404 });
    if (!canEditDeal(context, existingDeal)) {
      return NextResponse.json({ error: "You do not have permission to remove this deal." }, { status: 403 });
    }

    await supabaseRest("portal_deals", {
      method: "DELETE",
      prefer: "return=minimal",
      query: new URLSearchParams({ id: `eq.${id}` }),
    });

    await writeAuditLog(context, "portal_deal.deleted", "portal_deals", id, {
      merchantName: existingDeal.merchant_name,
    });
    return NextResponse.json({ deletedId: id });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
