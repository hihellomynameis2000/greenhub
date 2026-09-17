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
import {
  type AccountSplitAgent,
  type AccountSplitType,
  readAccountSplitMeta,
  visibleAccountAgentIds,
  writeAccountSplitMeta,
} from "@/lib/portal/accountSplitMeta";
import type { MerchantAccount } from "@/lib/portal/types";

function validStatus(value: unknown): value is "active" | "paused" | "closed" {
  return value === "active" || value === "paused" || value === "closed";
}

function splitPercent(value: unknown, fallback: number) {
  const parsed = decimalValue(value ?? fallback);
  return Math.min(Math.max(parsed, 0), 100);
}

function splitNumber(value: unknown, fallback: number) {
  const parsed = decimalValue(value ?? fallback);
  return Math.max(parsed, 0);
}

function validSplitType(value: unknown): AccountSplitType {
  return value === "fixed" ? "fixed" : "percent";
}

function normalizedAgentSplits(body: Record<string, unknown>) {
  const rawRows = Array.isArray(body.agentSplits)
    ? body.agentSplits
    : [
        {
          agentId: body.assignedAgentId,
          split: body.primaryAgentSplit,
        },
        {
          agentId: body.secondaryAgentId,
          split: body.secondaryAgentSplit,
        },
      ];
  const seen = new Set<string>();
  const rows: AccountSplitAgent[] = [];

  rawRows.forEach((row) => {
    const record = row as Record<string, unknown>;
    const agentId = optionalString(record.agentId);
    if (!agentId || seen.has(agentId)) return;
    seen.add(agentId);
    rows.push({
      agentId,
      split: String(record.split ?? ""),
    });
  });

  return rows;
}

