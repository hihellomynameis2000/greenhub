import { NextRequest, NextResponse } from "next/server";
import {
  decimalValue,
  optionalString,
  portalErrorResponse,
  PortalApiError,
  requirePortalContext,
  requiredString,
  supabaseRest,
  writeAuditLog,
} from "@/lib/portal/server";
import type { MerchantAccount } from "@/lib/portal/types";

function validStatus(value: unknown): value is "active" | "paused" | "closed" {
  return value === "active" || value === "paused" || value === "closed";
}

function splitPercent(value: unknown, fallback: number) {
  const parsed = decimalValue(value ?? fallback);
  return Math.min(Math.max(parsed, 0), 100);
}

function sharedAgentColumnsMissing(error: unknown) {
  return (
    error instanceof PortalApiError &&
    /secondary_agent_id|primary_agent_split|secondary_agent_split|schema cache|column/i.test(error.message)
  );
}

function withoutSharedAgentColumns(body: Record<string, unknown>) {
  const { primary_agent_split, secondary_agent_id, secondary_agent_split, ...fallbackBody } = body;
  void primary_agent_split;
  void secondary_agent_id;
  void secondary_agent_split;
  return fallbackBody;
}

async function writeAccount(options: {
  body: Record<string, unknown>;
  method: "PATCH" | "POST";
  query?: URLSearchParams;
}) {
  try {
    return await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", {
      method: options.method,
      prefer: "return=representation",
      query: options.query,
      body: options.body,
    });
  } catch (error) {
    if (!sharedAgentColumnsMissing(error)) throw error;

    return supabaseRest<MerchantAccount[]>("residual_merchant_accounts", {
      method: options.method,
      prefer: "return=representation",
      query: options.query,
      body: withoutSharedAgentColumns(options.body),
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await requirePortalContext(request);
    const query = new URLSearchParams({ select: "*", order: "created_at.desc" });
    if (context.profile.role === "agent") {
      query.set(
        "or",
        `(assigned_agent_id.eq.${context.profile.id},secondary_agent_id.eq.${context.profile.id})`
      );
    }

    let accounts: MerchantAccount[];
    try {
      accounts = await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", { query });
    } catch (error) {
      if (!sharedAgentColumnsMissing(error) || context.profile.role !== "agent") throw error;

      const fallbackQuery = new URLSearchParams({ select: "*", order: "created_at.desc" });
      fallbackQuery.set("assigned_agent_id", `eq.${context.profile.id}`);
      accounts = await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", {
        query: fallbackQuery,
      });
    }
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
    const secondaryAgentId = optionalString(body.secondaryAgentId);

    const accounts = await writeAccount({
      method: "POST",
      body: {
        account_name: accountName,
        assigned_agent_id: assignedAgentId,
        commission_structure: optionalString(body.commissionStructure),
        created_by: context.profile.id,
        internal_notes: optionalString(body.internalNotes),
        platform_id: platformId,
        primary_agent_split: splitPercent(body.primaryAgentSplit, secondaryAgentId ? 50 : 100),
        secondary_agent_id: secondaryAgentId,
        secondary_agent_split: secondaryAgentId ? splitPercent(body.secondaryAgentSplit, 50) : 0,
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
    if (body.primaryAgentSplit !== undefined) updates.primary_agent_split = splitPercent(body.primaryAgentSplit, 100);
    if (body.secondaryAgentId !== undefined) updates.secondary_agent_id = optionalString(body.secondaryAgentId);
    if (body.secondaryAgentSplit !== undefined) updates.secondary_agent_split = splitPercent(body.secondaryAgentSplit, 0);
    if (body.status !== undefined) {
      if (!validStatus(body.status)) throw new Error("Invalid account status.");
      updates.status = body.status;
    }
    if (body.commissionStructure !== undefined) updates.commission_structure = optionalString(body.commissionStructure);
    if (body.internalNotes !== undefined) updates.internal_notes = optionalString(body.internalNotes);

    const query = new URLSearchParams({ id: `eq.${id}` });
    const accounts = await writeAccount({
      method: "PATCH",
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
