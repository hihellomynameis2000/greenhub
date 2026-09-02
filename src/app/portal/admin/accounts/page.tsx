"use client";

import { useMemo, useState } from "react";
import { Archive, Pencil, Plus, Save, X } from "lucide-react";
import { accounts as demoAccounts, agents as demoAgents, platforms as demoPlatforms } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton, showPortalToast } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";
import type { MerchantAccount } from "@/lib/portal/types";

const initialForm = {
  accountName: "",
  assignedAgentId: "",
  commissionStructure: "",
  internalNotes: "",
  platformId: "",
  primaryAgentSplit: "100",
  secondaryAgentId: "",
  secondaryAgentSplit: "0",
  status: "active",
};

const initialAccountEdit = {
  accountName: "",
  assignedAgentId: "",
  platformId: "",
  primaryAgentSplit: "100",
  secondaryAgentId: "",
  secondaryAgentSplit: "0",
  status: "active",
};

type AccountEditForm = typeof initialAccountEdit;

function inputPercent(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value).replace(/%/g, "");
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
        (portfolioPlatform === "all" || account.platform_id === portfolioPlatform) &&
        (portfolioAgent === "all" ||
          account.assigned_agent_id === portfolioAgent ||
          account.secondary_agent_id === portfolioAgent)
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

    try {
      await portalRequest("/api/portal/accounts", {
        method: "POST",
        body: JSON.stringify(form),
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
    setEditingAccountId(account.id);
    setAccountEditForm({
      accountName: account.account_name,
      assignedAgentId: account.assigned_agent_id ?? "",
      platformId: account.platform_id ?? "",
      primaryAgentSplit: inputPercent(account.primary_agent_split, "100"),
      secondaryAgentId: account.secondary_agent_id ?? "",
      secondaryAgentSplit: inputPercent(account.secondary_agent_split, "0"),
      status: account.status ?? "active",
    });
  }

  function setAccountEditField(field: keyof AccountEditForm, value: string) {
    setAccountEditForm((current) => ({ ...current, [field]: value }));
  }

  async function saveAccountEdit(id: string) {
    if (!accountEditForm.accountName.trim()) {
      setError("Merchant name is required.");
      return;
    }

    setSavingAccountId(id);
    setError(null);

    try {
      await portalRequest("/api/portal/accounts", {
        method: "PATCH",
        body: JSON.stringify({
          assignedAgentId: accountEditForm.assignedAgentId,
          accountName: accountEditForm.accountName,
          id,
          platformId: accountEditForm.platformId,
          primaryAgentSplit: accountEditForm.primaryAgentSplit,
          secondaryAgentId: accountEditForm.secondaryAgentId,
          secondaryAgentSplit: accountEditForm.secondaryAgentId ? accountEditForm.secondaryAgentSplit : "0",
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
              onValueChange={(platformId) => setForm((current) => ({ ...current, platformId }))}
              options={[
                { disabled: true, label: "Select platform", value: "" },
                ...platformOptions,
              ]}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Primary agent
            <PortalSelect
              value={form.assignedAgentId}
              onValueChange={(assignedAgentId) =>
                setForm((current) => ({ ...current, assignedAgentId }))
              }
              options={[
                { disabled: true, label: "Assign agent", value: "" },
                ...agentOptions,
              ]}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Primary agent split
            <input
              className={portalInputClass}
              inputMode="decimal"
              placeholder="100"
              value={form.primaryAgentSplit}
              onChange={(event) =>
                setForm((current) => ({ ...current, primaryAgentSplit: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Sub-agent
            <PortalSelect
              value={form.secondaryAgentId}
              onValueChange={(secondaryAgentId) =>
                setForm((current) => ({
                  ...current,
                  secondaryAgentId,
                  secondaryAgentSplit: secondaryAgentId ? current.secondaryAgentSplit : "0",
                }))
              }
              options={[
                { label: "No sub-agent", value: "" },
                ...agentOptions.filter((agent) => agent.value !== form.assignedAgentId),
              ]}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Sub-agent split
            <input
              className={portalInputClass}
              inputMode="decimal"
              placeholder="0"
              value={form.secondaryAgentSplit}
              onChange={(event) =>
                setForm((current) => ({ ...current, secondaryAgentSplit: event.target.value }))
              }
            />
          </label>
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
                            <div className="grid min-w-72 gap-2">
                              <PortalSelect
                                ariaLabel="Edit primary agent"
                                value={accountEditForm.assignedAgentId}
                                onValueChange={(value) =>
                                  setAccountEditField("assignedAgentId", value)
                                }
                                options={[
                                  { disabled: true, label: "Assign agent", value: "" },
                                  ...agentOptions,
                                ]}
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  aria-label="Primary agent split"
                                  className={portalInputClass}
                                  inputMode="decimal"
                                  value={accountEditForm.primaryAgentSplit}
                                  onChange={(event) =>
                                    setAccountEditField("primaryAgentSplit", event.target.value)
                                  }
                                />
                                <input
                                  aria-label="Sub-agent split"
                                  className={portalInputClass}
                                  inputMode="decimal"
                                  value={accountEditForm.secondaryAgentSplit}
                                  onChange={(event) =>
                                    setAccountEditField("secondaryAgentSplit", event.target.value)
                                  }
                                />
                              </div>
                              <PortalSelect
                                ariaLabel="Edit sub-agent"
                                value={accountEditForm.secondaryAgentId}
                                onValueChange={(value) => setAccountEditField("secondaryAgentId", value)}
                                options={[
                                  { label: "No sub-agent", value: "" },
                                  ...agentOptions.filter((agent) => agent.value !== accountEditForm.assignedAgentId),
                                ]}
                              />
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
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => beginEditAccount(account)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                              aria-label={`Edit ${account.account_name}`}
                              title="Edit account"
                            >
                              <Pencil aria-hidden="true" className="h-4 w-4" />
                            </button>
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
  const primaryAgent = agentNames.get(account.assigned_agent_id ?? "") ?? "Unassigned";
  const primarySplit = inputPercent(account.primary_agent_split, "100");
  const secondaryAgent = account.secondary_agent_id
    ? agentNames.get(account.secondary_agent_id) ?? "Sub-agent"
    : null;
  const secondarySplit = inputPercent(account.secondary_agent_split, "0");

  return (
    <div className="space-y-1">
      <p className="font-semibold text-slate-900">
        {primaryAgent}
        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
          {primarySplit}%
        </span>
      </p>
      {secondaryAgent ? (
        <p className="text-xs font-medium text-slate-600">
          Sub-agent: {secondaryAgent}
          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
            {secondarySplit}%
          </span>
        </p>
      ) : null}
    </div>
  );
}
