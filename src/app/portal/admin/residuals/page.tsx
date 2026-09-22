"use client";

import { Bell, ChevronDown, CreditCard, FileText, Layers3, Lock, Plus, ReceiptText, Trash2, Unlock, UploadCloud } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { accounts as demoAccounts, agents as demoAgents, platforms as demoPlatforms } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect, type PortalSelectOption } from "@/components/portal/PortalSelect";
import { PortalActionButton, showPortalToast } from "@/components/portal/PortalToast";
import { splitAmount, splitLabel, splitPercentFromText } from "@/lib/portal/agentSplits";
import {
  accountSplitAssignments,
  accountSplitType,
  hasStoredAccountSplitMeta,
  readAccountSplitMeta,
  visibleAccountAgentIds,
} from "@/lib/portal/accountSplitMeta";
import { portalFileRequest, portalRequest } from "@/lib/portal/client";
import type { ParsedResidualImport, ParsedResidualImportRow } from "@/lib/portal/residualImport";
import { readResidualMeta, writeResidualMeta } from "@/lib/portal/residualMeta";
import { inferredResidualPlatformType, type ResidualPlatformType } from "@/lib/portal/residualType";
import type { MerchantAccount, MonthlyResidual, Platform } from "@/lib/portal/types";

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

const residualsPerPage = 50;
const defaultReportMonth = "2026-7";
const defaultEntryMonth = "July";
const defaultEntryYear = "2026";

type ResidualReportView = "pob" | "cc" | "total";

const residualReportViews: Array<{
  description: string;
  icon: typeof ReceiptText;
  id: ResidualReportView;
  label: string;
}> = [
  {
    description: "Surcharge, rebate, transaction count, and POB profit reporting.",
    icon: ReceiptText,
    id: "pob",
    label: "POB Residual",
  },
  {
    description: "Card-processing volume, GreenHub net profit, and commission terms.",
    icon: CreditCard,
    id: "cc",
    label: "CC Residual",
  },
  {
    description: "Combined POB and CC agent residuals with equipment-cost deductions.",
    icon: Layers3,
    id: "total",
    label: "Total Residual",
  },
];

type ResidualForm = {
  agentCommissionStructure: string;
  agentId: string;
  agentProfit: string;
  equipmentCost: string;
  greenhubCcSplit: string;
  greenhubPobBuyRate: string;
  greenhubPobNetProfit: string;
  greenhubPobProfitPerTransaction: string;
  merchantNotes: string;
  merchantAccountId: string;
  month: string;
  monthlySalesVolume: string;
  netProfit: string;
  oneTimeFees: string;
  platformId: string;
  posIntegrationFee: string;
  profitPerTransaction: string;
  rebate: string;
  status: "draft" | "finalized";
  surcharge: string;
  transactionsPerMonth: string;
  year: string;
};

type DraftEntry = {
  data: ResidualForm;
  id: string;
  savedAt: string;
  title: string;
};

type ResidualReportRow = {
  agent: string;
  agentCommissionStructure: string;
  agentId: string;
  agentIds: string[];
  agentProfit: number;
  agentSplit: number;
  equipmentCost: number;
  greenhubCcSplit: string;
  greenhubNetProfit: number;
  greenhubPobBuyRate: number;
  greenhubPobNetProfit: number;
  greenhubPobProfitPerTransaction: number;
  hasResidual: boolean;
  id: string;
  merchant: string;
  merchantAccountId: string;
  merchantNotes: string;
  month: string;
  monthValue: string;
  platform: string;
  platformId: string;
  posIntegrationFee: number;
  profitPerTransaction: number;
  rebate: number;
  residualId: string | null;
  residualType: ResidualPlatformType;
  salesVolume: number;
  secondaryAgentId: string | null;
  status: "draft" | "finalized";
  surcharge: number;
  transactionsPerMonth: number;
};

type ResidualImportPreviewRow = ParsedResidualImportRow & {
  account: MerchantAccount | null;
  agentName: string;
  baselineResidual: MonthlyResidual | null;
  platform: Platform | null;
  ready: boolean;
  residualType: ResidualPlatformType;
  warnings: string[];
};

type CustomResidualAccountForm = {
  accountName: string;
  agentCommissionStructure: string;
  agentId: string;
  equipmentCost: string;
  greenhubPobBuyRate: string;
  merchantNotes: string;
  monthlySalesVolume: string;
  netProfit: string;
  platformId: string;
  posIntegrationFee: string;
  profitPerTransaction: string;
  rebate: string;
  surcharge: string;
  transactionsPerMonth: string;
};

const initialForm: ResidualForm = {
  agentCommissionStructure: "",
  agentId: "",
  agentProfit: "",
  equipmentCost: "",
  greenhubCcSplit: "",
  greenhubPobBuyRate: "",
  greenhubPobNetProfit: "",
  greenhubPobProfitPerTransaction: "",
  merchantNotes: "",
  merchantAccountId: "",
  month: defaultEntryMonth,
  monthlySalesVolume: "",
  netProfit: "",
  oneTimeFees: "",
  platformId: "",
  posIntegrationFee: "",
  profitPerTransaction: "",
  rebate: "",
  status: "draft",
  surcharge: "",
  transactionsPerMonth: "",
  year: defaultEntryYear,
};

const initialCustomResidualAccountForm: CustomResidualAccountForm = {
  accountName: "",
  agentCommissionStructure: "",
  agentId: "",
  equipmentCost: "",
  greenhubPobBuyRate: "",
  merchantNotes: "",
  monthlySalesVolume: "",
  netProfit: "",
  platformId: "",
  posIntegrationFee: "",
  profitPerTransaction: "",
  rebate: "",
  surcharge: "",
  transactionsPerMonth: "",
};

const demoDrafts: DraftEntry[] = [
  {
    id: "demo-prime-wellness-april",
    title: "Prime Wellness - April 2026",
    savedAt: "Saved today at 10:42 AM",
    data: {
      agentCommissionStructure: "50% net profit share",
      agentId: "nick@greenhubinc.com",
      agentProfit: "$1,020.79",
      equipmentCost: "$250.00",
      greenhubCcSplit: "",
      greenhubPobBuyRate: "$3.00",
      greenhubPobNetProfit: "$655.20",
      greenhubPobProfitPerTransaction: "$1.20",
      merchantNotes: "Strong month. No merchant exceptions.",
      merchantAccountId: "Prime Wellness",
      month: "April",
      monthlySalesVolume: "$54,595",
      netProfit: "$2,041.56",
      oneTimeFees: "$0",
      platformId: "Best Rate – Nuvei",
      posIntegrationFee: "$0.00",
      profitPerTransaction: "$3.74",
      rebate: "$0",
      status: "draft",
      surcharge: "$215.00",
      transactionsPerMonth: "546",
      year: "2026",
    },
  },
  {
    id: "demo-oakline-retail-may",
    title: "Oakline Retail - May 2026",
    savedAt: "Saved yesterday at 4:18 PM",
    data: {
      agentCommissionStructure: "45% net profit share",
      agentId: "rob@paynex.net",
      agentProfit: "$332.58",
      equipmentCost: "$200.00",
      greenhubCcSplit: "",
      greenhubPobBuyRate: "$2.75",
      greenhubPobNetProfit: "$384.30",
      greenhubPobProfitPerTransaction: "$1.05",
      merchantNotes: "Rebate applied for May volume.",
      merchantAccountId: "Oakline Retail",
      month: "May",
      monthlySalesVolume: "$34,220",
      netProfit: "$1,066.15",
      oneTimeFees: "$49.00",
      platformId: "ElitePay – Adyen",
      posIntegrationFee: "$0.00",
      profitPerTransaction: "$2.91",
      rebate: "$35.00",
      status: "draft",
      surcharge: "$148.00",
      transactionsPerMonth: "366",
      year: "2026",
    },
  },
];

