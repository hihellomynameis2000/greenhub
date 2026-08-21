"use client";

import { Bell, ChevronDown, CreditCard, FileText, Layers3, Lock, ReceiptText, Trash2, Unlock, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { accounts as demoAccounts, agents as demoAgents, platforms as demoPlatforms } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton, showPortalToast } from "@/components/portal/PortalToast";
import { portalFileRequest, portalRequest } from "@/lib/portal/client";
import type { ParsedResidualImport, ParsedResidualImportRow } from "@/lib/portal/residualImport";
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

const residualsPerPage = 10;

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
  agentProfit: number;
  equipmentCost: number;
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
  profitPerTransaction: number;
  rebate: number;
  residualId: string | null;
  residualType: ResidualPlatformType;
  salesVolume: number;
  status: "draft" | "finalized";
  surcharge: number;
  transactionsPerMonth: number;
};

type ResidualImportPreviewRow = ParsedResidualImportRow & {
  account: MerchantAccount | null;
  agentName: string;
  platform: Platform | null;
  ready: boolean;
  residualType: ResidualPlatformType;
  warnings: string[];
};

const initialForm: ResidualForm = {
  agentCommissionStructure: "",
  agentId: "",
  agentProfit: "",
  equipmentCost: "",
  greenhubPobBuyRate: "",
  greenhubPobNetProfit: "",
  greenhubPobProfitPerTransaction: "",
  merchantNotes: "",
  merchantAccountId: "",
  month: "January",
  monthlySalesVolume: "",
  netProfit: "",
  oneTimeFees: "",
  platformId: "",
  profitPerTransaction: "",
  rebate: "",
  status: "draft",
  surcharge: "",
  transactionsPerMonth: "",
  year: "2026",
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

function normalizedLookupName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function withPobCalculations(form: ResidualForm) {
  const transactions = amount(form.transactionsPerMonth);
  const agentProfitPerTransaction = amount(form.profitPerTransaction);
  const greenhubPobProfitPerTransaction = amount(form.greenhubPobProfitPerTransaction);

  return {
    ...form,
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

function calculatedPobField(field: keyof ResidualForm) {
  return field === "transactionsPerMonth" ||
    field === "profitPerTransaction" ||
    field === "greenhubPobProfitPerTransaction";
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
  const [reportMonth, setReportMonth] = useState("all");
  const [reportStatus, setReportStatus] = useState("all");
  const [reportView, setReportView] = useState<ResidualReportView>("total");
  const [recentPage, setRecentPage] = useState(1);
  const [pobFieldsLocked, setPobFieldsLocked] = useState(true);
  const [importMonth, setImportMonth] = useState("July");
  const [importYear, setImportYear] = useState("2026");
  const [importPlatformId, setImportPlatformId] = useState("");
  const [importStatus, setImportStatus] = useState<ResidualForm["status"]>("draft");
  const [parsedImport, setParsedImport] = useState<ParsedResidualImport | null>(null);
  const [importing, setImporting] = useState(false);
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
  const normalizedAccounts = useMemo(
    () =>
      data?.accounts.map((account) => ({
        account,
        name: normalizedLookupName(account.account_name),
      })) ?? [],
    [data?.accounts]
  );
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
      const platform =
        data?.platforms.find((item) => item.id === (importPlatformId || accountMatch?.platform_id || "")) ??
        null;
      const agentName = agentNames.get(accountMatch?.assigned_agent_id ?? "") ?? "";
      const residualType = inferredResidualPlatformType(platform ?? "");
      const warnings = [
        accountMatch ? "" : "No matching account",
        accountMatch?.assigned_agent_id ? "" : "No assigned agent",
        platform ? "" : "No platform",
      ].filter(Boolean);

      return {
        ...row,
        account: accountMatch,
        agentName,
        platform,
        ready: warnings.length === 0,
        residualType,
        warnings,
      };
    });
  }, [agentNames, data?.platforms, importPlatformId, normalizedAccounts, parsedImport]);
  const readyImportRows = importPreviewRows.filter((row) => row.ready);
  const selectedAccount = data?.accounts.find((account) => account.id === form.merchantAccountId);
  const effectivePlatformId = form.platformId || selectedAccount?.platform_id || "";
  const selectedPlatformName =
    platformOptions.find((platform) => platform.value === effectivePlatformId)?.label ||
    platformNames.get(effectivePlatformId) ||
    effectivePlatformId;
  const selectedPlatformRecord = data?.platforms.find((platform) => platform.id === effectivePlatformId);
  const residualEntryType = effectivePlatformId
    ? inferredResidualPlatformType(selectedPlatformRecord ?? selectedPlatformName)
    : "all";
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

  function updateForm(field: keyof ResidualForm, value: string) {
    setForm((current) => {
      if (field !== "merchantAccountId") {
        const next = { ...current, [field]: value };
        return calculatedPobField(field) ? withPobCalculations(next) : next;
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

    return {
      agentCommissionStructure: row.agentCommissionStructure || row.account?.commission_structure || "",
      agentId: row.account?.assigned_agent_id ?? "",
      agentProfit: row.agentProfit,
      equipmentCost: row.equipmentCost,
      greenhubNetProfit: pobEntry ? "" : row.greenhubNetProfit,
      greenhubPobBuyRate: ccEntry ? "" : row.greenhubPobBuyRate,
      greenhubPobNetProfit: ccEntry ? "" : row.greenhubPobNetProfit,
      greenhubPobProfitPerTransaction: ccEntry ? "" : row.greenhubPobProfitPerTransaction,
      merchantNotes: row.merchantNotes,
      merchantAccountId: row.account?.id ?? "",
      monthlySalesVolume: pobEntry ? "" : row.monthlySalesVolume,
      oneTimeFees: "",
      platformId: row.platform?.id ?? "",
      profitPerTransaction: ccEntry ? "" : row.profitPerTransaction,
      rebate: ccEntry ? "" : row.rebate,
      residualMonth: months.indexOf(importMonth) + 1,
      residualStatus: importStatus,
      residualYear: importYear,
      surcharge: ccEntry ? "" : row.surcharge,
      transactionsPerMonth: ccEntry ? "" : row.transactionsPerMonth,
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
      const result = await portalRequest<{ created: number; imported: number; updated: number }>(
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
    const pobEntry = residualEntryType === "pob";
    const ccEntry = residualEntryType === "cc";

    return {
      agentCommissionStructure: form.agentCommissionStructure,
      agentId: form.agentId,
      agentProfit: form.agentProfit,
      equipmentCost: form.equipmentCost,
      greenhubNetProfit: pobEntry ? "" : form.netProfit,
      greenhubPobBuyRate: ccEntry ? "" : form.greenhubPobBuyRate,
      greenhubPobNetProfit: ccEntry ? "" : form.greenhubPobNetProfit,
      greenhubPobProfitPerTransaction: ccEntry ? "" : form.greenhubPobProfitPerTransaction,
      merchantNotes: form.merchantNotes,
      merchantAccountId: form.merchantAccountId,
      monthlySalesVolume: pobEntry ? "" : form.monthlySalesVolume,
      oneTimeFees: form.oneTimeFees,
      platformId: form.platformId,
      profitPerTransaction: ccEntry ? "" : form.profitPerTransaction,
      rebate: ccEntry ? "" : form.rebate,
      residualMonth: months.indexOf(form.month) + 1,
      residualStatus: nextStatus,
      residualYear: form.year,
      surcharge: ccEntry ? "" : form.surcharge,
      transactionsPerMonth: ccEntry ? "" : form.transactionsPerMonth,
    };
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
    setSaving(true);
    setError(null);

    try {
      if (data) {
        await portalRequest("/api/portal/notifications", {
          method: "POST",
          body: JSON.stringify({
            agentId: form.agentId,
            residualMonth: months.indexOf(form.month) + 1,
            residualYear: form.year,
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
      const platformId = residual.platform_id ?? rowAccount?.platform_id ?? "";
      const platformRecord = data?.platforms.find((platform) => platform.id === platformId);
      const agentId = residual.agent_id || rowAccount?.assigned_agent_id || "";

      return {
        agent: agentNames.get(agentId) ?? "Unknown agent",
        agentCommissionStructure:
          residual.agent_commission_structure ||
          rowAccount?.commission_structure ||
          "Not specified",
        agentId,
        agentProfit: amount(residual.agent_profit),
        equipmentCost: amount(residual.equipment_cost),
        greenhubNetProfit: amount(residual.greenhub_net_profit),
        greenhubPobBuyRate: amount(residual.greenhub_pob_buy_rate),
        greenhubPobNetProfit: amount(residual.greenhub_pob_net_profit),
        greenhubPobProfitPerTransaction: amount(residual.greenhub_pob_profit_per_transaction),
        hasResidual: true,
        id: residual.id,
        merchant: accountNames.get(residual.merchant_account_id) ?? rowAccount?.account_name ?? "Unknown account",
        merchantAccountId: residual.merchant_account_id,
        merchantNotes: residual.merchant_notes ?? "",
        month: `${months[residual.residual_month - 1]} ${residual.residual_year}`,
        monthValue: residualMonthValue(residual),
        platform: platformNames.get(platformId) ?? "Unassigned",
        platformId,
        profitPerTransaction: amount(residual.profit_per_transaction),
        rebate: amount(residual.rebate),
        residualId: residual.id,
        residualType: inferredResidualPlatformType(platformRecord ?? platformNames.get(platformId) ?? "Unassigned"),
        salesVolume: amount(residual.monthly_sales_volume),
        status: residual.residual_status,
        surcharge: amount(residual.surcharge),
        transactionsPerMonth: amount(residual.transactions_per_month),
      };
    }

    if (!selectedReportPeriod) {
      return data.residuals.map((residual) => rowFromResidual(residual));
    }

    return data.accounts
      .filter((account) => account.status !== "closed")
      .map((account) => {
        const platformId = account.platform_id ?? "";
        const residual =
          residualsByAccountPeriod.get(residualKey(account.id, platformId, selectedReportPeriod.value)) ??
          residualsByAccountPeriod.get(residualKey(account.id, "", selectedReportPeriod.value));

        if (residual) return rowFromResidual(residual, account);

        const platformRecord = data.platforms.find((platform) => platform.id === platformId);
        const agentId = account.assigned_agent_id ?? "";

        return {
          agent: agentNames.get(agentId) ?? "Unassigned",
          agentCommissionStructure: account.commission_structure || "Not specified",
          agentId,
          agentProfit: 0,
          equipmentCost: 0,
          greenhubNetProfit: 0,
          greenhubPobBuyRate: 0,
          greenhubPobNetProfit: 0,
          greenhubPobProfitPerTransaction: 0,
          hasResidual: false,
          id: `pending-${account.id}-${selectedReportPeriod.value}`,
          merchant: account.account_name,
          merchantAccountId: account.id,
          merchantNotes: account.internal_notes ?? "",
          month: selectedReportPeriod.label,
          monthValue: selectedReportPeriod.value,
          platform: platformNames.get(platformId) ?? "Unassigned",
          platformId,
          profitPerTransaction: 0,
          rebate: 0,
          residualId: null,
          residualType: inferredResidualPlatformType(platformRecord ?? platformNames.get(platformId) ?? "Unassigned"),
          salesVolume: 0,
          status: "draft" as const,
          surcharge: 0,
          transactionsPerMonth: 0,
        };
      });
  }, [
    accountNames,
    agentNames,
    data,
    platformNames,
    residualsByAccountPeriod,
    selectedReportPeriod,
  ]);
  const previewReportRows = useMemo(
    () => demoResidualRows.map((row) => demoReportRow(row)),
    []
  );
  const reportRows = data ? liveReportRows : previewReportRows;
  const filteredReportRows = reportRows.filter(
    (row) =>
      (reportAgent === "all" || row.agentId === reportAgent) &&
      (reportMonth === "all" || row.monthValue === reportMonth) &&
      (reportStatus === "all" || row.status === reportStatus)
  );
  const visibleReportRows =
    reportView === "total"
      ? filteredReportRows
      : filteredReportRows.filter((row) => row.residualType === reportView);
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
            ariaLabel="Import fallback platform"
            value={importPlatformId}
            onValueChange={setImportPlatformId}
            options={[
              { label: "Use account platform", value: "" },
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

      <section ref={residualFormRef} className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
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
          <PortalSelect
            value={form.merchantAccountId}
            onValueChange={(merchantAccountId) => updateForm("merchantAccountId", merchantAccountId)}
            options={[{ disabled: true, label: "Select merchant account", value: "" }, ...accountOptions]}
          />
          <PortalSelect
            value={form.agentId}
            onValueChange={(agentId) => updateForm("agentId", agentId)}
            options={[{ disabled: true, label: "Select agent", value: "" }, ...agentOptions]}
          />
          <PortalSelect
            value={form.platformId}
            onValueChange={(platformId) => updateForm("platformId", platformId)}
            options={[{ disabled: true, label: "Select platform", value: "" }, ...platformOptions]}
          />
          <PortalSelect
            value={form.month}
            onValueChange={(month) => updateForm("month", month)}
            options={months.map((month) => ({ label: month, value: month }))}
          />
          <input
            className={portalInputClass}
            placeholder="Year"
            value={form.year}
            onChange={(event) => updateForm("year", event.target.value)}
          />
          <PortalSelect
            value={form.status}
            onValueChange={(status) => updateForm("status", status)}
            options={[
              { label: "Draft", value: "draft" },
              { label: "Finalized", value: "finalized" },
            ]}
          />
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
            <ResidualInput
              label="GreenHub POB Buy Rate"
              field="greenhubPobBuyRate"
              form={form}
              updateForm={updateForm}
              disabled={pobFieldsLocked && residualEntryType === "pob"}
            />
          ) : null}
          <input
            className={portalInputClass}
            placeholder="Agent Commission Structure"
            value={form.agentCommissionStructure}
            onChange={(event) => updateForm("agentCommissionStructure", event.target.value)}
          />
          {showCcFields ? (
            <>
              <ResidualInput label="Monthly Sales Volume" field="monthlySalesVolume" form={form} updateForm={updateForm} />
              <ResidualInput label="GreenHub Net Profit" field="netProfit" form={form} updateForm={updateForm} />
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
          <ResidualInput label="Equipment Cost" field="equipmentCost" form={form} updateForm={updateForm} />
          <textarea
            className={`${portalInputClass} md:col-span-3`}
            placeholder="Merchant Notes"
            rows={3}
            value={form.merchantNotes}
            onChange={(event) => updateForm("merchantNotes", event.target.value)}
          />
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
        </div>
        <ResidualSummary view={reportView} totals={reportTotals} />
        <ResidualReportTable rows={paginatedReportRows} view={reportView} onEditRow={loadReportRow} />
        <PortalPagination
          page={activePage}
          pageCount={pageCount}
          pageSize={residualsPerPage}
          totalItems={totalRows}
          onPageChange={setRecentPage}
        />
      </section>
    </>
  );
}

function formFromResidual(residual: MonthlyResidual): ResidualForm {
  return {
    agentCommissionStructure: residual.agent_commission_structure ?? "",
    agentId: residual.agent_id,
    agentProfit: inputValue(residual.agent_profit),
    equipmentCost: inputValue(residual.equipment_cost),
    greenhubPobBuyRate: inputValue(residual.greenhub_pob_buy_rate),
    greenhubPobNetProfit: inputValue(residual.greenhub_pob_net_profit),
    greenhubPobProfitPerTransaction: inputValue(residual.greenhub_pob_profit_per_transaction),
    merchantNotes: residual.merchant_notes ?? "",
    merchantAccountId: residual.merchant_account_id,
    month: months[residual.residual_month - 1] ?? "January",
    monthlySalesVolume: inputValue(residual.monthly_sales_volume),
    netProfit: inputValue(residual.greenhub_net_profit),
    oneTimeFees: inputValue(residual.one_time_fees),
    platformId: residual.platform_id ?? "",
    profitPerTransaction: inputValue(residual.profit_per_transaction),
    rebate: inputValue(residual.rebate),
    status: residual.residual_status,
    surcharge: inputValue(residual.surcharge),
    transactionsPerMonth: inputValue(residual.transactions_per_month),
    year: String(residual.residual_year),
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
    <input
      className={`${portalInputClass} disabled:bg-slate-100 disabled:text-slate-500 disabled:shadow-none`}
      disabled={disabled}
      placeholder={label}
      value={form[field]}
      onChange={(event) => updateForm(field, event.target.value)}
    />
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

function agentNetResidual(row: ResidualReportRow) {
  return row.agentProfit - row.equipmentCost;
}

function pobAgentResidual(row: ResidualReportRow) {
  return row.residualType === "pob" ? row.agentProfit : 0;
}

function ccAgentResidual(row: ResidualReportRow) {
  return row.residualType === "cc" ? row.agentProfit : 0;
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
            { label: "CC GreenHub Net Profit", value: currency(totals.greenhubNetProfit) },
            { label: "Agent Revenue Share Total", value: currency(totals.agentProfit) },
            { label: "Equipment Cost", value: currency(totals.equipmentCost) },
          ]
        : [
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

function ResidualReportTable({
  onEditRow,
  rows,
  view,
}: {
  onEditRow: (row: ResidualReportRow) => void;
  rows: ResidualReportRow[];
  view: ResidualReportView;
}) {
  if (view === "pob") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1450px] text-left text-xs text-slate-900">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="p-4">Merchant</th>
              <th className="px-3 py-3">Agent</th>
              <th className="px-3 py-3">Platform</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3 text-right">POB Buy Rate</th>
              <th className="px-3 py-3 text-right">Surcharge</th>
              <th className="px-3 py-3 text-right">Rebate to Merchant</th>
              <th className="px-3 py-3 text-right">Agent Profit / Transaction</th>
              <th className="px-3 py-3 text-right">GreenHub POB Profit / Transaction</th>
              <th className="px-3 py-3 text-right">Transactions</th>
              <th className="px-3 py-3 text-right">Agent POB Residual</th>
              <th className="px-3 py-3 text-right">GreenHub POB Net Profit</th>
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
                <td className="px-3 py-3 text-right tabular-nums">{currency(row.greenhubPobBuyRate)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(row.surcharge)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(row.rebate)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(row.profitPerTransaction)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(row.greenhubPobProfitPerTransaction)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{row.transactionsPerMonth.toLocaleString()}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{currency(row.agentProfit)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{currency(row.greenhubPobNetProfit)}</td>
                <td className="max-w-64 px-3 py-3 text-slate-700">{row.merchantNotes || "-"}</td>
                <ResidualRowAction row={row} onEditRow={onEditRow} />
              </tr>
            ))}
            <ResidualEmptyRow colSpan={14} rows={rows} />
          </tbody>
        </table>
      </div>
    );
  }

  if (view === "cc") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-left text-xs text-slate-900">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
            <tr>
              <th className="p-4">Merchant</th>
              <th className="px-3 py-3">Agent</th>
              <th className="px-3 py-3">Platform</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Agent Commission Structure</th>
              <th className="px-3 py-3 text-right">Merchant Sales Volume</th>
              <th className="px-3 py-3 text-right">GreenHub Net Profit</th>
              <th className="px-3 py-3 text-right">Agent Residual</th>
              <th className="px-3 py-3 text-right">Equipment Cost</th>
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
                <td className="px-3 py-3">{row.agentCommissionStructure}</td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(row.salesVolume)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{currency(row.greenhubNetProfit)}</td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums">{currency(row.agentProfit)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{currency(row.equipmentCost)}</td>
                <td className="max-w-64 px-3 py-3 text-slate-700">{row.merchantNotes || "-"}</td>
                <ResidualRowAction row={row} onEditRow={onEditRow} />
              </tr>
            ))}
            <ResidualEmptyRow colSpan={11} rows={rows} />
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1180px] text-left text-xs text-slate-900">
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
              <ResidualRowAction row={row} onEditRow={onEditRow} />
            </tr>
          ))}
          <ResidualEmptyRow colSpan={11} rows={rows} />
        </tbody>
      </table>
    </div>
  );
}

function ResidualRowAction({
  onEditRow,
  row,
}: {
  onEditRow: (row: ResidualReportRow) => void;
  row: ResidualReportRow;
}) {
  return (
    <td className="px-3 py-3 text-right">
      <button
        type="button"
        onClick={() => onEditRow(row)}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition-colors hover:bg-slate-100"
      >
        {row.hasResidual ? "Edit" : "Add data"}
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
      greenhubNetProfit: totals.greenhubNetProfit + row.greenhubNetProfit,
      greenhubPobNetProfit: totals.greenhubPobNetProfit + row.greenhubPobNetProfit,
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
      equipmentCost: 0,
      greenhubNetProfit: 0,
      greenhubPobNetProfit: 0,
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
    agentProfit: amount(row.agentProfit),
    equipmentCost: amount(row.equipment),
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
    profitPerTransaction: amount(row.profitPerTransaction),
    rebate: amount(row.rebate),
    residualId: null,
    residualType: inferredResidualPlatformType(row.platform),
    salesVolume: amount(row.volume),
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
    equipment: "$200.00",
    notes: "Draft pending final transaction review.",
    status: "Draft",
  },
];
