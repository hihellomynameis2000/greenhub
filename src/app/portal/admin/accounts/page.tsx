"use client";

import { useMemo, useState } from "react";
import { Archive, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { accounts as demoAccounts, agents as demoAgents, platforms as demoPlatforms } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton, showPortalToast } from "@/components/portal/PortalToast";
import {
  type AccountSplitType,
  accountSplitAssignments,
  accountSplitType,
  readAccountSplitMeta,
  visibleAccountAgentIds,
} from "@/lib/portal/accountSplitMeta";
import { portalRequest } from "@/lib/portal/client";
import { inferredResidualPlatformType } from "@/lib/portal/residualType";
import type { MerchantAccount } from "@/lib/portal/types";

type SplitFormRow = {
  agentId: string;
  key: string;
  split: string;
};

const defaultSplitRows: SplitFormRow[] = [{ agentId: "", key: "primary", split: "100" }];

const initialForm = {
  accountName: "",
  agentSplits: defaultSplitRows,
  commissionStructure: "",
  internalNotes: "",
  platformId: "",
  splitType: "percent" as AccountSplitType,
  status: "active",
};

const initialAccountEdit = {
  accountName: "",
  agentSplits: defaultSplitRows,
  platformId: "",
  splitType: "percent" as AccountSplitType,
  status: "active",
};

type AccountEditForm = typeof initialAccountEdit;

function inputPercent(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(/%/g, "");
}