function inputValue(value: number | string | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function amount(value: number | string | null | undefined) {
  const numeric =
    typeof value === "number"
      ? value
      : Number(String(value ?? 0).replace(/[$,%\s,]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function currency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount(value));
}

function inputAmount(value: number) {
  return value ? Number(value.toFixed(2)).toString() : "";
}

function rowInputAmount(value: number) {
  return value ? inputValue(value) : "";
}

function normalizedLookupName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function withPobCalculations(form: ResidualForm, changedField?: keyof ResidualForm) {
  const transactions = amount(form.transactionsPerMonth);
  const agentProfitPerTransaction = amount(form.profitPerTransaction);
  const grossPobProfitPerTransaction =
    amount(form.surcharge) -
    amount(form.greenhubPobBuyRate) -
    amount(form.rebate) -
    amount(form.posIntegrationFee);
  const calculatedGreenhubPobProfitPerTransaction =
    grossPobProfitPerTransaction || agentProfitPerTransaction
      ? grossPobProfitPerTransaction - agentProfitPerTransaction
      : 0;
  const greenhubPobProfitPerTransaction =
    changedField === "greenhubPobProfitPerTransaction"
      ? amount(form.greenhubPobProfitPerTransaction)
      : calculatedGreenhubPobProfitPerTransaction;

  return {
    ...form,
    greenhubPobProfitPerTransaction:
      changedField === "greenhubPobProfitPerTransaction"
        ? form.greenhubPobProfitPerTransaction
        : greenhubPobProfitPerTransaction
          ? inputAmount(greenhubPobProfitPerTransaction)
          : form.greenhubPobProfitPerTransaction,
    agentProfit:
      transactions && agentProfitPerTransaction
        ? inputAmount(transactions * agentProfitPerTransaction)
        : form.agentProfit,
    greenhubPobNetProfit:
      transactions && greenhubPobProfitPerTransaction
        ? inputAmount(transactions * greenhubPobProfitPerTransaction)
        : form.greenhubPobNetProfit,
  };
}

function withCcCalculations(form: ResidualForm, changedField?: keyof ResidualForm) {
  if (changedField === "agentProfit") return form;

  const greenhubNetProfit = amount(form.netProfit);
  const agentSplit = splitPercentFromText(form.agentCommissionStructure, 100);

  return {
    ...form,
    agentProfit: greenhubNetProfit ? inputAmount(splitAmount(greenhubNetProfit, agentSplit)) : form.agentProfit,
  };
}

function withResidualCalculations(
  form: ResidualForm,
  residualType: ResidualPlatformType,
  changedField?: keyof ResidualForm
) {
  return residualType === "pob" ? withPobCalculations(form, changedField) : withCcCalculations(form, changedField);
}

function greenhubCcSplitPercent(agentCommissionStructure: string | null | undefined) {
  return Math.min(Math.max(100 - splitPercentFromText(agentCommissionStructure, 100), 0), 100);
}

function greenhubCcSplitPercentForAgentSplit(agentSplit: number) {
  return Math.min(Math.max(100 - agentSplit, 0), 100);
}

function normalizedPercent(value: string | number | null | undefined, fallback: number) {
  const parsed = amount(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), 100);
}

function greenhubCcSplitPercentFromForm(
  form: Pick<ResidualForm, "agentCommissionStructure" | "greenhubCcSplit">
) {
  return form.greenhubCcSplit
    ? normalizedPercent(form.greenhubCcSplit, greenhubCcSplitPercent(form.agentCommissionStructure))
    : greenhubCcSplitPercent(form.agentCommissionStructure);
}

function ccGreenhubNetProfitFromForm(
  form: Pick<ResidualForm, "agentCommissionStructure" | "greenhubCcSplit" | "netProfit">
) {
  return splitAmount(amount(form.netProfit), greenhubCcSplitPercentFromForm(form));
}

function reportAgentIds(account: MerchantAccount | null | undefined, fallbackAgentId: string) {
  const ids = visibleAccountAgentIds(account);
  if (ids.length) return ids;
  return fallbackAgentId ? [fallbackAgentId] : [];
}

function reportAgentSplit({
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
  const assignments = accountSplitAssignments(account);
  const splitType =
    residualType === "pob" && assignments.length > 1 && !hasStoredAccountSplitMeta(account)
      ? "fixed"
      : accountSplitType(account);

  if (assignments.length) {
    if (reportAgent !== "all") {
      const value = assignments.find((row) => row.agentId === reportAgent)?.split;
      return splitType === "fixed" && residualType === "pob"
        ? amount(value)
        : normalizedPercent(value, 0);
    }

    return assignments.reduce(
      (total, row) =>
        total + (splitType === "fixed" && residualType === "pob" ? amount(row.split) : normalizedPercent(row.split, 0)),
      0
    );
  }

  return residualType === "cc" ? splitPercentFromText(fallbackCommission, 100) : 100;
}

function reportAgentProfit({
  account,
  agentSplit,
  grossCcProfit,
  rawAgentProfit,
  reportAgent,
  residualType,
  transactions,
}: {
  account: MerchantAccount | null | undefined;
  agentSplit: number;
  grossCcProfit: number;
  rawAgentProfit: number;
  reportAgent: string;
  residualType: ResidualPlatformType;
  transactions: number;
}) {
  if (residualType === "cc") return splitAmount(grossCcProfit, agentSplit);

  const splitType =
    residualType === "pob" &&
    accountSplitAssignments(account).length > 1 &&
    !hasStoredAccountSplitMeta(account)
      ? "fixed"
      : accountSplitType(account);

  if (splitType === "fixed" && accountSplitAssignments(account).length) {
    return transactions * agentSplit;
  }

  if (reportAgent !== "all" && accountSplitAssignments(account).length > 1) {
    return splitAmount(rawAgentProfit, agentSplit);
  }

  return rawAgentProfit;
}

function calculatedPobField(field: keyof ResidualForm) {
  return field === "transactionsPerMonth" ||
    field === "greenhubPobBuyRate" ||
    field === "profitPerTransaction" ||
    field === "posIntegrationFee" ||
    field === "rebate" ||
    field === "surcharge" ||
    field === "greenhubPobProfitPerTransaction";
}

function calculatedCcField(field: keyof ResidualForm) {
  return field === "agentCommissionStructure" || field === "greenhubCcSplit" || field === "netProfit";
}

function buildResidualPayload(
  entry: ResidualForm,
  entryType: ResidualPlatformType,
  nextStatus: ResidualForm["status"]
) {
  const pobEntry = entryType === "pob";
  const ccEntry = entryType === "cc";

  return {
    agentCommissionStructure: entry.agentCommissionStructure,
    agentId: entry.agentId,
    agentProfit: entry.agentProfit,
    equipmentCost: entry.equipmentCost,
    greenhubNetProfit: pobEntry ? "" : entry.netProfit,
    greenhubPobBuyRate: ccEntry ? "" : entry.greenhubPobBuyRate,
    greenhubPobNetProfit: ccEntry ? "" : entry.greenhubPobNetProfit,
    greenhubPobProfitPerTransaction: ccEntry ? "" : entry.greenhubPobProfitPerTransaction,
    merchantNotes: ccEntry
      ? writeResidualMeta(entry.merchantNotes, { greenhubCcSplit: entry.greenhubCcSplit })
      : entry.merchantNotes,
    merchantAccountId: entry.merchantAccountId,
    monthlySalesVolume: pobEntry ? "" : entry.monthlySalesVolume,
    oneTimeFees: entry.oneTimeFees,
    platformId: entry.platformId,
    posIntegrationFee: ccEntry ? "" : entry.posIntegrationFee,
    profitPerTransaction: ccEntry ? "" : entry.profitPerTransaction,
    rebate: ccEntry ? "" : entry.rebate,
    residualMonth: months.indexOf(entry.month) + 1,
    residualStatus: nextStatus,
    residualYear: entry.year,
    surcharge: ccEntry ? "" : entry.surcharge,
    transactionsPerMonth: ccEntry ? "" : entry.transactionsPerMonth,
  };
}

function reportMonthLabel(value: string) {
  const [year, numericMonth] = value.split("-");
  return `${months[Number(numericMonth) - 1] ?? "Unknown"} ${year}`;
}

function parseReportMonth(value: string) {
  if (value === "all") return null;

  const [year, numericMonth] = value.split("-");
  const month = Number(numericMonth);
  if (!year || !month) return null;

  return {
    label: reportMonthLabel(value),
    month,
    value,
    year,
  };
}

function residualMonthValue(residual: MonthlyResidual) {
  return `${residual.residual_year}-${residual.residual_month}`;
}

function residualKey(accountId: string, platformId: string | null | undefined, monthValue: string) {
  return `${accountId}::${platformId ?? ""}::${monthValue}`;
}

function formMonthValue(entry: Pick<ResidualForm, "month" | "year">) {
  return `${entry.year}-${months.indexOf(entry.month) + 1}`;
}

function platformResidualType(platform: Platform | null | undefined): ResidualPlatformType {
  return platform?.residual_type === "pob" || inferredResidualPlatformType(platform?.name ?? "") === "pob"
    ? "pob"
    : "cc";
}

function residualBaseKey(accountId: string, platformId: string | null | undefined) {
  return `${accountId}::${platformId ?? ""}`;
}

function residualPeriodScore(residual: MonthlyResidual) {
  return residual.residual_year * 100 + residual.residual_month;
}

function reportRowEditKey(row: ResidualReportRow) {
  return residualKey(row.merchantAccountId, row.platformId, row.monthValue);
}

function monthlyAccountKey(accountId: string, monthValue: string) {
  return `${accountId}::${monthValue}`;
}

function dedupeMonthlyRows(rows: ResidualReportRow[]) {
  const seen = new Set<string>();

  return rows.filter((row) => {
    const key = monthlyAccountKey(row.merchantAccountId, row.monthValue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function savedAt(value: string) {
  return `Saved ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))}`;
}

export default function AdminResidualsPage() {
  return (
    <PortalShell role="admin">
      <AdminResidualsContent />
    </PortalShell>
  );
}

function AdminResidualsContent() {
  const { data, refresh } = usePortalData();
  const [form, setForm] = useState<ResidualForm>(initialForm);
  const [previewDrafts, setPreviewDrafts] = useState<DraftEntry[]>(demoDrafts);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportAgent, setReportAgent] = useState("all");
  const [reportMonth, setReportMonth] = useState(defaultReportMonth);
  const [reportStatus, setReportStatus] = useState("all");
  const [reportView, setReportView] = useState<ResidualReportView>("pob");
  const [recentPage, setRecentPage] = useState(1);
  const [pobFieldsLocked, setPobFieldsLocked] = useState(true);
  const [importMonth, setImportMonth] = useState("July");
  const [importYear, setImportYear] = useState("2026");
  const [importPlatformId, setImportPlatformId] = useState("");
  const [importStatus, setImportStatus] = useState<ResidualForm["status"]>("draft");
  const [parsedImport, setParsedImport] = useState<ParsedResidualImport | null>(null);
  const [importing, setImporting] = useState(false);
  const [rowEdits, setRowEdits] = useState<Record<string, ResidualForm>>({});
  const [pobOverrideRowKeys, setPobOverrideRowKeys] = useState<string[]>([]);
  const [savingRowKey, setSavingRowKey] = useState<string | null>(null);
  const [quickAddAccountId, setQuickAddAccountId] = useState("");
  const [quickAdding, setQuickAdding] = useState(false);
  const [hiddenMonthlyRows, setHiddenMonthlyRows] = useState<string[]>([]);
  const [customResidualForms, setCustomResidualForms] = useState<Record<ResidualPlatformType, CustomResidualAccountForm>>({
    cc: { ...initialCustomResidualAccountForm },
    pob: { ...initialCustomResidualAccountForm },
  });
  const [creatingCustomResidualType, setCreatingCustomResidualType] = useState<ResidualPlatformType | null>(null);
  const draftsMenuRef = useRef<HTMLDivElement>(null);
  const residualFormRef = useRef<HTMLElement>(null);

  const accountOptions = data
    ? data.accounts.map((account) => ({ label: account.account_name, value: account.id }))
    : demoAccounts.map((account) => ({ label: account.merchant, value: account.merchant }));
  const agentOptions = data
    ? data.agents.map((agent) => ({ label: agent.name, value: agent.id }))
    : demoAgents.map((agent) => ({ label: agent.name, value: agent.email }));
  const platformOptions = data
    ? data.platforms.map((platform) => ({ label: platform.name, value: platform.id }))
    : demoPlatforms.map((platform) => ({ label: platform, value: platform }));

  const accountNames = useMemo(
    () => new Map(data?.accounts.map((account) => [account.id, account.account_name]) ?? []),
    [data?.accounts]
  );
  const agentNames = useMemo(
    () => new Map(data?.agents.map((agent) => [agent.id, agent.name]) ?? []),
    [data?.agents]
  );
  const platformNames = useMemo(
    () => new Map(data?.platforms.map((platform) => [platform.id, platform.name]) ?? []),
    [data?.platforms]
  );
  const platformTypes = useMemo(
    () => new Map(data?.platforms.map((platform) => [platform.id, platformResidualType(platform)]) ?? []),
    [data?.platforms]
  );
  const residualTypeForPlatformId = (platformId: string | null | undefined) =>
    platformTypes.get(platformId ?? "") ??
    inferredResidualPlatformType(platformNames.get(platformId ?? "") ?? "Unassigned");
  const quickAddAccountOptions = useMemo(() => {
    const accounts = data?.accounts ?? [];

    return [
      { disabled: true, label: "Add merchant to this month", value: "" },
      ...accounts
        .filter((account) => account.status !== "closed")
        .sort((left, right) => left.account_name.localeCompare(right.account_name))
        .map((account) => {
          const platformName = platformNames.get(account.platform_id ?? "") ?? "Unassigned";
          const agentName = agentNames.get(account.assigned_agent_id ?? "") ?? "Unassigned";
          const type = residualTypeForPlatformId(account.platform_id).toUpperCase();

          return {
            label: `${account.account_name} - ${platformName} (${type}) - ${agentName}`,
            value: account.id,
          };
        }),
    ];
  }, [agentNames, data?.accounts, platformNames, residualTypeForPlatformId]);
  const customPobPlatformOptions = useMemo(
    () => [
      { disabled: true, label: "Select POB platform", value: "" },
      ...(data?.platforms ?? [])
        .filter((platform) => platform.is_active !== false && platformResidualType(platform) === "pob")
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((platform) => ({ label: platform.name, value: platform.id })),
    ],
    [data?.platforms]
  );
  const customCcPlatformOptions = useMemo(
    () => [
      { disabled: true, label: "Select CC platform", value: "" },
      ...(data?.platforms ?? [])
        .filter((platform) => platform.is_active !== false && platformResidualType(platform) === "cc")
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((platform) => ({ label: platform.name, value: platform.id })),
    ],
    [data?.platforms]
  );
  const normalizedAccounts = useMemo(
    () =>
      data?.accounts.map((account) => ({
        account,
        name: normalizedLookupName(account.account_name),
      })) ?? [],
    [data?.accounts]
  );
  const residualBaselinesByAccountPlatform = useMemo(() => {
    const rows = new Map<string, MonthlyResidual>();

    data?.residuals.forEach((residual) => {
      const platformKey = residualBaseKey(residual.merchant_account_id, residual.platform_id);
      const accountKey = residualBaseKey(residual.merchant_account_id, "");

      [platformKey, accountKey].forEach((key) => {
        const current = rows.get(key);
        if (!current || residualPeriodScore(residual) >= residualPeriodScore(current)) {
          rows.set(key, residual);
        }
      });
    });

    return rows;
  }, [data?.residuals]);
  const importPreviewRows = useMemo<ResidualImportPreviewRow[]>(() => {
    if (!parsedImport) return [];

    return parsedImport.rows.map((row) => {
      const normalizedMerchant = normalizedLookupName(row.merchantName);
      const accountMatch =
        normalizedAccounts.find((item) => item.name === normalizedMerchant)?.account ??
        normalizedAccounts.find(
          (item) => item.name.includes(normalizedMerchant) || normalizedMerchant.includes(item.name)
        )?.account ??
        null;
      const platformId = accountMatch?.platform_id || importPlatformId || "";
      const platform = data?.platforms.find((item) => item.id === platformId) ?? null;
      const agentName = agentNames.get(accountMatch?.assigned_agent_id ?? "") ?? "";
      const residualType = platformResidualType(platform);
      const baselineResidual = accountMatch
        ? residualBaselinesByAccountPlatform.get(residualBaseKey(accountMatch.id, platform?.id ?? "")) ??
          residualBaselinesByAccountPlatform.get(residualBaseKey(accountMatch.id, "")) ??
          null
        : null;
      const warnings = [
        accountMatch ? "" : "No matching account",
        accountMatch?.assigned_agent_id ? "" : "No assigned agent",
        platform ? "" : "No platform",
      ].filter(Boolean);

      return {
        ...row,
        account: accountMatch,
        agentName,
        baselineResidual,
        platform,
        ready: warnings.length === 0,
        residualType,
        warnings,
      };
    });
  }, [
    agentNames,
    data?.platforms,
    importPlatformId,
    normalizedAccounts,
    parsedImport,
    residualBaselinesByAccountPlatform,
  ]);
  const readyImportRows = importPreviewRows.filter((row) => row.ready);
  const selectedAccount = data?.accounts.find((account) => account.id === form.merchantAccountId);
  const effectivePlatformId = form.platformId || selectedAccount?.platform_id || "";
  const selectedPlatformName =
    platformOptions.find((platform) => platform.value === effectivePlatformId)?.label ||
    platformNames.get(effectivePlatformId) ||
    effectivePlatformId;
  const residualEntryType: ResidualPlatformType = effectivePlatformId
    ? residualTypeForPlatformId(effectivePlatformId)
    : inferredResidualPlatformType(selectedPlatformName);
  const showPobFields = residualEntryType !== "cc";
  const showCcFields = residualEntryType !== "pob";
  const reportMonthOptions = useMemo(() => {
    if (!data) {
      return [
        { label: "All months", value: "all" },
        { label: "April 2024", value: "2024-4" },
      ];
    }

    const years = new Set<number>([
      new Date().getFullYear(),
      Number(form.year) || new Date().getFullYear(),
      Number(importYear) || new Date().getFullYear(),
      ...data.residuals.map((row) => row.residual_year),
    ]);
    const values = [...years]
      .sort((left, right) => right - left)
      .flatMap((year) => months.map((_, monthIndex) => `${year}-${monthIndex + 1}`));

    return [
      { label: "All months", value: "all" },
      ...values.map((value) => ({ label: reportMonthLabel(value), value })),
    ];
  }, [data, form.year, importYear]);

  const drafts = useMemo<DraftEntry[]>(() => {
    if (!data) return previewDrafts;

    return data.residuals
      .filter((residual) => residual.residual_status === "draft")
      .map((residual) => ({
        id: residual.id,
        title: `${accountNames.get(residual.merchant_account_id) ?? "Unnamed account"} - ${
          months[residual.residual_month - 1] ?? "Unknown month"
        } ${residual.residual_year}`,
        savedAt: savedAt(residual.updated_at || residual.created_at),
        data: formFromResidual(residual),
      }));
  }, [accountNames, data, previewDrafts]);

  useEffect(() => {
    if (!draftsOpen) return;

    function closeMenu(event: MouseEvent) {
      if (!draftsMenuRef.current?.contains(event.target as Node)) setDraftsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setDraftsOpen(false);
    }

    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [draftsOpen]);

  useEffect(() => {
    const importMonthValue = `${importYear}-${months.indexOf(importMonth) + 1}`;
    setReportMonth((current) => (current === "all" ? importMonthValue : current));
  }, [importMonth, importYear]);

  function formForAccountPeriod(base: ResidualForm, account: MerchantAccount, platformOverride?: string) {
    const platformId = platformOverride ?? account.platform_id ?? base.platformId;
    const periodValue = formMonthValue(base);
    const residual =
      residualsByAccountPeriod.get(residualKey(account.id, platformId, periodValue)) ??
      residualsByAccountPeriod.get(residualKey(account.id, "", periodValue));

    if (residual) {
      const entry = formFromResidual(residual);

      return {
        entry: {
          ...entry,
          agentId: entry.agentId || account.assigned_agent_id || "",
          platformId: entry.platformId || platformId,
        },
        residualId: residual.id,
      };
    }

    const baseline =
      residualBaselinesByAccountPlatform.get(residualBaseKey(account.id, platformId)) ??
      residualBaselinesByAccountPlatform.get(residualBaseKey(account.id, ""));
    const baselineMeta = readResidualMeta(baseline?.merchant_notes);

    const entry = withResidualCalculations({
      ...base,
      agentCommissionStructure:
        baseline?.agent_commission_structure ||
        account.commission_structure ||
        "",
      agentId: account.assigned_agent_id ?? "",
      agentProfit: "",
      equipmentCost: rowInputAmount(amount(baseline?.equipment_cost)),
      greenhubCcSplit: baselineMeta.greenhubCcSplit ?? "",
      greenhubPobBuyRate: rowInputAmount(amount(baseline?.greenhub_pob_buy_rate)),
      greenhubPobNetProfit: "",
      greenhubPobProfitPerTransaction: rowInputAmount(
        amount(baseline?.greenhub_pob_profit_per_transaction)
      ),
      merchantAccountId: account.id,
      merchantNotes: readAccountSplitMeta(account.internal_notes, account).cleanNotes || baselineMeta.cleanNotes,
      monthlySalesVolume: "",
      netProfit: "",
      platformId,
      posIntegrationFee: rowInputAmount(amount(baseline?.pos_integration_fee)),
      profitPerTransaction: rowInputAmount(amount(baseline?.profit_per_transaction)),
      rebate: rowInputAmount(amount(baseline?.rebate)),
      surcharge: rowInputAmount(amount(baseline?.surcharge)),
      transactionsPerMonth: "",
    }, residualTypeForPlatformId(platformId));

    return { entry, residualId: null };
  }

  function updateForm(field: keyof ResidualForm, value: string) {
    if (
      data &&
      (field === "merchantAccountId" || field === "month" || field === "year" || field === "platformId")
    ) {
      const next = { ...form, [field]: value };
      const accountId = field === "merchantAccountId" ? value : next.merchantAccountId;
      const account = data.accounts.find((item) => item.id === accountId);

      if (account) {
        const { entry, residualId } = formForAccountPeriod(
          next,
          account,
          field === "platformId" ? value : undefined
        );
        const nextMonthValue = formMonthValue(entry);
        setForm(entry);
        setEditingDraftId(residualId);
        setReportAgent(entry.agentId || account.assigned_agent_id || "all");
        setReportMonth(nextMonthValue);
        setReportView(residualTypeForPlatformId(entry.platformId || account.platform_id));
        setRecentPage(1);
        return;
      }
    }

    if (field === "month" || field === "year") {
      setReportMonth(formMonthValue({ ...form, [field]: value }));
      setRecentPage(1);
    }

    if (field === "agentId") {
      setReportAgent(value || "all");
      setRecentPage(1);
    }

    if (field === "platformId") {
      setReportView(residualTypeForPlatformId(value));
      setRecentPage(1);
    }

    setForm((current) => {
      if (field !== "merchantAccountId") {
        const next = { ...current, [field]: value };
        const nextType = next.platformId ? residualTypeForPlatformId(next.platformId) : residualEntryType;
        if (nextType === "pob" && calculatedPobField(field)) return withPobCalculations(next, field);
        if (nextType === "cc" && calculatedCcField(field)) return withCcCalculations(next, field);
        return next;
      }

      const account = data?.accounts.find((item) => item.id === value);
      return {
        ...current,
        merchantAccountId: value,
        agentId: account ? account.assigned_agent_id ?? "" : current.agentId,
        platformId: account ? account.platform_id ?? "" : current.platformId,
      };
    });
  }

  async function parseImport(file: File) {
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const parsed = await portalFileRequest<ParsedResidualImport>(
        "/api/portal/residuals/parse-import",
        formData
      );
      setParsedImport(parsed);
      if (parsed.warnings.length) setError(parsed.warnings.join(" "));
    } catch (parseError) {
      setParsedImport(null);
      setError(
        parseError instanceof Error
          ? parseError.message
          : "The residual import file could not be read. Export the report as CSV and upload it again."
      );
    }
  }

  function importPayload(row: ResidualImportPreviewRow) {
    const platformType = row.residualType;
    const pobEntry = platformType === "pob";
    const ccEntry = platformType === "cc";
    const baseline = row.baselineResidual;
    const baselineMeta = readResidualMeta(baseline?.merchant_notes);
    const importedOrBaseline = (importedValue: string, baselineValue: number | string | null | undefined) =>
      importedValue || rowInputAmount(amount(baselineValue));
    const entry = withResidualCalculations({
      ...initialForm,
      agentCommissionStructure:
        row.agentCommissionStructure ||
        baseline?.agent_commission_structure ||
        row.account?.commission_structure ||
        "",
      agentId: row.account?.assigned_agent_id ?? "",
      agentProfit: row.agentProfit || rowInputAmount(amount(baseline?.agent_profit)),
      equipmentCost: row.equipmentCost || rowInputAmount(amount(baseline?.equipment_cost)),
      greenhubCcSplit: baselineMeta.greenhubCcSplit ?? "",
      greenhubPobBuyRate: importedOrBaseline(row.greenhubPobBuyRate, baseline?.greenhub_pob_buy_rate),
      greenhubPobNetProfit: row.greenhubPobNetProfit || "",
      greenhubPobProfitPerTransaction: importedOrBaseline(
        row.greenhubPobProfitPerTransaction,
        baseline?.greenhub_pob_profit_per_transaction
      ),
      merchantNotes: row.merchantNotes || baselineMeta.cleanNotes || "",
      merchantAccountId: row.account?.id ?? "",
      month: importMonth,
      monthlySalesVolume: pobEntry ? "" : row.monthlySalesVolume,
      netProfit: pobEntry ? "" : row.greenhubNetProfit,
      platformId: row.platform?.id ?? "",
      posIntegrationFee: importedOrBaseline(row.posIntegrationFee, baseline?.pos_integration_fee),
      profitPerTransaction: importedOrBaseline(row.profitPerTransaction, baseline?.profit_per_transaction),
      rebate: importedOrBaseline(row.rebate, baseline?.rebate),
      status: importStatus,
      surcharge: importedOrBaseline(row.surcharge, baseline?.surcharge),
      transactionsPerMonth: ccEntry ? "" : row.transactionsPerMonth,
      year: importYear,
    }, platformType);

    return {
      ...buildResidualPayload(entry, platformType, importStatus),
      sourceIndex: row.sourceIndex,
      sourceMerchantName: row.merchantName,
    };
  }

  async function importResidualRows() {
    if (!data) {
      setError("Sign in is required before importing residuals.");
      return;
    }

    if (!readyImportRows.length) {
      setError("No matched residual rows are ready to import.");
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const result = await portalRequest<{
        created: number;
        errors?: Array<{ merchantName: string | null; row: number | null }>;
        imported: number;
        requested?: number;
        updated: number;
      }>(
        "/api/portal/residuals/import",
        {
          method: "POST",
          body: JSON.stringify({
            entries: readyImportRows.map((row) => importPayload(row)),
            source: parsedImport?.fileName ?? "monthly residual import",
          }),
        }
      );
      await refresh();
      if (result.errors?.length) {
        const failedNames = result.errors
          .slice(0, 3)
          .map((row) => row.merchantName || (row.row ? `row ${row.row}` : "one row"))
          .join(", ");
        setError(
          `${result.imported} rows imported. ${result.errors.length} rows could not be saved${
            failedNames ? `: ${failedNames}` : ""
          }.`
        );
      }
      showPortalToast({
        title: "Residual import complete",
        message: `${result.imported} rows imported. ${result.updated} updated, ${result.created} created.`,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The residual import could not be saved.");
    } finally {
      setImporting(false);
    }
  }

  function apiPayload(nextStatus: ResidualForm["status"]) {
    return buildResidualPayload(
      withResidualCalculations(form, residualEntryType),
      residualEntryType,
      nextStatus
    );
  }

  async function persistResidual(nextStatus: ResidualForm["status"]) {
    setSaving(true);
    setError(null);

    try {
      if (!data) {
        const draftData = { ...form, status: nextStatus };
        if (nextStatus === "draft") {
          if (editingDraftId) {
            setPreviewDrafts((current) =>
              current.map((draft) =>
                draft.id === editingDraftId
                  ? {
                      ...draft,
                      data: draftData,
                      savedAt: "Saved just now",
                      title: `${
                        accountOptions.find((account) => account.value === draftData.merchantAccountId)
                          ?.label ?? "Untitled residual"
                      } - ${draftData.month} ${draftData.year}`,
                    }
                  : draft
              )
            );
          } else {
            const id = `demo-draft-${Date.now()}`;
            setPreviewDrafts((current) => [
              {
                id,
                data: draftData,
                savedAt: "Saved just now",
                title: `${
                  accountOptions.find((account) => account.value === draftData.merchantAccountId)?.label ??
                  "Untitled residual"
                } - ${draftData.month} ${draftData.year}`,
              },
              ...current,
            ]);
            setEditingDraftId(id);
          }
        }
        setForm(draftData);
        return;
      }

      const payload = apiPayload(nextStatus);
      const result = editingDraftId
        ? await portalRequest<{ residual: MonthlyResidual }>("/api/portal/residuals", {
            method: "PATCH",
            body: JSON.stringify({ ...payload, id: editingDraftId }),
          })
        : await portalRequest<{ residual: MonthlyResidual }>("/api/portal/residuals", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setForm((current) => ({ ...current, status: nextStatus }));
      setEditingDraftId(nextStatus === "draft" ? result.residual.id : null);
      await refresh();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "The residual entry could not be saved.";
      setError(message);
      throw requestError;
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft(draftId: string) {
    setError(null);

    try {
      if (data) {
        await portalRequest(`/api/portal/residuals?id=${encodeURIComponent(draftId)}`, {
          method: "DELETE",
        });
        await refresh();
      } else {
        setPreviewDrafts((current) => current.filter((draft) => draft.id !== draftId));
      }
      if (editingDraftId === draftId) {
        setEditingDraftId(null);
        setForm(initialForm);
      }
      showPortalToast({ title: "Draft deleted", message: "The saved residual draft was removed." });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The draft could not be deleted.");
    }
  }

  function loadDraft(draft: DraftEntry) {
    setForm(draft.data);
    setEditingDraftId(draft.id);
    setDraftsOpen(false);
  }

  async function notifyAgent() {
    if (!selectedReportPeriod || reportAgent === "all") {
      setError("Choose one agent and one month before marking residuals complete.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (data) {
        await portalRequest("/api/portal/notifications", {
          method: "POST",
          body: JSON.stringify({
            agentId: reportAgent,
            residualMonth: selectedReportPeriod.month,
            residualYear: selectedReportPeriod.year,
          }),
        });
        await refresh();
      }
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "The notification could not be recorded.";
      setError(message);
      throw requestError;
    } finally {
      setSaving(false);
    }
  }

  function loadReportRow(row: ResidualReportRow) {
    const period = parseReportMonth(row.monthValue);
    const value = (amountValue: number) => (row.hasResidual ? inputValue(amountValue) : "");

    setForm({
      agentCommissionStructure: row.agentCommissionStructure === "Not specified" ? "" : row.agentCommissionStructure,
      agentId: row.agentId,
      agentProfit: value(row.agentProfit),
      equipmentCost: value(row.equipmentCost),
      greenhubCcSplit: row.greenhubCcSplit,
      greenhubPobBuyRate: value(row.greenhubPobBuyRate),
      greenhubPobNetProfit: value(row.greenhubPobNetProfit),
      greenhubPobProfitPerTransaction: value(row.greenhubPobProfitPerTransaction),
      merchantNotes: row.hasResidual ? row.merchantNotes : "",
      merchantAccountId: row.merchantAccountId,
      month: period ? months[period.month - 1] ?? form.month : form.month,
      monthlySalesVolume: value(row.salesVolume),
      netProfit: value(row.greenhubNetProfit),
      oneTimeFees: "",
      platformId: row.platformId,
      posIntegrationFee: value(row.posIntegrationFee),
      profitPerTransaction: value(row.profitPerTransaction),
      rebate: value(row.rebate),
      status: row.status,
      surcharge: value(row.surcharge),
      transactionsPerMonth: value(row.transactionsPerMonth),
      year: period?.year ?? form.year,
    });
    setEditingDraftId(row.residualId);
    setDraftsOpen(false);
    residualFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    showPortalToast({
      title: row.hasResidual ? "Residual loaded" : "Account loaded",
      message: row.hasResidual
        ? "Update the monthly values in the entry form."
        : "Add this account's monthly residual values, then save.",
    });
  }

  function updateReportRow(row: ResidualReportRow, field: keyof ResidualForm, value: string) {
    const key = reportRowEditKey(row);

    setRowEdits((current) => {
      const base = current[key] ?? formFromReportRow(row);
      const next = { ...base, [field]: value };

      return {
        ...current,
        [key]:
          (row.residualType === "pob" && calculatedPobField(field)) ||
          (row.residualType === "cc" && calculatedCcField(field))
            ? withResidualCalculations(next, row.residualType, field)
            : next,
      };
    });
  }

  async function saveReportRow(row: ResidualReportRow) {
    if (!data) {
      setError("Sign in is required before saving residual rows.");
      return;
    }

    const key = reportRowEditKey(row);
    const entry = withResidualCalculations(
      rowEdits[key] ?? formFromReportRow(row),
      row.residualType,
      row.residualType === "pob" && pobOverrideRowKeys.includes(key)
        ? "greenhubPobProfitPerTransaction"
        : undefined
    );

    setSavingRowKey(key);
    setError(null);

    try {
      await portalRequest<{ residual: MonthlyResidual }>("/api/portal/residuals", {
        method: row.residualId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...buildResidualPayload(entry, row.residualType, entry.status),
          ...(row.residualId ? { id: row.residualId } : {}),
        }),
      });
      setRowEdits((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      await refresh();
      showPortalToast({
        title: "Residual row saved",
        message: `${row.merchant} was saved for ${row.month}.`,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The residual row could not be saved.");
    } finally {
      setSavingRowKey(null);
    }
  }

  function setCustomResidualField(
    type: ResidualPlatformType,
    field: keyof CustomResidualAccountForm,
    value: string
  ) {
    setCustomResidualForms((current) => ({
      ...current,
      [type]: {
        ...current[type],
        [field]: value,
      },
    }));
  }

  async function createCustomResidualAccount(type: ResidualPlatformType) {
    if (!data) {
      setError("Sign in is required before adding a custom residual account.");
      return;
    }

    if (!selectedReportPeriod) {
      setError("Choose a single month before adding a custom residual account.");
      return;
    }

    const custom = customResidualForms[type];
    const accountName = custom.accountName.trim();

    if (!accountName) {
      setError("Custom account name is required.");
      return;
    }

    if (!custom.agentId) {
      setError("Choose an agent for the custom residual account.");
      return;
    }

    if (!custom.platformId) {
      setError(`Choose a ${type.toUpperCase()} platform for the custom residual account.`);
      return;
    }

    const normalizedName = normalizedLookupName(accountName);
    const existingAccount = data.accounts.find(
      (account) =>
        normalizedLookupName(account.account_name) === normalizedName &&
        account.platform_id === custom.platformId
    );

    setCreatingCustomResidualType(type);
    setError(null);

    try {
      const account = existingAccount
        ? existingAccount
        : (
            await portalRequest<{ account: MerchantAccount }>("/api/portal/accounts", {
              method: "POST",
              body: JSON.stringify({
                accountName,
                assignedAgentId: custom.agentId,
                commissionStructure: custom.agentCommissionStructure,
                internalNotes: custom.merchantNotes || "Created from residual portal custom add-on.",
                platformId: custom.platformId,
                primaryAgentSplit: "100",
                secondaryAgentId: "",
                secondaryAgentSplit: "0",
                status: "active",
              }),
            })
          ).account;
      const existingResidual =
        residualsByAccountPeriod.get(
          residualKey(account.id, custom.platformId, selectedReportPeriod.value)
        ) ??
        residualsByAccountPeriod.get(residualKey(account.id, "", selectedReportPeriod.value));

      if (existingResidual) {
        setHiddenMonthlyRows((current) =>
          current.filter((key) => key !== monthlyAccountKey(account.id, selectedReportPeriod.value))
        );
        setCustomResidualForms((current) => ({
          ...current,
          [type]: { ...initialCustomResidualAccountForm },
        }));
        setReportAgent(custom.agentId);
        setReportMonth(selectedReportPeriod.value);
        setReportStatus("all");
        setReportView(type);
        setRecentPage(1);
        showPortalToast({
          title: "Account already listed",
          message: `${accountName} already has a residual row for ${selectedReportPeriod.label}.`,
        });
        return;
      }

      const entry = withResidualCalculations(
        {
          ...initialForm,
          agentCommissionStructure: custom.agentCommissionStructure,
          agentId: custom.agentId,
          equipmentCost: custom.equipmentCost,
          greenhubPobBuyRate: type === "pob" ? custom.greenhubPobBuyRate : "",
          merchantAccountId: account.id,
          merchantNotes: custom.merchantNotes,
          month: months[selectedReportPeriod.month - 1] ?? defaultEntryMonth,
          monthlySalesVolume: type === "cc" ? custom.monthlySalesVolume : "",
          netProfit: type === "cc" ? custom.netProfit : "",
          platformId: custom.platformId,
          posIntegrationFee: type === "pob" ? custom.posIntegrationFee : "",
          profitPerTransaction: type === "pob" ? custom.profitPerTransaction : "",
          rebate: type === "pob" ? custom.rebate : "",
          status: "draft",
          surcharge: type === "pob" ? custom.surcharge : "",
          transactionsPerMonth: type === "pob" ? custom.transactionsPerMonth : "",
          year: selectedReportPeriod.year,
        },
        type
      );

      await portalRequest<{ residual: MonthlyResidual }>("/api/portal/residuals", {
        method: "POST",
        body: JSON.stringify(buildResidualPayload(entry, type, "draft")),
      });
      setHiddenMonthlyRows((current) =>
        current.filter((key) => key !== monthlyAccountKey(account.id, selectedReportPeriod.value))
      );
      setCustomResidualForms((current) => ({
        ...current,
        [type]: { ...initialCustomResidualAccountForm },
      }));
      setReportAgent(custom.agentId);
      setReportMonth(selectedReportPeriod.value);
      setReportStatus("all");
      setReportView(type);
      setRecentPage(1);
      await refresh();
      showPortalToast({
        title: `${type.toUpperCase()} account added`,
        message: `${accountName} was added to ${selectedReportPeriod.label}.`,
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The custom residual account could not be added."
      );
    } finally {
      setCreatingCustomResidualType(null);
    }
  }

  async function quickAddResidualAccount() {
    if (!data) {
      setError("Sign in is required before adding a residual row.");
      return;
    }

    if (!selectedReportPeriod) {
      setError("Choose a single month before adding an account to residuals.");
      return;
    }

    const account = data.accounts.find((item) => item.id === quickAddAccountId);
    if (!account) {
      setError("Choose a merchant account to add.");
      return;
    }

    const platformId = account.platform_id ?? "";
    const residualType = residualTypeForPlatformId(platformId);
    const { entry, residualId } = formForAccountPeriod(
      {
        ...initialForm,
        month: months[selectedReportPeriod.month - 1] ?? defaultEntryMonth,
        status: "draft",
        year: selectedReportPeriod.year,
      },
      account
    );

    if (residualId) {
      setHiddenMonthlyRows((current) =>
        current.filter((key) => key !== monthlyAccountKey(account.id, selectedReportPeriod.value))
      );
      setQuickAddAccountId("");
      showPortalToast({
        title: "Account already listed",
        message: `${account.account_name} already has a residual row for ${selectedReportPeriod.label}.`,
      });
      return;
    }

    setQuickAdding(true);
    setError(null);

    try {
      await portalRequest<{ residual: MonthlyResidual }>("/api/portal/residuals", {
        method: "POST",
        body: JSON.stringify(buildResidualPayload(withResidualCalculations(entry, residualType), residualType, "draft")),
      });
      setHiddenMonthlyRows((current) =>
        current.filter((key) => key !== monthlyAccountKey(account.id, selectedReportPeriod.value))
      );
      setQuickAddAccountId("");
      setReportView(residualType);
      setReportStatus("all");
      setRecentPage(1);
      await refresh();
      showPortalToast({
        title: "Account added",
        message: `${account.account_name} was added to ${selectedReportPeriod.label}.`,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The residual row could not be added.");
    } finally {
      setQuickAdding(false);
    }
  }

  async function removeReportRow(row: ResidualReportRow) {
    const hiddenKey = monthlyAccountKey(row.merchantAccountId, row.monthValue);

    if (!data) {
      setHiddenMonthlyRows((current) => [...new Set([...current, hiddenKey])]);
      return;
    }

    if (!row.residualId) {
      setHiddenMonthlyRows((current) => [...new Set([...current, hiddenKey])]);
      showPortalToast({
        title: "Row removed from this month",
        message: `${row.merchant} is hidden from ${row.month}. The account still exists in Accounts.`,
      });
      return;
    }

    if (row.status !== "draft") {
      setError("Finalized residual rows cannot be removed. Move it back to draft before removing it.");
      return;
    }

    setSavingRowKey(reportRowEditKey(row));
    setError(null);

    try {
      await portalRequest(`/api/portal/residuals?id=${encodeURIComponent(row.residualId)}`, {
        method: "DELETE",
      });
      setRowEdits((current) => {
        const next = { ...current };
        delete next[reportRowEditKey(row)];
        return next;
      });
      setHiddenMonthlyRows((current) => [...new Set([...current, hiddenKey])]);
      await refresh();
      showPortalToast({
        title: "Residual row removed",
        message: `${row.merchant} was removed from ${row.month}. The account still exists in Accounts.`,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The residual row could not be removed.");
    } finally {
      setSavingRowKey(null);
    }
  }

  const selectedReportPeriod = useMemo(() => parseReportMonth(reportMonth), [reportMonth]);
  const residualsByAccountPeriod = useMemo(() => {
    const rows = new Map<string, MonthlyResidual>();

    data?.residuals.forEach((residual) => {
      const monthValue = residualMonthValue(residual);
      rows.set(residualKey(residual.merchant_account_id, residual.platform_id, monthValue), residual);
      rows.set(residualKey(residual.merchant_account_id, "", monthValue), residual);
    });

    return rows;
  }, [data?.residuals]);
  const liveReportRows = useMemo<ResidualReportRow[]>(() => {
    if (!data) return [];

    function rowFromResidual(residual: MonthlyResidual, account?: MerchantAccount): ResidualReportRow {
      const rowAccount =
        account ?? data?.accounts.find((item) => item.id === residual.merchant_account_id) ?? null;
      const platformId = rowAccount?.platform_id ?? residual.platform_id ?? "";
      const agentId = residual.agent_id || rowAccount?.assigned_agent_id || "";
      const agentIds = reportAgentIds(rowAccount, agentId);
      const secondaryAgentId = agentIds.find((id) => id !== agentId) ?? rowAccount?.secondary_agent_id ?? null;
      const residualType = residualTypeForPlatformId(platformId);
      const agentSplit = reportAgentSplit({
        account: rowAccount,
        fallbackCommission: residual.agent_commission_structure || rowAccount?.commission_structure,
        reportAgent,
        residualType,
      });
      const rawAgentProfit = amount(residual.agent_profit);
      const transactions = amount(residual.transactions_per_month);
      const agentProfit = reportAgentProfit({
        account: rowAccount,
        agentSplit,
        grossCcProfit: amount(residual.greenhub_net_profit),
        rawAgentProfit,
        reportAgent,
        residualType,
        transactions,
      });
      const residualMeta = readResidualMeta(residual.merchant_notes);
      const displayAgentId = reportAgent !== "all" ? reportAgent : agentId;
      const primaryAgentName = agentNames.get(agentId) ?? "Unknown agent";
      const assignmentNames = agentIds
        .map((id) => agentNames.get(id))
        .filter((name): name is string => Boolean(name));

      return {
        agent:
          reportAgent !== "all"
            ? agentNames.get(displayAgentId) ?? primaryAgentName
            : assignmentNames.length > 1
              ? assignmentNames.join(" + ")
              : primaryAgentName,
        agentCommissionStructure:
          residual.agent_commission_structure ||
          rowAccount?.commission_structure ||
          (residualType === "cc" ? splitLabel(agentSplit) : "") ||
          "Not specified",
        agentId,
        agentIds,
        agentProfit,
        agentSplit,
        equipmentCost: amount(residual.equipment_cost),
        greenhubCcSplit: residualMeta.greenhubCcSplit ?? "",
        greenhubNetProfit: amount(residual.greenhub_net_profit),
        greenhubPobBuyRate: amount(residual.greenhub_pob_buy_rate),
        greenhubPobNetProfit: amount(residual.greenhub_pob_net_profit),
        greenhubPobProfitPerTransaction: amount(residual.greenhub_pob_profit_per_transaction),
        hasResidual: true,
        id: residual.id,
        merchant: accountNames.get(residual.merchant_account_id) ?? rowAccount?.account_name ?? "Unknown account",
        merchantAccountId: residual.merchant_account_id,
        merchantNotes: residualMeta.cleanNotes,
        month: `${months[residual.residual_month - 1]} ${residual.residual_year}`,
        monthValue: residualMonthValue(residual),
        platform: platformNames.get(platformId) ?? "Unassigned",
        platformId,
        posIntegrationFee: amount(residual.pos_integration_fee),
        profitPerTransaction: amount(residual.profit_per_transaction),
        rebate: amount(residual.rebate),
        residualId: residual.id,
        residualType,
        salesVolume: amount(residual.monthly_sales_volume),
        secondaryAgentId,
        status: residual.residual_status,
        surcharge: amount(residual.surcharge),
        transactionsPerMonth: transactions,
      };
    }

    const matchesReportView = (row: ResidualReportRow) =>
      reportView === "total" || row.residualType === reportView;

    if (!selectedReportPeriod) {
      return data.residuals.map((residual) => rowFromResidual(residual)).filter(matchesReportView);
    }

    return data.accounts
      .filter((account) => account.status !== "closed")
      .filter(
        (account) =>
          reportView === "total" || residualTypeForPlatformId(account.platform_id) === reportView
      )
      .sort((left, right) => left.account_name.localeCompare(right.account_name))
      .map((account) => {
        const platformId = account.platform_id ?? "";
        const residualType = residualTypeForPlatformId(platformId);
        const residual =
          residualsByAccountPeriod.get(residualKey(account.id, platformId, selectedReportPeriod.value)) ??
          residualsByAccountPeriod.get(residualKey(account.id, "", selectedReportPeriod.value));

        if (residual) return rowFromResidual(residual, account);

        const agentId = account.assigned_agent_id ?? "";
        const agentIds = reportAgentIds(account, agentId);
        const secondaryAgentId = agentIds.find((id) => id !== agentId) ?? account.secondary_agent_id ?? null;
        const baseline =
          residualBaselinesByAccountPlatform.get(residualBaseKey(account.id, platformId)) ??
          residualBaselinesByAccountPlatform.get(residualBaseKey(account.id, ""));
        const agentSplit = reportAgentSplit({
          account,
          fallbackCommission: baseline?.agent_commission_structure || account.commission_structure,
          reportAgent,
          residualType,
        });
        const primaryAgentName = agentNames.get(agentId) ?? "Unassigned";
        const assignmentNames = agentIds
          .map((id) => agentNames.get(id))
          .filter((name): name is string => Boolean(name));
        const baselineMeta = readResidualMeta(baseline?.merchant_notes);

        return {
          agent:
            reportAgent !== "all"
              ? agentNames.get(reportAgent) ?? primaryAgentName
              : assignmentNames.length > 1
                ? assignmentNames.join(" + ")
                : primaryAgentName,
          agentCommissionStructure:
            baseline?.agent_commission_structure ||
            account.commission_structure ||
            (residualType === "cc" ? splitLabel(agentSplit) : "") ||
            "Not specified",
          agentId,
          agentIds,
          agentSplit,
          agentProfit: 0,
          equipmentCost: amount(baseline?.equipment_cost),
          greenhubCcSplit: baselineMeta.greenhubCcSplit ?? "",
          greenhubNetProfit: 0,
          greenhubPobBuyRate: amount(baseline?.greenhub_pob_buy_rate),
          greenhubPobNetProfit: 0,
          greenhubPobProfitPerTransaction: amount(baseline?.greenhub_pob_profit_per_transaction),
          hasResidual: false,
          id: `pending-${account.id}-${selectedReportPeriod.value}`,
          merchant: account.account_name,
          merchantAccountId: account.id,
          merchantNotes: readAccountSplitMeta(account.internal_notes, account).cleanNotes,
          month: selectedReportPeriod.label,
          monthValue: selectedReportPeriod.value,
          platform: platformNames.get(platformId) ?? "Unassigned",
          platformId,
          posIntegrationFee: amount(baseline?.pos_integration_fee),
          profitPerTransaction: amount(baseline?.profit_per_transaction),
          rebate: amount(baseline?.rebate),
          residualId: null,
          residualType,
          salesVolume: 0,
          secondaryAgentId,
          status: "draft" as const,
          surcharge: amount(baseline?.surcharge),
          transactionsPerMonth: 0,
        };
      })
      .filter((row) => row.hasResidual || !hiddenMonthlyRows.includes(monthlyAccountKey(row.merchantAccountId, row.monthValue)));
  }, [
    accountNames,
    agentNames,
    data,
    hiddenMonthlyRows,
    platformNames,
    platformTypes,
    reportAgent,
    reportView,
    residualsByAccountPeriod,
    residualBaselinesByAccountPlatform,
    selectedReportPeriod,
  ]);
  const previewReportRows = useMemo(
    () => demoResidualRows.map((row) => demoReportRow(row)),
    []
  );
  const reportRows = data ? dedupeMonthlyRows(liveReportRows) : previewReportRows;
  const filteredReportRows = reportRows.filter(
    (row) =>
      (reportAgent === "all" || row.agentIds.includes(reportAgent)) &&
      (reportMonth === "all" || row.monthValue === reportMonth) &&
      (reportStatus === "all" || row.status === reportStatus)
  );
  const visibleReportRows = (
    reportView === "total"
      ? filteredReportRows
      : filteredReportRows.filter((row) => row.residualType === reportView)
  )
    .slice()
    .sort(
      (left, right) =>
        left.merchant.localeCompare(right.merchant) ||
        left.platform.localeCompare(right.platform) ||
        left.monthValue.localeCompare(right.monthValue)
    );
  const totalRows = visibleReportRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / residualsPerPage));
  const activePage = Math.min(recentPage, pageCount);
  const pageOffset = (activePage - 1) * residualsPerPage;
  const paginatedReportRows = visibleReportRows.slice(pageOffset, pageOffset + residualsPerPage);
  const reportTotals = totalResiduals(visibleReportRows);

  return (
    <>
      <PageHeader
        title="Monthly Residuals"
        subtitle="Enter monthly sales volume, net profit, costs, and agent residuals."
      />

      <section className="mb-6 rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <UploadCloud aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Import Monthly Residual Report</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
                Upload a CSV or XLSX report, map it to existing merchant accounts, then import the matched rows into the selected month.
              </p>
            </div>
          </div>
          {parsedImport ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {readyImportRows.length} of {importPreviewRows.length} rows ready
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[170px_140px_minmax(220px,1fr)_150px_minmax(220px,1.2fr)]">
          <PortalSelect
            ariaLabel="Import month"
            value={importMonth}
            onValueChange={setImportMonth}
            options={months.map((month) => ({ label: month, value: month }))}
          />
          <input
            className={portalInputClass}
            placeholder="Year"
            value={importYear}
            onChange={(event) => setImportYear(event.target.value)}
          />
          <PortalSelect
            ariaLabel="Fallback platform for accounts without a saved platform"
            value={importPlatformId}
            onValueChange={setImportPlatformId}
            options={[
              { label: "Use each account's saved platform", value: "" },
              ...platformOptions.filter((option) => option.value),
            ]}
          />
          <PortalSelect
            ariaLabel="Import residual status"
            value={importStatus}
            onValueChange={(status) => setImportStatus(status as ResidualForm["status"])}
            options={[
              { label: "Draft", value: "draft" },
              { label: "Finalized", value: "finalized" },
            ]}
          />
          <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100">
            <span className="truncate">{parsedImport?.fileName ?? "Choose CSV or XLSX file"}</span>
            <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600">Browse</span>
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void parseImport(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>

        {parsedImport ? (
          <div className="mt-5 overflow-hidden rounded-lg border border-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Import preview: {parsedImport.sheetName}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Matching is based on merchant account names already saved in the portal.
                </p>
              </div>
              <button
                type="button"
                disabled={importing || !readyImportRows.length}
                onClick={() => void importResidualRows()}
                className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? "Importing..." : `Import ${readyImportRows.length} matched rows`}
              </button>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="w-full min-w-[980px] text-left text-xs text-slate-900">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
                  <tr>
                    <th className="p-3">Merchant from file</th>
                    <th className="px-3 py-3">Matched account</th>
                    <th className="px-3 py-3">Agent</th>
                    <th className="px-3 py-3">Platform</th>
                    <th className="px-3 py-3 text-right">Transactions</th>
                    <th className="px-3 py-3 text-right">Agent residual</th>
                    <th className="px-3 py-3 text-right">GreenHub POB net</th>
                    <th className="px-3 py-3">Import status</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreviewRows.slice(0, 80).map((row) => (
                    <tr key={`${row.sourceIndex}-${row.merchantName}`} className="border-t border-slate-200">
                      <td className="p-3 font-semibold text-slate-950">{row.merchantName}</td>
                      <td className="px-3 py-3">{row.account?.account_name ?? "-"}</td>
                      <td className="px-3 py-3">{row.agentName || "-"}</td>
                      <td className="px-3 py-3">
                        {row.platform ? `${row.platform.name} (${row.residualType.toUpperCase()})` : "-"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{row.transactionsPerMonth || "-"}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {row.agentProfit ? currency(row.agentProfit) : "-"}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
                        {row.greenhubPobNetProfit ? currency(row.greenhubPobNetProfit) : "-"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            row.ready
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {row.ready ? "Ready" : row.warnings.join(", ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}

      <section ref={residualFormRef} className="hidden">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Add Monthly Residual Entry</h2>
            <p className="mt-1 text-sm text-slate-700">
              Admin-entered numbers. Agents only see finalized reporting.
            </p>
          </div>
          <div ref={draftsMenuRef} className="relative">
            <button
              type="button"
              aria-expanded={draftsOpen}
              aria-haspopup="menu"
              onClick={() => setDraftsOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
            >
              <FileText aria-hidden="true" className="h-4 w-4 text-slate-600" />
              Drafts
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
                {drafts.length}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 text-slate-500 transition-transform ${
                  draftsOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {draftsOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/70"
              >
                <div className="border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-950">Saved drafts</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Select a draft to restore its residual details.
                  </p>
                </div>
                {drafts.length ? (
                  drafts.map((draft) => (
                    <div key={draft.id} className="flex items-center gap-1 px-1 py-1 hover:bg-slate-50">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => loadDraft(draft)}
                        className="min-w-0 flex-1 rounded-md px-3 py-2 text-left"
                      >
                        <p className="truncate text-sm font-semibold text-slate-900">{draft.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600">{draft.savedAt}</p>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${draft.title}`}
                        title="Delete draft"
                        onClick={() => void deleteDraft(draft.id)}
                        className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="px-4 py-5 text-sm text-slate-600">No saved drafts.</p>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <ResidualFieldShell label="Merchant location">
            <PortalSelect
              value={form.merchantAccountId}
              onValueChange={(merchantAccountId) => updateForm("merchantAccountId", merchantAccountId)}
              options={[{ disabled: true, label: "Select merchant account", value: "" }, ...accountOptions]}
            />
          </ResidualFieldShell>
          <ResidualFieldShell label="Assigned agent">
            <PortalSelect
              value={form.agentId}
              onValueChange={(agentId) => updateForm("agentId", agentId)}
              options={[{ disabled: true, label: "Select agent", value: "" }, ...agentOptions]}
            />
          </ResidualFieldShell>
          <ResidualFieldShell label="Processing platform">
            <PortalSelect
              value={form.platformId}
              onValueChange={(platformId) => updateForm("platformId", platformId)}
              options={[{ disabled: true, label: "Select platform", value: "" }, ...platformOptions]}
            />
          </ResidualFieldShell>
          <ResidualFieldShell label="Residual month">
            <PortalSelect
              value={form.month}
              onValueChange={(month) => updateForm("month", month)}
              options={months.map((month) => ({ label: month, value: month }))}
            />
          </ResidualFieldShell>
          <ResidualFieldShell label="Residual year">
            <input
              className={portalInputClass}
              placeholder="Year"
              value={form.year}
              onChange={(event) => updateForm("year", event.target.value)}
            />
          </ResidualFieldShell>
          <ResidualFieldShell label="Entry status">
            <PortalSelect
              value={form.status}
              onValueChange={(status) => updateForm("status", status)}
              options={[
                { label: "Draft", value: "draft" },
                { label: "Finalized", value: "finalized" },
              ]}
            />
          </ResidualFieldShell>
          {showPobFields ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 md:col-span-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                {pobFieldsLocked ? (
                  <Lock aria-hidden="true" className="h-4 w-4 text-slate-600" />
                ) : (
                  <Unlock aria-hidden="true" className="h-4 w-4 text-slate-600" />
                )}
                <span>
                  POB rate fields are {pobFieldsLocked ? "locked" : "unlocked"}. Transaction counts stay editable and recalculate residual totals.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPobFieldsLocked((locked) => !locked)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                {pobFieldsLocked ? "Unlock fields" : "Lock fields"}
              </button>
            </div>
          ) : null}
          {showPobFields ? (
            <ResidualSectionLabel
              title="Locked account setup"
              description="Saved merchant terms for this account. Unlock only when a permanent rate, fee, or commission value needs to change."
            />
          ) : null}
          {showPobFields ? (
            <ResidualInput
              label="GreenHub POB Buy Rate"
              field="greenhubPobBuyRate"
              form={form}
              updateForm={updateForm}
              disabled={pobFieldsLocked && residualEntryType === "pob"}
            />
          ) : null}
          <ResidualFieldShell label="Agent commission structure">
            <input
              className={`${portalInputClass} disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none`}
              disabled={pobFieldsLocked && residualEntryType === "pob"}
              placeholder="Agent Commission Structure"
              value={form.agentCommissionStructure}
              onChange={(event) => updateForm("agentCommissionStructure", event.target.value)}
            />
          </ResidualFieldShell>
          {showCcFields ? (
            <>
              <ResidualSectionLabel
                title="CC residual values"
                description="Card-processing monthly values for the selected merchant and reporting month."
              />
              <ResidualInput label="Monthly Sales Volume" field="monthlySalesVolume" form={form} updateForm={updateForm} />
              <ResidualInput label="Gross Profit" field="netProfit" form={form} updateForm={updateForm} />
            </>
          ) : null}
          {showPobFields ? (
            <>
              <ResidualInput
                label="Surcharge"
                field="surcharge"
                form={form}
                updateForm={updateForm}
                disabled={pobFieldsLocked && residualEntryType === "pob"}
              />
              <ResidualInput
                label="Rebate to Merchant"
                field="rebate"
                form={form}
                updateForm={updateForm}
                disabled={pobFieldsLocked && residualEntryType === "pob"}
              />
              <ResidualInput
                label="POS Integration Fee"
                field="posIntegrationFee"
                form={form}
                updateForm={updateForm}
                disabled={pobFieldsLocked && residualEntryType === "pob"}
              />
              <ResidualInput
                label="Agent Profit Per Transaction"
                field="profitPerTransaction"
                form={form}
                updateForm={updateForm}
                disabled={pobFieldsLocked && residualEntryType === "pob"}
              />
              <ResidualInput
                label="GreenHub POB Profit Per Transaction"
                field="greenhubPobProfitPerTransaction"
                form={form}
                updateForm={updateForm}
                disabled={pobFieldsLocked && residualEntryType === "pob"}
              />
              <ResidualSectionLabel
                title="Monthly POB values"
                description="Enter the transaction count for this month. Agent residual and GreenHub POB net profit recalculate from the locked account setup."
              />
              <ResidualInput label="Transactions Per Month" field="transactionsPerMonth" form={form} updateForm={updateForm} />
            </>
          ) : null}
          <ResidualInput
            label="Agent Profit"
            field="agentProfit"
            form={form}
            updateForm={updateForm}
            disabled={pobFieldsLocked && residualEntryType === "pob"}
          />
          {showPobFields ? (
            <ResidualInput
              label="GreenHub POB Net Profit"
              field="greenhubPobNetProfit"
              form={form}
              updateForm={updateForm}
              disabled={pobFieldsLocked && residualEntryType === "pob"}
            />
          ) : null}
          <ResidualInput
            label="Equipment Cost"
            field="equipmentCost"
            form={form}
            updateForm={updateForm}
            disabled={pobFieldsLocked && residualEntryType === "pob"}
          />
          <div className="md:col-span-3">
            <ResidualFieldShell label="Merchant notes">
              <textarea
                className={portalInputClass}
                placeholder="Merchant Notes"
                rows={3}
                value={form.merchantNotes}
                onChange={(event) => updateForm("merchantNotes", event.target.value)}
              />
            </ResidualFieldShell>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm font-medium text-rose-700">{error}</p> : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <PortalActionButton
            type="button"
            disabled={saving}
            onClick={() => persistResidual(form.status)}
            toastTitle="Residual saved"
            toastMessage="The monthly residual entry has been saved."
            className="rounded-xl bg-emerald-800 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Residual Entry"}
          </PortalActionButton>
          <PortalActionButton
            type="button"
            disabled={saving}
            onClick={() => persistResidual("draft")}
            toastTitle="Draft saved"
            toastMessage="The residual entry has been saved as a draft."
            className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save as Draft
          </PortalActionButton>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Bell aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-950">Completion Notification</h2>
              <p className="mt-1 text-sm text-slate-700">
                Finalize residuals for the selected agent and period, then record the notification.
              </p>
            </div>
          </div>
          <PortalActionButton
            type="button"
            disabled={saving}
            onClick={notifyAgent}
            toastTitle="Agent notified"
            toastMessage="Finalized residuals were recorded for the selected agent."
            className="rounded-xl border border-emerald-300 bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Mark Residuals Complete & Notify Agent
          </PortalActionButton>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-300 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-semibold text-slate-950">Residual Reporting by Agent</h2>
              <p className="mt-1 text-sm text-slate-700">
                Review POB residuals, CC residuals, and the combined total residual payout.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[560px]">
              <PortalSelect
                ariaLabel="Filter residual reporting by agent"
                value={reportAgent}
                onValueChange={(value) => {
                  setReportAgent(value);
                  setRecentPage(1);
                }}
                options={[{ label: "All agents", value: "all" }, ...agentOptions]}
              />
              <PortalSelect
                ariaLabel="Filter residual reporting by month"
                value={reportMonth}
                onValueChange={(value) => {
                  setReportMonth(value);
                  setRecentPage(1);
                }}
                options={reportMonthOptions}
              />
              <PortalSelect
                ariaLabel="Filter residual reporting by status"
                value={reportStatus}
                onValueChange={(value) => {
                  setReportStatus(value);
                  setRecentPage(1);
                }}
                options={[
                  { label: "All statuses", value: "all" },
                  { label: "Finalized", value: "finalized" },
                  { label: "Draft", value: "draft" },
                ]}
              />
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3 rounded-lg border border-slate-300 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">Add merchant to monthly residuals</p>
              <p className="mt-0.5 text-xs text-slate-600">
                Adds a draft row for the selected month without changing the saved merchant account.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(280px,1fr)_auto] lg:min-w-[620px]">
              <PortalSelect
                ariaLabel="Add merchant account to selected residual month"
                value={quickAddAccountId}
                onValueChange={setQuickAddAccountId}
                options={quickAddAccountOptions}
              />
              <button
                type="button"
                disabled={quickAdding || !quickAddAccountId || !selectedReportPeriod}
                onClick={() => void quickAddResidualAccount()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {quickAdding ? "Adding..." : `Add to ${selectedReportPeriod?.label ?? "month"}`}
              </button>
            </div>
          </div>
          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            {residualReportViews.map(({ description, icon: Icon, id, label }) => {
              const active = reportView === id;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setReportView(id);
                    setRecentPage(1);
                  }}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    active
                      ? "border-emerald-800 bg-emerald-900 text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      active ? "bg-emerald-800 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" strokeWidth={1.8} />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className={`mt-1 block text-xs leading-5 ${active ? "text-emerald-50" : "text-slate-600"}`}>
                      {description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {reportView === "pob" ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setPobFieldsLocked((locked) => !locked)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-100"
              >
                {pobFieldsLocked ? (
                  <Lock aria-hidden="true" className="h-4 w-4 text-slate-600" />
                ) : (
                  <Unlock aria-hidden="true" className="h-4 w-4 text-slate-600" />
                )}
                {pobFieldsLocked ? "Unlock POB static fields" : "Lock POB static fields"}
              </button>
            </div>
          ) : null}
        </div>
        <ResidualSummary view={reportView} totals={reportTotals} />
        <ResidualReportTable
          rows={paginatedReportRows}
          view={reportView}
          onTogglePobOverride={(row) => {
            const key = reportRowEditKey(row);
            setPobOverrideRowKeys((current) =>
              current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
            );
          }}
          pobFieldsLocked={pobFieldsLocked}
          pobOverrideRowKeys={pobOverrideRowKeys}
          onRemoveRow={(row) => void removeReportRow(row)}
          onSaveRow={(row) => void saveReportRow(row)}
          onUpdateRow={updateReportRow}
          rowEdits={rowEdits}
          savingRowKey={savingRowKey}
        />
        <PortalPagination
          page={activePage}
          pageCount={pageCount}
          pageSize={residualsPerPage}
          totalItems={totalRows}
          onPageChange={setRecentPage}
        />
      </section>

      <section className="mt-6 rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Custom Residual Account Add-On</h2>
            <p className="mt-1 text-sm text-slate-700">
              Add a merchant directly into the selected month without opening Accounts first.
            </p>
          </div>
          <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {selectedReportPeriod?.label ?? "Choose one month"}
          </span>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <CustomResidualAccountCard
            type="pob"
            title="POB Residual Custom Account"
            form={customResidualForms.pob}
            agentOptions={agentOptions}
            platformOptions={customPobPlatformOptions}
            disabled={!selectedReportPeriod || creatingCustomResidualType !== null}
            saving={creatingCustomResidualType === "pob"}
            onFieldChange={(field, value) => setCustomResidualField("pob", field, value)}
            onSubmit={() => void createCustomResidualAccount("pob")}
          />
          <CustomResidualAccountCard
            type="cc"
            title="CC Residual Custom Account"
            form={customResidualForms.cc}
            agentOptions={agentOptions}
            platformOptions={customCcPlatformOptions}
            disabled={!selectedReportPeriod || creatingCustomResidualType !== null}
            saving={creatingCustomResidualType === "cc"}
            onFieldChange={(field, value) => setCustomResidualField("cc", field, value)}
            onSubmit={() => void createCustomResidualAccount("cc")}
          />
        </div>
      </section>
    </>
  );
}

function formFromResidual(residual: MonthlyResidual): ResidualForm {
  const residualMeta = readResidualMeta(residual.merchant_notes);

  return {
    agentCommissionStructure: residual.agent_commission_structure ?? "",
    agentId: residual.agent_id,
    agentProfit: inputValue(residual.agent_profit),
    equipmentCost: inputValue(residual.equipment_cost),
    greenhubCcSplit: residualMeta.greenhubCcSplit ?? "",
    greenhubPobBuyRate: inputValue(residual.greenhub_pob_buy_rate),
    greenhubPobNetProfit: inputValue(residual.greenhub_pob_net_profit),
    greenhubPobProfitPerTransaction: inputValue(residual.greenhub_pob_profit_per_transaction),
    merchantNotes: residualMeta.cleanNotes,
    merchantAccountId: residual.merchant_account_id,
    month: months[residual.residual_month - 1] ?? "January",
    monthlySalesVolume: inputValue(residual.monthly_sales_volume),
    netProfit: inputValue(residual.greenhub_net_profit),
    oneTimeFees: inputValue(residual.one_time_fees),
    platformId: residual.platform_id ?? "",
    posIntegrationFee: inputValue(residual.pos_integration_fee),
    profitPerTransaction: inputValue(residual.profit_per_transaction),
    rebate: inputValue(residual.rebate),
    status: residual.residual_status,
    surcharge: inputValue(residual.surcharge),
    transactionsPerMonth: inputValue(residual.transactions_per_month),
    year: String(residual.residual_year),
  };
}

function formFromReportRow(row: ResidualReportRow): ResidualForm {
  const period = parseReportMonth(row.monthValue);

  return {
    agentCommissionStructure: row.agentCommissionStructure === "Not specified" ? "" : row.agentCommissionStructure,
    agentId: row.agentId,
    agentProfit: rowInputAmount(row.agentProfit),
    equipmentCost: rowInputAmount(row.equipmentCost),
    greenhubCcSplit: row.greenhubCcSplit,
    greenhubPobBuyRate: rowInputAmount(row.greenhubPobBuyRate),
    greenhubPobNetProfit: rowInputAmount(row.greenhubPobNetProfit),
    greenhubPobProfitPerTransaction: rowInputAmount(row.greenhubPobProfitPerTransaction),
    merchantNotes: row.merchantNotes,
    merchantAccountId: row.merchantAccountId,
    month: period ? months[period.month - 1] ?? "January" : "January",
    monthlySalesVolume: rowInputAmount(row.salesVolume),
    netProfit: rowInputAmount(row.greenhubNetProfit),
    oneTimeFees: "",
    platformId: row.platformId,
    posIntegrationFee: rowInputAmount(row.posIntegrationFee),
    profitPerTransaction: rowInputAmount(row.profitPerTransaction),
    rebate: rowInputAmount(row.rebate),
    status: row.status,
    surcharge: rowInputAmount(row.surcharge),
    transactionsPerMonth: rowInputAmount(row.transactionsPerMonth),
    year: period?.year ?? "2026",
  };
}

function ResidualInput({
  disabled = false,
  field,
  form,
  label,
  updateForm,
}: {
  disabled?: boolean;
  field: keyof Pick<
    ResidualForm,
    | "agentProfit"
    | "equipmentCost"
    | "greenhubPobBuyRate"
    | "greenhubPobNetProfit"
    | "greenhubPobProfitPerTransaction"
    | "monthlySalesVolume"
    | "netProfit"
    | "oneTimeFees"
    | "posIntegrationFee"
    | "profitPerTransaction"
    | "rebate"
    | "surcharge"
    | "transactionsPerMonth"
  >;
  form: ResidualForm;
  label: string;
  updateForm: (field: keyof ResidualForm, value: string) => void;
}) {
  return (
    <ResidualFieldShell label={label}>
      <input
        className={`${portalInputClass} disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none`}
        disabled={disabled}
        placeholder={label}
        value={form[field]}
        onChange={(event) => updateForm(field, event.target.value)}
      />
    </ResidualFieldShell>
  );
}

function ResidualStatus({ status }: { status: "draft" | "finalized" }) {
  return (
    <span
      className={`rounded-full px-2 py-1 text-xs font-semibold ${
        status === "finalized"
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      {status}
    </span>
  );
}

function TotalTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-3">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function ResidualFieldShell({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ResidualSectionLabel({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
    </div>
  );
}

function CustomResidualAccountCard({
  agentOptions,
  disabled,
  form,
  onFieldChange,
  onSubmit,
  platformOptions,
  saving,
  title,
  type,
}: {
  agentOptions: PortalSelectOption[];
  disabled: boolean;
  form: CustomResidualAccountForm;
  onFieldChange: (field: keyof CustomResidualAccountForm, value: string) => void;
  onSubmit: () => void;
  platformOptions: PortalSelectOption[];
  saving: boolean;
  title: string;
  type: ResidualPlatformType;
}) {
  const isPob = type === "pob";
  const submitDisabled = disabled || saving || !form.accountName.trim() || !form.agentId || !form.platformId;

  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
          {type.toUpperCase()}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ResidualFieldShell label="Merchant name">
          <input
            className={portalInputClass}
            disabled={disabled}
            placeholder="Type account name"
            value={form.accountName}
            onChange={(event) => onFieldChange("accountName", event.target.value)}
          />
        </ResidualFieldShell>
        <ResidualFieldShell label="Agent">
          <PortalSelect
            disabled={disabled}
            value={form.agentId}
            onValueChange={(value) => onFieldChange("agentId", value)}
            options={[{ disabled: true, label: "Select agent", value: "" }, ...agentOptions]}
          />
        </ResidualFieldShell>
        <ResidualFieldShell label="Platform">
          <PortalSelect
            disabled={disabled}
            value={form.platformId}
            onValueChange={(value) => onFieldChange("platformId", value)}
            options={platformOptions}
          />
        </ResidualFieldShell>
        <ResidualFieldShell label={isPob ? "Commission / split notes" : "Agent CC split"}>
          <input
            className={portalInputClass}
            disabled={disabled}
            placeholder={isPob ? "50% over $1.35 buy rate" : "80%"}
            value={form.agentCommissionStructure}
            onChange={(event) => onFieldChange("agentCommissionStructure", event.target.value)}
          />
        </ResidualFieldShell>
        {isPob ? (
          <>
            <CustomResidualInput
              disabled={disabled}
              form={form}
              field="greenhubPobBuyRate"
              label="POB buy rate"
              onFieldChange={onFieldChange}
            />
            <CustomResidualInput
              disabled={disabled}
              form={form}
              field="surcharge"
              label="Surcharge"
              onFieldChange={onFieldChange}
            />
            <CustomResidualInput
              disabled={disabled}
              form={form}
              field="rebate"
              label="Rebate to merchant"
              onFieldChange={onFieldChange}
            />
            <CustomResidualInput
              disabled={disabled}
              form={form}
              field="posIntegrationFee"
              label="POS integration fee"
              onFieldChange={onFieldChange}
            />
            <CustomResidualInput
              disabled={disabled}
              form={form}
              field="profitPerTransaction"
              label="Agent profit / transaction"
              onFieldChange={onFieldChange}
            />
            <CustomResidualInput
              disabled={disabled}
              form={form}
              field="transactionsPerMonth"
              label="Transactions"
              onFieldChange={onFieldChange}
            />
          </>
        ) : (
          <>
            <CustomResidualInput
              disabled={disabled}
              form={form}
              field="monthlySalesVolume"
              label="Merchant sales volume"
              onFieldChange={onFieldChange}
            />
            <CustomResidualInput
              disabled={disabled}
              form={form}
              field="netProfit"
              label="Gross profit"
              onFieldChange={onFieldChange}
            />
          </>
        )}
        <CustomResidualInput
          disabled={disabled}
          form={form}
          field="equipmentCost"
          label="Equipment cost"
          onFieldChange={onFieldChange}
        />
        <ResidualFieldShell label="Merchant notes">
          <input
            className={portalInputClass}
            disabled={disabled}
            placeholder="Optional"
            value={form.merchantNotes}
            onChange={(event) => onFieldChange("merchantNotes", event.target.value)}
          />
        </ResidualFieldShell>
      </div>
      <button
        type="button"
        disabled={submitDisabled}
        onClick={onSubmit}
        className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        {saving ? "Adding..." : `Add ${type.toUpperCase()} Account`}
      </button>
    </div>
  );
}

function CustomResidualInput({
  disabled,
  field,
  form,
  label,
  onFieldChange,
}: {
  disabled: boolean;
  field: keyof Pick<
    CustomResidualAccountForm,
    | "equipmentCost"
    | "greenhubPobBuyRate"
    | "monthlySalesVolume"
    | "netProfit"
    | "posIntegrationFee"
    | "profitPerTransaction"
    | "rebate"
    | "surcharge"
    | "transactionsPerMonth"
  >;
  form: CustomResidualAccountForm;
  label: string;
  onFieldChange: (field: keyof CustomResidualAccountForm, value: string) => void;
}) {
  return (
    <ResidualFieldShell label={label}>
      <input
        className={portalInputClass}
        disabled={disabled}
        inputMode="decimal"
        placeholder={label}
        value={form[field]}
        onChange={(event) => onFieldChange(field, event.target.value)}
      />
    </ResidualFieldShell>
  );
}

function agentNetResidual(row: ResidualReportRow) {
  return row.agentProfit - row.equipmentCost;
}

function pobAgentResidual(row: ResidualReportRow) {
  return row.residualType === "pob" ? row.agentProfit : 0;
}

function ccAgentResidual(row: ResidualReportRow) {
  return row.residualType === "cc" ? row.agentProfit : 0;
}

function ccGrossProfit(row: ResidualReportRow) {
  return row.residualType === "cc" ? row.greenhubNetProfit : 0;
}

function ccGreenhubNetProfit(row: ResidualReportRow) {
  return row.residualType === "cc"
    ? splitAmount(
        row.greenhubNetProfit,
        row.greenhubCcSplit
          ? normalizedPercent(row.greenhubCcSplit, greenhubCcSplitPercentForAgentSplit(row.agentSplit))
          : greenhubCcSplitPercentForAgentSplit(row.agentSplit)
      )
    : 0;
}

function ResidualSummary({
  totals,
  view,
}: {
  totals: ReturnType<typeof totalResiduals>;
  view: ResidualReportView;
}) {
  const tiles =
    view === "pob"
      ? [
          { label: "POB Transactions", value: totals.transactionsPerMonth.toLocaleString() },
          { label: "POB GreenHub Net Profit", value: currency(totals.greenhubPobNetProfit) },
          { label: "POB Agent Residual", value: currency(totals.agentProfit) },
          { label: "Avg POB Profit / Transaction", value: currency(totals.averagePobProfitPerTransaction) },
        ]
      : view === "cc"
        ? [
            { label: "CC Merchant Sales Volume", value: currency(totals.salesVolume) },
            { label: "CC Gross Profit", value: currency(totals.ccGrossProfit) },
            { label: "CC GreenHub Net Profit", value: currency(totals.greenhubNetProfit) },
            { label: "Agent Revenue Share Total", value: currency(totals.agentProfit) },
            { label: "Equipment Cost", value: currency(totals.equipmentCost) },
          ]
        : [
            { label: "GreenHub POB Net Residual", value: currency(totals.greenhubPobNetProfit) },
            { label: "GreenHub CC Net Residual", value: currency(totals.greenhubNetProfit) },
            { label: "Total GreenHub Net Residual", value: currency(totals.totalGreenhubNetResidual) },
            { label: "POB Agent Residual", value: currency(totals.pobAgentResidual) },
            { label: "CC Agent Residual", value: currency(totals.ccAgentResidual) },
            { label: "Total Agent Residual", value: currency(totals.agentProfit) },
            { label: "Total Equipment Cost", value: currency(totals.equipmentCost) },
            { label: "Agent Net Residual", value: currency(totals.agentNetResidual) },
          ];

  return (
    <div className="border-b border-slate-300 bg-slate-50 p-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <TotalTile key={tile.label} label={tile.label} value={tile.value} />
        ))}
      </div>
    </div>
  );
}

function QuickResidualInput({
  ariaLabel,
  onValueChange,
  readOnly = false,
  value,
}: {
  ariaLabel: string;
  onValueChange?: (value: string) => void;
  readOnly?: boolean;
  value: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      readOnly={readOnly}
      value={value}
      onChange={(event) => onValueChange?.(event.target.value)}
      className={`h-8 w-full min-w-0 rounded-md border border-slate-300 px-1.5 text-right text-[11px] font-medium tabular-nums text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 ${
        readOnly ? "bg-slate-100 text-slate-600" : "bg-white"
      }`}
    />
  );
}

function ResidualReportTable({
  onTogglePobOverride,
  onRemoveRow,
  onSaveRow,
  onUpdateRow,
  pobFieldsLocked,
  pobOverrideRowKeys,
  rows,
  rowEdits,
  savingRowKey,
  view,
}: {
  onTogglePobOverride: (row: ResidualReportRow) => void;
  onRemoveRow: (row: ResidualReportRow) => void;
  onSaveRow: (row: ResidualReportRow) => void;
  onUpdateRow: (row: ResidualReportRow, field: keyof ResidualForm, value: string) => void;
  pobFieldsLocked: boolean;
  pobOverrideRowKeys: string[];
  rows: ResidualReportRow[];
  rowEdits: Record<string, ResidualForm>;
  savingRowKey: string | null;
  view: ResidualReportView;
}) {
  if (view === "pob") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1595px] table-fixed border-separate border-spacing-0 text-left text-[11px] text-slate-900">
          <colgroup>
            <col style={{ width: "120px" }} />
            <col style={{ width: "110px" }} />
            <col style={{ width: "105px" }} />
            <col style={{ width: "74px" }} />
            <col style={{ width: "86px" }} />
            <col style={{ width: "88px" }} />
            <col style={{ width: "96px" }} />
            <col style={{ width: "102px" }} />
            <col style={{ width: "104px" }} />
            <col style={{ width: "112px" }} />
            <col style={{ width: "98px" }} />
            <col style={{ width: "104px" }} />
            <col style={{ width: "108px" }} />
            <col style={{ width: "118px" }} />
            <col style={{ width: "170px" }} />
          </colgroup>
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="px-3 py-3">Merchant</th>
              <th className="px-2 py-3">Agent</th>
              <th className="px-2 py-3">Platform</th>
              <th className="px-2 py-3">Status</th>
              <th className="px-2 py-3 text-right">POB Buy Rate</th>
              <th className="px-2 py-3 text-right">Surcharge</th>
              <th className="px-2 py-3 text-right">Rebate to Merchant</th>
              <th className="px-2 py-3 text-right">POS Integration Fee</th>
              <th className="px-2 py-3 text-right">Agent Profit / Transaction</th>
              <th className="px-2 py-3 text-right">GreenHub POB Profit / Transaction</th>
              <th className="px-2 py-3 text-right">Transactions</th>
              <th className="px-2 py-3 text-right">Agent POB Residual</th>
              <th className="px-2 py-3 text-right">GreenHub POB Net Profit</th>
              <th className="px-2 py-3">Merchant Notes</th>
              <th className="sticky right-0 z-20 border-l border-slate-200 bg-slate-100 px-2 py-3 text-right shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.55)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = reportRowEditKey(row);
              const overrideProfitPerTransaction = pobOverrideRowKeys.includes(key);
              const edit = withPobCalculations(
                rowEdits[key] ?? formFromReportRow(row),
                overrideProfitPerTransaction ? "greenhubPobProfitPerTransaction" : undefined
              );
              const saving = savingRowKey === key;

              return (
                <tr key={row.id} className="group border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-3 py-3 font-semibold text-slate-950">{row.merchant}</td>
                  <td className="px-2 py-3">{row.agent}</td>
                  <td className="px-2 py-3">{row.platform}</td>
                  <td className="px-2 py-3"><ResidualStatus status={row.status} /></td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} POB buy rate`}
                      readOnly={pobFieldsLocked}
                      value={edit.greenhubPobBuyRate}
                      onValueChange={(value) => onUpdateRow(row, "greenhubPobBuyRate", value)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} surcharge`}
                      readOnly={pobFieldsLocked}
                      value={edit.surcharge}
                      onValueChange={(value) => onUpdateRow(row, "surcharge", value)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} rebate to merchant`}
                      readOnly={pobFieldsLocked}
                      value={edit.rebate}
                      onValueChange={(value) => onUpdateRow(row, "rebate", value)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} POS integration fee`}
                      readOnly={pobFieldsLocked}
                      value={edit.posIntegrationFee}
                      onValueChange={(value) => onUpdateRow(row, "posIntegrationFee", value)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} agent profit per transaction`}
                      readOnly={pobFieldsLocked}
                      value={edit.profitPerTransaction}
                      onValueChange={(value) => onUpdateRow(row, "profitPerTransaction", value)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} GreenHub POB profit per transaction`}
                      readOnly={!overrideProfitPerTransaction}
                      value={edit.greenhubPobProfitPerTransaction}
                      onValueChange={(value) => onUpdateRow(row, "greenhubPobProfitPerTransaction", value)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} transactions`}
                      value={edit.transactionsPerMonth}
                      onValueChange={(value) => onUpdateRow(row, "transactionsPerMonth", value)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} agent POB residual`}
                      readOnly
                      value={edit.agentProfit}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} GreenHub POB net profit`}
                      readOnly
                      value={edit.greenhubPobNetProfit}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <input
                      aria-label={`${row.merchant} merchant notes`}
                      value={edit.merchantNotes}
                      onChange={(event) => onUpdateRow(row, "merchantNotes", event.target.value)}
                      className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-1.5 text-[11px] font-medium text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </td>
                  <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-2 py-3 text-right shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.55)] group-hover:bg-slate-50">
                    <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onTogglePobOverride(row)}
                        className={`h-8 rounded-md border px-1.5 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          overrideProfitPerTransaction
                            ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        Override
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onSaveRow(row)}
                        className="h-8 rounded-md bg-emerald-800 px-2 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? "Saving" : row.hasResidual ? "Save" : "Create"}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${row.merchant}`}
                        title={`Remove ${row.merchant}`}
                        disabled={saving || (row.hasResidual && row.status !== "draft")}
                        onClick={() => onRemoveRow(row)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            <ResidualEmptyRow colSpan={15} rows={rows} />
          </tbody>
        </table>
      </div>
    );
  }

  if (view === "cc") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1360px] table-fixed border-separate border-spacing-0 text-left text-[11px] text-slate-900">
          <colgroup>
            <col style={{ width: "140px" }} />
            <col style={{ width: "108px" }} />
            <col style={{ width: "112px" }} />
            <col style={{ width: "74px" }} />
            <col style={{ width: "104px" }} />
            <col style={{ width: "104px" }} />
            <col style={{ width: "112px" }} />
            <col style={{ width: "104px" }} />
            <col style={{ width: "112px" }} />
            <col style={{ width: "104px" }} />
            <col style={{ width: "98px" }} />
            <col style={{ width: "140px" }} />
            <col style={{ width: "108px" }} />
          </colgroup>
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="px-3 py-3">Merchant</th>
              <th className="px-2 py-3">Agent</th>
              <th className="px-2 py-3">Platform</th>
              <th className="px-2 py-3">Status</th>
              <th className="px-2 py-3 text-right">Agent CC Split</th>
              <th className="px-2 py-3 text-right">GreenHub CC Split</th>
              <th className="px-2 py-3 text-right">Merchant Sales Volume</th>
              <th className="px-2 py-3 text-right">Gross Profit</th>
              <th className="px-2 py-3 text-right">GreenHub Net Profit</th>
              <th className="px-2 py-3 text-right">Agent Residual</th>
              <th className="px-2 py-3 text-right">Equipment Cost</th>
              <th className="px-2 py-3">Merchant Notes</th>
              <th className="sticky right-0 z-20 border-l border-slate-200 bg-slate-100 px-2 py-3 text-right shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.55)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = reportRowEditKey(row);
              const edit = withResidualCalculations(rowEdits[key] ?? formFromReportRow(row), "cc");
              const greenhubSplit = greenhubCcSplitPercentFromForm(edit);
              const greenhubNetProfit = ccGreenhubNetProfitFromForm(edit);
              const saving = savingRowKey === key;

              return (
                <tr key={row.id} className="group border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-3 py-3 font-semibold text-slate-950">{row.merchant}</td>
                  <td className="px-2 py-3">{row.agent}</td>
                  <td className="px-2 py-3">{row.platform}</td>
                  <td className="px-2 py-3"><ResidualStatus status={row.status} /></td>
                  <td className="px-2 py-3 text-right">
                    <input
                      aria-label={`${row.merchant} agent CC split`}
                      value={edit.agentCommissionStructure}
                      onChange={(event) => onUpdateRow(row, "agentCommissionStructure", event.target.value)}
                      className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-1.5 text-right text-[11px] font-medium text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} GreenHub CC split`}
                      value={edit.greenhubCcSplit || splitLabel(greenhubSplit)}
                      onValueChange={(value) => onUpdateRow(row, "greenhubCcSplit", value)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} merchant sales volume`}
                      value={edit.monthlySalesVolume}
                      onValueChange={(value) => onUpdateRow(row, "monthlySalesVolume", value)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} gross profit`}
                      value={edit.netProfit}
                      onValueChange={(value) => onUpdateRow(row, "netProfit", value)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} GreenHub net profit`}
                      readOnly
                      value={inputAmount(greenhubNetProfit)}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} agent residual`}
                      readOnly
                      value={edit.agentProfit}
                    />
                  </td>
                  <td className="px-2 py-3 text-right">
                    <QuickResidualInput
                      ariaLabel={`${row.merchant} equipment cost`}
                      value={edit.equipmentCost}
                      onValueChange={(value) => onUpdateRow(row, "equipmentCost", value)}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <input
                      aria-label={`${row.merchant} merchant notes`}
                      value={edit.merchantNotes}
                      onChange={(event) => onUpdateRow(row, "merchantNotes", event.target.value)}
                      className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-1.5 text-[11px] font-medium text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    />
                  </td>
                  <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-2 py-3 text-right shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.55)] group-hover:bg-slate-50">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onSaveRow(row)}
                        className="h-8 rounded-md bg-emerald-800 px-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {saving ? "Saving" : row.hasResidual ? "Save" : "Create"}
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${row.merchant}`}
                        title={`Remove ${row.merchant}`}
                        disabled={saving || (row.hasResidual && row.status !== "draft")}
                        onClick={() => onRemoveRow(row)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            <ResidualEmptyRow colSpan={13} rows={rows} />
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] table-fixed text-left text-[11px] text-slate-900">
        <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
          <tr>
            <th className="p-4">Merchant</th>
            <th className="px-3 py-3">Agent</th>
            <th className="px-3 py-3">Platform</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3 text-right">CC Agent Residual</th>
            <th className="px-3 py-3 text-right">POB Agent Residual</th>
            <th className="px-3 py-3 text-right">Total Agent Residual</th>
            <th className="px-3 py-3 text-right">Equipment Cost</th>
            <th className="px-3 py-3 text-right">Agent Net Residual</th>
            <th className="px-3 py-3">Merchant Notes</th>
            <th className="px-3 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
              <td className="p-4 font-semibold text-slate-950">{row.merchant}</td>
              <td className="px-3 py-3">{row.agent}</td>
              <td className="px-3 py-3">{row.platform}</td>
              <td className="px-3 py-3"><ResidualStatus status={row.status} /></td>
              <td className="px-3 py-3 text-right tabular-nums">{currency(ccAgentResidual(row))}</td>
              <td className="px-3 py-3 text-right tabular-nums">{currency(pobAgentResidual(row))}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">{currency(row.agentProfit)}</td>
              <td className="px-3 py-3 text-right tabular-nums">{currency(row.equipmentCost)}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">{currency(agentNetResidual(row))}</td>
              <td className="max-w-64 px-3 py-3 text-slate-700">{row.merchantNotes || "-"}</td>
              <ResidualRowAction row={row} onRemoveRow={onRemoveRow} />
            </tr>
          ))}
          <ResidualEmptyRow colSpan={11} rows={rows} />
        </tbody>
      </table>
    </div>
  );
}

function ResidualRowAction({
  onRemoveRow,
  row,
}: {
  onRemoveRow: (row: ResidualReportRow) => void;
  row: ResidualReportRow;
}) {
  return (
    <td className="px-3 py-3 text-right">
      <button
        type="button"
        disabled={row.hasResidual && row.status !== "draft"}
        onClick={() => onRemoveRow(row)}
        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
        Remove
      </button>
    </td>
  );
}

function ResidualEmptyRow({ colSpan, rows }: { colSpan: number; rows: ResidualReportRow[] }) {
  if (rows.length) return null;

  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-10 text-center text-sm text-slate-600">
        No residuals match the selected filters.
      </td>
    </tr>
  );
}

function totalResiduals(rows: ResidualReportRow[]) {
  return rows.reduce(
    (totals, row) => ({
      agentProfit: totals.agentProfit + row.agentProfit,
      agentNetResidual: totals.agentNetResidual + agentNetResidual(row),
      averagePobProfitPerTransaction:
        totals.transactionsPerMonth + row.transactionsPerMonth
          ? (totals.greenhubPobNetProfit + row.greenhubPobNetProfit) /
            (totals.transactionsPerMonth + row.transactionsPerMonth)
          : 0,
      equipmentCost: totals.equipmentCost + row.equipmentCost,
      ccGrossProfit: totals.ccGrossProfit + ccGrossProfit(row),
      greenhubNetProfit: totals.greenhubNetProfit + ccGreenhubNetProfit(row),
      greenhubPobNetProfit: totals.greenhubPobNetProfit + row.greenhubPobNetProfit,
      totalGreenhubNetResidual:
        totals.totalGreenhubNetResidual + ccGreenhubNetProfit(row) + row.greenhubPobNetProfit,
      ccAgentResidual: totals.ccAgentResidual + ccAgentResidual(row),
      pobAgentResidual: totals.pobAgentResidual + pobAgentResidual(row),
      salesVolume: totals.salesVolume + row.salesVolume,
      transactionsPerMonth: totals.transactionsPerMonth + row.transactionsPerMonth,
    }),
    {
      agentProfit: 0,
      agentNetResidual: 0,
      averagePobProfitPerTransaction: 0,
      ccAgentResidual: 0,
      ccGrossProfit: 0,
      equipmentCost: 0,
      greenhubNetProfit: 0,
      greenhubPobNetProfit: 0,
      totalGreenhubNetResidual: 0,
      pobAgentResidual: 0,
      salesVolume: 0,
      transactionsPerMonth: 0,
    }
  );
}

type DemoResidualRow = {
  agent: string;
  agentCommissionStructure: string;
  agentId: string;
  agentProfit: string;
  equipment: string;
  greenhubPobBuyRate: string;
  greenhubPobProfitPerTransaction: string;
  merchant: string;
  month: string;
  netProfit: string;
  notes: string;
  platform: string;
  pobNetProfit: string;
  posIntegrationFee: string;
  profitPerTransaction: string;
  rebate: string;
  status: "Draft" | "Finalized";
  surcharge: string;
  transactions: string;
  volume: string;
};

function reportMonthValue(label: string) {
  const [monthName, year] = label.split(" ");
  const numericMonth = months.indexOf(monthName) + 1;
  return numericMonth && year ? `${year}-${numericMonth}` : "unknown";
}

function demoReportRow(row: DemoResidualRow): ResidualReportRow {
  return {
    agent: row.agent,
    agentCommissionStructure: row.agentCommissionStructure,
    agentId: row.agentId,
    agentIds: [row.agentId],
    agentProfit: amount(row.agentProfit),
    agentSplit: splitPercentFromText(row.agentCommissionStructure, 100),
    equipmentCost: amount(row.equipment),
    greenhubCcSplit: "",
    greenhubNetProfit: amount(row.netProfit),
    greenhubPobBuyRate: amount(row.greenhubPobBuyRate),
    greenhubPobNetProfit: amount(row.pobNetProfit),
    greenhubPobProfitPerTransaction: amount(row.greenhubPobProfitPerTransaction),
    hasResidual: true,
    id: `${row.merchant}-${row.month}`,
    merchant: row.merchant,
    merchantAccountId: row.merchant,
    merchantNotes: row.notes,
    month: row.month,
    monthValue: reportMonthValue(row.month),
    platform: row.platform,
    platformId: row.platform,
    posIntegrationFee: amount(row.posIntegrationFee),
    profitPerTransaction: amount(row.profitPerTransaction),
    rebate: amount(row.rebate),
    residualId: null,
    residualType: inferredResidualPlatformType(row.platform),
    salesVolume: amount(row.volume),
    secondaryAgentId: null,
    status: row.status.toLowerCase() as "draft" | "finalized",
    surcharge: amount(row.surcharge),
    transactionsPerMonth: amount(row.transactions),
  };
}

const demoResidualRows: DemoResidualRow[] = [
  {
    merchant: "Resource Group",
    agent: "Nicholas Sanchez",
    agentId: "nick@greenhubinc.com",
    platform: "Best Rate - Nuvei",
    month: "April 2024",
    greenhubPobBuyRate: "$3.00",
    agentCommissionStructure: "50% net profit share",
    volume: "$54,595",
    netProfit: "$2,041.56",
    surcharge: "$215.00",
    rebate: "$0.00",
    profitPerTransaction: "$3.74",
    greenhubPobProfitPerTransaction: "$1.20",
    transactions: "546",
    agentProfit: "$1,020.79",
    pobNetProfit: "$655.20",
    posIntegrationFee: "$0.00",
    equipment: "$250.00",
    notes: "Clean period. Equipment deducted from payout.",
    status: "Finalized",
  },
  {
    merchant: "Urbana Cafe",
    agent: "Rob Sinn",
    agentId: "rob@paynex.net",
    platform: "ElitePay - AUX",
    month: "April 2024",
    greenhubPobBuyRate: "$2.75",
    agentCommissionStructure: "45% net profit share",
    volume: "$34,220",
    netProfit: "$1,066.15",
    surcharge: "$148.00",
    rebate: "$35.00",
    profitPerTransaction: "$2.91",
    greenhubPobProfitPerTransaction: "$1.05",
    transactions: "366",
    agentProfit: "$332.58",
    pobNetProfit: "$384.30",
    posIntegrationFee: "$0.00",
    equipment: "$200.00",
    notes: "Draft pending final transaction review.",
    status: "Draft",
  },
];
