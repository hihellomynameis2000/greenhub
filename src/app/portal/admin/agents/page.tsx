"use client";

import { Fragment, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { agents as demoAgents } from "@/components/portal/mockData";
import { usePortalData } from "@/components/portal/PortalDataProvider";
import { PageHeader, PortalShell, portalInputClass } from "@/components/portal/PortalShell";
import { PortalSelect } from "@/components/portal/PortalSelect";
import { PortalActionButton, showPortalToast } from "@/components/portal/PortalToast";
import { portalRequest } from "@/lib/portal/client";
import type { AgentProfile } from "@/lib/portal/types";

const initialForm = {
  commissionRate: "20",
  email: "",
  name: "",
  role: "agent",
  status: "active",
};

type AgentForm = typeof initialForm;

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AgentForm>(initialForm);
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
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

  function beginEdit(agent: AgentProfile) {
    setDirectoryError(null);
    setDeleteCandidateId(null);
    setEditingId(agent.id);
    setEditForm({
      commissionRate: String(agent.commission_rate ?? 0),
      email: agent.email,
      name: agent.name,
      role: agent.role,
      status: agent.status,
    });
  }

  async function saveAgent() {
    if (!editingId) return;

    setSavingAgentId(editingId);
    setDirectoryError(null);

    try {
      await portalRequest("/api/portal/agents", {
        method: "PATCH",
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      setEditingId(null);
      await refresh();
      showPortalToast({
        title: "Agent updated",
        message: "The agent profile and commission rate were saved.",
      });
    } catch (requestError) {
      setDirectoryError(
        requestError instanceof Error ? requestError.message : "The agent could not be updated."
      );
    } finally {
      setSavingAgentId(null);
    }
  }

  async function deleteAgent(id: string) {
    setSavingAgentId(id);
    setDirectoryError(null);

    try {
      await portalRequest("/api/portal/agents", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      setDeleteCandidateId(null);
      await refresh();
      showPortalToast({
        title: "Agent deleted",
        message: "The portal profile was removed.",
      });
    } catch (requestError) {
      setDirectoryError(
        requestError instanceof Error ? requestError.message : "The agent could not be deleted."
      );
    } finally {
      setSavingAgentId(null);
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
          {directoryError ? (
            <p className="mt-3 text-sm font-medium text-rose-700">{directoryError}</p>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm text-slate-900">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
              <tr>
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 text-right font-semibold">Commission</th>
                <th className="w-32 px-5 py-3 text-right font-semibold">Actions</th>
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
                  <Fragment key={agent.email}>
                    <tr className="border-t border-slate-300 hover:bg-slate-50">
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
                    <td className="px-5 py-3.5">
                      {liveAgent ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            aria-label={`Edit ${agent.name}`}
                            title="Edit agent"
                            onClick={() => beginEdit(agent)}
                            disabled={savingAgentId === agent.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Pencil aria-hidden="true" className="h-4 w-4" />
                          </button>
                          {deleteCandidateId === agent.id ? (
                            <>
                              <button
                                type="button"
                                aria-label={`Confirm deletion of ${agent.name}`}
                                title="Confirm deletion"
                                onClick={() => deleteAgent(agent.id)}
                                disabled={savingAgentId === agent.id}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-rose-600 text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Check aria-hidden="true" className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="Cancel deletion"
                                title="Cancel"
                                onClick={() => setDeleteCandidateId(null)}
                                disabled={savingAgentId === agent.id}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <X aria-hidden="true" className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              aria-label={`Delete ${agent.name}`}
                              title="Delete agent"
                              onClick={() => {
                                setEditingId(null);
                                setDirectoryError(null);
                                setDeleteCandidateId(agent.id);
                              }}
                              disabled={agent.id === data?.profile.id || savingAgentId === agent.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Preview</span>
                      )}
                    </td>
                    </tr>
                    {liveAgent && editingId === agent.id ? (
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td colSpan={6} className="px-5 py-4">
                        <div className="grid gap-4 lg:grid-cols-5">
                          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                            Full name
                            <input
                              className={portalInputClass}
                              value={editForm.name}
                              onChange={(event) =>
                                setEditForm((current) => ({ ...current, name: event.target.value }))
                              }
                            />
                          </label>
                          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                            Email address
                            <input
                              className={portalInputClass}
                              type="email"
                              value={editForm.email}
                              onChange={(event) =>
                                setEditForm((current) => ({ ...current, email: event.target.value }))
                              }
                            />
                          </label>
                          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                            Role
                            <PortalSelect
                              value={editForm.role}
                              onValueChange={(role) =>
                                setEditForm((current) => ({ ...current, role }))
                              }
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
                              value={editForm.commissionRate}
                              onChange={(event) =>
                                setEditForm((current) => ({
                                  ...current,
                                  commissionRate: event.target.value,
                                }))
                              }
                            />
                          </label>
                          <label className="grid gap-1.5 text-sm font-medium text-slate-700">
                            Status
                            <PortalSelect
                              value={editForm.status}
                              onValueChange={(status) =>
                                setEditForm((current) => ({ ...current, status }))
                              }
                              options={[
                                { label: "Active", value: "active" },
                                { label: "Inactive", value: "inactive" },
                              ]}
                            />
                          </label>
                        </div>
                        <div className="mt-4 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            disabled={savingAgentId === agent.id}
                            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={saveAgent}
                            disabled={savingAgentId === agent.id}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Check aria-hidden="true" className="h-4 w-4" />
                            {savingAgentId === agent.id ? "Saving..." : "Save changes"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