function splitRowKey() {
  return `split-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function splitRowsForAccount(account: MerchantAccount): SplitFormRow[] {
  const meta = readAccountSplitMeta(account.internal_notes, account);
  const rows = meta.agents.map((row, index) => ({
    agentId: row.agentId,
    key: index === 0 ? "primary" : `${row.agentId}-${index}`,
    split: inputPercent(row.split, index === 0 ? "100" : "0"),
  }));

  return rows.length ? rows : [{ agentId: account.assigned_agent_id ?? "", key: "primary", split: "100" }];
}

function payloadSplits(rows: SplitFormRow[]) {
  return rows
    .map((row) => ({ agentId: row.agentId, split: row.split }))
    .filter((row) => row.agentId);
}

function splitTypeLabel(type: AccountSplitType) {
  return type === "fixed" ? "$" : "%";
}

export default function AdminAccountsPage() {
  return (
    <PortalShell role="admin">
      <AdminAccountsContent />
    </PortalShell>
  );
}

function AdminAccountsContent() {
  const { data, refresh } = usePortalData();
  const [form, setForm] = useState(initialForm);
  const [platformName, setPlatformName] = useState("");
  const [previewPlatforms, setPreviewPlatforms] = useState(demoPlatforms);
  const [saving, setSaving] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const [portfolioPlatform, setPortfolioPlatform] = useState("all");
  const [portfolioAgent, setPortfolioAgent] = useState("all");
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountEditForm, setAccountEditForm] = useState<AccountEditForm>(initialAccountEdit);
  const [savingAccountId, setSavingAccountId] = useState<string | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const platformOptions = data
    ? data.platforms.map((platform) => ({ label: platform.name, value: platform.id }))
    : previewPlatforms.map((platform) => ({ label: platform, value: platform }));
  const agentOptions = data
    ? data.agents.map((agent) => ({ label: agent.name, value: agent.id }))
    : demoAgents.map((agent) => ({ label: agent.name, value: agent.email }));

  const platformNames = useMemo(
    () => new Map(data?.platforms.map((platform) => [platform.id, platform.name]) ?? []),
    [data?.platforms]
  );
  const agentNames = useMemo(
    () => new Map(data?.agents.map((agent) => [agent.id, agent.name]) ?? []),
    [data?.agents]
  );
  function defaultSplitTypeForPlatform(platformId: string): AccountSplitType {
    const platform = data?.platforms.find((item) => item.id === platformId);
    const residualType = platform?.residual_type ?? inferredResidualPlatformType(platform?.name ?? platformId);
    return residualType === "pob" ? "fixed" : "percent";
  }

  const portfolioPlatformOptions = [
    { label: "All platforms", value: "all" },
    ...platformOptions,
  ];
  const portfolioAgentOptions = [
    { label: "All agents", value: "all" },
    ...agentOptions,
  ];
  const filteredAccounts = useMemo(() => {
    if (!data) return [];
    return data.accounts.filter(
      (account) =>
        account.status !== "closed" &&
        (portfolioPlatform === "all" || account.platform_id === portfolioPlatform) &&
        (portfolioAgent === "all" || visibleAccountAgentIds(account).includes(portfolioAgent))
    );
  }, [data, portfolioAgent, portfolioPlatform]);
  const filteredDemoAccounts = useMemo(
    () =>
      demoAccounts.filter(
        (account) =>
          (portfolioPlatform === "all" || account.platform === portfolioPlatform) &&
          (portfolioAgent === "all" || account.agent === portfolioAgent)
      ),
    [portfolioAgent, portfolioPlatform]
  );

  async function saveAccount() {
    setSaving(true);
    setError(null);
    const agentSplits = payloadSplits(form.agentSplits);

    if (!agentSplits.length) {
      setError("Choose at least one agent for this account.");
      setSaving(false);
      return;
    }

    try {
      await portalRequest("/api/portal/accounts", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          agentSplits,
          assignedAgentId: agentSplits[0].agentId,
          primaryAgentSplit: agentSplits[0].split,
          secondaryAgentId: agentSplits[1]?.agentId ?? "",
          secondaryAgentSplit: agentSplits[1]?.split ?? "0",
        }),
      });
      setForm(initialForm);
      await refresh();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "The account could not be saved.";
      setError(message);
      throw requestError;
    } finally {
      setSaving(false);
    }
  }

  async function addPlatform() {
    const name = platformName.trim();
    if (!name) {
      setPlatformError("Platform name is required.");
      return;
    }

    setSavingPlatform(true);
    setPlatformError(null);

    try {
      if (data) {
        const result = await portalRequest<{ platform: { id: string; name: string } }>(
          "/api/portal/platforms",
          {
            method: "POST",
            body: JSON.stringify({ name }),
          }
        );
        setPlatformName("");
        setForm((current) => ({ ...current, platformId: result.platform.id }));
        await refresh();
      } else {
        setPreviewPlatforms((current) => {
          const exists = current.some((platform) => platform.toLowerCase() === name.toLowerCase());
          return exists ? current : [...current, name].sort((a, b) => a.localeCompare(b));
        });
        setPlatformName("");
        setForm((current) => ({ ...current, platformId: name }));
      }
    } catch (requestError) {
      setPlatformError(
        requestError instanceof Error ? requestError.message : "The platform could not be added."
      );
    } finally {
      setSavingPlatform(false);
    }
  }

  async function archivePlatform(id: string) {
    setSavingPlatform(true);
    setPlatformError(null);

    try {
      if (data) {
        await portalRequest(`/api/portal/platforms?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (form.platformId === id) setForm((current) => ({ ...current, platformId: "" }));
        if (portfolioPlatform === id) setPortfolioPlatform("all");
        await refresh();
      } else {
        setPreviewPlatforms((current) => current.filter((platform) => platform !== id));
        if (form.platformId === id) setForm((current) => ({ ...current, platformId: "" }));
        if (portfolioPlatform === id) setPortfolioPlatform("all");
      }
    } catch (requestError) {
      setPlatformError(
        requestError instanceof Error ? requestError.message : "The platform could not be archived."
      );
    } finally {
      setSavingPlatform(false);
    }
  }

  function beginEditAccount(account: MerchantAccount) {
    const meta = readAccountSplitMeta(account.internal_notes, account);
    setEditingAccountId(account.id);
    setAccountEditForm({
      accountName: account.account_name,
      agentSplits: splitRowsForAccount(account),
      platformId: account.platform_id ?? "",
      splitType: meta.splitType,
      status: account.status ?? "active",
    });
  }

  function setAccountEditField(field: Exclude<keyof AccountEditForm, "agentSplits">, value: string) {
    setAccountEditForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "platformId" ? { splitType: defaultSplitTypeForPlatform(value) } : {}),
    }));
  }

  function setFormPlatform(platformId: string) {
    setForm((current) => ({
      ...current,
      platformId,
      splitType: defaultSplitTypeForPlatform(platformId),
    }));
  }

  function setFormSplitRow(key: string, patch: Partial<SplitFormRow>) {
    setForm((current) => ({
      ...current,
      agentSplits: current.agentSplits.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }));
  }

  function addFormSplitRow() {
    setForm((current) => ({
      ...current,
      agentSplits: [...current.agentSplits, { agentId: "", key: splitRowKey(), split: "0" }],
    }));
  }

  function removeFormSplitRow(key: string) {
    setForm((current) => ({
      ...current,
      agentSplits:
        current.agentSplits.length > 1
          ? current.agentSplits.filter((row) => row.key !== key)
          : current.agentSplits,
    }));
  }

  function setEditSplitRow(key: string, patch: Partial<SplitFormRow>) {
    setAccountEditForm((current) => ({
      ...current,
      agentSplits: current.agentSplits.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    }));
  }

  function addEditSplitRow() {
    setAccountEditForm((current) => ({
      ...current,
      agentSplits: [...current.agentSplits, { agentId: "", key: splitRowKey(), split: "0" }],
    }));
  }

  function removeEditSplitRow(key: string) {
    setAccountEditForm((current) => ({
      ...current,
      agentSplits:
        current.agentSplits.length > 1
          ? current.agentSplits.filter((row) => row.key !== key)
          : current.agentSplits,
    }));
  }

  async function saveAccountEdit(id: string) {
    if (!accountEditForm.accountName.trim()) {
      setError("Merchant name is required.");
      return;
    }
    const agentSplits = payloadSplits(accountEditForm.agentSplits);

    if (!agentSplits.length) {
      setError("Choose at least one agent for this account.");
      return;
    }

    setSavingAccountId(id);
    setError(null);

    try {
      await portalRequest("/api/portal/accounts", {
        method: "PATCH",
        body: JSON.stringify({
          accountName: accountEditForm.accountName,
          agentSplits,
          id,
          platformId: accountEditForm.platformId,
          assignedAgentId: agentSplits[0].agentId,
          primaryAgentSplit: agentSplits[0].split,
          secondaryAgentId: agentSplits[1]?.agentId ?? "",
          secondaryAgentSplit: agentSplits[1]?.split ?? "0",
          splitType: accountEditForm.splitType,
          status: accountEditForm.status,
        }),
      });
      setEditingAccountId(null);
      await refresh();
      showPortalToast({ title: "Account updated", message: "The merchant account was saved." });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The account could not be updated.");
    } finally {
      setSavingAccountId(null);
    }
  }

  async function deleteAccount(account: MerchantAccount) {
    setDeletingAccountId(account.id);
    setError(null);

    try {
      const result = await portalRequest<{ archived: boolean }>(
        `/api/portal/accounts?id=${encodeURIComponent(account.id)}`,
        { method: "DELETE" }
      );
      if (editingAccountId === account.id) setEditingAccountId(null);
      await refresh();
      showPortalToast({
        title: result.archived ? "Account archived" : "Account deleted",
        message: `${account.account_name} was removed from the active account list.`,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The account could not be deleted.");
    } finally {
      setDeletingAccountId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Merchant Accounts"
        subtitle="Assign accounts to agents, platforms, and statuses."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <section className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
          <div className="mb-5 border-b border-slate-200 pb-5">
            <h2 className="text-lg font-semibold text-slate-950">Add Merchant Account</h2>
            <p className="mt-1 text-sm text-slate-700">
              Set the operating details that appear in portfolio reporting.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Merchant name
            <input
              className={portalInputClass}
              placeholder="Merchant name"
              value={form.accountName}
              onChange={(event) =>
                setForm((current) => ({ ...current, accountName: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Processing platform
            <PortalSelect
              value={form.platformId}
              onValueChange={setFormPlatform}
              options={[
                { disabled: true, label: "Select platform", value: "" },
                ...platformOptions,
              ]}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Split mode
            <PortalSelect
              value={form.splitType}
              onValueChange={(splitType) =>
                setForm((current) => ({ ...current, splitType: splitType as AccountSplitType }))
              }
              options={[
                { label: "Percent split", value: "percent" },
                { label: "Fixed dollar split", value: "fixed" },
              ]}
            />
          </label>
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:col-span-2 xl:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Agent splits</p>
              <button
                type="button"
                onClick={addFormSplitRow}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                Add agent
              </button>
            </div>
            {form.agentSplits.map((row, index) => (
              <div key={row.key} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_36px]">
                <PortalSelect
                  ariaLabel={`${index === 0 ? "Primary" : "Additional"} agent`}
                  value={row.agentId}
                  onValueChange={(agentId) => setFormSplitRow(row.key, { agentId })}
                  options={[
                    { disabled: true, label: index === 0 ? "Primary agent" : "Additional agent", value: "" },
                    ...agentOptions.filter(
                      (agent) =>
                        agent.value === row.agentId ||
                        !form.agentSplits.some((splitRow) => splitRow.key !== row.key && splitRow.agentId === agent.value)
                    ),
                  ]}
                />
                <input
                  aria-label={`${index === 0 ? "Primary" : "Additional"} agent split`}
                  className={portalInputClass}
                  inputMode="decimal"
                  placeholder={form.splitType === "fixed" ? "0.25" : "50"}
                  value={row.split}
                  onChange={(event) => setFormSplitRow(row.key, { split: event.target.value })}
                />
                <button
                  type="button"
                  disabled={form.agentSplits.length === 1}
                  onClick={() => removeFormSplitRow(row.key)}
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Remove agent split"
                  title="Remove agent"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            ))}
            <p className="text-xs font-medium text-slate-500">
              {form.splitType === "fixed"
                ? "POB accounts use fixed dollar amounts per transaction."
                : "CC accounts use percentages of gross profit."}
            </p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Account status
            <PortalSelect
              value={form.status}
              onValueChange={(status) => setForm((current) => ({ ...current, status }))}
              options={[
                { label: "Active", value: "active" },
                { label: "Paused", value: "paused" },
                { label: "Closed", value: "closed" },
              ]}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">
            Commission / split notes
            <input
              className={portalInputClass}
              placeholder="20%, 80%, Nick(25%), 50% over $1.35 buy rate"
              value={form.commissionStructure}
              onChange={(event) =>
                setForm((current) => ({ ...current, commissionStructure: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-3">
            Internal notes
            <textarea
              className={portalInputClass}
              placeholder="Internal notes - admin only"
              rows={3}
              value={form.internalNotes}
              onChange={(event) =>
                setForm((current) => ({ ...current, internalNotes: event.target.value }))
              }
            />
          </label>
          </div>

          {error ? <p className="mt-4 text-sm font-medium text-rose-700">{error}</p> : null}

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <p className="text-xs font-medium text-slate-500">
              Account ownership can be edited later from the portfolio table.
            </p>
            <PortalActionButton
              type="button"
              disabled={saving}
              onClick={saveAccount}
              toastTitle="Account saved"
              toastMessage="The merchant account has been saved."
              className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Account"}
            </PortalActionButton>
          </div>
        </section>

        <aside className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-950">Platform Shortcuts</h2>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                Add quick processing options for account setup.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {platformOptions.length}
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            <input
              className={portalInputClass}
              placeholder="Ellacash, Greenway POB, Paynex"
              value={platformName}
              onChange={(event) => setPlatformName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addPlatform();
                }
              }}
            />
            <button
              type="button"
              disabled={savingPlatform}
              onClick={() => void addPlatform()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              {savingPlatform ? "Adding..." : "Add Platform"}
            </button>
          </div>

          {platformError ? (
            <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {platformError}
            </p>
          ) : null}

          <div className="mt-4 max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            {platformOptions.map((platform) => (
              <div
                key={platform.value}
                className="flex items-center justify-between gap-3 border-b border-slate-200 px-3 py-2.5 last:border-b-0"
              >
                <span className="min-w-0 truncate text-sm font-medium text-slate-800">
                  {platform.label}
                </span>
                <button
                  type="button"
                  disabled={savingPlatform}
                  onClick={() => void archivePlatform(platform.value)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Archive ${platform.label}`}
                  title="Archive platform"
                >
                  <Archive aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-300 p-5">
          <h2 className="text-lg font-semibold text-slate-950">Merchant Portfolio</h2>
          <p className="mt-1 text-sm text-slate-700">
            Current accounts, platform assignments, and agent ownership.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm text-slate-900">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold">Merchant</th>
                <th className="px-4 py-3 font-semibold">
                  <PortalSelect
                    ariaLabel="Filter merchant portfolio by platform"
                    value={portfolioPlatform}
                    onValueChange={setPortfolioPlatform}
                    options={portfolioPlatformOptions}
                    className="py-1.5 text-xs font-semibold"
                  />
                </th>
                <th className="px-4 py-3 font-semibold">
                  <PortalSelect
                    ariaLabel="Filter merchant portfolio by agent ownership"
                    value={portfolioAgent}
                    onValueChange={setPortfolioAgent}
                    options={portfolioAgentOptions}
                    className="py-1.5 text-xs font-semibold"
                  />
                </th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data
                ? filteredAccounts.map((account) => {
                    const editing = editingAccountId === account.id;

                    return (
                      <tr key={account.id} className="border-t border-slate-300 hover:bg-slate-50">
                        <td className="px-5 py-3.5 font-semibold text-slate-950">
                          {editing ? (
                            <input
                              className={portalInputClass}
                              value={accountEditForm.accountName}
                              onChange={(event) =>
                                setAccountEditField("accountName", event.target.value)
                              }
                            />
                          ) : (
                            account.account_name
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {editing ? (
                            <PortalSelect
                              ariaLabel="Edit processing platform"
                              value={accountEditForm.platformId}
                              onValueChange={(value) => setAccountEditField("platformId", value)}
                              options={[
                                { disabled: true, label: "Select platform", value: "" },
                                ...platformOptions,
                              ]}
                            />
                          ) : (
                            platformNames.get(account.platform_id ?? "") ?? "Unassigned"
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          {editing ? (
                            <div className="grid min-w-[360px] gap-2">
                              <PortalSelect
                                ariaLabel="Edit account split mode"
                                value={accountEditForm.splitType}
                                onValueChange={(value) =>
                                  setAccountEditField("splitType", value as AccountSplitType)
                                }
                                options={[
                                  { label: "Percent split", value: "percent" },
                                  { label: "Fixed dollar split", value: "fixed" },
                                ]}
                              />
                              {accountEditForm.agentSplits.map((row, index) => (
                                <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_86px_32px] gap-2">
                                  <PortalSelect
                                    ariaLabel={`${index === 0 ? "Primary" : "Additional"} agent`}
                                    value={row.agentId}
                                    onValueChange={(value) => setEditSplitRow(row.key, { agentId: value })}
                                    options={[
                                      { disabled: true, label: index === 0 ? "Primary agent" : "Additional agent", value: "" },
                                      ...agentOptions.filter(
                                        (agent) =>
                                          agent.value === row.agentId ||
                                          !accountEditForm.agentSplits.some(
                                            (splitRow) => splitRow.key !== row.key && splitRow.agentId === agent.value
                                          )
                                      ),
                                    ]}
                                  />
                                  <input
                                    aria-label={`${index === 0 ? "Primary" : "Additional"} split`}
                                    className={portalInputClass}
                                    inputMode="decimal"
                                    value={row.split}
                                    onChange={(event) => setEditSplitRow(row.key, { split: event.target.value })}
                                  />
                                  <button
                                    type="button"
                                    disabled={accountEditForm.agentSplits.length === 1}
                                    onClick={() => removeEditSplitRow(row.key)}
                                    className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    aria-label="Remove agent split"
                                    title="Remove agent"
                                  >
                                    <X aria-hidden="true" className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={addEditSplitRow}
                                className="inline-flex h-8 w-fit items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                <Plus aria-hidden="true" className="h-3.5 w-3.5" />
                                Add agent
                              </button>
                            </div>
                          ) : (
                            <AccountOwnership
                              account={account}
                              agentNames={agentNames}
                            />
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {editing ? (
                            <PortalSelect
                              ariaLabel="Edit account status"
                              value={accountEditForm.status}
                              onValueChange={(value) => setAccountEditField("status", value)}
                              options={[
                                { label: "Active", value: "active" },
                                { label: "Paused", value: "paused" },
                                { label: "Closed", value: "closed" },
                              ]}
                            />
                          ) : (
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                account.status === "active"
                                  ? "bg-emerald-100 text-emerald-900"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {account.status}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {editing ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={savingAccountId === account.id}
                                onClick={() => void saveAccountEdit(account.id)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-800 text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label="Save account changes"
                                title="Save changes"
                              >
                                <Save aria-hidden="true" className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={savingAccountId === account.id}
                                onClick={() => setEditingAccountId(null)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label="Cancel account edit"
                                title="Cancel"
                              >
                                <X aria-hidden="true" className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={deletingAccountId === account.id || savingAccountId === account.id}
                                onClick={() => void deleteAccount(account)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label={`Delete ${account.account_name}`}
                                title="Delete account"
                              >
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => beginEditAccount(account)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                aria-label={`Edit ${account.account_name}`}
                                title="Edit account"
                              >
                                <Pencil aria-hidden="true" className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                disabled={deletingAccountId === account.id}
                                onClick={() => void deleteAccount(account)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                                aria-label={`Delete ${account.account_name}`}
                                title="Delete account"
                              >
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                : filteredDemoAccounts.map((account) => (
                    <tr key={account.merchant} className="border-t border-slate-300 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-semibold text-slate-950">{account.merchant}</td>
                      <td className="px-4 py-3.5">{account.platform}</td>
                      <td className="px-4 py-3.5">{account.agent}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            account.status === "Active"
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {account.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">Preview</td>
                    </tr>
                  ))}
              {(data ? filteredAccounts.length : filteredDemoAccounts.length) === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-600">
                    No merchant accounts match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AccountOwnership({
  account,
  agentNames,
}: {
  account: MerchantAccount;
  agentNames: Map<string, string>;
}) {
  const assignments = accountSplitAssignments(account);
  const splitType = accountSplitType(account);
  const unit = splitTypeLabel(splitType);

  return (
    <div className="space-y-1">
      {assignments.length ? (
        assignments.map((row, index) => (
          <p
            key={`${row.agentId}-${index}`}
            className={index === 0 ? "font-semibold text-slate-900" : "text-xs font-medium text-slate-600"}
          >
            {index === 0 ? "" : "Sub-agent: "}
            {agentNames.get(row.agentId) ?? "Unassigned"}
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${
                index === 0 ? "bg-slate-100 text-slate-700" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {splitType === "fixed" ? `$${row.split}` : `${row.split}${unit}`}
            </span>
          </p>
        ))
      ) : (
        <p className="font-semibold text-slate-900">Unassigned</p>
      )}
    </div>
  );
}
