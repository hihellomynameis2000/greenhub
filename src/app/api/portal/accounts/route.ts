import { NextRequest, NextResponse } from "next/server";
import {
  optionalString,
  portalErrorResponse,
  requirePortalContext,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import type { MerchantAccount } from "@/lib/portal/types";

function validStatus(value: unknown): value is "active" | "paused" | "closed" {
  return value === "active" || value === "paused" || value === "closed";
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    const query = new URLSearchParams({ select: "*", order: "created_at.desc" });
    if (context.profile.role === "agent") {
      query.set("assigned_agent_id", `eq.${context.profile.id}`);
    }

    const accounts = await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", {
      query,
    });
    return NextResponse.json({ accounts });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const accountName = requiredString(body.accountName, "Merchant name");
    const platformId = requiredString(body.platformId, "Processing platform");
    const assignedAgentId = requiredString(body.assignedAgentId, "Assigned agent");
    const status = validStatus(body.status) ? body.status : "active";

    const accounts = await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", {
      method: "POST",
      prefer: "return=representation",
      body: {
        account_name: accountName,
        assigned_agent_id: assignedAgentId,
        commission_structure: optionalString(body.commissionStructure),
        created_by: context.profile.id,
        internal_notes: optionalString(body.internalNotes),
        platform_id: platformId,
        status,
        updated_by: context.profile.id,
      },
    });
    const account = accounts[0];
    await writeAuditLog(context, "account.created", "residual_merchant_accounts", account.id, {
      accountName,
      assignedAgentId,
      platformId,
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    return portalErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const body = await request.json();
    const id = requiredString(body.id, "Account ID");
    const updates: Record<string, unknown> = { updated_by: context.profile.id };

    if (body.accountName !== undefined) updates.account_name = requiredString(body.accountName, "Merchant name");
    if (body.platformId !== undefined) updates.platform_id = requiredString(body.platformId, "Processing platform");
    if (body.assignedAgentId !== undefined) updates.assigned_agent_id = requiredString(body.assignedAgentId, "Assigned agent");
    if (body.status !== undefined) {
      if (!validStatus(body.status)) throw new Error("Invalid account status.");
      updates.status = body.status;
    }
    if (body.commissionStructure !== undefined) updates.commission_structure = optionalString(body.commissionStructure);
    if (body.internalNotes !== undefined) updates.internal_notes = optionalString(body.internalNotes);

    const query = new URLSearchParams({ id: `eq.${id}` });
    const accounts = await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", {
      method: "PATCH",
      prefer: "return=representation",
      query,
      body: updates,
    });
    const account = accounts[0];
    if (!account) return NextResponse.json({ error: "Account not found." }, { status: 404 });

    await writeAuditLog(context, "account.updated", "residual_merchant_accounts", id, updates);
    return NextResponse.json({ account });
  } catch (error) {
    return portalErrorResponse(error);
  }
}
