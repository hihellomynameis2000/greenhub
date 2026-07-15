"use client";

import { Bell, ChevronDown, FileText, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { accounts as demoAccounts, agents as demoAgents, platforms as demoPlatforms } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PortalPagination } from "@/components/portal/PortalPagination";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton, showPortalToast } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";
import type { MonthlyResidual } from "@/lib/portal/types";

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
  id: string;
  merchant: string;
  merchantNotes: string;
  month: string;
  monthValue: string;
  platform: string;
  profitPerTransaction: number;
  rebate: number;
  salesVolume: number;
  status: "draft" | "finalized";
  surcharge: number;
  transactionsPerMonth: number;
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
  const [recentPage, setRecentPage] = useState(1);
  const draftsMenuRef = useRef<HTMLDivElement>(null);

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
  const reportMonthOptions = data
    ? [
        { label: "All months", value: "all" },
        ...Array.from(
          new Set(data.residuals.map((row) => `${row.residual_year}-${row.residual_month}`))
        ).map((value) => {
          const [year, numericMonth] = value.split("-");
          return { label: `${months[Number(numericMonth) - 1]} ${year}`, value };
        }),
      ]
    : [
        { label: "All months", value: "all" },
        { label: "April 2024", value: "2024-4" },
      ];

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
    setForm((current) => ({ ...current, [field]: value }));
  }

  function apiPayload(nextStatus: ResidualForm["status"]) {
    return {
      agentCommissionStructure: form.agentCommissionStructure,
      agentId: form.agentId,
      agentProfit: form.agentProfit,
      equipmentCost: form.equipmentCost,
      greenhubNetProfit: form.netProfit,
      greenhubPobBuyRate: form.greenhubPobBuyRate,
      greenhubPobNetProfit: form.greenhubPobNetProfit,
      greenhubPobProfitPerTransaction: form.greenhubPobProfitPerTransaction,
      merchantNotes: form.merchantNotes,
      merchantAccountId: form.merchantAccountId,
      monthlySalesVolume: form.monthlySalesVolume,
      oneTimeFees: form.oneTimeFees,
      platformId: form.platformId,
      profitPerTransaction: form.profitPerTransaction,
      rebate: form.rebate,
      residualMonth: months.indexOf(form.month) + 1,
      residualStatus: nextStatus,
      residualYear: form.year,
      surcharge: form.surcharge,
      transactionsPerMonth: form.transactionsPerMonth,
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

  const liveReportRows = useMemo<ResidualReportRow[]>(
    () =>
      data?.residuals.map((residual) => ({
        agent: agentNames.get(residual.agent_id) ?? "Unknown agent",
        agentCommissionStructure:
          residual.agent_commission_structure ||
          data.accounts.find((account) => account.id === residual.merchant_account_id)
            ?.commission_structure ||
          "Not specified",
        agentId: residual.agent_id,
        agentProfit: amount(residual.agent_profit),
        equipmentCost: amount(residual.equipment_cost),
        greenhubNetProfit: amount(residual.greenhub_net_profit),
        greenhubPobBuyRate: amount(residual.greenhub_pob_buy_rate),
        greenhubPobNetProfit: amount(residual.greenhub_pob_net_profit),
        greenhubPobProfitPerTransaction: amount(residual.greenhub_pob_profit_per_transaction),
        id: residual.id,
        merchant: accountNames.get(residual.merchant_account_id) ?? "Unknown account",
        merchantNotes: residual.merchant_notes ?? "",
        month: `${months[residual.residual_month - 1]} ${residual.residual_year}`,
        monthValue: `${residual.residual_year}-${residual.residual_month}`,
        platform: platformNames.get(residual.platform_id ?? "") ?? "Unassigned",
        profitPerTransaction: amount(residual.profit_per_transaction),
        rebate: amount(residual.rebate),
        salesVolume: amount(residual.monthly_sales_volume),
        status: residual.residual_status,
        surcharge: amount(residual.surcharge),
        transactionsPerMonth: amount(residual.transactions_per_month),
      })) ?? [],
    [accountNames, agentNames, data, platformNames]
  );
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
  const totalRows = filteredReportRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / residualsPerPage));
  const activePage = Math.min(recentPage, pageCount);
  const pageOffset = (activePage - 1) * residualsPerPage;
  const paginatedReportRows = filteredReportRows.slice(pageOffset, pageOffset + residualsPerPage);
  const reportTotals = totalResiduals(filteredReportRows);

  return (
    <>
      <PageHeader
        title="Monthly Residuals"
        subtitle="Enter monthly sales volume, net profit, costs, and agent residuals."
      />

      <section className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
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
          <ResidualInput label="GreenHub POB Buy Rate" field="greenhubPobBuyRate" form={form} updateForm={updateForm} />
          <input
            className={portalInputClass}
            placeholder="Agent Commission Structure"
            value={form.agentCommissionStructure}
            onChange={(event) => updateForm("agentCommissionStructure", event.target.value)}
          />
          <ResidualInput label="Monthly Sales Volume" field="monthlySalesVolume" form={form} updateForm={updateForm} />
          <ResidualInput label="GreenHub Net Profit" field="netProfit" form={form} updateForm={updateForm} />
          <ResidualInput label="Surcharge" field="surcharge" form={form} updateForm={updateForm} />
          <ResidualInput label="Rebate to Merchant" field="rebate" form={form} updateForm={updateForm} />
          <ResidualInput label="Agent Profit Per Transaction" field="profitPerTransaction" form={form} updateForm={updateForm} />
          <ResidualInput
            label="GreenHub POB Profit Per Transaction"
            field="greenhubPobProfitPerTransaction"
            form={form}
            updateForm={updateForm}
          />
          <ResidualInput label="Transactions Per Month" field="transactionsPerMonth" form={form} updateForm={updateForm} />
          <ResidualInput label="Agent Profit" field="agentProfit" form={form} updateForm={updateForm} />
          <ResidualInput label="GreenHub POB Net Profit" field="greenhubPobNetProfit" form={form} updateForm={updateForm} />
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
                Review each agent&apos;s residuals, equipment costs, and POB reporting fields.
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
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[2100px] text-left text-xs text-slate-900">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="p-4">Merchant</th>
                <th className="px-3 py-3">Agent</th>
                <th className="px-3 py-3">Platform</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">GreenHub POB Buy Rate</th>
                <th className="px-3 py-3">Agent Commission Structure</th>
                <th className="px-3 py-3 text-right">Merchant Sales Volume</th>
                <th className="px-3 py-3 text-right">GreenHub Net Profit</th>
                <th className="px-3 py-3 text-right">Surcharge</th>
                <th className="px-3 py-3 text-right">Rebate to Merchant</th>
                <th className="px-3 py-3 text-right">Agent Profit Per Transaction</th>
                <th className="px-3 py-3 text-right">GreenHub POB Profit Per Transaction</th>
                <th className="px-3 py-3 text-right">Transactions per Month</th>
                <th className="px-3 py-3 text-right">Agent Profit</th>
                <th className="px-3 py-3 text-right">GreenHub POB Net Profit</th>
                <th className="px-3 py-3 text-right">Equipment Cost</th>
                <th className="px-3 py-3">Merchant Notes</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReportRows.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="p-4 font-semibold text-slate-950">{row.merchant}</td>
                  <td className="px-3 py-3">{row.agent}</td>
                  <td className="px-3 py-3">{row.platform}</td>
                  <td className="px-3 py-3"><ResidualStatus status={row.status} /></td>
                  <td className="px-3 py-3 text-right tabular-nums">{currency(row.greenhubPobBuyRate)}</td>
                  <td className="px-3 py-3">{row.agentCommissionStructure}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{currency(row.salesVolume)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{currency(row.greenhubNetProfit)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{currency(row.surcharge)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{currency(row.rebate)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{currency(row.profitPerTransaction)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{currency(row.greenhubPobProfitPerTransaction)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{row.transactionsPerMonth.toLocaleString()}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">{currency(row.agentProfit)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{currency(row.greenhubPobNetProfit)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{currency(row.equipmentCost)}</td>
                  <td className="max-w-64 px-3 py-3 text-slate-700">{row.merchantNotes || "—"}</td>
                </tr>
              ))}
              {filteredReportRows.length === 0 ? (
                <tr>
                  <td colSpan={17} className="px-5 py-10 text-center text-sm text-slate-600">
                    No residuals match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-300 bg-slate-50 p-5">
          <h3 className="text-sm font-semibold text-slate-950">Totals</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <TotalTile label="Total Merchant Sales Volume" value={currency(reportTotals.salesVolume)} />
            <TotalTile label="Total GreenHub Net Profit" value={currency(reportTotals.greenhubNetProfit)} />
            <TotalTile label="Total Transactions per Month" value={reportTotals.transactionsPerMonth.toLocaleString()} />
            <TotalTile label="Total Agent Profit" value={currency(reportTotals.agentProfit)} />
            <TotalTile label="Total GreenHub POB Net Profit" value={currency(reportTotals.greenhubPobNetProfit)} />
            <TotalTile label="Total Equipment Cost" value={currency(reportTotals.equipmentCost)} />
            <TotalTile label="Agent Profit Less Equipment" value={currency(reportTotals.agentProfit - reportTotals.equipmentCost)} />
          </div>
        </div>
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
  field,
  form,
  label,
  updateForm,
}: {
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
      className={portalInputClass}
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

function totalResiduals(rows: ResidualReportRow[]) {
  return rows.reduce(
    (totals, row) => ({
      agentProfit: totals.agentProfit + row.agentProfit,
      equipmentCost: totals.equipmentCost + row.equipmentCost,
      greenhubNetProfit: totals.greenhubNetProfit + row.greenhubNetProfit,
      greenhubPobNetProfit: totals.greenhubPobNetProfit + row.greenhubPobNetProfit,
      salesVolume: totals.salesVolume + row.salesVolume,
      transactionsPerMonth: totals.transactionsPerMonth + row.transactionsPerMonth,
    }),
    {
      agentProfit: 0,
      equipmentCost: 0,
      greenhubNetProfit: 0,
      greenhubPobNetProfit: 0,
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
    id: `${row.merchant}-${row.month}`,
    merchant: row.merchant,
    merchantNotes: row.notes,
    month: row.month,
    monthValue: reportMonthValue(row.month),
    platform: row.platform,
    profitPerTransaction: amount(row.profitPerTransaction),
    rebate: amount(row.rebate),
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
