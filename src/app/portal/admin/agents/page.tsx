"use client";

import { useState } from "react";
import { agents as demoAgents } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";

const initialForm = {
  commissionRate: "20",
  email: "",
  name: "",
  role: "agent",
  status: "active",
};

function commissionLabel(value: number | string | null) {
  const numeric = Number(value ?? 0);
  return `${Number.isFinite(numeric) ? numeric : 0}%`;
}

export default function AdminAgentsPage() {
  return (
    <PortalShell role="admin">
      <AdminAgentsContent />
    </PortalShell>
  );
}

function AdminAgentsContent() {
  const { data, refresh } = usePortalData();
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const agentRows = data?.agents ?? demoAgents;

  async function addAgent() {
    setSaving(true);
    setError(null);

    try {
      await portalRequest("/api/portal/agents", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(initialForm);
      await refresh();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "The agent could not be added.";
      setError(message);
      throw requestError;
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Agents"
        subtitle="Create, manage, and assign commission rates to agents."
      />

      <section className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-950">Add Agent</h2>
          <p className="mt-1 text-sm text-slate-700">
            Create a portal profile and send an invitation to the agent.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Full name
            <input
              className={portalInputClass}
              placeholder="Agent name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Email address
            <input
              className={portalInputClass}
              placeholder="agent@greenhubinc.com"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Role
            <PortalSelect
              value={form.role}
              onValueChange={(role) => setForm((current) => ({ ...current, role }))}
              options={[
                { label: "Agent", value: "agent" },
                { label: "Admin", value: "admin" },
              ]}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Commission rate
            <input
              className={portalInputClass}
              inputMode="decimal"
              placeholder="20"
              value={form.commissionRate}
              onChange={(event) =>
                setForm((current) => ({ ...current, commissionRate: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
            Status
            <PortalSelect
              value={form.status}
              onValueChange={(status) => setForm((current) => ({ ...current, status }))}
              options={[
                { label: "Active", value: "active" },
                { label: "Inactive", value: "inactive" },
              ]}
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 text-sm font-medium text-rose-700">{error}</p>
        ) : null}

        <PortalActionButton
          type="button"
          disabled={saving}
          onClick={addAgent}
          toastTitle="Agent added"
          toastMessage="The agent profile was created and an invitation was sent."
          className="mt-5 rounded-xl bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Sending invitation..." : "Add Agent"}
        </PortalActionButton>
      </section>

      <section className="mt-6 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-300 p-5">
          <h2 className="text-lg font-semibold text-slate-950">Agent Directory</h2>
          <p className="mt-1 text-sm text-slate-700">
            Active portal users and their current commission settings.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm text-slate-900">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Commission</th>
              </tr>
            </thead>
            <tbody>
              {agentRows.map((agent) => {
                const liveAgent = "commission_rate" in agent;
                const status = liveAgent ? agent.status : agent.status.toLowerCase();
                const role = liveAgent ? agent.role : agent.role.toLowerCase();
                const commission = liveAgent
                  ? commissionLabel(agent.commission_rate)
                  : agent.commission;

                return (
                  <tr
                    key={agent.email}
                    className="border-t border-slate-300 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3.5 font-semibold text-slate-950">{agent.name}</td>
                    <td className="px-4 py-3.5">{agent.email}</td>
                    <td className="px-4 py-3.5 capitalize">{role}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          status === "active"
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                      {commission}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
