"use client";

import { useMemo, useState } from "react";
import { accounts as demoAccounts, agents as demoAgents, platforms as demoPlatforms } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";

const initialForm = {
  accountName: "",
  assignedAgentId: "",
  commissionStructure: "",
  internalNotes: "",
  platformId: "",
  status: "active",
};

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const platformOptions = data
    ? data.platforms.map((platform) => ({ label: platform.name, value: platform.id }))
    : demoPlatforms.map((platform) => ({ label: platform, value: platform }));
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

  return (
    <>
      <PageHeader
        title="Merchant Accounts"
        subtitle="Assign accounts to agents, platforms, and statuses."
      />

      <section className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <div className="mb-5">
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
            Assigned agent
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
            Commission structure
            <input
              className={portalInputClass}
              placeholder="Commission structure"
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

        <PortalActionButton
          type="button"
          disabled={saving}
          onClick={saveAccount}
          toastTitle="Account saved"
          toastMessage="The merchant account has been saved."
          className="mt-5 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving account..." : "Save Account"}
        </PortalActionButton>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-300 p-5">
          <h2 className="text-lg font-semibold text-slate-950">Merchant Portfolio</h2>
          <p className="mt-1 text-sm text-slate-700">
            Current accounts, platform assignments, and agent ownership.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm text-slate-900">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold">Merchant</th>
                <th className="px-4 py-3 font-semibold">Platform</th>
                <th className="px-4 py-3 font-semibold">Agent</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data
                ? data.accounts.map((account) => (
                    <tr key={account.id} className="border-t border-slate-300 hover:bg-slate-50">
                      <td className="px-5 py-3.5 font-semibold text-slate-950">
                        {account.account_name}
                      </td>
                      <td className="px-4 py-3.5">
                        {platformNames.get(account.platform_id ?? "") ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3.5">
                        {agentNames.get(account.assigned_agent_id ?? "") ?? "Unassigned"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            account.status === "active"
                              ? "bg-emerald-100 text-emerald-900"
                              : "bg-amber-100 text-amber-900"
                          }`}
                        >
                          {account.status}
                        </span>
                      </td>
                    </tr>
                  ))
                : demoAccounts.map((account) => (
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
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