async function readAccount(id: string) {
  const query = new URLSearchParams({ id: `eq.${id}`, limit: "1", select: "*" });
  const rows = await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", { query });
  return rows[0] ?? null;
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
    const query = new URLSearchParams({ select: "*", order: "account_name.asc" });
    if (context.profile.role === "agent") {
      const accounts = await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", { query });
      return NextResponse.json({
        accounts: accounts.filter((account) => visibleAccountAgentIds(account).includes(context.profile.id)),
      });
    }

    const accounts = await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", { query });
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
    const splitType = validSplitType(body.splitType);
    const agentSplits = normalizedAgentSplits(body);
    const assignedAgentId = requiredString(
      agentSplits[0]?.agentId ?? body.assignedAgentId,
      "Assigned agent"
    );
    const status = validStatus(body.status) ? body.status : "active";
    const secondaryAgentId = agentSplits[1]?.agentId ?? optionalString(body.secondaryAgentId);
    const primarySplit = agentSplits[0]?.split ?? body.primaryAgentSplit;
    const secondarySplit = agentSplits[1]?.split ?? body.secondaryAgentSplit;

    const accounts = await writeAccount({
      method: "POST",
      body: {
        account_name: accountName,
        assigned_agent_id: assignedAgentId,
        commission_structure: optionalString(body.commissionStructure),
        created_by: context.profile.id,
        internal_notes: writeAccountSplitMeta(optionalString(body.internalNotes), {
          agents: agentSplits.length
            ? agentSplits
            : [{ agentId: assignedAgentId, split: String(primarySplit ?? "100") }],
          splitType,
        }),
        platform_id: platformId,
        primary_agent_split:
          splitType === "fixed"
            ? splitNumber(primarySplit, 0)
            : splitPercent(primarySplit, secondaryAgentId ? 50 : 100),
        secondary_agent_id: secondaryAgentId,
        secondary_agent_split: secondaryAgentId
          ? splitType === "fixed"
            ? splitNumber(secondarySplit, 0)
            : splitPercent(secondarySplit, 50)
          : 0,
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
    const splitFieldsTouched =
      body.agentSplits !== undefined ||
      body.splitType !== undefined ||
      body.assignedAgentId !== undefined ||
      body.primaryAgentSplit !== undefined ||
      body.secondaryAgentId !== undefined ||
      body.secondaryAgentSplit !== undefined;
    const currentAccount = splitFieldsTouched || body.internalNotes !== undefined ? await readAccount(id) : null;
    const splitType =
      body.splitType !== undefined
        ? validSplitType(body.splitType)
        : currentAccount
          ? readAccountSplitMeta(currentAccount.internal_notes, currentAccount).splitType
          : "percent";
    const agentSplits = normalizedAgentSplits(body);

    if (body.accountName !== undefined) updates.account_name = requiredString(body.accountName, "Merchant name");
    if (body.platformId !== undefined) updates.platform_id = requiredString(body.platformId, "Processing platform");
    if (splitFieldsTouched) {
      const assignedAgentId = requiredString(
        agentSplits[0]?.agentId ?? body.assignedAgentId ?? currentAccount?.assigned_agent_id,
        "Assigned agent"
      );
      const secondaryAgentId = agentSplits[1]?.agentId ?? optionalString(body.secondaryAgentId);
      const primarySplit = agentSplits[0]?.split ?? body.primaryAgentSplit ?? currentAccount?.primary_agent_split;
      const secondarySplit = agentSplits[1]?.split ?? body.secondaryAgentSplit ?? currentAccount?.secondary_agent_split;

      updates.assigned_agent_id = assignedAgentId;
      updates.primary_agent_split =
        splitType === "fixed"
          ? splitNumber(primarySplit, 0)
          : splitPercent(primarySplit, secondaryAgentId ? 50 : 100);
      updates.secondary_agent_id = secondaryAgentId;
      updates.secondary_agent_split = secondaryAgentId
        ? splitType === "fixed"
          ? splitNumber(secondarySplit, 0)
          : splitPercent(secondarySplit, 50)
        : 0;
      updates.internal_notes = writeAccountSplitMeta(
        body.internalNotes !== undefined
          ? optionalString(body.internalNotes)
          : currentAccount?.internal_notes,
        {
          agents: agentSplits.length
            ? agentSplits
            : [{ agentId: assignedAgentId, split: String(primarySplit ?? "100") }],
          splitType,
        }
      );
    }
    if (body.status !== undefined) {
      if (!validStatus(body.status)) throw new Error("Invalid account status.");
      updates.status = body.status;
    }
    if (body.commissionStructure !== undefined) updates.commission_structure = optionalString(body.commissionStructure);
    if (body.internalNotes !== undefined && !splitFieldsTouched) updates.internal_notes = optionalString(body.internalNotes);

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

export async function DELETE(request: NextRequest) {
  try {
    const context = await requirePortalContext(request, "admin");
    const id = requiredString(request.nextUrl.searchParams.get("id"), "Account ID");
    const query = new URLSearchParams({ id: `eq.${id}` });

    try {
      const accounts = await supabaseRest<MerchantAccount[]>("residual_merchant_accounts", {
        method: "DELETE",
        prefer: "return=representation",
        query,
      });
      await writeAuditLog(context, "account.deleted", "residual_merchant_accounts", id, {});
      return NextResponse.json({ account: accounts[0] ?? null, archived: false, deletedId: id });
    } catch (deleteError) {
      if (
        !(
          deleteError instanceof PortalApiError &&
          /foreign key|violates|referenced|409/i.test(deleteError.message)
        )
      ) {
        throw deleteError;
      }

      const accounts = await writeAccount({
        method: "PATCH",
        query,
        body: {
          status: "closed",
          updated_by: context.profile.id,
        },
      });
      await writeAuditLog(context, "account.archived", "residual_merchant_accounts", id, {});
      return NextResponse.json({ account: accounts[0] ?? null, archived: true, deletedId: id });
    }
  } catch (error) {
    return portalErrorResponse(error);
  }
}
