"use client";

import { Bell, ChevronDown, FileText, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { accounts as demoAccounts, agents as demoAgents, platforms as demoPlatforms } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
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

type ResidualForm = {
  agentId: string;
  agentProfit: string;
  equipmentCost: string;
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

const initialForm: ResidualForm = {
  agentId: "",
  agentProfit: "",
  equipmentCost: "",
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
      agentId: "nick@greenhubinc.com",
      agentProfit: "$1,020.79",
      equipmentCost: "$250.00",
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
      agentId: "rob@paynex.net",
      agentProfit: "$332.58",
      equipmentCost: "$200.00",
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

function inputValue(value: number | string | null) {
  return value === null || value === undefined ? "" : String(value);
}

function currency(value: number | string | null) {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numeric) ? numeric : 0);
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
      agentId: form.agentId,
      agentProfit: form.agentProfit,
      equipmentCost: form.equipmentCost,
      greenhubNetProfit: form.netProfit,
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

  const rows = data?.residuals ?? [];

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
          <ResidualInput label="Monthly Sales Volume" field="monthlySalesVolume" form={form} updateForm={updateForm} />
          <ResidualInput label="GreenHub Net Profit" field="netProfit" form={form} updateForm={updateForm} />
          <ResidualInput label="Surcharge" field="surcharge" form={form} updateForm={updateForm} />
          <ResidualInput label="Rebate" field="rebate" form={form} updateForm={updateForm} />
          <ResidualInput label="Profit Per Transaction" field="profitPerTransaction" form={form} updateForm={updateForm} />
          <ResidualInput label="Transactions Per Month" field="transactionsPerMonth" form={form} updateForm={updateForm} />
          <ResidualInput label="Agent Profit" field="agentProfit" form={form} updateForm={updateForm} />
          <ResidualInput label="Equipment Cost" field="equipmentCost" form={form} updateForm={updateForm} />
          <ResidualInput label="One-Time Fees" field="oneTimeFees" form={form} updateForm={updateForm} />
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
          <h2 className="font-semibold text-slate-950">Recent Residual Entries</h2>
          <p className="mt-1 text-sm text-slate-700">
            Latest monthly entries across agents and accounts.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm text-slate-900">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="p-4">Merchant</th>
                <th>Agent</th>
                <th>Platform</th>
                <th>Month</th>
                <th>Volume</th>
                <th>Net Profit</th>
                <th>Agent Profit</th>
                <th>Equipment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data
                ? rows.map((residual) => (
                    <tr key={residual.id} className="border-t border-slate-200">
                      <td className="p-4 font-semibold text-slate-950">
                        {accountNames.get(residual.merchant_account_id) ?? "Unknown account"}
                      </td>
                      <td>{agentNames.get(residual.agent_id) ?? "Unknown agent"}</td>
                      <td>{platformNames.get(residual.platform_id ?? "") ?? "Unassigned"}</td>
                      <td>{`${months[residual.residual_month - 1]} ${residual.residual_year}`}</td>
                      <td>{currency(residual.monthly_sales_volume)}</td>
                      <td>{currency(residual.greenhub_net_profit)}</td>
                      <td>{currency(residual.agent_profit)}</td>
                      <td>{currency(residual.equipment_cost)}</td>
                      <td><ResidualStatus status={residual.residual_status} /></td>
                    </tr>
                  ))
                : demoResidualRows.map((row) => (
                    <tr key={`${row.merchant}-${row.month}`} className="border-t border-slate-200">
                      <td className="p-4 font-semibold text-slate-950">{row.merchant}</td>
                      <td>{row.agent}</td>
                      <td>{row.platform}</td>
                      <td>{row.month}</td>
                      <td>{row.volume}</td>
                      <td>{row.netProfit}</td>
                      <td>{row.agentProfit}</td>
                      <td>{row.equipment}</td>
                      <td><ResidualStatus status={row.status.toLowerCase() as "draft" | "finalized"} /></td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function formFromResidual(residual: MonthlyResidual): ResidualForm {
  return {
    agentId: residual.agent_id,
    agentProfit: inputValue(residual.agent_profit),
    equipmentCost: inputValue(residual.equipment_cost),
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

const demoResidualRows = [
  {
    merchant: "Resource Group",
    agent: "Nicholas Sanchez",
    platform: "Best Rate - Nuvei",
    month: "April 2024",
    volume: "$54,595",
    netProfit: "$2,041.56",
    agentProfit: "$1,020.79",
    equipment: "$250.00",
    status: "Finalized",
  },
  {
    merchant: "Urbana Cafe",
    agent: "Rob Sinn",
    platform: "ElitePay - AUX",
    month: "April 2024",
    volume: "$34,220",
    netProfit: "$1,066.15",
    agentProfit: "$332.58",
    equipment: "$200.00",
    status: "Draft",
  },
];
